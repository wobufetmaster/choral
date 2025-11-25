import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useBranchOperations } from '../../../src/composables/useBranchOperations.js';

describe('useBranchOperations', () => {
  let branchOps;
  let mockFetch;

  beforeEach(() => {
    branchOps = useBranchOperations();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      const newBranch = {
        id: 'branch-new',
        name: 'New Branch',
        parentBranchId: 'branch-main',
        branchPointMessageIndex: 1,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ branch: newBranch })
      });

      const result = await branchOps.createBranch({
        branchName: 'New Branch',
        messageIndex: 1,
        branches: {
          'branch-main': {
            id: 'branch-main',
            name: 'Main',
            parentBranchId: null,
            messages: []
          }
        },
        currentBranch: 'branch-main',
        messages: [],
        mainBranch: 'branch-main',
        chatId: 'chat-123',
        isGroupChat: false
      });

      expect(result.newBranch).toEqual(newBranch);
      expect(result.currentBranch).toBe('branch-new');
      expect(result.branches['branch-new']).toEqual(newBranch);
    });

    it('should initialize branch structure if empty', async () => {
      const newBranch = {
        id: 'branch-new',
        name: 'New Branch',
        parentBranchId: 'branch-main',
        branchPointMessageIndex: 0,
        messages: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ branch: newBranch })
      });

      const saveFn = vi.fn();

      const result = await branchOps.createBranch({
        branchName: 'New Branch',
        messageIndex: 0,
        branches: {},
        currentBranch: null,
        messages: [{ role: 'user', content: 'test' }],
        mainBranch: null,
        chatId: 'chat-123',
        isGroupChat: false,
        saveFn
      });

      expect(saveFn).toHaveBeenCalled();
      expect(result.mainBranch).toBe('branch-main');
    });

    it('should throw error if chat not saved', async () => {
      await expect(branchOps.createBranch({
        branchName: 'Test',
        messageIndex: 0,
        branches: { 'branch-main': { id: 'branch-main', parentBranchId: null, messages: [] } },
        currentBranch: 'branch-main',
        messages: [],
        mainBranch: 'branch-main',
        chatId: null,
        isGroupChat: false
      })).rejects.toThrow('Chat must be saved before creating a branch');
    });

    it('should use group chat endpoint for group chats', async () => {
      const newBranch = {
        id: 'branch-new',
        name: 'New Branch',
        parentBranchId: 'branch-main',
        messages: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ branch: newBranch })
      });

      await branchOps.createBranch({
        branchName: 'New Branch',
        messageIndex: 0,
        branches: { 'branch-main': { id: 'branch-main', parentBranchId: null, messages: [] } },
        currentBranch: 'branch-main',
        messages: [],
        mainBranch: 'branch-main',
        groupChatId: 'gc-123',
        isGroupChat: true
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/group-chats/gc-123/branches',
        expect.any(Object)
      );
    });
  });

  describe('switchToBranch', () => {
    it('should switch to a branch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await branchOps.switchToBranch({
        branchId: 'branch-child',
        branches: {
          'branch-main': { id: 'branch-main', name: 'Main', messages: [] },
          'branch-child': { id: 'branch-child', name: 'Child', messages: [{ role: 'user', content: 'Hello' }] }
        },
        chatId: 'chat-123',
        isGroupChat: false
      });

      expect(result.currentBranch).toBe('branch-child');
      expect(result.messages).toHaveLength(1);
      expect(result.branchName).toBe('Child');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      await expect(branchOps.switchToBranch({
        branchId: 'branch-child',
        branches: { 'branch-child': { id: 'branch-child', name: 'Child', messages: [] } },
        chatId: 'chat-123',
        isGroupChat: false
      })).rejects.toThrow('Failed to switch branch');
    });
  });

  describe('renameBranch', () => {
    it('should rename a branch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await branchOps.renameBranch({
        branchId: 'branch-child',
        newName: 'Renamed Branch',
        branches: {
          'branch-child': { id: 'branch-child', name: 'Child', messages: [] }
        },
        chatId: 'chat-123',
        isGroupChat: false
      });

      expect(result.branches['branch-child'].name).toBe('Renamed Branch');
    });
  });

  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deletedBranches: ['branch-child'] })
      });

      const result = await branchOps.deleteBranch({
        branchId: 'branch-child',
        deleteChildren: false,
        branches: {
          'branch-main': { id: 'branch-main', name: 'Main', messages: [] },
          'branch-child': { id: 'branch-child', name: 'Child', messages: [] }
        },
        currentBranch: 'branch-main',
        mainBranch: 'branch-main',
        chatId: 'chat-123',
        isGroupChat: false
      });

      expect(result.branches['branch-child']).toBeUndefined();
      expect(result.deletedBranches).toContain('branch-child');
    });

    it('should switch to main branch if current branch is deleted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deletedBranches: ['branch-current'] })
      });

      const result = await branchOps.deleteBranch({
        branchId: 'branch-current',
        deleteChildren: false,
        branches: {
          'branch-main': { id: 'branch-main', name: 'Main', messages: [{ role: 'user', content: 'Main message' }] },
          'branch-current': { id: 'branch-current', name: 'Current', messages: [] }
        },
        currentBranch: 'branch-current',
        mainBranch: 'branch-main',
        chatId: 'chat-123',
        isGroupChat: false
      });

      expect(result.currentBranch).toBe('branch-main');
      expect(result.messages).toHaveLength(1);
    });
  });
});
