/**
 * Branch operations composable
 *
 * Handles branch creation, switching, renaming, and deletion via API calls.
 * Returns functions that take the necessary state as arguments.
 */
export function useBranchOperations() {
  /**
   * Create a new branch at a specific message index
   *
   * @param {object} options - Branch creation options
   * @param {string} options.branchName - Name for the new branch
   * @param {number} options.messageIndex - Index of the message to branch from
   * @param {object} options.branches - Current branches object
   * @param {string} options.currentBranch - Current branch ID
   * @param {array} options.messages - Current messages array
   * @param {string} options.mainBranch - Main branch ID
   * @param {string} options.chatId - Chat file ID (regular chat)
   * @param {string} options.groupChatId - Group chat ID
   * @param {boolean} options.isGroupChat - Whether this is a group chat
   * @param {function} options.saveFn - Function to save the chat
   * @returns {Promise<object>} Result with newBranch and updated branches
   */
  async function createBranch(options) {
    const {
      branchName,
      messageIndex,
      branches,
      currentBranch,
      messages,
      mainBranch,
      chatId,
      groupChatId,
      isGroupChat,
      saveFn
    } = options;

    let updatedBranches = { ...branches };
    let newMainBranch = mainBranch;
    let newCurrentBranch = currentBranch;

    // Initialize branch structure if needed
    if (!updatedBranches || Object.keys(updatedBranches).length === 0) {
      const mainBranchId = 'branch-main';
      updatedBranches = {
        [mainBranchId]: {
          id: mainBranchId,
          name: 'Main',
          createdAt: new Date().toISOString(),
          parentBranchId: null,
          branchPointMessageIndex: null,
          messages: [...messages]
        }
      };
      newMainBranch = mainBranchId;
      newCurrentBranch = mainBranchId;

      // Save the chat with branch structure
      if (saveFn) await saveFn();
    }

    // Determine the correct parent branch for this message index
    let parentBranchId = newCurrentBranch;
    const currentBranchObj = updatedBranches[newCurrentBranch];

    if (currentBranchObj && currentBranchObj.parentBranchId !== null) {
      const currentBranchPoint = currentBranchObj.branchPointMessageIndex ?? 0;

      // If message index is at or before the current branch's split point,
      // it belongs to an ancestor branch
      if (messageIndex <= currentBranchPoint) {
        // Walk up the tree to find which ancestor contains this message
        let ancestorId = currentBranchObj.parentBranchId;
        while (ancestorId) {
          const ancestor = updatedBranches[ancestorId];
          if (!ancestor) break;

          const ancestorBranchPoint = ancestor.branchPointMessageIndex ?? 0;

          // If this is the main branch or the message is after this ancestor's branch point,
          // this is the correct parent
          if (ancestor.parentBranchId === null || messageIndex > ancestorBranchPoint) {
            parentBranchId = ancestorId;
            break;
          }

          // Keep walking up
          ancestorId = ancestor.parentBranchId;
        }
      }
    }

    const chatFileId = isGroupChat ? groupChatId : chatId;

    // Verify chat file ID exists before making API call
    if (!chatFileId) {
      throw new Error('Chat must be saved before creating a branch');
    }

    // Use the correct API endpoint based on chat type
    const apiEndpoint = isGroupChat
      ? `/api/group-chats/${chatFileId}/branches`
      : `/api/chats/${chatFileId}/branches`;

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentBranchId: parentBranchId,
        parentMessageIndex: messageIndex,
        branchName: branchName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create branch');
    }

    const data = await response.json();
    const newBranch = data.branch;

    // Update branches
    updatedBranches[newBranch.id] = newBranch;

    return {
      newBranch,
      branches: updatedBranches,
      mainBranch: newMainBranch,
      currentBranch: newBranch.id,
      messages: [...newBranch.messages]
    };
  }

  /**
   * Switch to a different branch
   *
   * @param {object} options - Switch options
   * @param {string} options.branchId - Branch to switch to
   * @param {object} options.branches - Current branches object
   * @param {string} options.chatId - Chat file ID
   * @param {string} options.groupChatId - Group chat ID
   * @param {boolean} options.isGroupChat - Whether this is a group chat
   * @param {function} options.normalizeMessages - Message normalization function
   * @returns {Promise<object>} Result with new currentBranch and messages
   */
  async function switchToBranch(options) {
    const {
      branchId,
      branches,
      chatId,
      groupChatId,
      isGroupChat,
      normalizeMessages = (m) => m
    } = options;

    const chatFileId = isGroupChat ? groupChatId : chatId;
    const apiEndpoint = isGroupChat
      ? `/api/group-chats/${chatFileId}/current-branch`
      : `/api/chats/${chatFileId}/current-branch`;

    const response = await fetch(apiEndpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId })
    });

    if (!response.ok) {
      throw new Error('Failed to switch branch');
    }

    const branch = branches[branchId];

    return {
      currentBranch: branchId,
      messages: normalizeMessages([...branch.messages]),
      branchName: branch.name
    };
  }

  /**
   * Rename a branch
   *
   * @param {object} options - Rename options
   * @param {string} options.branchId - Branch to rename
   * @param {string} options.newName - New name for the branch
   * @param {object} options.branches - Current branches object
   * @param {string} options.chatId - Chat file ID
   * @param {string} options.groupChatId - Group chat ID
   * @param {boolean} options.isGroupChat - Whether this is a group chat
   * @returns {Promise<object>} Updated branches object
   */
  async function renameBranch(options) {
    const {
      branchId,
      newName,
      branches,
      chatId,
      groupChatId,
      isGroupChat
    } = options;

    const chatFileId = isGroupChat ? groupChatId : chatId;
    const apiEndpoint = isGroupChat
      ? `/api/group-chats/${chatFileId}/branches/${branchId}`
      : `/api/chats/${chatFileId}/branches/${branchId}`;

    const response = await fetch(apiEndpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      throw new Error('Failed to rename branch');
    }

    const updatedBranches = { ...branches };
    updatedBranches[branchId] = { ...updatedBranches[branchId], name: newName };

    return { branches: updatedBranches };
  }

  /**
   * Delete a branch
   *
   * @param {object} options - Delete options
   * @param {string} options.branchId - Branch to delete
   * @param {boolean} options.deleteChildren - Whether to delete child branches
   * @param {object} options.branches - Current branches object
   * @param {string} options.currentBranch - Current branch ID
   * @param {string} options.mainBranch - Main branch ID
   * @param {string} options.chatId - Chat file ID
   * @param {string} options.groupChatId - Group chat ID
   * @param {boolean} options.isGroupChat - Whether this is a group chat
   * @param {function} options.normalizeMessages - Message normalization function
   * @returns {Promise<object>} Result with updated branches, currentBranch, and messages
   */
  async function deleteBranch(options) {
    const {
      branchId,
      deleteChildren,
      branches,
      currentBranch,
      mainBranch,
      chatId,
      groupChatId,
      isGroupChat,
      normalizeMessages = (m) => m
    } = options;

    const chatFileId = isGroupChat ? groupChatId : chatId;
    const apiEndpoint = isGroupChat
      ? `/api/group-chats/${chatFileId}/branches/${branchId}?deleteChildren=${deleteChildren}`
      : `/api/chats/${chatFileId}/branches/${branchId}?deleteChildren=${deleteChildren}`;

    const response = await fetch(apiEndpoint, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete branch');
    }

    const data = await response.json();

    // Remove deleted branches from local state
    const updatedBranches = { ...branches };
    data.deletedBranches.forEach(id => {
      delete updatedBranches[id];
    });

    // If we deleted the current branch, switch to main
    let newCurrentBranch = currentBranch;
    let newMessages = null;

    if (data.deletedBranches.includes(currentBranch)) {
      newCurrentBranch = mainBranch;
      const mainBranchObj = updatedBranches[mainBranch];
      newMessages = normalizeMessages([...mainBranchObj.messages]);
    }

    return {
      branches: updatedBranches,
      currentBranch: newCurrentBranch,
      messages: newMessages,
      deletedBranches: data.deletedBranches
    };
  }

  return {
    createBranch,
    switchToBranch,
    renameBranch,
    deleteBranch
  };
}
