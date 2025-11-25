import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatHistory } from '../../../src/composables/useChatHistory.js';

describe('useChatHistory', () => {
  let api;
  let history;

  beforeEach(() => {
    api = {
      getChats: vi.fn(),
      getGroupChats: vi.fn(),
      deleteChat: vi.fn(),
      deleteGroupChat: vi.fn()
    };
    history = useChatHistory(api);
  });

  describe('formatDate', () => {
    it('should format recent timestamps as relative time', () => {
      const now = Date.now();
      const result = history.formatDate(now - 30000); // 30 seconds ago
      expect(result).toMatch(/just now|seconds? ago/i);
    });

    it('should format older dates with date string', () => {
      const oldDate = new Date('2023-01-15').getTime();
      const result = history.formatDate(oldDate);
      expect(result).toContain('2023');
    });
  });

  describe('getPreview', () => {
    it('should extract preview from chat messages', () => {
      const chat = {
        messages: [
          { role: 'user', content: 'Hello there' },
          { role: 'assistant', swipes: ['Hi!'], swipeIndex: 0 }
        ]
      };
      const preview = history.getPreview(chat);
      expect(preview).toBeTruthy();
    });

    it('should handle branch-based chats', () => {
      const chat = {
        branches: {
          'branch-main': {
            messages: [{ role: 'user', content: 'Test message' }]
          }
        },
        mainBranch: 'branch-main'
      };
      const preview = history.getPreview(chat);
      expect(preview).toBeTruthy();
    });

    it('should truncate long previews', () => {
      const longMessage = 'A'.repeat(200);
      const chat = {
        messages: [{ role: 'user', content: longMessage }]
      };
      const preview = history.getPreview(chat);
      expect(preview.length).toBeLessThan(longMessage.length);
    });
  });

  describe('loadChatHistory', () => {
    it('should load regular chat history', async () => {
      const mockChats = [{ filename: 'chat1.json', characterFilename: 'char.png' }];
      api.getChats.mockResolvedValue(mockChats);

      await history.loadChatHistory('char.png', false);

      expect(api.getChats).toHaveBeenCalled();
      expect(history.chatHistory.value).toEqual(mockChats);
    });

    it('should load group chat history', async () => {
      const mockGroupChats = [{ filename: 'group1.json' }];
      api.getGroupChats.mockResolvedValue(mockGroupChats);

      await history.loadChatHistory(null, true);

      expect(api.getGroupChats).toHaveBeenCalled();
      expect(history.chatHistory.value).toEqual(mockGroupChats);
    });
  });
});
