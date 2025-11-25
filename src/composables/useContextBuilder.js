import { processMacrosForDisplay } from '../utils/macros.js';

/**
 * Context building composable
 *
 * Builds chat context arrays for API requests.
 * Handles both 1:1 and group chat context building with preset system prompts,
 * character card placeholders, persona descriptions, and conversation history.
 */
export function useContextBuilder() {
  /**
   * Build context for a 1:1 chat
   *
   * @param {object} options - Context building options
   * @param {object} options.settings - Chat settings with systemPrompts
   * @param {object} options.character - Character card data
   * @param {object} options.persona - User persona
   * @param {array} options.messages - Conversation messages
   * @param {number|null} options.upToMessageIndex - Optional message index limit
   * @returns {array} Context array for API request
   */
  function buildSingleChatContext(options) {
    const {
      settings,
      character,
      persona,
      messages,
      upToMessageIndex = null
    } = options;

    const context = [];

    // If we have system prompts from preset, use those
    if (settings.systemPrompts && settings.systemPrompts.length > 0) {
      // Sort prompts by injection order
      const sortedPrompts = [...settings.systemPrompts]
        .filter(p => p.enabled)
        .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

      // Track if any placeholder was used
      let hasCharacterInfo = false;

      // Process each prompt and replace placeholders
      for (const prompt of sortedPrompts) {
        let content = prompt.content || '';
        const originalContent = content;

        // Replace template placeholders
        content = content.replace(/\{\{description\}\}/g, character?.data?.description || '');
        content = content.replace(/\{\{personality\}\}/g, character?.data?.personality || '');
        content = content.replace(/\{\{scenario\}\}/g, character?.data?.scenario || '');
        content = content.replace(/\{\{system_prompt\}\}/g, character?.data?.system_prompt || '');
        content = content.replace(/\{\{dialogue_examples\}\}/g, character?.data?.mes_example || '');

        // Check if any placeholders were replaced
        if (content !== originalContent) {
          hasCharacterInfo = true;
        }

        // Only add if there's actual content
        if (content.trim()) {
          context.push({
            role: prompt.role || 'system',
            content: content.trim()
          });
        }
      }

      // If no placeholders were used, add character info separately
      if (!hasCharacterInfo) {
        const characterContent = buildCharacterInfoBlock(character?.data);
        if (characterContent) {
          context.push({
            role: 'system',
            content: characterContent
          });
        }
      }
    } else {
      // Fallback: Build from character card directly
      const characterContent = buildCharacterInfoBlock(character?.data);
      if (characterContent) {
        context.push({
          role: 'system',
          content: characterContent
        });
      }
    }

    // Add persona description if present
    if (persona?.description?.trim()) {
      context.push({
        role: 'system',
        content: `User persona: ${persona.description.trim()}`
      });
    }

    // Add conversation history
    addConversationHistory(context, messages, upToMessageIndex);

    return context;
  }

  /**
   * Build context for a group chat
   *
   * @param {object} options - Context building options
   * @param {object} options.settings - Chat settings with systemPrompts
   * @param {array} options.groupChatCharacters - Array of character objects
   * @param {string} options.strategy - Group chat strategy ('join' or 'swap')
   * @param {string|null} options.speakerFilename - Current/next speaker filename
   * @param {object} options.persona - User persona
   * @param {array} options.messages - Conversation messages
   * @param {number|null} options.upToMessageIndex - Optional message index limit
   * @returns {array} Context array for API request
   */
  function buildGroupChatContext(options) {
    const {
      settings,
      groupChatCharacters,
      strategy,
      speakerFilename,
      persona,
      messages,
      upToMessageIndex = null
    } = options;

    const context = [];

    // Determine which character will be speaking (for swap strategy)
    const speakingCharacter = speakerFilename
      ? groupChatCharacters.find(c => c.filename === speakerFilename)
      : null;

    // Track if character info was injected via placeholders
    let hasCharacterInfo = false;

    // Add system prompts from preset
    if (settings.systemPrompts && settings.systemPrompts.length > 0) {
      const sortedPrompts = [...settings.systemPrompts]
        .filter(p => p.enabled)
        .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

      for (const prompt of sortedPrompts) {
        let content = prompt.content || '';
        const originalContent = content;

        // For group chats, handle character info differently based on strategy
        if (strategy === 'join') {
          content = processJoinStrategyPlaceholders(content, groupChatCharacters, persona);
        } else if (strategy === 'swap' && speakingCharacter) {
          content = processSwapStrategyPlaceholders(content, speakingCharacter, persona);
        }

        // Check if any placeholders were replaced
        if (content !== originalContent) {
          hasCharacterInfo = true;
        }

        if (content.trim()) {
          context.push({
            role: prompt.role || 'system',
            content: content.trim()
          });
        }
      }
    }

    // If no placeholders were used, add character info as fallback
    if (!hasCharacterInfo) {
      const fallbackContent = buildGroupCharacterFallback(
        groupChatCharacters,
        strategy,
        speakingCharacter,
        persona
      );
      if (fallbackContent) {
        context.push({
          role: 'system',
          content: fallbackContent
        });
      }
    }

    // Add persona description if present
    if (persona?.description?.trim()) {
      context.push({
        role: 'system',
        content: `User persona: ${persona.description.trim()}`
      });
    }

    // Add conversation history
    addConversationHistory(context, messages, upToMessageIndex);

    return context;
  }

  /**
   * Build character info block for 1:1 chats
   */
  function buildCharacterInfoBlock(charData) {
    if (!charData) return '';

    const systemPrompt = charData.system_prompt || '';
    const description = charData.description || '';
    const personality = charData.personality || '';
    const scenario = charData.scenario || '';
    const dialogueExamples = charData.mes_example || '';

    if (!systemPrompt && !description && !personality && !scenario && !dialogueExamples) {
      return '';
    }

    let systemContent = '';
    if (systemPrompt) systemContent += systemPrompt + '\n\n';
    if (description) systemContent += `Character: ${description}\n\n`;
    if (personality) systemContent += `Personality: ${personality}\n\n`;
    if (scenario) systemContent += `Scenario: ${scenario}\n\n`;
    if (dialogueExamples) systemContent += `Example Dialogue:\n${dialogueExamples}\n\n`;

    return systemContent.trim();
  }

  /**
   * Process placeholders using join strategy (all characters combined)
   */
  function processJoinStrategyPlaceholders(content, characters, persona) {
    const hasCharPlaceholders = /\{\{(description|personality|scenario|system_prompt|dialogue_examples)\}\}/g.test(content);

    if (!hasCharPlaceholders) return content;

    // Build complete info for each character, then join them
    const allCharacterInfo = characters.map(c => {
      const charData = c.data?.data || c.data || {};
      const charMacroContext = {
        charName: c.name,
        charNickname: charData.nickname || '',
        userName: persona?.name || 'User'
      };

      let info = `=== Character: ${c.name} ===\n`;

      if (charData.description) {
        info += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
      }
      if (charData.personality) {
        info += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
      }
      if (charData.scenario) {
        info += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
      }
      if (charData.system_prompt) {
        info += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
      }
      if (charData.mes_example) {
        info += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
      }

      return info.trim();
    }).join('\n');

    // Replace the FIRST placeholder with all character info, remove the rest
    let replacedFirst = false;
    return content.replace(/\{\{(description|personality|scenario|system_prompt|dialogue_examples)\}\}/g, () => {
      if (!replacedFirst) {
        replacedFirst = true;
        return allCharacterInfo;
      }
      return ''; // Remove subsequent placeholders
    });
  }

  /**
   * Process placeholders using swap strategy (only speaking character)
   */
  function processSwapStrategyPlaceholders(content, speakingCharacter, persona) {
    const charData = speakingCharacter.data?.data || speakingCharacter.data || {};
    const charMacroContext = {
      charName: speakingCharacter.name,
      charNickname: charData.nickname || '',
      userName: persona?.name || 'User'
    };

    content = content.replace(/\{\{description\}\}/g,
      charData.description ? processMacrosForDisplay(charData.description, charMacroContext) : '');
    content = content.replace(/\{\{personality\}\}/g,
      charData.personality ? processMacrosForDisplay(charData.personality, charMacroContext) : '');
    content = content.replace(/\{\{scenario\}\}/g,
      charData.scenario ? processMacrosForDisplay(charData.scenario, charMacroContext) : '');
    content = content.replace(/\{\{system_prompt\}\}/g,
      charData.system_prompt ? processMacrosForDisplay(charData.system_prompt, charMacroContext) : '');
    content = content.replace(/\{\{dialogue_examples\}\}/g,
      charData.mes_example ? processMacrosForDisplay(charData.mes_example, charMacroContext) : '');

    return content;
  }

  /**
   * Build fallback character info for group chats when no placeholders were used
   */
  function buildGroupCharacterFallback(characters, strategy, speakingCharacter, persona) {
    if (strategy === 'join') {
      // Add all character info
      const characterInfos = characters.map(c => {
        const charData = c.data?.data || c.data || {};
        const charMacroContext = {
          charName: c.name,
          charNickname: charData.nickname || '',
          userName: persona?.name || 'User'
        };

        let info = `${c.name}:\n`;
        if (charData.description) {
          info += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
        }
        if (charData.personality) {
          info += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
        }
        if (charData.scenario) {
          info += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
        }
        if (charData.system_prompt) {
          info += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
        }
        if (charData.mes_example) {
          info += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
        }
        return info;
      }).join('\n\n');

      return characterInfos.trim() || '';
    } else if (strategy === 'swap' && speakingCharacter) {
      // Add only the speaking character's info
      const charData = speakingCharacter.data?.data || speakingCharacter.data || {};
      const charMacroContext = {
        charName: speakingCharacter.name,
        charNickname: charData.nickname || '',
        userName: persona?.name || 'User'
      };

      let characterInfo = `${speakingCharacter.name}:\n`;
      if (charData.description) {
        characterInfo += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
      }
      if (charData.personality) {
        characterInfo += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
      }
      if (charData.scenario) {
        characterInfo += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
      }
      if (charData.system_prompt) {
        characterInfo += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
      }
      if (charData.mes_example) {
        characterInfo += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
      }

      if (characterInfo.trim() !== `${speakingCharacter.name}:\n`) {
        return characterInfo.trim();
      }
    }

    return '';
  }

  /**
   * Add conversation history to context
   */
  function addConversationHistory(context, messages, upToMessageIndex) {
    const messagesToInclude = upToMessageIndex !== null
      ? messages.slice(0, upToMessageIndex)
      : messages;

    for (const msg of messagesToInclude) {
      if (msg.role === 'user') {
        context.push({
          role: 'user',
          content: msg.content
        });
      } else {
        // For assistant messages, use current swipe
        context.push({
          role: 'assistant',
          content: msg.swipes?.[msg.swipeIndex] || msg.content || ''
        });
      }
    }
  }

  return {
    buildSingleChatContext,
    buildGroupChatContext
  };
}
