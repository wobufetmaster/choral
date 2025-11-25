import { ref } from 'vue';

/**
 * Branch management composable
 *
 * Manages conversation branching - creating alternate conversation paths
 * from any point in the chat history.
 */
export function useBranches(messages, { onSave }) {
  const branches = ref({});
  const mainBranch = ref(null);
  const currentBranch = ref(null);

  /**
   * Initialize branch structure with main branch
   */
  function initializeBranches() {
    if (Object.keys(branches.value).length > 0) return;

    const mainBranchId = 'branch-main';
    branches.value = {
      [mainBranchId]: {
        id: mainBranchId,
        name: 'Main',
        createdAt: new Date().toISOString(),
        parentBranchId: null,
        branchPointMessageIndex: null,
        messages: [...messages.value]
      }
    };
    mainBranch.value = mainBranchId;
    currentBranch.value = mainBranchId;
  }

  /**
   * Create a new branch from a message index
   * @param {number} messageIndex - Index to branch from
   * @param {string} branchName - Name for the new branch
   * @returns {string} New branch ID
   */
  async function createBranch(messageIndex, branchName) {
    // Ensure branches are initialized
    if (Object.keys(branches.value).length === 0) {
      initializeBranches();
    }

    // Save current branch state
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    // Generate unique branch ID
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new branch with messages up to branch point
    branches.value[branchId] = {
      id: branchId,
      name: branchName,
      createdAt: new Date().toISOString(),
      parentBranchId: currentBranch.value,
      branchPointMessageIndex: messageIndex,
      messages: messages.value.slice(0, messageIndex + 1)
    };

    // Switch to new branch
    currentBranch.value = branchId;
    messages.value = [...branches.value[branchId].messages];

    await onSave?.();
    return branchId;
  }

  /**
   * Switch to an existing branch
   * @param {string} branchId - Branch to switch to
   */
  async function switchToBranch(branchId) {
    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Save current branch state
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    // Load target branch
    currentBranch.value = branchId;
    messages.value.splice(0, messages.value.length, ...branches.value[branchId].messages);

    await onSave?.();
  }

  /**
   * Rename a branch
   */
  async function renameBranch(branchId, newName) {
    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    branches.value[branchId].name = newName;
    await onSave?.();
  }

  /**
   * Delete a branch
   * @param {string} branchId - Branch to delete
   * @param {boolean} deleteChildren - Also delete child branches
   */
  async function deleteBranch(branchId, deleteChildren = false) {
    if (branchId === mainBranch.value) {
      throw new Error('Cannot delete main branch');
    }

    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Find children
    const children = Object.keys(branches.value).filter(
      id => branches.value[id].parentBranchId === branchId
    );

    if (deleteChildren) {
      // Recursively delete children
      for (const childId of children) {
        await deleteBranch(childId, true);
      }
    } else {
      // Re-parent children to deleted branch's parent
      const newParent = branches.value[branchId].parentBranchId;
      for (const childId of children) {
        branches.value[childId].parentBranchId = newParent;
      }
    }

    // If deleting current branch, switch to parent
    if (currentBranch.value === branchId) {
      const parentId = branches.value[branchId].parentBranchId || mainBranch.value;
      await switchToBranch(parentId);
    }

    delete branches.value[branchId];
    await onSave?.();
  }

  /**
   * Load branch structure from saved chat data
   */
  function loadBranches(chatData) {
    if (chatData.branches) {
      branches.value = chatData.branches;
      mainBranch.value = chatData.mainBranch;
      currentBranch.value = chatData.currentBranch || chatData.mainBranch;

      // Load current branch messages
      if (branches.value[currentBranch.value]) {
        messages.value.splice(0, messages.value.length, ...branches.value[currentBranch.value].messages);
      }
    }
  }

  /**
   * Get branch data for saving
   */
  function getBranchDataForSave() {
    // Update current branch messages before saving
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    return {
      branches: branches.value,
      mainBranch: mainBranch.value,
      currentBranch: currentBranch.value
    };
  }

  return {
    branches,
    mainBranch,
    currentBranch,
    initializeBranches,
    createBranch,
    switchToBranch,
    renameBranch,
    deleteBranch,
    loadBranches,
    getBranchDataForSave
  };
}
