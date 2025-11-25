import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGroupChatOperations } from '../../../src/composables/useGroupChatOperations.js';

describe('useGroupChatOperations', () => {
  let groupChatOps;
  let mockApi;

  beforeEach(() => {
    groupChatOps = useGroupChatOperations();
    mockApi = {
      getGroupChat: vi.fn(),
      getCharacter: vi.fn(),
      saveGroupChat: vi.fn()
    };
  });

  describe('loadGroupChat', () => {
    it('should load and refresh character data', async () => {
      mockApi.getGroupChat.mockResolvedValue({
        characters: [
          { filename: 'alice.png', name: 'Alice', data: { description: 'old' } }
        ],
        strategy: 'join',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      mockApi.getCharacter.mockResolvedValue({
        data: { name: 'Alice Updated', description: 'new' }
      });

      const result = await groupChatOps.loadGroupChat({
        groupChatId: 'gc-123',
        api: mockApi
      });

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].name).toBe('Alice Updated');
      expect(result.strategy).toBe('join');
      expect(result.messages).toHaveLength(1);
    });

    it('should handle branch structure', async () => {
      mockApi.getGroupChat.mockResolvedValue({
        characters: [],
        branches: {
          'branch-main': { id: 'branch-main', messages: [{ role: 'user', content: 'Hi' }] }
        },
        mainBranch: 'branch-main',
        currentBranch: 'branch-main'
      });

      const result = await groupChatOps.loadGroupChat({
        groupChatId: 'gc-123',
        api: mockApi
      });

      expect(result.branches).toBeDefined();
      expect(result.mainBranch).toBe('branch-main');
      expect(result.messages).toHaveLength(1);
    });

    it('should use cached character data if refresh fails', async () => {
      mockApi.getGroupChat.mockResolvedValue({
        characters: [
          { filename: 'missing.png', name: 'Missing', data: { description: 'cached' } }
        ],
        messages: []
      });

      mockApi.getCharacter.mockRejectedValue(new Error('Not found'));

      const result = await groupChatOps.loadGroupChat({
        groupChatId: 'gc-123',
        api: mockApi
      });

      expect(result.characters[0].name).toBe('Missing');
    });
  });

  describe('initializeGroupChat', () => {
    it('should create messages with greetings for each character', async () => {
      mockApi.getCharacter.mockResolvedValueOnce({
        data: {
          first_mes: 'Hello from Alice!',
          alternate_greetings: ['Hey there!']
        }
      }).mockResolvedValueOnce({
        data: {
          first_mes: 'Greetings from Bob!'
        }
      });

      const messages = await groupChatOps.initializeGroupChat({
        characters: [
          { filename: 'alice.png', name: 'Alice' },
          { filename: 'bob.png', name: 'Bob' }
        ],
        api: mockApi
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].swipes).toEqual(['Hello from Alice!', 'Hey there!']);
      expect(messages[0].characterFilename).toBe('alice.png');
      expect(messages[1].swipes).toEqual(['Greetings from Bob!']);
    });

    it('should return empty array for no characters', async () => {
      const messages = await groupChatOps.initializeGroupChat({
        characters: [],
        api: mockApi
      });

      expect(messages).toEqual([]);
    });
  });

  describe('saveGroupChat', () => {
    it('should save group chat with all data', async () => {
      mockApi.saveGroupChat.mockResolvedValue({ filename: 'gc-new.json' });

      const result = await groupChatOps.saveGroupChat({
        groupChatId: null,
        characters: [{ filename: 'alice.png', name: 'Alice' }],
        strategy: 'join',
        explicitMode: false,
        name: 'Test Group',
        tags: ['test'],
        conversationGroup: 'group-1',
        displayTitle: 'Test Chat',
        messages: [{ role: 'user', content: 'Hi' }],
        branches: null,
        mainBranch: null,
        currentBranch: null,
        api: mockApi
      });

      expect(result.filename).toBe('gc-new.json');
      expect(mockApi.saveGroupChat).toHaveBeenCalledWith(
        expect.objectContaining({
          isGroupChat: true,
          name: 'Test Group',
          strategy: 'join'
        })
      );
    });

    it('should update branch messages before saving', async () => {
      mockApi.saveGroupChat.mockResolvedValue({ filename: 'gc-123.json' });

      await groupChatOps.saveGroupChat({
        groupChatId: 'gc-123.json',
        characters: [],
        strategy: 'join',
        explicitMode: false,
        name: '',
        tags: [],
        conversationGroup: null,
        displayTitle: '',
        messages: [{ role: 'user', content: 'New message' }],
        branches: {
          'branch-main': { id: 'branch-main', messages: [{ role: 'user', content: 'Old' }] }
        },
        mainBranch: 'branch-main',
        currentBranch: 'branch-main',
        api: mockApi
      });

      const savedData = mockApi.saveGroupChat.mock.calls[0][0];
      expect(savedData.branches['branch-main'].messages[0].content).toBe('New message');
    });
  });

  describe('convertToGroupChat', () => {
    it('should convert character to group format', () => {
      const result = groupChatOps.convertToGroupChat({
        character: { data: { name: 'Alice', description: 'Test' } },
        characterFilename: 'alice.png',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', swipes: ['Hi!'], swipeIndex: 0 }
        ]
      });

      expect(result.isGroupChat).toBe(true);
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].filename).toBe('alice.png');
      expect(result.messages[1].characterFilename).toBe('alice.png');
    });

    it('should not overwrite existing characterFilename', () => {
      const result = groupChatOps.convertToGroupChat({
        character: { data: { name: 'Alice' } },
        characterFilename: 'alice.png',
        messages: [
          { role: 'assistant', characterFilename: 'bob.png', swipes: ['Hi'] }
        ]
      });

      expect(result.messages[0].characterFilename).toBe('bob.png');
    });
  });

  describe('addCharacterToGroup', () => {
    it('should add character to group', () => {
      const result = groupChatOps.addCharacterToGroup({
        characterFilename: 'bob.png',
        allCharacters: [
          { filename: 'bob.png', name: 'Bob', data: { description: 'Test' } }
        ],
        currentCharacters: [{ filename: 'alice.png' }]
      });

      expect(result).not.toBeNull();
      expect(result.filename).toBe('bob.png');
      expect(result.name).toBe('Bob');
    });

    it('should return null if character not found', () => {
      const result = groupChatOps.addCharacterToGroup({
        characterFilename: 'missing.png',
        allCharacters: [],
        currentCharacters: []
      });

      expect(result).toBeNull();
    });

    it('should return null if already in group', () => {
      const result = groupChatOps.addCharacterToGroup({
        characterFilename: 'alice.png',
        allCharacters: [{ filename: 'alice.png', name: 'Alice' }],
        currentCharacters: [{ filename: 'alice.png' }]
      });

      expect(result).toBeNull();
    });
  });

  describe('removeCharacterFromGroup', () => {
    it('should remove character at index', () => {
      const result = groupChatOps.removeCharacterFromGroup({
        index: 1,
        characters: [
          { filename: 'alice.png' },
          { filename: 'bob.png' },
          { filename: 'charlie.png' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.characters).toHaveLength(2);
      expect(result.characters[1].filename).toBe('charlie.png');
    });

    it('should prevent removing last character', () => {
      const result = groupChatOps.removeCharacterFromGroup({
        index: 0,
        characters: [{ filename: 'alice.png' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot have empty group chat');
    });
  });

  describe('moveCharacterUp/Down', () => {
    const characters = [
      { filename: 'alice.png' },
      { filename: 'bob.png' },
      { filename: 'charlie.png' }
    ];

    it('should move character up', () => {
      const result = groupChatOps.moveCharacterUp(1, characters);
      expect(result[0].filename).toBe('bob.png');
      expect(result[1].filename).toBe('alice.png');
    });

    it('should return null if already at top', () => {
      const result = groupChatOps.moveCharacterUp(0, characters);
      expect(result).toBeNull();
    });

    it('should move character down', () => {
      const result = groupChatOps.moveCharacterDown(1, characters);
      expect(result[1].filename).toBe('charlie.png');
      expect(result[2].filename).toBe('bob.png');
    });

    it('should return null if already at bottom', () => {
      const result = groupChatOps.moveCharacterDown(2, characters);
      expect(result).toBeNull();
    });
  });
});
