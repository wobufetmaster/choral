import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatPersistence } from '../../../src/composables/useChatPersistence.js';

describe('useChatPersistence', () => {
  let chatPersistence;
  let mockApi;

  beforeEach(() => {
    chatPersistence = useChatPersistence();
    mockApi = {
      getChat: vi.fn(),
      saveChat: vi.fn()
    };
    global.fetch = vi.fn();
  });

  describe('loadChat', () => {
    it('should load chat with branch structure', async () => {
      mockApi.getChat.mockResolvedValue({
        branches: {
          'branch-main': { id: 'branch-main', messages: [{ role: 'user', content: 'Hi' }] }
        },
        mainBranch: 'branch-main',
        currentBranch: 'branch-main',
        title: 'Test Chat'
      });

      const result = await chatPersistence.loadChat({
        chatId: 'chat-123',
        api: mockApi
      });

      expect(result.chatId).toBe('chat-123');
      expect(result.branches).toBeDefined();
      expect(result.mainBranch).toBe('branch-main');
      expect(result.displayTitle).toBe('Test Chat');
      expect(result.messages).toHaveLength(1);
    });

    it('should load chat with old format', async () => {
      mockApi.getChat.mockResolvedValue({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ]
      });

      const result = await chatPersistence.loadChat({
        chatId: 'chat-456',
        api: mockApi
      });

      expect(result.branches).toBeNull();
      expect(result.messages).toHaveLength(2);
    });

    it('should apply normalizeMessages function', async () => {
      mockApi.getChat.mockResolvedValue({
        messages: [{ role: 'user', content: 'test' }]
      });

      const normalizeFn = vi.fn(m => m.map(msg => ({ ...msg, normalized: true })));

      await chatPersistence.loadChat({
        chatId: 'chat-789',
        api: mockApi,
        normalizeMessages: normalizeFn
      });

      expect(normalizeFn).toHaveBeenCalled();
    });
  });

  describe('saveChat', () => {
    it('should save chat with all data', async () => {
      mockApi.saveChat.mockResolvedValue({ filename: 'chat-new.json' });

      const result = await chatPersistence.saveChat({
        chatId: null,
        character: { data: { name: 'Alice' } },
        characterFilename: 'alice.png',
        persona: { _filename: 'default.json' },
        messages: [{ role: 'user', content: 'Hi' }],
        branches: null,
        mainBranch: null,
        currentBranch: null,
        api: mockApi
      });

      expect(result.filename).toBe('chat-new.json');
      expect(mockApi.saveChat).toHaveBeenCalledWith(
        expect.objectContaining({
          character: 'Alice',
          characterFilename: 'alice.png',
          personaFilename: 'default.json'
        })
      );
    });

    it('should update branch messages before saving', async () => {
      mockApi.saveChat.mockResolvedValue({ filename: 'chat-123.json' });

      await chatPersistence.saveChat({
        chatId: 'chat-123.json',
        character: { data: { name: 'Test' } },
        characterFilename: 'test.png',
        persona: null,
        messages: [{ role: 'user', content: 'New message' }],
        branches: {
          'branch-main': { id: 'branch-main', messages: [{ role: 'user', content: 'Old' }] }
        },
        mainBranch: 'branch-main',
        currentBranch: 'branch-main',
        api: mockApi
      });

      const savedData = mockApi.saveChat.mock.calls[0][0];
      expect(savedData.branches['branch-main'].messages[0].content).toBe('New message');
    });

    it('should handle missing character gracefully', async () => {
      mockApi.saveChat.mockResolvedValue({ filename: 'chat-123.json' });

      await chatPersistence.saveChat({
        chatId: null,
        character: null,
        characterFilename: 'test.png',
        persona: null,
        messages: [],
        branches: null,
        mainBranch: null,
        currentBranch: null,
        api: mockApi
      });

      const savedData = mockApi.saveChat.mock.calls[0][0];
      expect(savedData.character).toBe('Unknown');
    });
  });

  describe('loadMostRecentChat', () => {
    it('should load most recent chat for character', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          filename: 'recent-chat.json',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      const result = await chatPersistence.loadMostRecentChat({
        characterFilename: 'alice.png'
      });

      expect(result.chatId).toBe('recent-chat.json');
      expect(result.messages).toHaveLength(1);
    });

    it('should return null if no chat found', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await chatPersistence.loadMostRecentChat({
        characterFilename: 'missing.png'
      });

      expect(result).toBeNull();
    });
  });

  describe('autoNameChat', () => {
    it('should skip if no messages', async () => {
      const result = await chatPersistence.autoNameChat({
        chatId: 'chat-123',
        chat: { messages: [] },
        isGroupChat: false
      });

      expect(result.skipped).toBe(true);
    });

    it('should skip if already auto-named', async () => {
      const result = await chatPersistence.autoNameChat({
        chatId: 'chat-123',
        chat: { messages: [{ role: 'user', content: 'Hi' }], autoNamed: true },
        isGroupChat: false
      });

      expect(result.skipped).toBe(true);
    });

    it('should call correct endpoint for regular chat', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'Auto-generated Title' })
      });

      const result = await chatPersistence.autoNameChat({
        chatId: 'chat-123',
        chat: { messages: [{ role: 'user', content: 'Hi' }] },
        isGroupChat: false
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chats/chat-123/auto-name',
        expect.any(Object)
      );
      expect(result.title).toBe('Auto-generated Title');
    });

    it('should call correct endpoint for group chat', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'Group Title' })
      });

      await chatPersistence.autoNameChat({
        chatId: 'gc-123',
        chat: { messages: [{ role: 'user', content: 'Hi' }] },
        isGroupChat: true
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/group-chats/gc-123/auto-name',
        expect.any(Object)
      );
    });
  });

  describe('normalizeMessages', () => {
    it('should convert old format to swipe format', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const result = chatPersistence.normalizeMessages(messages);

      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[1].swipes).toEqual(['Hi there!']);
      expect(result[1].swipeIndex).toBe(0);
    });

    it('should preserve existing swipe format', () => {
      const messages = [
        {
          role: 'assistant',
          swipes: ['Response 1', 'Response 2'],
          swipeIndex: 1
        }
      ];

      const result = chatPersistence.normalizeMessages(messages);

      expect(result[0].swipes).toEqual(['Response 1', 'Response 2']);
      expect(result[0].swipeIndex).toBe(1);
    });

    it('should add swipeCharacters for group chat', () => {
      const messages = [
        {
          role: 'assistant',
          swipes: ['Hello'],
          swipeIndex: 0,
          characterFilename: 'alice.png'
        }
      ];

      const result = chatPersistence.normalizeMessages(messages, true);

      expect(result[0].swipeCharacters).toEqual(['alice.png']);
    });

    it('should initialize swipeCharacters when converting old format in group chat', () => {
      const messages = [
        { role: 'assistant', content: 'Hi!', characterFilename: 'bob.png' }
      ];

      const result = chatPersistence.normalizeMessages(messages, true);

      expect(result[0].swipeCharacters).toEqual(['bob.png']);
      expect(result[0].characterFilename).toBe('bob.png');
    });
  });
});
