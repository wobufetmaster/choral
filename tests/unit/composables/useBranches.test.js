import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBranches } from '../../../src/composables/useBranches.js';

describe('useBranches', () => {
  let messages;
  let onSave;
  let branches;

  beforeEach(() => {
    messages = ref([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', swipes: ['Hi there!'], swipeIndex: 0 }
    ]);
    onSave = vi.fn().mockResolvedValue(undefined);
    branches = useBranches(messages, { onSave });
  });

  describe('initializeBranches', () => {
    it('should create main branch structure', () => {
      branches.initializeBranches();

      expect(branches.mainBranch.value).toBe('branch-main');
      expect(branches.currentBranch.value).toBe('branch-main');
      expect(branches.branches.value['branch-main']).toBeDefined();
      expect(branches.branches.value['branch-main'].name).toBe('Main');
    });
  });

  describe('createBranch', () => {
    it('should create a new branch from message index', async () => {
      branches.initializeBranches();

      const branchId = await branches.createBranch(0, 'Test Branch');

      expect(branchId).toMatch(/^branch-/);
      expect(branches.branches.value[branchId]).toBeDefined();
      expect(branches.branches.value[branchId].name).toBe('Test Branch');
      expect(branches.currentBranch.value).toBe(branchId);
    });
  });

  describe('switchToBranch', () => {
    it('should switch to existing branch and load its messages', async () => {
      branches.initializeBranches();
      const branchId = await branches.createBranch(0, 'Alt Branch');

      // Add a message to the new branch
      messages.value.push({ role: 'user', content: 'New message' });
      branches.branches.value[branchId].messages = [...messages.value];

      // Switch back to main
      await branches.switchToBranch('branch-main');

      expect(branches.currentBranch.value).toBe('branch-main');
      expect(messages.value.length).toBe(2); // Original messages
    });
  });
});
