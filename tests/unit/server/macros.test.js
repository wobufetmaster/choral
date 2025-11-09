import { describe, it, expect, beforeEach } from 'vitest';
import { processMacros, clearPickCache, processMessagesWithMacros } from '../../../server/macros.js';

describe('Macro Processing', () => {
  const context = {
    charName: 'TestChar',
    userName: 'TestUser'
  };

  beforeEach(() => {
    // Clear pick cache before each test to ensure consistency
    clearPickCache();
  });

  describe('{{char}} macro', () => {
    it('should replace {{char}} with character name', () => {
      const result = processMacros('Hello {{char}}!', context);
      expect(result).toBe('Hello TestChar!');
    });

    it('should replace multiple {{char}} instances', () => {
      const result = processMacros('{{char}} says hi. {{char}} is friendly.', context);
      expect(result).toBe('TestChar says hi. TestChar is friendly.');
    });

    it('should use nickname when provided', () => {
      const contextWithNickname = {
        charName: 'CharacterFullName',
        charNickname: 'Nick',
        userName: 'TestUser'
      };
      const result = processMacros('Hello {{char}}!', contextWithNickname);
      expect(result).toBe('Hello Nick!');
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{CHAR}} and {{Char}} and {{char}}', context);
      expect(result).toBe('TestChar and TestChar and TestChar');
    });
  });

  describe('{{user}} macro', () => {
    it('should replace {{user}} with user name', () => {
      const result = processMacros('Hello {{user}}!', context);
      expect(result).toBe('Hello TestUser!');
    });

    it('should replace multiple {{user}} instances', () => {
      const result = processMacros('{{user}} waves. {{user}} smiles.', context);
      expect(result).toBe('TestUser waves. TestUser smiles.');
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{USER}} and {{User}} and {{user}}', context);
      expect(result).toBe('TestUser and TestUser and TestUser');
    });
  });

  describe('{{random}} macro', () => {
    it('should choose one option from {{random}}', () => {
      const result = processMacros('{{random:A,B,C}}', context);
      expect(['A', 'B', 'C']).toContain(result);
    });

    it('should handle single option', () => {
      const result = processMacros('{{random:OnlyOne}}', context);
      expect(result).toBe('OnlyOne');
    });

    it('should handle options with spaces', () => {
      const result = processMacros('{{random:Option A, Option B, Option C}}', context);
      expect(['Option A', 'Option B', 'Option C']).toContain(result);
    });

    it('should potentially return different values on multiple calls', () => {
      // Run multiple times to check that it's actually random
      const results = new Set();
      for (let i = 0; i < 50; i++) {
        const result = processMacros('{{random:A,B,C}}', context);
        results.add(result);
      }
      // With 50 iterations, we should get at least 2 different values
      // (statistically almost certain)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('{{pick}} macro', () => {
    it('should consistently return same value for same input', () => {
      const input = '{{pick:A,B,C}}';
      const result1 = processMacros(input, context);
      const result2 = processMacros(input, context);
      expect(result1).toBe(result2);
    });

    it('should return one of the valid options', () => {
      const result = processMacros('{{pick:X,Y,Z}}', context);
      expect(['X', 'Y', 'Z']).toContain(result);
    });

    it('should handle single option', () => {
      const result = processMacros('{{pick:OnlyOne}}', context);
      expect(result).toBe('OnlyOne');
    });

    it('should maintain consistency across different contexts', () => {
      const input = '{{pick:Alpha,Beta,Gamma}}';
      const result1 = processMacros(input, context);
      const result2 = processMacros(input, { charName: 'Other', userName: 'Other' });
      expect(result1).toBe(result2);
    });
  });

  describe('{{roll}} macro', () => {
    it('should generate number within range for {{roll:10}}', () => {
      const result = processMacros('{{roll:10}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
    });

    it('should handle dice notation {{roll:d20}}', () => {
      const result = processMacros('{{roll:d20}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(20);
    });

    it('should generate number for {{roll:6}}', () => {
      const result = processMacros('{{roll:6}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(6);
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{ROLL:6}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(6);
    });

    it('should handle {{roll:100}} correctly', () => {
      const result = processMacros('{{roll:100}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(100);
    });
  });

  describe('{{reverse}} macro', () => {
    it('should reverse text', () => {
      const result = processMacros('{{reverse:hello}}', context);
      expect(result).toBe('olleh');
    });

    it('should reverse longer text', () => {
      const result = processMacros('{{reverse:testing123}}', context);
      expect(result).toBe('321gnitset');
    });

    it('should handle spaces', () => {
      const result = processMacros('{{reverse:hello world}}', context);
      expect(result).toBe('dlrow olleh');
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{REVERSE:test}}', context);
      expect(result).toBe('tset');
    });
  });

  describe('{{comment}} and {{//}} macros', () => {
    it('should remove {{// comment}} from text', () => {
      const result = processMacros('Hello {{// hidden comment}} world', context);
      expect(result).toBe('Hello  world');
    });

    it('should remove {{comment: text}} from text', () => {
      const result = processMacros('Hello {{comment: visible}} world', context);
      expect(result).toBe('Hello  world');
    });

    it('should remove multiple comments', () => {
      const result = processMacros('{{// start}} Text {{comment: middle}} more {{// end}}', context);
      expect(result).toBe(' Text  more ');
    });

    it('should keep comments when removeComments is false', () => {
      const result = processMacros('Hello {{// comment}} world', context, false);
      expect(result).toContain('{{// comment}}');
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{// test}} {{COMMENT: test}}', context);
      expect(result).toBe(' ');
    });
  });

  describe('{{hidden_key}} macro', () => {
    it('should remove hidden_key content', () => {
      const result = processMacros('Text {{hidden_key:secret}} more text', context);
      expect(result).toBe('Text  more text');
    });

    it('should remove multiple hidden_key macros', () => {
      const result = processMacros('{{hidden_key:key1}} Text {{hidden_key:key2}}', context);
      expect(result).toBe(' Text ');
    });

    it('should keep hidden_key when removeComments is false', () => {
      const result = processMacros('{{hidden_key:secret}}', context, false);
      expect(result).toContain('{{hidden_key:secret}}');
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{HIDDEN_KEY:test}}', context);
      expect(result).toBe('');
    });
  });

  describe('Nested macros', () => {
    it('should process nested macros', () => {
      const result = processMacros('{{char}} says: {{random:Hello,Hi}} {{user}}!', context);
      expect(result).toMatch(/TestChar says: (Hello|Hi) TestUser!/);
    });

    it('should handle complex nested combinations', () => {
      const result = processMacros('{{char}} rolled {{roll:6}} and said {{random:yes,no}}', context);
      expect(result).toMatch(/TestChar rolled [1-6] and said (yes|no)/);
    });

    it('should process macros within reversed text', () => {
      const result = processMacros('{{reverse:{{char}}}}', context);
      // First {{char}} is replaced, then reversed
      expect(result).toBe('rahCtseT');
    });

    it('should handle all macro types together', () => {
      const input = '{{char}} greets {{user}} {{// hidden}} and says {{random:hi,hello}}';
      const result = processMacros(input, context);
      expect(result).toMatch(/TestChar greets TestUser  and says (hi|hello)/);
    });
  });

  describe('{{date}} macro', () => {
    it('should return current date in readable format', () => {
      const result = processMacros('Today is {{date}}', context);
      // Match format like "January 1, 2025" or "December 31, 2024"
      expect(result).toMatch(/^Today is [A-Z][a-z]+ \d{1,2}, \d{4}$/);
    });

    it('should replace multiple {{date}} instances', () => {
      const result = processMacros('{{date}} and {{date}}', context);
      const parts = result.split(' and ');
      // Both should be the same date since called at same time
      expect(parts[0]).toBe(parts[1]);
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{DATE}}', context);
      expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    });

    it('should contain month name not number', () => {
      const result = processMacros('{{date}}', context);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const hasMonth = months.some(month => result.includes(month));
      expect(hasMonth).toBe(true);
    });
  });

  describe('{{isotime}} macro', () => {
    it('should return time in HH:MM format', () => {
      const result = processMacros('The time is {{isotime}}', context);
      expect(result).toMatch(/^The time is \d{2}:\d{2}$/);
    });

    it('should have valid hours (00-23) and minutes (00-59)', () => {
      const result = processMacros('{{isotime}}', context);
      const [hours, minutes] = result.split(':').map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThanOrEqual(23);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(59);
    });

    it('should replace multiple {{isotime}} instances', () => {
      const result = processMacros('{{isotime}} - {{isotime}}', context);
      // Both should be the same time since called at nearly same moment
      const times = result.split(' - ');
      expect(times[0]).toBe(times[1]);
    });

    it('should be case insensitive', () => {
      const result = processMacros('{{ISOTIME}}', context);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should always use zero padding', () => {
      const result = processMacros('{{isotime}}', context);
      const [hours, minutes] = result.split(':');
      expect(hours).toHaveLength(2);
      expect(minutes).toHaveLength(2);
    });
  });

  describe('{{characters_list}} macro', () => {
    it('should list available characters with filenames', () => {
      const contextWithChars = {
        ...context,
        characters: [
          { name: 'Alice', filename: 'alice.png' },
          { name: 'Bob', filename: 'bob.png' }
        ]
      };
      const result = processMacros('Characters: {{characters_list}}', contextWithChars);
      expect(result).toBe('Characters: - Alice (alice.png)\n- Bob (bob.png)');
    });

    it('should handle single character', () => {
      const contextWithChars = {
        ...context,
        characters: [
          { name: 'Solo', filename: 'solo.png' }
        ]
      };
      const result = processMacros('{{characters_list}}', contextWithChars);
      expect(result).toBe('- Solo (solo.png)');
    });

    it('should return fallback message when no characters available', () => {
      const result = processMacros('{{characters_list}}', context);
      expect(result).toBe('(no characters available)');
    });

    it('should return fallback when characters array is empty', () => {
      const contextWithEmptyChars = {
        ...context,
        characters: []
      };
      const result = processMacros('{{characters_list}}', contextWithEmptyChars);
      expect(result).toBe('(no characters available)');
    });

    it('should be case insensitive', () => {
      const contextWithChars = {
        ...context,
        characters: [
          { name: 'Test', filename: 'test.png' }
        ]
      };
      const result = processMacros('{{CHARACTERS_LIST}}', contextWithChars);
      expect(result).toBe('- Test (test.png)');
    });

    it('should handle characters with special characters in names', () => {
      const contextWithChars = {
        ...context,
        characters: [
          { name: "O'Brien", filename: 'obrien.png' },
          { name: 'Jean-Luc', filename: 'jean-luc.png' }
        ]
      };
      const result = processMacros('{{characters_list}}', contextWithChars);
      expect(result).toBe("- O'Brien (obrien.png)\n- Jean-Luc (jean-luc.png)");
    });
  });

  describe('processMessagesWithMacros', () => {
    describe('String content (legacy format)', () => {
      it('should process macros in string content', () => {
        const messages = [
          { role: 'user', content: 'Hello {{char}}!' },
          { role: 'assistant', content: 'Hi {{user}}!' }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content).toBe('Hello TestChar!');
        expect(result[1].content).toBe('Hi TestUser!');
      });

      it('should preserve message structure', () => {
        const messages = [
          { role: 'user', content: 'Test {{char}}', metadata: { timestamp: 123 } }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].role).toBe('user');
        expect(result[0].metadata).toEqual({ timestamp: 123 });
      });

      it('should handle empty array', () => {
        const result = processMessagesWithMacros([], context);
        expect(result).toEqual([]);
      });
    });

    describe('Multimodal content (array format)', () => {
      it('should process text parts and leave image parts unchanged', () => {
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello {{char}}!' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
            ]
          }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content[0].text).toBe('Hello TestChar!');
        expect(result[0].content[1]).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc123' }
        });
      });

      it('should handle multiple text parts', () => {
        const messages = [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: '{{char}} says:' },
              { type: 'text', text: 'Hello {{user}}!' }
            ]
          }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content[0].text).toBe('TestChar says:');
        expect(result[0].content[1].text).toBe('Hello TestUser!');
      });

      it('should handle mixed content with multiple images', () => {
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look {{user}}!' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,img1' } },
              { type: 'text', text: 'What does {{char}} think?' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,img2' } }
            ]
          }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content[0].text).toBe('Look TestUser!');
        expect(result[0].content[1].type).toBe('image_url');
        expect(result[0].content[2].text).toBe('What does TestChar think?');
        expect(result[0].content[3].type).toBe('image_url');
      });

      it('should preserve part structure with all fields', () => {
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: '{{char}}', metadata: { source: 'test' } }
            ]
          }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content[0]).toEqual({
          type: 'text',
          text: 'TestChar',
          metadata: { source: 'test' }
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle messages with neither string nor array content', () => {
        const messages = [
          { role: 'system', content: null },
          { role: 'user', content: undefined },
          { role: 'assistant', content: 123 }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content).toBeNull();
        expect(result[1].content).toBeUndefined();
        expect(result[2].content).toBe(123);
      });

      it('should handle empty content array', () => {
        const messages = [
          { role: 'user', content: [] }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content).toEqual([]);
      });

      it('should process all macros in multimodal messages', () => {
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: '{{char}} rolled {{roll:6}} and said {{random:hi,hello}}' }
            ]
          }
        ];
        const result = processMessagesWithMacros(messages, context);
        expect(result[0].content[0].text).toMatch(/TestChar rolled [1-6] and said (hi|hello)/);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = processMacros('', context);
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = processMacros(null, context);
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = processMacros(undefined, context);
      expect(result).toBeUndefined();
    });

    it('should handle text with no macros', () => {
      const result = processMacros('Just plain text', context);
      expect(result).toBe('Just plain text');
    });

    it('should handle malformed macros gracefully', () => {
      const result = processMacros('{{incomplete', context);
      expect(result).toBe('{{incomplete');
    });

    it('should use default values when context is missing fields', () => {
      const emptyContext = {};
      const result = processMacros('{{char}} and {{user}}', emptyContext);
      expect(result).toBe('Character and User');
    });
  });
});
