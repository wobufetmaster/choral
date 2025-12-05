/**
 * Summary chat composable
 *
 * Handles generating summaries and continuing chats with a narrator.
 */

/**
 * Process SSE stream for summary generation
 */
async function processSummaryStream(reader, callbacks) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          // Await callbacks to ensure proper sequencing (onInit must complete before chunks)
          if (event.type === 'init' && callbacks.onInit) {
            await callbacks.onInit(event);
          } else if (event.type === 'chunk' && callbacks.onChunk) {
            await callbacks.onChunk(event);
          } else if (event.type === 'complete' && callbacks.onComplete) {
            await callbacks.onComplete(event);
          } else if (event.type === 'error' && callbacks.onError) {
            await callbacks.onError(event);
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      }
    }
  }
}

/**
 * Build preset from settings if API load failed
 */
function buildPresetFromSettings(settings, currentPresetName) {
  return {
    name: currentPresetName || 'Current Settings',
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    top_p: settings.top_p,
    top_k: settings.top_k,
    frequency_penalty: settings.frequency_penalty,
    presence_penalty: settings.presence_penalty,
    repetition_penalty: settings.repetition_penalty,
    prompts: settings.systemPrompts || [],
    promptProcessing: settings.prompt_processing || 'merge_system'
  };
}

/**
 * Build request data for summary API
 */
function buildSummaryRequest(options) {
  const {
    messages,
    chatTitle,
    preset,
    context,
    isGroupChat,
    groupChatCharacters,
    characterFilename // Pass explicitly - character objects don't have filename
  } = options;

  const characterFilenames = isGroupChat && groupChatCharacters
    ? groupChatCharacters.map(c => c.filename)
    : null;

  return {
    messages,
    chatTitle,
    preset,
    context,
    isGroupChat,
    characterFilenames,
    characterFilename: !isGroupChat ? characterFilename : null
  };
}

/**
 * Create streaming message placeholder
 */
function createStreamingMessage(narrator, timestamp) {
  return {
    role: 'assistant',
    character: narrator.name,
    characterFilename: '__narrator__',
    characterAvatar: narrator.avatar,
    content: '',
    timestamp,
    swipes: [''],
    swipeIndex: 0
  };
}

export function useSummaryChat() {
  return {
    processSummaryStream,
    buildPresetFromSettings,
    buildSummaryRequest,
    createStreamingMessage
  };
}
