/**
 * Lorebook entry scanning and matching system
 */

/**
 * Scan text for lorebook entry matches
 * @param {Array} entries - Array of lorebook entries
 * @param {String} text - Text to scan for matches
 * @param {Number} scanDepth - Number of recent messages to scan (0 = all)
 * @returns {Array} Matched entries sorted by priority
 */
function scanEntries(entries, text, scanDepth = 0) {
  const matched = [];

  for (const entry of entries) {
    const matchedKeys = [];
    let isMatch = false;

    // Always include entries marked as constant/always-on
    if (entry.constant || entry.alwaysOn) {
      matched.push({ ...entry, matchedKeys: ['always-on'], matchType: 'constant' });
      continue;
    }

    // Check if entry is enabled
    if (entry.enabled === false) {
      continue;
    }

    // Simple keyword matching (case insensitive)
    if (entry.keys && entry.keys.length > 0) {
      const lowerText = text.toLowerCase();
      for (const key of entry.keys) {
        if (lowerText.includes(key.toLowerCase())) {
          matchedKeys.push(key);
          isMatch = true;
        }
      }
      if (isMatch) {
        matched.push({ ...entry, matchedKeys, matchType: 'keyword' });
        continue;
      }
    }

    // Regex matching
    if (entry.regex && entry.regex.trim()) {
      try {
        const regexPattern = new RegExp(entry.regex, 'i');
        if (regexPattern.test(text)) {
          matched.push({ ...entry, matchedKeys: [`regex: ${entry.regex}`], matchType: 'regex' });
        }
      } catch (err) {
        console.warn(`Invalid regex in lorebook entry "${entry.name}":`, err.message);
      }
    }
  }

  // Sort by priority (higher = inserted first)
  matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return matched;
}

/**
 * Build scan text from messages based on scan depth
 * @param {Array} messages - Array of chat messages
 * @param {Number} scanDepth - Number of recent messages to scan (0 = all)
 * @returns {String} Combined text to scan
 */
function buildScanText(messages, scanDepth = 0) {
  let messagesToScan = messages;

  if (scanDepth > 0 && messages.length > scanDepth) {
    messagesToScan = messages.slice(-scanDepth);
  }

  return messagesToScan
    .map(msg => msg.content || '')
    .join('\n');
}

/**
 * Process lorebook and return matched entries
 * @param {Object} lorebook - Lorebook object with entries array
 * @param {Array} messages - Chat messages to scan
 * @param {Object} options - Scan options
 * @returns {Array} Matched and sorted entries
 */
function processLorebook(lorebook, messages, options = {}) {
  if (!lorebook || !lorebook.entries || lorebook.entries.length === 0) {
    return [];
  }

  const scanDepth = options.scanDepth || lorebook.scanDepth || 0;
  const scanText = buildScanText(messages, scanDepth);

  return scanEntries(lorebook.entries, scanText, scanDepth);
}

/**
 * Format lorebook entries as context messages
 * @param {Array} entries - Matched lorebook entries
 * @param {String} injectionPosition - Where to inject ('system', 'user', 'assistant')
 * @returns {Array} Array of message objects
 */
function formatEntriesAsMessages(entries, injectionPosition = 'system') {
  return entries.map(entry => ({
    role: injectionPosition,
    content: entry.content || entry.text || ''
  }));
}

/**
 * Inject lorebook entries into messages array
 * @param {Array} messages - Original messages array
 * @param {Array} entries - Lorebook entries to inject
 * @param {String} position - Injection position ('before', 'after')
 * @param {Number} index - Index to inject at (default: 0 for 'before', -1 for 'after')
 * @returns {Array} New messages array with injected entries
 */
function injectEntries(messages, entries, position = 'before', index = null) {
  if (!entries || entries.length === 0) {
    return messages;
  }

  const newMessages = [...messages];
  const entryMessages = formatEntriesAsMessages(entries);

  if (position === 'after') {
    const insertIndex = index !== null ? index : newMessages.length;
    newMessages.splice(insertIndex, 0, ...entryMessages);
  } else {
    const insertIndex = index !== null ? index : 0;
    newMessages.splice(insertIndex, 0, ...entryMessages);
  }

  return newMessages;
}

module.exports = {
  scanEntries,
  buildScanText,
  processLorebook,
  formatEntriesAsMessages,
  injectEntries
};
