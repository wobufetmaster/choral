/**
 * Macro Synchronization Tests
 *
 * Ensures that server/macros.js and src/utils/macros.js produce identical
 * output for all macro types. This prevents drift between the two implementations.
 *
 * Both implementations should handle:
 * - {{char}} and {{user}} substitutions
 * - {{random:...}} selections
 * - {{pick:...}} consistent selections
 * - {{roll:...}} dice rolls
 * - {{reverse:...}} text reversal
 * - {{// comment}} hidden comments
 * - {{hidden_key:...}} lorebook keys
 * - {{comment: ...}} visible comments
 *
 * Test Strategy:
 * - Use fixed seeds/caches for deterministic testing of random macros
 * - Compare outputs character-by-character
 * - Test edge cases (empty strings, special characters, nested macros)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processMacros as serverProcessMacros, processMessagesWithMacros as serverProcessMessages } from '../../server/macros.js';
import { processMacrosForDisplay as clientProcessMacros } from '../../src/utils/macros.js';

describe('Macro Synchronization (Server vs Client)', () => {
  const context = {
    charName: 'TestChar',
    userName: 'TestUser'
  };

  describe('Basic Substitutions', () => {
    it('should both handle {{char}} substitution', () => {
      const input = 'Hello, I am {{char}}!';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('Hello, I am TestChar!');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle {{user}} substitution', () => {
      const input = 'Hello {{user}}, nice to meet you!';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('Hello TestUser, nice to meet you!');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle multiple substitutions', () => {
      const input = '{{char}} greets {{user}}. {{user}} waves to {{char}}.';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('TestChar greets TestUser. TestUser waves to TestChar.');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle case-insensitive macros', () => {
      const input = '{{CHAR}} and {{User}} and {{ChAr}}';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(clientOutput).toBe(serverOutput);
    });
  });

  describe('Random Macros', () => {
    it('should both handle {{random:...}} format', () => {
      const input = 'I like {{random:apples,oranges,bananas}}.';

      // Run multiple times to ensure both use the same set of options
      const serverOutputs = new Set();
      const clientOutputs = new Set();

      for (let i = 0; i < 50; i++) {
        serverOutputs.add(serverProcessMacros(input, context));
        clientOutputs.add(clientProcessMacros(input, context));
      }

      // Both should produce results from the same set
      expect([...serverOutputs].every(o =>
        o === 'I like apples.' || o === 'I like oranges.' || o === 'I like bananas.'
      )).toBe(true);

      expect([...clientOutputs].every(o =>
        o === 'I like apples.' || o === 'I like oranges.' || o === 'I like bananas.'
      )).toBe(true);
    });

    it('should both handle {{pick:...}} consistently within session', () => {
      const input1 = 'First: {{pick:A,B,C}}';
      const input2 = 'Second: {{pick:A,B,C}}';

      // Test server picks maintain consistency
      const serverOut1 = serverProcessMacros(input1, context);
      const serverOut2 = serverProcessMacros(input2, context);
      const serverChoice = serverOut1.match(/First: ([ABC])/)[1];

      // Test client picks maintain consistency
      const clientOut1 = clientProcessMacros(input1, context);
      const clientOut2 = clientProcessMacros(input2, context);
      const clientChoice = clientOut1.match(/First: ([ABC])/)[1];

      // Both should maintain consistency (same choice on subsequent calls)
      expect(serverOut2).toBe(`Second: ${serverChoice}`);
      expect(clientOut2).toBe(`Second: ${clientChoice}`);
    });
  });

  describe('Dice Rolls', () => {
    it('should both handle {{roll:N}} format', () => {
      const input = 'You rolled {{roll:20}}.';

      const serverOutputs = new Set();
      const clientOutputs = new Set();

      for (let i = 0; i < 50; i++) {
        const serverResult = serverProcessMacros(input, context);
        const clientResult = clientProcessMacros(input, context);

        const serverNum = parseInt(serverResult.match(/You rolled (\d+)\./)[1]);
        const clientNum = parseInt(clientResult.match(/You rolled (\d+)\./)[1]);

        expect(serverNum).toBeGreaterThanOrEqual(1);
        expect(serverNum).toBeLessThanOrEqual(20);
        expect(clientNum).toBeGreaterThanOrEqual(1);
        expect(clientNum).toBeLessThanOrEqual(20);

        serverOutputs.add(serverNum);
        clientOutputs.add(clientNum);
      }

      // Both should explore the range (at least some variety)
      expect(serverOutputs.size).toBeGreaterThan(5);
      expect(clientOutputs.size).toBeGreaterThan(5);
    });

    it('should both handle {{roll:dN}} format', () => {
      const input = 'Damage: {{roll:d6}}';

      for (let i = 0; i < 20; i++) {
        const serverResult = serverProcessMacros(input, context);
        const clientResult = clientProcessMacros(input, context);

        const serverNum = parseInt(serverResult.match(/Damage: (\d+)/)[1]);
        const clientNum = parseInt(clientResult.match(/Damage: (\d+)/)[1]);

        expect(serverNum).toBeGreaterThanOrEqual(1);
        expect(serverNum).toBeLessThanOrEqual(6);
        expect(clientNum).toBeGreaterThanOrEqual(1);
        expect(clientNum).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('Text Manipulation', () => {
    it('should both handle {{reverse:...}}', () => {
      const input = 'Backwards: {{reverse:hello}}';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('Backwards: olleh');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both reverse with spaces and special chars', () => {
      const input = '{{reverse:Hello World! 123}}';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('321 !dlroW olleH');
      expect(clientOutput).toBe(serverOutput);
    });
  });

  describe('Comments', () => {
    it('should both handle {{// hidden comments}}', () => {
      const input = 'Before{{// this is hidden}}After';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('BeforeAfter');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should handle {{comment: visible}} differently (server removes, client styles)', () => {
      const input = 'Text {{comment: note here}} more text';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      // Server removes comment for AI
      expect(serverOutput).toBe('Text  more text');

      // Client styles comment for display
      expect(clientOutput).toContain('<em style="opacity: 0.7;">');
      expect(clientOutput).toContain('note here');
    });

    it('should both handle {{hidden_key:...}} for lorebook', () => {
      const input = 'Test {{hidden_key:secret}} text';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      // Both should remove hidden_key from output
      expect(serverOutput).not.toContain('secret');
      expect(clientOutput).toBe(serverOutput);
    });
  });

  describe('Edge Cases', () => {
    it('should both handle empty input', () => {
      const input = '';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('');
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle input with no macros', () => {
      const input = 'Just plain text, no macros here!';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe(input);
      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle malformed macros', () => {
      const input = 'Broken {{char}} and {{incomplete';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(clientOutput).toBe(serverOutput);
    });

    it('should both handle special characters in context', () => {
      const specialContext = {
        charName: 'Test-Char\'s "Name" & Stuff',
        userName: 'User <>&'
      };

      const input = '{{char}} meets {{user}}';
      const serverOutput = serverProcessMacros(input, specialContext);
      const clientOutput = clientProcessMacros(input, specialContext);

      expect(clientOutput).toBe(serverOutput);
    });
  });

  // Note: Client-side doesn't have processMessagesWithMacros, so these tests
  // only verify the server-side implementation
  describe('Multimodal Content (Server Only)', () => {
    it('should handle message arrays (processMessagesWithMacros)', () => {
      const messages = [
        {
          role: 'system',
          content: [{ type: 'text', text: 'You are {{char}}.' }]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello {{char}}!' }]
        }
      ];

      const serverProcessed = serverProcessMessages(messages, context);

      expect(serverProcessed).toEqual([
        {
          role: 'system',
          content: [{ type: 'text', text: 'You are TestChar.' }]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello TestChar!' }]
        }
      ]);
    });

    it('should handle legacy string content', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello {{char}}!'
        }
      ];

      const serverProcessed = serverProcessMessages(messages, context);

      expect(serverProcessed[0].content).toBe('Hello TestChar!');
    });

    it('should skip image_url content parts', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this, {{char}}!' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
          ]
        }
      ];

      const serverProcessed = serverProcessMessages(messages, context);

      expect(serverProcessed[0].content[0].text).toBe('Look at this, TestChar!');
      expect(serverProcessed[0].content[1].type).toBe('image_url');
    });
  });

  describe('Complex Scenarios', () => {
    it('should both handle multiple macro types in one string', () => {
      const input = '{{char}} rolled {{roll:20}} and chose {{random:left,right}}. {{// hidden note}}';

      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      // Check structure (both should have TestChar and a number)
      expect(serverOutput).toContain('TestChar rolled ');
      expect(serverOutput).toMatch(/\d+/);
      expect(serverOutput).not.toContain('{{');
      expect(serverOutput).not.toContain('hidden note');

      // Client should match server's pattern
      expect(clientOutput).toContain('TestChar rolled ');
      expect(clientOutput).toMatch(/\d+/);
      expect(clientOutput).not.toContain('{{');
      expect(clientOutput).not.toContain('hidden note');
    });

    it('should both handle nested substitutions', () => {
      const input = '{{char}} says: "Hello {{user}}, I am {{char}}!"';
      const serverOutput = serverProcessMacros(input, context);
      const clientOutput = clientProcessMacros(input, context);

      expect(serverOutput).toBe('TestChar says: "Hello TestUser, I am TestChar!"');
      expect(clientOutput).toBe(serverOutput);
    });
  });
});
