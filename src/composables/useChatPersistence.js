/**
 * Chat persistence composable
 *
 * Handles loading and saving chat data via API calls.
 * Returns functions that take the necessary state as arguments.
 */
export function useChatPersistence() {
  /**
   * Load a chat by ID
   *
   * @param {object} options - Load options
   * @param {string} options.chatId - Chat ID to load
   * @param {object} options.api - API client instance
   * @param {function} options.normalizeMessages - Message normalization function
   * @returns {Promise<object>} Loaded chat data
   */
  async function loadChat(options) {
    const { chatId, api, normalizeMessages = (m) => m } = options;

    const chat = await api.getChat(chatId);

    // Process branch structure
    let messages, branches, mainBranch, currentBranch;
    if (chat.branches && chat.mainBranch) {
      branches = chat.branches;
      mainBranch = chat.mainBranch;
      currentBranch = chat.currentBranch || chat.mainBranch;
      const branch = branches[currentBranch];
      messages = normalizeMessages(branch?.messages || []);
    } else {
      // Old format (will be migrated on server)
      messages = normalizeMessages(chat.messages || []);
      branches = null;
      mainBranch = null;
      currentBranch = null;
    }

    return {
      chatId,
      messages,
      branches,
      mainBranch,
      currentBranch,
      displayTitle: chat.title || null,
      personaFilename: chat.personaFilename || null,
      chat // Return full chat for auto-naming check
    };
  }

  /**
   * Save a chat
   *
   * @param {object} options - Save options
   * @param {string} options.chatId - Existing chat ID (or null for new)
   * @param {object} options.character - Character data
   * @param {string} options.characterFilename - Character filename
   * @param {object} options.persona - Current persona
   * @param {array} options.messages - Current messages
   * @param {object} options.branches - Branch structure (if any)
   * @param {string} options.mainBranch - Main branch ID
   * @param {string} options.currentBranch - Current branch ID
   * @param {object} options.api - API client instance
   * @returns {Promise<object>} Result with filename
   */
  async function saveChat(options) {
    const {
      chatId,
      character,
      characterFilename,
      persona,
      messages,
      branches,
      mainBranch,
      currentBranch,
      api
    } = options;

    // Update current branch messages if using branches
    let updatedBranches = branches;
    if (currentBranch && branches && branches[currentBranch]) {
      updatedBranches = { ...branches };
      updatedBranches[currentBranch] = {
        ...updatedBranches[currentBranch],
        messages
      };
    }

    const chat = {
      filename: chatId || `chat_${Date.now()}.json`,
      character: character?.data?.name || 'Unknown',
      characterFilename,
      timestamp: Date.now(),
      personaFilename: persona?._filename || null
    };

    // Include branch structure if it exists
    if (updatedBranches && Object.keys(updatedBranches).length > 0) {
      chat.branches = updatedBranches;
      chat.mainBranch = mainBranch;
      chat.currentBranch = currentBranch;
    } else {
      // Old format for compatibility
      chat.messages = messages;
    }

    const result = await api.saveChat(chat);

    return {
      filename: result.filename
    };
  }

  /**
   * Load most recent chat for a character
   *
   * @param {object} options - Load options
   * @param {string} options.characterFilename - Character filename
   * @param {function} options.normalizeMessages - Message normalization function
   * @returns {Promise<object|null>} Chat data or null if none found
   */
  async function loadMostRecentChat(options) {
    const { characterFilename, normalizeMessages = (m) => m } = options;

    const response = await fetch(`/api/chats/character/${characterFilename}`);
    if (!response.ok) {
      return null;
    }

    const chat = await response.json();

    return {
      chatId: chat.filename,
      messages: normalizeMessages(chat.messages || []),
      chat // Return full chat for auto-naming check
    };
  }

  /**
   * Auto-name a chat based on its content
   *
   * @param {object} options - Auto-naming options
   * @param {string} options.chatId - Chat ID
   * @param {object} options.chat - Full chat object
   * @param {boolean} options.isGroupChat - Whether this is a group chat
   * @returns {Promise<object>} Result with title if renamed
   */
  async function autoNameChat(options) {
    const { chatId, chat, isGroupChat } = options;

    // Only auto-name if chat has messages and hasn't been auto-named before
    let hasMessages = false;
    if (chat.branches && chat.currentBranch && chat.branches[chat.currentBranch]) {
      hasMessages = chat.branches[chat.currentBranch].messages?.length > 0;
    } else if (chat.messages) {
      hasMessages = chat.messages.length > 0;
    }

    if (!chat || !hasMessages) {
      return { skipped: true };
    }

    if (chat.autoNamed) {
      return { skipped: true }; // Already auto-named
    }

    // Call auto-naming endpoint
    const endpoint = isGroupChat
      ? `/api/group-chats/${chatId}/auto-name`
      : `/api/chats/${chatId}/auto-name`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      return { skipped: true };
    }

    const result = await response.json();
    if (result.skipped || !result.title) {
      return { skipped: true };
    }

    return { skipped: false, title: result.title };
  }

  /**
   * Normalize messages from old format to swipe format
   *
   * @param {array} messages - Messages to normalize
   * @param {boolean} isGroupChat - Whether this is a group chat
   * @returns {array} Normalized messages
   */
  function normalizeMessages(messages, isGroupChat = false) {
    return messages.map(msg => {
      if (msg.role === 'assistant') {
        // If already has swipes, use as-is
        if (msg.swipes) {
          const normalized = {
            ...msg,
            swipeIndex: msg.swipeIndex ?? 0
          };

          // For group chat messages, ensure swipeCharacters array exists
          if (isGroupChat && !normalized.swipeCharacters && normalized.characterFilename) {
            normalized.swipeCharacters = new Array(normalized.swipes.length).fill(normalized.characterFilename);
          }

          return normalized;
        }

        // Convert old format
        const normalized = {
          role: 'assistant',
          swipes: [msg.content],
          swipeIndex: 0
        };

        // For group chat messages, initialize swipeCharacters
        if (isGroupChat && msg.characterFilename) {
          normalized.characterFilename = msg.characterFilename;
          normalized.swipeCharacters = [msg.characterFilename];
        }

        return normalized;
      }

      // User messages stay as-is
      return msg;
    });
  }

  return {
    loadChat,
    saveChat,
    loadMostRecentChat,
    autoNameChat,
    normalizeMessages
  };
}
