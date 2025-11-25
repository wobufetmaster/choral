import { describe, it, expect, beforeEach } from 'vitest';
import { useContextBuilder } from '../../../src/composables/useContextBuilder.js';

describe('useContextBuilder', () => {
  let contextBuilder;

  beforeEach(() => {
    contextBuilder = useContextBuilder();
  });

  describe('buildSingleChatContext', () => {
    it('should build context with preset system prompts using placeholders', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: 'You are {{description}}', role: 'system', injection_order: 0 }
          ]
        },
        character: {
          data: {
            description: 'a helpful assistant',
            personality: 'friendly'
          }
        },
        persona: { name: 'User', description: 'A curious person' },
        messages: []
      };

      const context = contextBuilder.buildSingleChatContext(options);

      expect(context).toHaveLength(2);
      expect(context[0].content).toBe('You are a helpful assistant');
      expect(context[1].content).toContain('User persona:');
    });

    it('should add character info as fallback when no placeholders used', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: 'Be helpful', role: 'system', injection_order: 0 }
          ]
        },
        character: {
          data: {
            description: 'a robot',
            personality: 'logical'
          }
        },
        persona: null,
        messages: []
      };

      const context = contextBuilder.buildSingleChatContext(options);

      expect(context).toHaveLength(2);
      expect(context[0].content).toBe('Be helpful');
      expect(context[1].content).toContain('Character: a robot');
    });

    it('should include conversation history', () => {
      const options = {
        settings: { systemPrompts: [] },
        character: { data: { description: 'test' } },
        persona: null,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', swipes: ['Hi there!'], swipeIndex: 0 }
        ]
      };

      const context = contextBuilder.buildSingleChatContext(options);

      expect(context).toHaveLength(3); // character info + 2 messages
      expect(context[1].role).toBe('user');
      expect(context[1].content).toBe('Hello');
      expect(context[2].role).toBe('assistant');
      expect(context[2].content).toBe('Hi there!');
    });

    it('should respect upToMessageIndex', () => {
      const options = {
        settings: { systemPrompts: [] },
        character: { data: {} },
        persona: null,
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', swipes: ['Response'], swipeIndex: 0 },
          { role: 'user', content: 'Second' }
        ],
        upToMessageIndex: 2
      };

      const context = contextBuilder.buildSingleChatContext(options);

      expect(context).toHaveLength(2);
      expect(context[0].content).toBe('First');
      expect(context[1].content).toBe('Response');
    });

    it('should sort prompts by injection order', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: 'Second', role: 'system', injection_order: 1 },
            { enabled: true, content: 'First', role: 'system', injection_order: 0 }
          ]
        },
        character: { data: { description: 'test' } },
        persona: null,
        messages: []
      };

      const context = contextBuilder.buildSingleChatContext(options);

      expect(context[0].content).toBe('First');
      expect(context[1].content).toBe('Second');
    });

    it('should skip disabled prompts', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: 'Enabled', role: 'system' },
            { enabled: false, content: 'Disabled', role: 'system' }
          ]
        },
        character: { data: { description: 'test' } },
        persona: null,
        messages: []
      };

      const context = contextBuilder.buildSingleChatContext(options);

      const contents = context.map(c => c.content);
      expect(contents).toContain('Enabled');
      expect(contents).not.toContain('Disabled');
    });
  });

  describe('buildGroupChatContext', () => {
    const createCharacter = (name, filename, description) => ({
      name,
      filename,
      data: { description, personality: `${name}'s personality` }
    });

    it('should build context with join strategy', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: '{{description}}', role: 'system' }
          ]
        },
        groupChatCharacters: [
          createCharacter('Alice', 'alice.png', 'A programmer'),
          createCharacter('Bob', 'bob.png', 'A designer')
        ],
        strategy: 'join',
        speakerFilename: null,
        persona: { name: 'User' },
        messages: []
      };

      const context = contextBuilder.buildGroupChatContext(options);

      expect(context[0].content).toContain('Alice');
      expect(context[0].content).toContain('Bob');
      expect(context[0].content).toContain('A programmer');
      expect(context[0].content).toContain('A designer');
    });

    it('should build context with swap strategy using speaker', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: '{{description}}', role: 'system' }
          ]
        },
        groupChatCharacters: [
          createCharacter('Alice', 'alice.png', 'A programmer'),
          createCharacter('Bob', 'bob.png', 'A designer')
        ],
        strategy: 'swap',
        speakerFilename: 'alice.png',
        persona: { name: 'User' },
        messages: []
      };

      const context = contextBuilder.buildGroupChatContext(options);

      expect(context[0].content).toContain('A programmer');
      expect(context[0].content).not.toContain('A designer');
    });

    it('should use fallback when no placeholders in join strategy', () => {
      const options = {
        settings: {
          systemPrompts: [
            { enabled: true, content: 'Chat with multiple characters', role: 'system' }
          ]
        },
        groupChatCharacters: [
          createCharacter('Alice', 'alice.png', 'A programmer'),
          createCharacter('Bob', 'bob.png', 'A designer')
        ],
        strategy: 'join',
        speakerFilename: null,
        persona: null,
        messages: []
      };

      const context = contextBuilder.buildGroupChatContext(options);

      expect(context).toHaveLength(2);
      expect(context[0].content).toBe('Chat with multiple characters');
      expect(context[1].content).toContain('Alice');
      expect(context[1].content).toContain('Bob');
    });

    it('should include persona description', () => {
      const options = {
        settings: { systemPrompts: [] },
        groupChatCharacters: [createCharacter('Alice', 'alice.png', 'test')],
        strategy: 'join',
        speakerFilename: null,
        persona: { name: 'TestUser', description: 'A test persona' },
        messages: []
      };

      const context = contextBuilder.buildGroupChatContext(options);

      const personaEntry = context.find(c => c.content.includes('User persona:'));
      expect(personaEntry).toBeDefined();
      expect(personaEntry.content).toContain('A test persona');
    });

    it('should include conversation history', () => {
      const options = {
        settings: { systemPrompts: [] },
        groupChatCharacters: [createCharacter('Alice', 'alice.png', 'test')],
        strategy: 'join',
        speakerFilename: null,
        persona: null,
        messages: [
          { role: 'user', content: 'Hello everyone' },
          { role: 'assistant', swipes: ['Hi!'], swipeIndex: 0, characterFilename: 'alice.png' }
        ]
      };

      const context = contextBuilder.buildGroupChatContext(options);

      expect(context.some(c => c.content === 'Hello everyone')).toBe(true);
      expect(context.some(c => c.content === 'Hi!')).toBe(true);
    });
  });
});
