import { describe, it, expect } from 'vitest';
import {
  scanEntries,
  buildScanText,
  processLorebook,
  formatEntriesAsMessages,
  injectEntries
} from '../../../server/lorebook.js';

describe('Lorebook Processing', () => {
  describe('scanEntries', () => {
    it('should match entries by keyword (case insensitive)', () => {
      const entries = [
        { name: 'Dragon', keys: ['dragon', 'wyrm'], content: 'A powerful reptile' },
        { name: 'Castle', keys: ['castle', 'fortress'], content: 'A medieval structure' }
      ];
      const text = 'The DRAGON flew over the castle.';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(2);
      expect(matched[0].name).toBe('Dragon');
      expect(matched[1].name).toBe('Castle');
    });

    it('should match entries by regex', () => {
      const entries = [
        { name: 'Number', regex: '\\d+', content: 'A numeric value' }
      ];
      const text = 'There are 42 dragons.';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Number');
      expect(matched[0].matchType).toBe('regex');
    });

    it('should always match constant entries', () => {
      const entries = [
        { name: 'World Info', constant: true, content: 'Always include this' },
        { name: 'Dragon', keys: ['dragon'], content: 'Only with keyword' }
      ];
      const text = 'A knight walked through the forest.';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('World Info');
      expect(matched[0].matchType).toBe('constant');
    });

    it('should always match alwaysOn entries', () => {
      const entries = [
        { name: 'Setting', alwaysOn: true, content: 'Fantasy world' },
        { name: 'Dragon', keys: ['dragon'], content: 'Only with keyword' }
      ];
      const text = 'A knight walked through the forest.';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Setting');
    });

    it('should skip disabled entries', () => {
      const entries = [
        { name: 'Dragon', keys: ['dragon'], content: 'Active', enabled: true },
        { name: 'Goblin', keys: ['goblin'], content: 'Disabled', enabled: false }
      ];
      const text = 'A dragon and a goblin appeared.';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Dragon');
    });

    it('should sort matched entries by priority (descending)', () => {
      const entries = [
        { name: 'Low', keys: ['test'], priority: 10, content: 'Low priority' },
        { name: 'High', keys: ['test'], priority: 100, content: 'High priority' },
        { name: 'Medium', keys: ['test'], priority: 50, content: 'Medium priority' }
      ];
      const text = 'test';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(3);
      expect(matched[0].name).toBe('High');
      expect(matched[1].name).toBe('Medium');
      expect(matched[2].name).toBe('Low');
    });

    it('should handle entries without priority (default 0)', () => {
      const entries = [
        { name: 'With Priority', keys: ['test'], priority: 10, content: 'Has priority' },
        { name: 'No Priority', keys: ['test'], content: 'No priority' }
      ];
      const text = 'test';

      const matched = scanEntries(entries, text);

      expect(matched).toHaveLength(2);
      expect(matched[0].name).toBe('With Priority');
      expect(matched[1].name).toBe('No Priority');
    });

    it('should handle invalid regex gracefully', () => {
      const entries = [
        { name: 'Bad Regex', regex: '[invalid(', content: 'Invalid pattern' },
        { name: 'Good Entry', keys: ['test'], content: 'Valid entry' }
      ];
      const text = 'test';

      const matched = scanEntries(entries, text);

      // Only the good entry should match
      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Good Entry');
    });
  });

  describe('buildScanText', () => {
    it('should combine all message content when scanDepth is 0', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = buildScanText(messages, 0);

      expect(result).toBe('Hello\nHi there\nHow are you?');
    });

    it('should only use recent messages when scanDepth is set', () => {
      const messages = [
        { role: 'user', content: 'Old message 1' },
        { role: 'assistant', content: 'Old message 2' },
        { role: 'user', content: 'Recent message 1' },
        { role: 'assistant', content: 'Recent message 2' }
      ];

      const result = buildScanText(messages, 2);

      expect(result).toBe('Recent message 1\nRecent message 2');
    });

    it('should handle empty messages array', () => {
      const result = buildScanText([], 0);
      expect(result).toBe('');
    });
  });

  describe('processLorebook', () => {
    it('should process lorebook and return matched entries', () => {
      const lorebook = {
        entries: [
          { name: 'Dragon', keys: ['dragon'], content: 'A dragon entry' },
          { name: 'Castle', keys: ['castle'], content: 'A castle entry' }
        ],
        scanDepth: 0
      };
      const messages = [
        { role: 'user', content: 'I see a dragon!' }
      ];

      const matched = processLorebook(lorebook, messages);

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Dragon');
    });

    it('should respect lorebook scanDepth setting', () => {
      const lorebook = {
        entries: [
          { name: 'Dragon', keys: ['dragon'], content: 'A dragon entry' }
        ],
        scanDepth: 1
      };
      const messages = [
        { role: 'user', content: 'dragon appears' },
        { role: 'assistant', content: 'no match here' }
      ];

      const matched = processLorebook(lorebook, messages);

      // Should only scan the last message
      expect(matched).toHaveLength(0);
    });

    it('should return empty array for empty lorebook', () => {
      const lorebook = { entries: [] };
      const messages = [{ role: 'user', content: 'test' }];

      const matched = processLorebook(lorebook, messages);

      expect(matched).toHaveLength(0);
    });

    it('should return empty array for null lorebook', () => {
      const matched = processLorebook(null, []);
      expect(matched).toHaveLength(0);
    });
  });

  describe('formatEntriesAsMessages', () => {
    it('should format entries as system messages by default', () => {
      const entries = [
        { name: 'Entry1', content: 'Content 1' },
        { name: 'Entry2', content: 'Content 2' }
      ];

      const messages = formatEntriesAsMessages(entries);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('Content 1');
      expect(messages[1].role).toBe('system');
      expect(messages[1].content).toBe('Content 2');
    });

    it('should use text field if content is missing', () => {
      const entries = [
        { name: 'Entry1', text: 'Text content' }
      ];

      const messages = formatEntriesAsMessages(entries);

      expect(messages[0].content).toBe('Text content');
    });

    it('should support custom injection position', () => {
      const entries = [{ name: 'Entry1', content: 'Content' }];

      const messages = formatEntriesAsMessages(entries, 'user');

      expect(messages[0].role).toBe('user');
    });
  });

  describe('injectEntries', () => {
    it('should inject entries at the beginning by default', () => {
      const messages = [
        { role: 'user', content: 'User message' }
      ];
      const entries = [
        { name: 'Entry1', content: 'Entry content' }
      ];

      const result = injectEntries(messages, entries, 'before', 0);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('Entry content');
      expect(result[1].role).toBe('user');
    });

    it('should inject entries after system messages', () => {
      const messages = [
        { role: 'system', content: 'System 1' },
        { role: 'system', content: 'System 2' },
        { role: 'user', content: 'User message' }
      ];
      const entries = [
        { name: 'Entry1', content: 'Entry content' }
      ];

      const result = injectEntries(messages, entries, 'before', 2);

      expect(result).toHaveLength(4);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('System 1');
      expect(result[1].role).toBe('system');
      expect(result[1].content).toBe('System 2');
      expect(result[2].role).toBe('system');
      expect(result[2].content).toBe('Entry content');
      expect(result[3].role).toBe('user');
    });

    it('should inject entries at the end when position is after', () => {
      const messages = [
        { role: 'user', content: 'User message' }
      ];
      const entries = [
        { name: 'Entry1', content: 'Entry content' }
      ];

      const result = injectEntries(messages, entries, 'after');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('system');
    });

    it('should handle empty entries array', () => {
      const messages = [
        { role: 'user', content: 'User message' }
      ];

      const result = injectEntries(messages, [], 'before', 0);

      expect(result).toHaveLength(1);
      expect(result).toEqual(messages);
    });

    it('should inject multiple entries in order', () => {
      const messages = [
        { role: 'user', content: 'User message' }
      ];
      const entries = [
        { name: 'Entry1', content: 'First entry' },
        { name: 'Entry2', content: 'Second entry' },
        { name: 'Entry3', content: 'Third entry' }
      ];

      const result = injectEntries(messages, entries, 'before', 0);

      expect(result).toHaveLength(4);
      expect(result[0].content).toBe('First entry');
      expect(result[1].content).toBe('Second entry');
      expect(result[2].content).toBe('Third entry');
      expect(result[3].content).toBe('User message');
    });
  });

  describe('Multiple Lorebook Integration', () => {
    it('should combine entries from multiple lorebooks', () => {
      const lorebook1 = {
        entries: [
          { name: 'Dragon', keys: ['dragon'], content: 'Dragon info', priority: 100 }
        ]
      };
      const lorebook2 = {
        entries: [
          { name: 'Castle', keys: ['castle'], content: 'Castle info', priority: 50 }
        ]
      };
      const messages = [
        { role: 'user', content: 'A dragon guards the castle.' }
      ];

      const matched1 = processLorebook(lorebook1, messages);
      const matched2 = processLorebook(lorebook2, messages);
      const allEntries = [...matched1, ...matched2];

      // Sort by priority (as the server does)
      allEntries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      expect(allEntries).toHaveLength(2);
      expect(allEntries[0].name).toBe('Dragon'); // Higher priority
      expect(allEntries[1].name).toBe('Castle');
    });

    it('should handle priority sorting across multiple lorebooks', () => {
      const lorebook1 = {
        entries: [
          { name: 'Low Priority', keys: ['test'], content: 'Low', priority: 10 }
        ]
      };
      const lorebook2 = {
        entries: [
          { name: 'High Priority', keys: ['test'], content: 'High', priority: 100 }
        ]
      };
      const messages = [{ role: 'user', content: 'test' }];

      const matched1 = processLorebook(lorebook1, messages);
      const matched2 = processLorebook(lorebook2, messages);
      const allEntries = [...matched1, ...matched2];

      allEntries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      expect(allEntries[0].name).toBe('High Priority');
      expect(allEntries[1].name).toBe('Low Priority');
    });
  });
});
