/**
 * Prompt Post-Processing
 * Handles different message format requirements for various APIs
 */

/**
 * Available post-processing modes
 */
const MODES = {
  NONE: 'none',                           // No processing, send as-is
  MERGE_SYSTEM: 'merge_system',           // Merge all system messages into one
  STRICT: 'strict',                       // system, user, assistant alternating (first must be user)
  SEMI_STRICT: 'semi_strict',             // One system message, then alternating user/assistant
  SINGLE_USER: 'single_user',             // Everything in one user message
  ANTHROPIC_PREFILL: 'anthropic_prefill'  // system, then alternating, with optional assistant prefill
};

/**
 * Merge consecutive messages with the same role
 * @param {Array} messages
 * @returns {Array}
 */
function mergeConsecutiveMessages(messages) {
  if (!messages || messages.length === 0) return [];

  const merged = [];
  let current = { ...messages[0] };

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === current.role) {
      // Same role, merge content
      current.content += '\n\n' + msg.content;
    } else {
      // Different role, push current and start new
      merged.push(current);
      current = { ...msg };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Merge all system messages into one
 * @param {Array} messages
 * @returns {Array}
 */
function mergeSystemMessages(messages) {
  if (!messages || messages.length === 0) return [];

  const systemMessages = [];
  const otherMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessages.push(msg.content);
    } else {
      otherMessages.push(msg);
    }
  }

  const result = [];

  if (systemMessages.length > 0) {
    result.push({
      role: 'system',
      content: systemMessages.join('\n\n')
    });
  }

  result.push(...otherMessages);
  return result;
}

/**
 * Strict mode: Must start with user, then alternate user/assistant
 * Removes system messages and prepends them to first user message
 * @param {Array} messages
 * @returns {Array}
 */
function strictMode(messages) {
  if (!messages || messages.length === 0) return [];

  // Collect system messages
  const systemContent = messages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');

  // Get non-system messages
  let nonSystem = messages.filter(m => m.role !== 'system');

  // Ensure starts with user
  if (nonSystem.length > 0 && nonSystem[0].role !== 'user') {
    nonSystem.unshift({
      role: 'user',
      content: '[Start of conversation]'
    });
  }

  // Prepend system content to first user message
  if (systemContent && nonSystem.length > 0) {
    const firstUserIndex = nonSystem.findIndex(m => m.role === 'user');
    if (firstUserIndex !== -1) {
      nonSystem[firstUserIndex] = {
        ...nonSystem[firstUserIndex],
        content: systemContent + '\n\n' + nonSystem[firstUserIndex].content
      };
    }
  }

  // Merge consecutive and ensure alternation
  const merged = mergeConsecutiveMessages(nonSystem);

  // Ensure strict alternation
  const result = [];
  let expectedRole = 'user';

  for (const msg of merged) {
    if (msg.role === expectedRole) {
      result.push(msg);
      expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
    } else if (msg.role === 'user' && expectedRole === 'assistant') {
      // Got user when expecting assistant, insert placeholder
      result.push({
        role: 'assistant',
        content: '[Acknowledged]'
      });
      result.push(msg);
      expectedRole = 'user';
    }
  }

  return result;
}

/**
 * Semi-strict mode: One system message, then alternating user/assistant
 * @param {Array} messages
 * @returns {Array}
 */
function semiStrictMode(messages) {
  if (!messages || messages.length === 0) return [];

  // Merge all system messages into one
  const withMergedSystem = mergeSystemMessages(messages);

  // Merge consecutive non-system messages
  const result = [];

  for (const msg of withMergedSystem) {
    if (msg.role === 'system') {
      result.push(msg);
    } else {
      if (result.length > 0 && result[result.length - 1].role === msg.role) {
        // Merge with previous
        result[result.length - 1].content += '\n\n' + msg.content;
      } else {
        result.push(msg);
      }
    }
  }

  return result;
}

/**
 * Single user message mode: Everything in one user message
 * @param {Array} messages
 * @returns {Array}
 */
function singleUserMode(messages) {
  if (!messages || messages.length === 0) return [];

  const allContent = messages.map(msg => {
    const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    return `[${roleLabel}]\n${msg.content}`;
  }).join('\n\n');

  return [{
    role: 'user',
    content: allContent
  }];
}

/**
 * Anthropic prefill mode: system, alternating user/assistant, optional assistant prefill
 * @param {Array} messages
 * @param {string} prefill - Optional prefill text for assistant
 * @returns {Array}
 */
function anthropicPrefillMode(messages, prefill = '') {
  // Start with semi-strict
  let result = semiStrictMode(messages);

  // If prefill provided and last message is user, add assistant prefill
  if (prefill && result.length > 0 && result[result.length - 1].role === 'user') {
    result.push({
      role: 'assistant',
      content: prefill
    });
  }

  return result;
}

/**
 * Process messages according to mode
 * @param {Array} messages
 * @param {string} mode - Processing mode from MODES
 * @param {Object} options - Additional options (e.g., prefill)
 * @returns {Array}
 */
function processPrompt(messages, mode = MODES.MERGE_SYSTEM, options = {}) {
  if (!messages || messages.length === 0) return [];

  switch (mode) {
    case MODES.NONE:
      return messages;

    case MODES.MERGE_SYSTEM:
      return mergeSystemMessages(messages);

    case MODES.STRICT:
      return strictMode(messages);

    case MODES.SEMI_STRICT:
      return semiStrictMode(messages);

    case MODES.SINGLE_USER:
      return singleUserMode(messages);

    case MODES.ANTHROPIC_PREFILL:
      return anthropicPrefillMode(messages, options.prefill);

    default:
      console.warn(`Unknown processing mode: ${mode}, using merge_system`);
      return mergeSystemMessages(messages);
  }
}

module.exports = {
  MODES,
  processPrompt,
  mergeSystemMessages,
  strictMode,
  semiStrictMode,
  singleUserMode,
  anthropicPrefillMode
};
