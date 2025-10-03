/**
 * Client-side macro processing
 * For displaying macros in the UI (comments should be visible here)
 */

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
