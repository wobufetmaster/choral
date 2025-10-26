/**
 * Client-side macro processing
 * For displaying macros in the UI (comments should be visible here)
 */

/**
 * Macro metadata for documentation and validation
 */
export const MACRO_DEFINITIONS = [
  // Character Card Data (Essential - pulled from character cards)
  {
    pattern: '{{description}}',
    category: 'character_card',
    description: 'Physical appearance and basic character info from card',
    isCharacterData: true,
    example: 'Character: {{description}}'
  },
  {
    pattern: '{{personality}}',
    category: 'character_card',
    description: 'Personality traits and behaviors from card',
    isCharacterData: true,
    example: 'Personality: {{personality}}'
  },
  {
    pattern: '{{scenario}}',
    category: 'character_card',
    description: 'Current situation/context for the roleplay from card',
    isCharacterData: true,
    example: 'Scenario: {{scenario}}'
  },
  {
    pattern: '{{dialogue_examples}}',
    category: 'character_card',
    description: 'Example conversations showing character voice from card',
    isCharacterData: true,
    example: '{{dialogue_examples}}'
  },

  // Names & Identifiers
  {
    pattern: '{{char}}',
    category: 'names',
    description: 'Character name or nickname',
    isCharacterData: false,
    example: '{{char}} smiled warmly.'
  },
  {
    pattern: '{{user}}',
    category: 'names',
    description: 'User name or persona name',
    isCharacterData: false,
    example: '{{user}} waved hello.'
  },

  // Date & Time
  {
    pattern: '{{date}}',
    category: 'datetime',
    description: 'Current date (e.g., "October 26, 2025")',
    isCharacterData: false,
    example: 'Today is {{date}}'
  },
  {
    pattern: '{{isotime}}',
    category: 'datetime',
    description: 'Current time in HH:MM format (e.g., "14:30")',
    isCharacterData: false,
    example: 'Current time: {{isotime}}'
  },

  // Randomization
  {
    pattern: '{{random:...}}',
    category: 'randomization',
    description: 'Pick random option from comma-separated list each time',
    isCharacterData: false,
    example: '{{random:happy,sad,excited}}'
  },
  {
    pattern: '{{pick:...}}',
    category: 'randomization',
    description: 'Consistent random choice (cached per session)',
    isCharacterData: false,
    example: '{{pick:coffee,tea,water}}'
  },
  {
    pattern: '{{roll:N}}',
    category: 'randomization',
    description: 'Random number from 1 to N (also supports {{roll:dN}})',
    isCharacterData: false,
    example: 'You rolled a {{roll:20}}'
  },

  // Utilities
  {
    pattern: '{{reverse:...}}',
    category: 'utilities',
    description: 'Reverse the text inside',
    isCharacterData: false,
    example: '{{reverse:hello}} outputs "olleh"'
  },
  {
    pattern: '{{characters_list}}',
    category: 'utilities',
    description: 'List of all available characters with filenames',
    isCharacterData: false,
    example: 'Available: {{characters_list}}'
  },
  {
    pattern: '{{comment:...}}',
    category: 'utilities',
    description: 'Visible comment shown in UI as italics',
    isCharacterData: false,
    example: '{{comment:This is a note for readers}}'
  },
  {
    pattern: '{{//...}}',
    category: 'utilities',
    description: 'Hidden comment (removed from display and AI context)',
    isCharacterData: false,
    example: '{{// This is only visible in the editor}}'
  },
  {
    pattern: '{{hidden_key:...}}',
    category: 'utilities',
    description: 'Hidden lorebook scan key (not shown to AI or user)',
    isCharacterData: false,
    example: '{{hidden_key:secret_trigger}}'
  }
];

/**
 * Macro category metadata for organization
 */
export const MACRO_CATEGORIES = {
  character_card: {
    name: 'Character Card Data',
    order: 1,
    description: 'Essential macros that pull data from character cards'
  },
  names: {
    name: 'Names & Identifiers',
    order: 2,
    description: 'Character and user name substitution'
  },
  datetime: {
    name: 'Date & Time',
    order: 3,
    description: 'Current date and time values'
  },
  randomization: {
    name: 'Randomization',
    order: 4,
    description: 'Random selections and dice rolls'
  },
  utilities: {
    name: 'Utilities',
    order: 5,
    description: 'Text manipulation and special functions'
  }
};

const pickCache = new Map();

export function processMacrosForDisplay(text, context) {
  if (!text || typeof text !== 'string') return text;

  const charName = context.charNickname || context.charName || 'Character';
  const userName = context.userName || 'User';

  let result = text;

  // {{char}} - Character name/nickname
  result = result.replace(/\{\{char\}\}/gi, charName);

  // {{user}} - User name
  result = result.replace(/\{\{user\}\}/gi, userName);

  // {{random:A,B,C}} - Random choice
  result = result.replace(/\{\{random:([^}]+)\}\}/gi, (match, options) => {
    const choices = options.split(/(?<!\\),/).map(s => s.trim().replace(/\\,/g, ','));
    return choices[Math.floor(Math.random() * choices.length)];
  });

  // {{pick:A,B,C}} - Consistent random choice (cached)
  result = result.replace(/\{\{pick:([^}]+)\}\}/gi, (match, options) => {
    const key = `pick:${options}`;
    if (!pickCache.has(key)) {
      const choices = options.split(/(?<!\\),/).map(s => s.trim().replace(/\\,/g, ','));
      pickCache.set(key, choices[Math.floor(Math.random() * choices.length)]);
    }
    return pickCache.get(key);
  });

  // {{roll:N}} or {{roll:dN}} - Random number 1 to N
  result = result.replace(/\{\{roll:d?(\d+)\}\}/gi, (match, max) => {
    const maxNum = parseInt(max, 10);
    return Math.floor(Math.random() * maxNum) + 1;
  });

  // {{reverse:A}} - Reverse text
  result = result.replace(/\{\{reverse:([^}]+)\}\}/gi, (match, content) => {
    return content.split('').reverse().join('');
  });

  // {{date}} - Current date with month name (e.g., "October 11, 2025")
  result = result.replace(/\{\{date\}\}/gi, () => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // {{isotime}} - Current time in HH:MM format (e.g., "14:30")
  result = result.replace(/\{\{isotime\}\}/gi, () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  // {{characters_list}} - List of available characters with filenames
  result = result.replace(/\{\{characters_list\}\}/gi, () => {
    if (context.characters && Array.isArray(context.characters) && context.characters.length > 0) {
      return context.characters.map(char => `- ${char.name} (${char.filename})`).join('\n');
    }
    return '(no characters available)';
  });

  // {{// A}} - Hidden comment (remove for display)
  result = result.replace(/\{\{\/\/[^}]*\}\}/gi, '');

  // {{hidden_key:A}} - Hidden key (remove for display)
  result = result.replace(/\{\{hidden_key:[^}]*\}\}/gi, '');

  // {{comment: A}} - Visible comment (show in italics)
  result = result.replace(/\{\{comment:([^}]*)\}\}/gi, '<em style="opacity: 0.7;">$1</em>');

  return result;
}

export function clearPickCache() {
  pickCache.clear();
}
