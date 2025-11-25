/**
 * Branch management helper composable
 *
 * Provides pure helper functions for working with branch data structures.
 * The actual branch operations (create, switch, delete) remain in ChatView
 * as they require API calls and Vue-specific context.
 */
export function useBranches() {
  /**
   * Check if branch data exists and has been initialized
   * @param {object} branches - Branch structure object
   * @returns {boolean} True if branches are initialized
   */
  function hasBranches(branches) {
    return branches && Object.keys(branches).length > 0;
  }

  /**
   * Get count of branches
   * @param {object} branches - Branch structure object
   * @returns {number} Number of branches
   */
  function getBranchCount(branches) {
    return branches ? Object.keys(branches).length : 0;
  }

  /**
   * Get branch by ID
   * @param {object} branches - Branch structure object
   * @param {string} branchId - Branch ID
   * @returns {object|null} Branch object or null
   */
  function getBranch(branches, branchId) {
    return branches?.[branchId] || null;
  }

  /**
   * Get children of a branch
   * @param {object} branches - Branch structure object
   * @param {string} branchId - Parent branch ID
   * @returns {array} Array of child branch objects
   */
  function getChildBranches(branches, branchId) {
    if (!branches) return [];
    return Object.values(branches).filter(b => b.parentBranchId === branchId);
  }

  /**
   * Check if a branch has children
   * @param {object} branches - Branch structure object
   * @param {string} branchId - Branch ID
   * @returns {boolean} True if branch has children
   */
  function hasChildBranches(branches, branchId) {
    return getChildBranches(branches, branchId).length > 0;
  }

  /**
   * Get ancestor chain of a branch (from root to branch)
   * @param {object} branches - Branch structure object
   * @param {string} branchId - Branch ID
   * @returns {array} Array of branch IDs from root to given branch
   */
  function getAncestorChain(branches, branchId) {
    if (!branches) return [];
    const chain = [];
    let current = branchId;

    while (current && branches[current]) {
      chain.unshift(current);
      current = branches[current].parentBranchId;
    }

    return chain;
  }

  /**
   * Find the branch that should be the parent for a new branch at a given message index
   * @param {object} branches - Branch structure object
   * @param {string} currentBranchId - Current branch ID
   * @param {number} messageIndex - Message index where branch would be created
   * @returns {string} ID of the branch that should be the parent
   */
  function findParentBranchForIndex(branches, currentBranchId, messageIndex) {
    if (!branches || !currentBranchId) return currentBranchId;

    const currentBranch = branches[currentBranchId];
    if (!currentBranch) return currentBranchId;

    // If current branch has no parent, it's the root
    if (currentBranch.parentBranchId === null) {
      return currentBranchId;
    }

    const currentBranchPoint = currentBranch.branchPointMessageIndex ?? 0;

    // If message is after the current branch point, parent is current branch
    if (messageIndex > currentBranchPoint) {
      return currentBranchId;
    }

    // Walk up to find the correct ancestor
    let ancestorId = currentBranch.parentBranchId;
    while (ancestorId) {
      const ancestor = branches[ancestorId];
      if (!ancestor) break;

      const ancestorBranchPoint = ancestor.branchPointMessageIndex ?? 0;

      // If this is the main branch or message is after this ancestor's branch point
      if (ancestor.parentBranchId === null || messageIndex > ancestorBranchPoint) {
        return ancestorId;
      }

      ancestorId = ancestor.parentBranchId;
    }

    return currentBranchId;
  }

  /**
   * Build a tree structure from flat branches for display
   * @param {object} branches - Branch structure object
   * @param {string} mainBranchId - ID of the main branch
   * @returns {object} Tree structure with children arrays
   */
  function buildBranchTree(branches, mainBranchId) {
    if (!branches || !mainBranchId) return null;

    const buildNode = (branchId) => {
      const branch = branches[branchId];
      if (!branch) return null;

      return {
        ...branch,
        children: getChildBranches(branches, branchId).map(child => buildNode(child.id))
      };
    };

    return buildNode(mainBranchId);
  }

  return {
    hasBranches,
    getBranchCount,
    getBranch,
    getChildBranches,
    hasChildBranches,
    getAncestorChain,
    findParentBranchForIndex,
    buildBranchTree
  };
}
