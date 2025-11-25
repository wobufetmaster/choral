/**
 * Stream event handlers composable
 *
 * Handles parsing and processing of SSE stream events from the chat API.
 * Returns handler functions that can be called with callbacks for state updates.
 */
export function useStreamHandlers() {
  /**
   * Build the request body for a streaming chat request
   */
  function buildStreamRequestBody(options) {
    const {
      messages,
      settings,
      macroContext,
      lorebookFilenames,
      tools
    } = options;

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

    return requestBody;
  }

  /**
   * Build macro context for a chat request
   */
  function buildMacroContext(options) {
    const { isGroupChat, currentSpeaker, groupChatCharacters, character, persona } = options;

    if (isGroupChat && currentSpeaker) {
      const speakingChar = groupChatCharacters.find(c => c.filename === currentSpeaker);
      const charData = speakingChar?.data?.data || speakingChar?.data || {};
      return {
        charName: speakingChar?.name || 'Character',
        charNickname: charData.nickname || '',
        userName: persona?.name || 'User'
      };
    }

    return {
      charName: character?.data?.name || 'Character',
      charNickname: character?.data?.nickname || '',
      userName: persona?.name || 'User'
    };
  }

  /**
   * Fetch tool schemas for characters
   */
  async function fetchToolSchemas(options) {
    const { isGroupChat, groupChatCharacters, characterFilename } = options;
    const allTools = [];

    if (isGroupChat) {
      for (const char of groupChatCharacters) {
        try {
          const response = await fetch(`/api/tools/schemas/${encodeURIComponent(char.filename)}`);
          const data = await response.json();
          if (data.tools?.length > 0) {
            allTools.push(...data.tools);
          }
        } catch (error) {
          console.error(`Failed to fetch tools for ${char.filename}:`, error);
        }
      }

      // Deduplicate by function name
      const uniqueTools = [];
      const seenNames = new Set();
      for (const tool of allTools) {
        if (!seenNames.has(tool.function.name)) {
          uniqueTools.push(tool);
          seenNames.add(tool.function.name);
        }
      }
      return uniqueTools;
    }

    if (characterFilename) {
      try {
        const response = await fetch(`/api/tools/schemas/${encodeURIComponent(characterFilename)}`);
        const data = await response.json();
        return data.tools || [];
      } catch (error) {
        console.error('Failed to fetch tool schemas:', error);
      }
    }

    return [];
  }

  /**
   * Format tool result message for display
   */
  function formatToolResultMessage(result) {
    if (!result.success) {
      return {
        message: `\n\n✗ **Tool failed:** ${result.error}\n\n`,
        notification: { text: 'Tool execution failed', type: 'error' }
      };
    }

    // create_character_card response
    if (result.name && result.filename && result.details) {
      let msg = `\n\n✓ **create_character_card succeeded!**\n\n`;
      msg += `**Character Name:** ${result.name}\n`;
      msg += `**Filename:** \`${result.filename}\`\n\n`;
      msg += `*${result.details}*\n\n`;
      return {
        message: msg,
        notification: { text: `Character created: ${result.name}`, type: 'success' }
      };
    }

    // add_greetings response
    if (result.addedGreetings && result.characterName) {
      let msg = `\n\n✓ **add_greetings succeeded!**\n\n`;
      msg += `**Character:** ${result.characterName}\n`;
      msg += `**Added ${result.addedCount} greeting(s)** (Total: ${result.totalGreetings})\n\n`;
      result.addedGreetings.forEach((greeting, idx) => {
        if (result.addedCount > 1) {
          msg += `**Greeting ${idx + 1}:**\n\n`;
        }
        msg += greeting + '\n\n';
      });
      return {
        message: msg,
        notification: { text: `Added ${result.addedCount} greeting(s)`, type: 'success' }
      };
    }

    // update_character_card response
    if (result.updatedFields && result.characterName) {
      let msg = `\n\n✓ **update_character_card succeeded!**\n\n`;
      msg += `**Character:** ${result.characterName}\n`;
      msg += `**Updated Fields:** ${result.updatedFields.join(', ')}\n\n`;
      return {
        message: msg,
        notification: { text: `Updated ${result.characterName}`, type: 'success' }
      };
    }

    // Generic success
    return {
      message: `\n\n✓ **Tool succeeded!**\n\n${result.message || 'Operation completed successfully'}\n\n`,
      notification: { text: 'Tool executed successfully', type: 'success' }
    };
  }

  /**
   * Parse a single SSE data line and return the event type and data
   */
  function parseStreamEvent(data) {
    if (data === '[DONE]') {
      return { type: 'done' };
    }

    try {
      const parsed = JSON.parse(data);

      if (parsed.error) {
        return { type: 'error', error: parsed.error };
      }

      if (parsed.type === 'debug') {
        return { type: 'debug', debug: parsed.debug };
      }

      if (parsed.type === 'tool_call_start') {
        return { type: 'tool_call_start', toolName: parsed.toolName };
      }

      if (parsed.type === 'tool_call') {
        return { type: 'tool_call', toolCall: parsed.toolCall };
      }

      if (parsed.type === 'tool_result') {
        return { type: 'tool_result', result: parsed.result };
      }

      if (parsed.type === 'tool_error') {
        return { type: 'tool_error', error: parsed.error };
      }

      if (parsed.type === 'images') {
        return { type: 'images', images: parsed.images };
      }

      if (parsed.content) {
        return { type: 'content', content: parsed.content };
      }

      return { type: 'unknown', data: parsed };
    } catch (e) {
      if (!data.trim()) {
        return { type: 'empty' };
      }
      console.error('Parse error:', e);
      return { type: 'parse_error', error: e };
    }
  }

  /**
   * Create a new assistant message object
   */
  function createAssistantMessage(options) {
    const { content, isGroupChat, currentSpeaker, pendingImages } = options;

    const message = {
      role: 'assistant',
      swipes: [content],
      swipeIndex: 0
    };

    if (isGroupChat && currentSpeaker) {
      message.characterFilename = currentSpeaker;
      message.swipeCharacters = [currentSpeaker];
    }

    if (pendingImages?.length > 0) {
      message.images = pendingImages;
    }

    return message;
  }

  /**
   * Add a swipe to an existing message
   */
  function addSwipeToMessage(message, options) {
    const { content, isGroupChat, currentSpeaker } = options;

    message.swipes.push(content);
    message.swipeIndex = message.swipes.length - 1;

    if (isGroupChat && currentSpeaker) {
      if (!message.swipeCharacters) {
        const originalCharacter = message.characterFilename || currentSpeaker;
        message.swipeCharacters = new Array(message.swipes.length - 1).fill(originalCharacter);
      }
      message.swipeCharacters.push(currentSpeaker);
    }
  }

  return {
    buildStreamRequestBody,
    buildMacroContext,
    fetchToolSchemas,
    formatToolResultMessage,
    parseStreamEvent,
    createAssistantMessage,
    addSwipeToMessage
  };
}
