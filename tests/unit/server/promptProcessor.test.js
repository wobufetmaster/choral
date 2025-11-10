import { describe, it, expect } from 'vitest';
import { processPrompt, MODES } from '../../../server/promptProcessor.js';

describe('Prompt Processor', () => {
  const testMessages = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'system', content: 'You are friendly.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' }
  ];

  describe('merge_system mode', () => {
    it('should merge all system messages into one', () => {
      const result = processPrompt([...testMessages], MODES.MERGE_SYSTEM);

      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);

      // Extract text from content array
      const systemContent = systemMessages[0].content;
      const text = Array.isArray(systemContent)
        ? systemContent.find(p => p.type === 'text')?.text
        : systemContent;

      expect(text).toContain('You are helpful.');
      expect(text).toContain('You are friendly.');
    });

    it('should preserve user and assistant messages', () => {
      const result = processPrompt([...testMessages], MODES.MERGE_SYSTEM);

      const userMessages = result.filter(m => m.role === 'user');
      const assistantMessages = result.filter(m => m.role === 'assistant');

      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(1);
    });

    it('should handle messages without system prompts', () => {
      const noSystemMessages = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const result = processPrompt(noSystemMessages, MODES.MERGE_SYSTEM);
      const systemMessages = result.filter(m => m.role === 'system');

      expect(systemMessages.length).toBe(0);
      expect(result.length).toBe(2);
    });
  });

  describe('semi_strict mode', () => {
    it('should have one system message at start', () => {
      const result = processPrompt([...testMessages], MODES.SEMI_STRICT);

      expect(result[0].role).toBe('system');
      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);
    });

    it('should alternate user/assistant after system', () => {
      const result = processPrompt([...testMessages], MODES.SEMI_STRICT);

      for (let i = 1; i < result.length - 1; i++) {
        if (result[i].role === 'user') {
          expect(result[i + 1].role).toBe('assistant');
        }
      }
    });

    it('should merge consecutive same-role messages', () => {
      const consecutiveMessages = [
        { role: 'system', content: 'System 1' },
        { role: 'user', content: 'User 1' },
        { role: 'user', content: 'User 2' },
        { role: 'assistant', content: 'Assistant 1' }
      ];

      const result = processPrompt(consecutiveMessages, MODES.SEMI_STRICT);

      // Should have merged the two user messages
      const userMessages = result.filter(m => m.role === 'user');
      expect(userMessages.length).toBe(1);

      const userContent = userMessages[0].content;
      const text = Array.isArray(userContent)
        ? userContent.find(p => p.type === 'text')?.text
        : userContent;

      expect(text).toContain('User 1');
      expect(text).toContain('User 2');
    });
  });

  describe('strict mode', () => {
    it('should start with user message', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);
      expect(result[0].role).toBe('user');
    });

    it('should have no system messages', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);
      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(0);
    });

    it('should strictly alternate user/assistant', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);

      for (let i = 0; i < result.length - 1; i++) {
        if (result[i].role === 'user') {
          expect(result[i + 1].role).toBe('assistant');
        } else {
          expect(result[i + 1].role).toBe('user');
        }
      }
    });
  });

  describe('single_user mode', () => {
    it('should combine everything into one user message', () => {
      const result = processPrompt([...testMessages], MODES.SINGLE_USER);

      expect(result.length).toBe(1);
      expect(result[0].role).toBe('user');
    });

    it('should include role labels in content', () => {
      const result = processPrompt([...testMessages], MODES.SINGLE_USER);
      const content = result[0].content;

      // Extract text from content array
      const text = Array.isArray(content)
        ? content.find(p => p.type === 'text')?.text
        : content;

      expect(text).toContain('[System]');
      expect(text).toContain('[User]');
      expect(text).toContain('[Assistant]');
    });

    it('should preserve all message content', () => {
      const result = processPrompt([...testMessages], MODES.SINGLE_USER);
      const content = result[0].content;

      const text = Array.isArray(content)
        ? content.find(p => p.type === 'text')?.text
        : content;

      expect(text).toContain('You are helpful.');
      expect(text).toContain('Hello!');
      expect(text).toContain('Hi there!');
      expect(text).toContain('How are you?');
    });
  });

  describe('anthropic_prefill mode', () => {
    it('should have one system message at start', () => {
      const result = processPrompt([...testMessages], MODES.ANTHROPIC_PREFILL);
      expect(result[0].role).toBe('system');
    });

    it('should support assistant prefill at end', () => {
      const messagesEndingWithUser = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'Tell me a story' }
      ];

      const result = processPrompt(messagesEndingWithUser, MODES.ANTHROPIC_PREFILL, { prefill: 'Sure, I' });

      expect(result[result.length - 1].role).toBe('assistant');

      const lastContent = result[result.length - 1].content;
      const text = Array.isArray(lastContent)
        ? lastContent.find(p => p.type === 'text')?.text
        : lastContent;

      expect(text).toBe('Sure, I');
    });

    it('should work without prefill option', () => {
      const result = processPrompt([...testMessages], MODES.ANTHROPIC_PREFILL);

      // Should behave like semi-strict mode without prefill
      expect(result[0].role).toBe('system');
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('none mode', () => {
    it('should not modify messages', () => {
      const result = processPrompt([...testMessages], MODES.NONE);
      expect(result).toEqual(testMessages);
    });

    it('should preserve array structure', () => {
      const result = processPrompt([...testMessages], MODES.NONE);
      expect(result.length).toBe(testMessages.length);
      expect(result[0]).toEqual(testMessages[0]);
    });

    it('should return different array instance', () => {
      const result = processPrompt([...testMessages], MODES.NONE);
      expect(result).not.toBe(testMessages);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages array', () => {
      const result = processPrompt([], MODES.MERGE_SYSTEM);
      expect(result).toEqual([]);
    });

    it('should handle messages with only system prompts', () => {
      const systemOnly = [
        { role: 'system', content: 'Test 1' },
        { role: 'system', content: 'Test 2' }
      ];

      const result = processPrompt(systemOnly, MODES.MERGE_SYSTEM);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].role).toBe('system');
    });

    it('should handle multimodal content arrays', () => {
      const multimodalMessages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
          ]
        }
      ];

      const result = processPrompt(multimodalMessages, MODES.NONE);
      expect(result[0].content).toBeInstanceOf(Array);
      expect(result[0].content.length).toBe(2);
      expect(result[0].content[1].type).toBe('image_url');
    });

    it('should handle null/undefined gracefully', () => {
      expect(processPrompt(null, MODES.MERGE_SYSTEM)).toEqual([]);
      expect(processPrompt(undefined, MODES.MERGE_SYSTEM)).toEqual([]);
    });

    it('should handle unknown mode with fallback', () => {
      const result = processPrompt([...testMessages], 'unknown_mode');

      // Should fallback to merge_system (default)
      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);
    });

    it('should preserve image_url parts in single_user mode', () => {
      const multimodalMessages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
          ]
        },
        {
          role: 'assistant',
          content: 'I see a cat'
        }
      ];

      const result = processPrompt(multimodalMessages, MODES.SINGLE_USER);

      expect(result.length).toBe(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBeInstanceOf(Array);

      // Should have text part and image_url part
      const textPart = result[0].content.find(p => p.type === 'text');
      const imagePart = result[0].content.find(p => p.type === 'image_url');

      expect(textPart).toBeDefined();
      expect(imagePart).toBeDefined();
      expect(imagePart.image_url.url).toBe('data:image/png;base64,abc123');
    });

    it('should handle messages with empty content', () => {
      const messagesWithEmpty = [
        { role: 'system', content: '' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' }
      ];

      const result = processPrompt(messagesWithEmpty, MODES.MERGE_SYSTEM);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle strict mode when starting with assistant', () => {
      const startsWithAssistant = [
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'Hello!' }
      ];

      const result = processPrompt(startsWithAssistant, MODES.STRICT);

      // Should insert a user message at the start
      expect(result[0].role).toBe('user');
    });
  });

  describe('Content normalization', () => {
    it('should handle string content in merge_system mode', () => {
      const stringContentMessages = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' }
      ];

      const result = processPrompt(stringContentMessages, MODES.MERGE_SYSTEM);
      expect(result.length).toBe(2);
    });

    it('should handle mixed string and array content', () => {
      const mixedMessages = [
        { role: 'system', content: 'String system' },
        { role: 'user', content: [{ type: 'text', text: 'Array user' }] },
        { role: 'assistant', content: 'String assistant' }
      ];

      const result = processPrompt(mixedMessages, MODES.MERGE_SYSTEM);
      expect(result.length).toBe(3);
    });

    it('should extract text from complex content arrays', () => {
      const complexMessages = [
        {
          role: 'system',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' }
          ]
        }
      ];

      const result = processPrompt(complexMessages, MODES.MERGE_SYSTEM);
      const systemContent = result[0].content;
      const text = Array.isArray(systemContent)
        ? systemContent.find(p => p.type === 'text')?.text
        : systemContent;

      // Should combine multiple text parts
      expect(text).toContain('Part 1');
      expect(text).toContain('Part 2');
    });
  });

  describe('Prefill functionality', () => {
    it('should add prefill when last message is user in anthropic_prefill mode', () => {
      const messages = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' }
      ];

      const result = processPrompt(messages, MODES.ANTHROPIC_PREFILL, { prefill: 'Hello! I' });

      expect(result.length).toBe(3);
      expect(result[2].role).toBe('assistant');

      const prefillContent = result[2].content;
      const text = Array.isArray(prefillContent)
        ? prefillContent.find(p => p.type === 'text')?.text
        : prefillContent;

      expect(text).toBe('Hello! I');
    });

    it('should not add prefill when last message is assistant', () => {
      const messages = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const result = processPrompt(messages, MODES.ANTHROPIC_PREFILL, { prefill: 'Should not appear' });

      // Last message should still be the original assistant message
      expect(result[result.length - 1].role).toBe('assistant');

      const lastContent = result[result.length - 1].content;
      const text = Array.isArray(lastContent)
        ? lastContent.find(p => p.type === 'text')?.text
        : lastContent;

      expect(text).toBe('Hi!');
    });

    it('should not add prefill when prefill is empty string', () => {
      const messages = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' }
      ];

      const resultWithEmpty = processPrompt(messages, MODES.ANTHROPIC_PREFILL, { prefill: '' });
      const resultWithoutPrefill = processPrompt(messages, MODES.ANTHROPIC_PREFILL);

      expect(resultWithEmpty.length).toBe(resultWithoutPrefill.length);
    });
  });
});
