/**
 * Swipe navigation composable
 *
 * Manages swipe navigation for assistant messages (response alternatives).
 */
export function useSwipes(messages, { onSave }) {
  /**
   * Get total number of swipes for a message
   */
  function getTotalSwipes(message) {
    return message.swipes?.length || 1;
  }

  /**
   * Get current swipe index
   */
  function getCurrentSwipeIndex(message) {
    return message.swipeIndex ?? 0;
  }

  /**
   * Check if can swipe left
   */
  function canSwipeLeft(message) {
    if (message.isFirstMessage) {
      return true; // First messages cycle
    }
    return (message.swipeIndex ?? 0) > 0;
  }

  /**
   * Check if can swipe right (to existing swipe)
   */
  function canSwipeRight(message) {
    const currentIndex = message.swipeIndex ?? 0;
    const totalSwipes = message.swipes?.length || 1;
    return currentIndex < totalSwipes - 1;
  }

  /**
   * Swipe left to previous response
   * @param {number} index - Message index in messages array
   * @param {object} options - Options for group chat handling
   */
  async function swipeLeft(index, options = {}) {
    const message = messages.value[index];
    const currentIndex = message.swipeIndex ?? 0;
    const totalSwipes = message.swipes?.length || 1;

    if (message.isFirstMessage) {
      // Cycle back to last
      if (currentIndex > 0) {
        message.swipeIndex--;
      } else {
        message.swipeIndex = totalSwipes - 1;
      }
    } else if (canSwipeLeft(message)) {
      message.swipeIndex--;
    } else {
      return; // Can't swipe
    }

    // Update character filename for group chats
    if (options.isGroupChat && message.swipeCharacters?.[message.swipeIndex]) {
      message.characterFilename = message.swipeCharacters[message.swipeIndex];
    }

    // Save if chat has content
    if (messages.value.length > 1 || options.chatId) {
      await onSave?.();
    }
  }

  /**
   * Swipe right to next response or generate new
   * @param {number} index - Message index
   * @param {function} generateFn - Function to call when generating new swipe
   * @param {object} options - Options for group chat handling
   */
  async function swipeRight(index, generateFn, options = {}) {
    const message = messages.value[index];
    const currentIndex = message.swipeIndex ?? 0;
    const totalSwipes = message.swipes?.length || 1;

    if (message.isFirstMessage) {
      // Cycle back to first
      if (currentIndex < totalSwipes - 1) {
        message.swipeIndex++;
      } else {
        message.swipeIndex = 0;
      }

      // Update character filename for group chats
      if (options.isGroupChat && message.swipeCharacters?.[message.swipeIndex]) {
        message.characterFilename = message.swipeCharacters[message.swipeIndex];
      }

      if (messages.value.length > 1 || options.chatId) {
        await onSave?.();
      }
    } else if (currentIndex < totalSwipes - 1) {
      // Navigate to existing swipe
      message.swipeIndex++;

      // Update character filename for group chats
      if (options.isGroupChat && message.swipeCharacters?.[message.swipeIndex]) {
        message.characterFilename = message.swipeCharacters[message.swipeIndex];
      }

      await onSave?.();
    } else if (generateFn) {
      // At last swipe, generate new one
      await generateFn(index);
    }
  }

  return {
    getTotalSwipes,
    getCurrentSwipeIndex,
    canSwipeLeft,
    canSwipeRight,
    swipeLeft,
    swipeRight
  };
}
