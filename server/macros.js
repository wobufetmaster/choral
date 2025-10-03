/**
 * Process macros (Curly Braced Syntaxes) in text
 * Based on Character Card V3 specification
 */

// Cache for {{pick}} to ensure consistent results per session
const pickCache = new Map();

/**
 * Process all macros in a text string
 * @param {string} text - Text containing macros
 * @param {Object} context - Context for macro replacement
 * @param {string} context.charName - Character name
 * @param {string} context.charNickname - Character nickname (optional)
 * @param {string} context.userName - User/persona name
 * @param {boolean} removeComments - Whether to remove comments (default: true)
 * @returns {string} - Text with macros replaced
 */
function processMacros(text, context, removeComments = true) {
  if (!text || typeof text !== 'string') return text;

  const charName = context.charNickname || context.charName || 'Character';
  const userName = context.userName || 'User';

  // Process macros (case insensitive)
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

  // {{// A}} - Comment (remove completely)
  if (removeComments) {
    result = result.replace(/\{\{\/\/[^}]*\}\}/gi, '');
  }

  // {{hidden_key:A}} - Hidden key (remove from prompt, used for lorebook)
  if (removeComments) {
    result = result.replace(/\{\{hidden_key:[^}]*\}\}/gi, '');
  }

  // {{comment: A}} - Comment (remove from prompt)
  if (removeComments) {
    result = result.replace(/\{\{comment:[^}]*\}\}/gi, '');
  }

  return result;
}

/**
 * Clear the pick cache (call when starting a new conversation)
 */
function clearPickCache() {
  pickCache.clear();
}

/**
 * Process macros in all messages
 * @param {Array} messages - Array of message objects
 * @param {Object} context - Macro context
 * @returns {Array} - Messages with macros processed
 */
function processMessagesWithMacros(messages, context) {
  return messages.map(msg => ({
    ...msg,
    content: processMacros(msg.content, context)
  }));
}

module.exports = {
  processMacros,
  clearPickCache,
  processMessagesWithMacros
};
