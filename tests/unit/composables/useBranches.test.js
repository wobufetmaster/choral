import { describe, it, expect, beforeEach } from 'vitest';
import { useBranches } from '../../../src/composables/useBranches.js';

describe('useBranches', () => {
  let branchHelpers;
  let testBranches;

  beforeEach(() => {
    branchHelpers = useBranches();
    testBranches = {
      'branch-main': {
        id: 'branch-main',
        name: 'Main',
        parentBranchId: null,
        branchPointMessageIndex: null,
        messages: ['msg1', 'msg2', 'msg3']
      },
      'branch-child1': {
        id: 'branch-child1',
        name: 'Child 1',
        parentBranchId: 'branch-main',
        branchPointMessageIndex: 1,
        messages: ['msg1', 'msg2', 'alt-msg3']
      },
      'branch-grandchild': {
        id: 'branch-grandchild',
        name: 'Grandchild',
        parentBranchId: 'branch-child1',
        branchPointMessageIndex: 2,
        messages: ['msg1', 'msg2', 'alt-msg3', 'gc-msg']
      }
    };
  });

  describe('hasBranches', () => {
    it('should return true for initialized branches', () => {
      expect(branchHelpers.hasBranches(testBranches)).toBe(true);
    });

    it('should return false for empty object', () => {
      expect(branchHelpers.hasBranches({})).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(branchHelpers.hasBranches(null)).toBeFalsy();
      expect(branchHelpers.hasBranches(undefined)).toBeFalsy();
    });
  });

  describe('getBranchCount', () => {
    it('should return correct count', () => {
      expect(branchHelpers.getBranchCount(testBranches)).toBe(3);
    });

    it('should return 0 for empty/null', () => {
      expect(branchHelpers.getBranchCount({})).toBe(0);
      expect(branchHelpers.getBranchCount(null)).toBe(0);
    });
  });

  describe('getBranch', () => {
    it('should return branch by ID', () => {
      const branch = branchHelpers.getBranch(testBranches, 'branch-main');
      expect(branch.name).toBe('Main');
    });

    it('should return null for non-existent ID', () => {
      expect(branchHelpers.getBranch(testBranches, 'non-existent')).toBeNull();
    });
  });

  describe('getChildBranches', () => {
    it('should return children of main branch', () => {
      const children = branchHelpers.getChildBranches(testBranches, 'branch-main');
      expect(children.length).toBe(1);
      expect(children[0].id).toBe('branch-child1');
    });

    it('should return empty array for branch with no children', () => {
      const children = branchHelpers.getChildBranches(testBranches, 'branch-grandchild');
      expect(children.length).toBe(0);
    });
  });

  describe('hasChildBranches', () => {
    it('should return true for branch with children', () => {
      expect(branchHelpers.hasChildBranches(testBranches, 'branch-main')).toBe(true);
    });

    it('should return false for leaf branch', () => {
      expect(branchHelpers.hasChildBranches(testBranches, 'branch-grandchild')).toBe(false);
    });
  });

  describe('getAncestorChain', () => {
    it('should return chain from root to branch', () => {
      const chain = branchHelpers.getAncestorChain(testBranches, 'branch-grandchild');
      expect(chain).toEqual(['branch-main', 'branch-child1', 'branch-grandchild']);
    });

    it('should return single item for root branch', () => {
      const chain = branchHelpers.getAncestorChain(testBranches, 'branch-main');
      expect(chain).toEqual(['branch-main']);
    });
  });

  describe('findParentBranchForIndex', () => {
    it('should return current branch for message after branch point', () => {
      const parent = branchHelpers.findParentBranchForIndex(testBranches, 'branch-child1', 2);
      expect(parent).toBe('branch-child1');
    });

    it('should return ancestor for message before branch point', () => {
      const parent = branchHelpers.findParentBranchForIndex(testBranches, 'branch-child1', 0);
      expect(parent).toBe('branch-main');
    });

    it('should return root for root branch', () => {
      const parent = branchHelpers.findParentBranchForIndex(testBranches, 'branch-main', 0);
      expect(parent).toBe('branch-main');
    });
  });

  describe('buildBranchTree', () => {
    it('should build tree structure', () => {
      const tree = branchHelpers.buildBranchTree(testBranches, 'branch-main');
      expect(tree.id).toBe('branch-main');
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].id).toBe('branch-child1');
      expect(tree.children[0].children.length).toBe(1);
      expect(tree.children[0].children[0].id).toBe('branch-grandchild');
    });

    it('should return null for missing branches', () => {
      expect(branchHelpers.buildBranchTree(null, 'branch-main')).toBeNull();
    });
  });
});
