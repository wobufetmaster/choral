/**
 * Debug data management composable
 *
 * Handles building and storing debug information for chat requests.
 */

// Module-level cache for debug data
const debugDataCache = new Map();

export function useDebugData() {
  /**
   * Estimate token count for text
   */
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate basic debug info from messages
   */
  function calculateBasicDebugInfo(messages) {
    const messageCount = messages.length;
    const systemMessageCount = messages.filter(m => m.role === 'system').length;
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const assistantMessageCount = messages.filter(m => m.role === 'assistant').length;

    // Estimate total tokens
    const allText = messages.map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
      }
      return '';
    }).join(' ');

    return {
      messageCount,
      systemMessageCount,
      userMessageCount,
      assistantMessageCount,
      estimatedTokens: estimateTokens(allText)
    };
  }

  /**
   * Build character info for debug data
   */
  function buildCharacterInfo(options) {
    const {
      isGroupChat,
      groupChatStrategy,
      currentSpeaker,
      groupChatCharacters,
      character,
      characterFilename
    } = options;

    const characterInfo = {};

    if (isGroupChat) {
      characterInfo.isGroupChat = true;
      characterInfo.groupChatStrategy = groupChatStrategy;

      if (currentSpeaker) {
        const speakingChar = groupChatCharacters.find(c => c.filename === currentSpeaker);
        if (speakingChar) {
          characterInfo.characterName = speakingChar.name;
          characterInfo.characterFilename = speakingChar.filename;
        }
      }

      // Store character descriptions based on strategy
      if (groupChatStrategy === 'swap') {
        // For SWAP: Only store the speaking character's full description
        if (currentSpeaker) {
          const speakingChar = groupChatCharacters.find(c => c.filename === currentSpeaker);
          if (speakingChar) {
            const charData = speakingChar.data?.data || speakingChar.data || {};
            characterInfo.characterDescriptions = [{
              name: speakingChar.name,
              filename: speakingChar.filename,
              nickname: charData.nickname || '',
              description: charData.description || '',
              personality: charData.personality || '',
              scenario: charData.scenario || '',
              isSpeaking: true
            }];
          }
        }
      } else {
        // For JOIN: Store all characters' full descriptions
        characterInfo.characterDescriptions = groupChatCharacters.map(c => {
          const charData = c.data?.data || c.data || {};
          return {
            name: c.name,
            filename: c.filename,
            nickname: charData.nickname || '',
            description: charData.description || '',
            personality: charData.personality || '',
            scenario: charData.scenario || '',
            isSpeaking: c.filename === currentSpeaker
          };
        });
      }
    } else if (character) {
      characterInfo.isGroupChat = false;
      characterInfo.characterName = character.data?.name || 'Character';
      characterInfo.characterFilename = characterFilename;
      // Store full description for 1-on-1 chats
      characterInfo.characterDescriptions = [{
        name: character.data?.name || 'Character',
        filename: characterFilename,
        nickname: character.data?.nickname || '',
        description: character.data?.description || '',
        personality: character.data?.personality || '',
        scenario: character.data?.scenario || '',
        isSpeaking: true
      }];
    }

    return characterInfo;
  }

  /**
   * Build complete debug data object
   */
  function buildDebugData(options) {
    const {
      requestBody,
      debugInfoFromServer,
      basicDebugInfo,
      persona,
      characterInfo
    } = options;

    // Use processed messages from server if available
    const finalMessages = debugInfoFromServer?.processedMessages || requestBody.messages;

    return {
      timestamp: Date.now(),
      // Request info
      model: requestBody.model,
      messages: finalMessages,
      options: requestBody.options,
      promptProcessing: requestBody.promptProcessing,
      lorebookFilenames: requestBody.lorebookFilenames || [],
      tools: requestBody.tools || [],
      // Context info (persona)
      context: requestBody.context || {},
      personaName: persona?.name || 'User',
      personaNickname: persona?.nickname || '',
      personaDescription: persona?.description || '',
      // Character info
      ...characterInfo,
      // Debug info from server
      matchedEntriesByLorebook: debugInfoFromServer?.matchedEntriesByLorebook || {},
      // Computed info
      estimatedTokens: basicDebugInfo.estimatedTokens,
      messageCount: basicDebugInfo.messageCount,
      systemMessageCount: basicDebugInfo.systemMessageCount,
      userMessageCount: basicDebugInfo.userMessageCount,
      assistantMessageCount: basicDebugInfo.assistantMessageCount
    };
  }

  /**
   * Load debug data from localStorage cache
   */
  function loadFromStorage(chatKey) {
    if (!chatKey) return null;

    try {
      const stored = localStorage.getItem(`debug_${chatKey}`);
      if (stored) {
        const data = JSON.parse(stored);
        debugDataCache.set(chatKey, data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load persisted debug data:', err);
    }
    return null;
  }

  /**
   * Get cached debug data
   */
  function getFromCache(chatKey) {
    return debugDataCache.get(chatKey);
  }

  /**
   * Set debug data in cache
   */
  function setInCache(chatKey, data) {
    debugDataCache.set(chatKey, data);
  }

  return {
    estimateTokens,
    calculateBasicDebugInfo,
    buildCharacterInfo,
    buildDebugData,
    loadFromStorage,
    getFromCache,
    setInCache
  };
}
