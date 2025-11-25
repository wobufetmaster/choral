/**
 * Group chat operations composable
 *
 * Handles group chat CRUD operations via API calls.
 * Returns functions that take the necessary state as arguments.
 */
export function useGroupChatOperations() {
  /**
   * Load a group chat by ID
   *
   * @param {object} options - Load options
   * @param {string} options.groupChatId - Group chat ID to load
   * @param {object} options.api - API client instance
   * @param {function} options.normalizeMessages - Message normalization function
   * @returns {Promise<object>} Loaded group chat data
   */
  async function loadGroupChat(options) {
    const { groupChatId, api, normalizeMessages = (m) => m } = options;

    const groupChat = await api.getGroupChat(groupChatId);

    // Refresh character data from actual PNG files to get latest edits
    const refreshedCharacters = [];
    for (const cachedChar of groupChat.characters || []) {
      try {
        const freshCharData = await api.getCharacter(cachedChar.filename);
        refreshedCharacters.push({
          filename: cachedChar.filename,
          name: freshCharData.data.name,
          data: freshCharData.data
        });
      } catch (error) {
        // If character file is missing, keep the cached version
        console.warn(`Character ${cachedChar.filename} not found, using cached data`);
        refreshedCharacters.push(cachedChar);
      }
    }

    // Process branch structure
    let messages, branches, mainBranch, currentBranch;
    if (groupChat.branches && groupChat.mainBranch) {
      branches = groupChat.branches;
      mainBranch = groupChat.mainBranch;
      currentBranch = groupChat.currentBranch || groupChat.mainBranch;
      const branch = branches[currentBranch];
      messages = normalizeMessages(branch?.messages || []);
    } else {
      // Old format without branches
      messages = normalizeMessages(groupChat.messages || []);
      branches = null;
      mainBranch = null;
      currentBranch = null;
    }

    return {
      characters: refreshedCharacters,
      strategy: groupChat.strategy || 'join',
      explicitMode: groupChat.explicitMode || false,
      name: groupChat.name || '',
      tags: groupChat.tags || [],
      conversationGroup: groupChat.conversationGroup || null,
      messages,
      branches,
      mainBranch,
      currentBranch,
      needsInitialization: messages.length === 0
    };
  }

  /**
   * Initialize a new group chat with character greetings
   *
   * @param {object} options - Initialization options
   * @param {array} options.characters - Array of group chat characters
   * @param {object} options.api - API client instance
   * @returns {Promise<array>} Initial messages array
   */
  async function initializeGroupChat(options) {
    const { characters, api } = options;

    if (characters.length === 0) return [];

    const messages = [];

    for (const char of characters) {
      try {
        const charData = await api.getCharacter(char.filename);

        const firstMessage = charData.data.first_mes || 'Hello!';
        const alternateGreetings = charData.data.alternate_greetings || [];

        // Create all greetings for this character (first message + alternates)
        const characterGreetings = [firstMessage, ...alternateGreetings];

        // Create a message for this character with all their greetings as swipes
        messages.push({
          role: 'assistant',
          swipes: characterGreetings,
          swipeCharacters: new Array(characterGreetings.length).fill(char.filename),
          swipeIndex: 0,
          isFirstMessage: true,
          characterFilename: char.filename
        });
      } catch (err) {
        console.error(`Failed to load greetings for ${char.filename}:`, err);
      }
    }

    return messages;
  }

  /**
   * Save a group chat
   *
   * @param {object} options - Save options
   * @param {string} options.groupChatId - Existing group chat ID (or null for new)
   * @param {array} options.characters - Group chat characters
   * @param {string} options.strategy - Chat strategy ('join' or 'swap')
   * @param {boolean} options.explicitMode - Explicit mode flag
   * @param {string} options.name - Group chat name
   * @param {array} options.tags - Group chat tags
   * @param {string} options.conversationGroup - Conversation group ID
   * @param {string} options.displayTitle - Display title for history
   * @param {array} options.messages - Current messages
   * @param {object} options.branches - Branch structure (if any)
   * @param {string} options.mainBranch - Main branch ID
   * @param {string} options.currentBranch - Current branch ID
   * @param {object} options.api - API client instance
   * @param {function} options.getConversationGroupId - Function to generate conversation group ID
   * @returns {Promise<object>} Result with filename
   */
  async function saveGroupChat(options) {
    const {
      groupChatId,
      characters,
      strategy,
      explicitMode,
      name,
      tags,
      conversationGroup,
      displayTitle,
      messages,
      branches,
      mainBranch,
      currentBranch,
      api,
      getConversationGroupId
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

    // Generate conversationGroup ID if it doesn't exist
    let groupId = conversationGroup;
    if (!groupId && getConversationGroupId) {
      const characterFilenames = characters.map(c => c.filename);
      groupId = getConversationGroupId(characterFilenames);
    }

    const groupChat = {
      filename: groupChatId || `group_chat_${Date.now()}.json`,
      isGroupChat: true,
      characters,
      characterFilenames: characters.map(c => c.filename),
      conversationGroup: groupId,
      strategy,
      explicitMode,
      name,
      tags,
      timestamp: Date.now(),
      title: displayTitle
    };

    // Include branch structure if it exists
    if (updatedBranches && Object.keys(updatedBranches).length > 0) {
      groupChat.branches = updatedBranches;
      groupChat.mainBranch = mainBranch;
      groupChat.currentBranch = currentBranch;
    } else {
      // Old format for compatibility
      groupChat.messages = messages;
    }

    const result = await api.saveGroupChat(groupChat);

    return {
      filename: result.filename,
      conversationGroup: groupId
    };
  }

  /**
   * Convert a 1:1 chat to a group chat
   *
   * @param {object} options - Conversion options
   * @param {object} options.character - Current character data
   * @param {string} options.characterFilename - Character filename
   * @param {array} options.messages - Current messages
   * @returns {object} Converted group chat state
   */
  function convertToGroupChat(options) {
    const { character, characterFilename, messages } = options;

    const characterData = character.data || character;

    // Mark all existing messages with character
    const updatedMessages = messages.map(msg => {
      if (msg.role === 'assistant' && !msg.characterFilename) {
        return { ...msg, characterFilename };
      }
      return msg;
    });

    return {
      isGroupChat: true,
      characters: [{
        filename: characterFilename,
        name: characterData.name,
        data: characterData
      }],
      strategy: 'join',
      messages: updatedMessages
    };
  }

  /**
   * Add a character to a group chat
   *
   * @param {object} options - Add options
   * @param {string} options.characterFilename - Character to add
   * @param {array} options.allCharacters - All available characters
   * @param {array} options.currentCharacters - Current group characters
   * @returns {object|null} New character object or null if not found
   */
  function addCharacterToGroup(options) {
    const { characterFilename, allCharacters, currentCharacters } = options;

    const char = allCharacters.find(c => c.filename === characterFilename);
    if (!char) return null;

    // Check if already in group
    if (currentCharacters.some(c => c.filename === characterFilename)) {
      return null;
    }

    return {
      filename: char.filename,
      name: char.name,
      data: char.data
    };
  }

  /**
   * Remove a character from a group chat
   *
   * @param {object} options - Remove options
   * @param {number} options.index - Index of character to remove
   * @param {array} options.characters - Current characters array
   * @returns {object} Result with updated characters array and success flag
   */
  function removeCharacterFromGroup(options) {
    const { index, characters } = options;

    if (characters.length <= 1) {
      return { success: false, error: 'Cannot have empty group chat' };
    }

    const updatedCharacters = [...characters];
    updatedCharacters.splice(index, 1);

    return { success: true, characters: updatedCharacters };
  }

  /**
   * Move a character up in the group order
   *
   * @param {number} index - Character index
   * @param {array} characters - Current characters array
   * @returns {array|null} Updated characters array or null if can't move
   */
  function moveCharacterUp(index, characters) {
    if (index <= 0) return null;

    const updated = [...characters];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;

    return updated;
  }

  /**
   * Move a character down in the group order
   *
   * @param {number} index - Character index
   * @param {array} characters - Current characters array
   * @returns {array|null} Updated characters array or null if can't move
   */
  function moveCharacterDown(index, characters) {
    if (index >= characters.length - 1) return null;

    const updated = [...characters];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;

    return updated;
  }

  return {
    loadGroupChat,
    initializeGroupChat,
    saveGroupChat,
    convertToGroupChat,
    addCharacterToGroup,
    removeCharacterFromGroup,
    moveCharacterUp,
    moveCharacterDown
  };
}
