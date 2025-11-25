import { ref } from 'vue';

/**
 * Streaming response composable
 *
 * Handles the core streaming logic for chat responses.
 * Extracted from ChatView.vue to reduce file size.
 */
export function useStreaming() {
  // Streaming state
  const isStreaming = ref(false);
  const streamingContent = ref('');
  const abortController = ref(null);
  const isGeneratingSwipe = ref(false);
  const generatingSwipeIndex = ref(null);
  const currentToolCall = ref(null);
  const toolCallStartTime = ref(null);
  const toolCallElapsedTime = ref(0);
  const pendingImages = ref(null);

  let toolCallTimerInterval = null;

  /**
   * Start the tool call elapsed time timer
   */
  function startToolCallTimer() {
    toolCallElapsedTime.value = 0;
    toolCallTimerInterval = setInterval(() => {
      if (toolCallStartTime.value) {
        toolCallElapsedTime.value = Date.now() - toolCallStartTime.value;
      }
    }, 100);
  }

  /**
   * Stop the tool call timer
   */
  function stopToolCallTimer() {
    if (toolCallTimerInterval) {
      clearInterval(toolCallTimerInterval);
      toolCallTimerInterval = null;
    }
    toolCallElapsedTime.value = 0;
  }

  /**
   * Format elapsed time for display
   */
  function formatElapsedTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Stop an in-progress stream
   */
  function stopStream() {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
  }

  /**
   * Reset streaming state
   */
  function resetStreamingState() {
    streamingContent.value = '';
    isStreaming.value = false;
    isGeneratingSwipe.value = false;
    generatingSwipeIndex.value = null;
    currentToolCall.value = null;
    toolCallStartTime.value = null;
    stopToolCallTimer();
    pendingImages.value = null;
  }

  /**
   * Stream a response from the API
   *
   * @param {object} options - Streaming options
   * @param {array} options.messages - Context messages to send
   * @param {object} options.settings - Model settings (model, temperature, etc.)
   * @param {array} options.lorebookFilenames - Active lorebook filenames
   * @param {object} options.macroContext - Macro replacement context
   * @param {array} options.tools - Tool schemas (optional)
   * @param {object} callbacks - Callback functions
   * @param {function} callbacks.onContent - Called when content is received
   * @param {function} callbacks.onDone - Called when streaming completes
   * @param {function} callbacks.onError - Called on error
   * @param {function} callbacks.onDebug - Called with debug info
   * @param {function} callbacks.onToolStart - Called when tool starts
   * @param {function} callbacks.onToolResult - Called with tool result
   * @param {function} callbacks.onImages - Called when images are received
   */
  async function streamResponse(options, callbacks = {}) {
    const {
      messages,
      settings,
      lorebookFilenames = [],
      macroContext = {},
      tools = null
    } = options;

    const {
      onContent = () => {},
      onDone = () => {},
      onError = () => {},
      onDebug = () => {},
      onToolStart = () => {},
      onToolResult = () => {},
      onImages = () => {}
    } = callbacks;

    // Create AbortController for this request
    abortController.value = new AbortController();
    isStreaming.value = true;
    streamingContent.value = '';

    const requestBody = {
      messages,
      model: settings.model,
      options: {
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        top_p: settings.top_p,
        top_k: settings.top_k
      },
      context: macroContext,
      promptProcessing: settings.prompt_processing || 'merge_system',
      lorebookFilenames,
      stoppingStrings: settings.stopping_strings || ['[User]'],
      debug: true
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortController.value.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              const hasContent = streamingContent.value && streamingContent.value.trim().length > 0;

              if (!hasContent) {
                resetStreamingState();
                onError(new Error('Received empty response'));
                return { success: false, empty: true };
              }

              const content = streamingContent.value;
              const images = pendingImages.value;
              resetStreamingState();
              onDone({ content, images });
              return { success: true, content, images };
            }

            try {
              const parsed = JSON.parse(data);

              // Handle error from server
              if (parsed.error) {
                resetStreamingState();
                onError(new Error(parsed.error));
                return { success: false, error: parsed.error };
              }

              // Handle different message types
              if (parsed.type === 'debug') {
                onDebug(parsed.debug);
              } else if (parsed.type === 'tool_call_start') {
                currentToolCall.value = parsed.toolName;
                toolCallStartTime.value = Date.now();
                startToolCallTimer();
                onToolStart(parsed.toolName);
              } else if (parsed.type === 'tool_call') {
                // Full tool call notification - indicator should already be showing
              } else if (parsed.type === 'tool_result') {
                // Ensure indicator is visible for at least 500ms
                const elapsedTime = Date.now() - (toolCallStartTime.value || 0);
                const minDisplayTime = 500;
                const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

                setTimeout(() => {
                  currentToolCall.value = null;
                  stopToolCallTimer();
                }, remainingTime);

                const resultContent = formatToolResult(parsed.result);
                streamingContent.value += resultContent;
                onToolResult(parsed.result, resultContent);
              } else if (parsed.type === 'tool_error') {
                const errorContent = `\n\n✗ Error executing tool: ${parsed.error}\n\n`;
                streamingContent.value += errorContent;
                onError(new Error(parsed.error));
              } else if (parsed.type === 'images') {
                pendingImages.value = parsed.images;
                onImages(parsed.images);
              } else if (parsed.content) {
                streamingContent.value += parsed.content;
                onContent(parsed.content, streamingContent.value);
              }
            } catch (e) {
              if (!data.trim()) continue;
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled - return partial content if any
        const content = streamingContent.value;
        const hasContent = content && content.trim().length > 0;
        resetStreamingState();
        return { success: false, aborted: true, content: hasContent ? content : null };
      }

      resetStreamingState();
      onError(error);
      throw error;
    }
  }

  /**
   * Format tool result for display
   */
  function formatToolResult(result) {
    if (result.success) {
      if (result.name && result.filename && result.details) {
        // create_character_card response
        return `\n\n✓ **create_character_card succeeded!**\n\n` +
          `**Character Name:** ${result.name}\n` +
          `**Filename:** \`${result.filename}\`\n\n` +
          `*${result.details}*\n\n`;
      } else if (result.addedGreetings && result.characterName) {
        // add_greetings response
        let msg = `\n\n✓ **add_greetings succeeded!**\n\n` +
          `**Character:** ${result.characterName}\n` +
          `**Added ${result.addedCount} greeting(s)** (Total: ${result.totalGreetings})\n\n`;
        result.addedGreetings.forEach((greeting, idx) => {
          if (result.addedCount > 1) {
            msg += `**Greeting ${idx + 1}:**\n\n`;
          }
          msg += greeting + '\n\n';
        });
        return msg;
      } else if (result.updatedFields && result.characterName) {
        // update_character_card response
        return `\n\n✓ **update_character_card succeeded!**\n\n` +
          `**Character:** ${result.characterName}\n` +
          `**Updated Fields:** ${result.updatedFields.join(', ')}\n\n`;
      } else {
        return `\n\n✓ **Tool succeeded!**\n\n${result.message || 'Operation completed successfully'}\n\n`;
      }
    } else {
      return `\n\n✗ **Tool failed:** ${result.error}\n\n`;
    }
  }

  /**
   * Set up for generating a new swipe
   */
  function startSwipeGeneration(messageIndex) {
    isGeneratingSwipe.value = true;
    generatingSwipeIndex.value = messageIndex;
  }

  return {
    // State
    isStreaming,
    streamingContent,
    isGeneratingSwipe,
    generatingSwipeIndex,
    currentToolCall,
    toolCallElapsedTime,
    pendingImages,

    // Methods
    streamResponse,
    stopStream,
    resetStreamingState,
    startSwipeGeneration,
    formatElapsedTime,
    startToolCallTimer,
    stopToolCallTimer
  };
}
