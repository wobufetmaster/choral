/**
 * Swipe navigation composable
 *
 * Provides helper functions for swipe navigation on assistant messages.
 * Extracted from ChatView.vue for reusability.
 */
export function useSwipes() {
  /**
   * Get total number of swipes for a message
   * @param {object} message - Message object
   * @returns {number} Total swipe count
   */
  function getTotalSwipes(message) {
    return message.swipes?.length || 1;
  }

  /**
   * Get current swipe index
   * @param {object} message - Message object
   * @returns {number} Current swipe index
   */
  function getCurrentSwipeIndex(message) {
    return message.swipeIndex ?? 0;
  }

  /**
   * Check if message has multiple swipes
   * @param {object} message - Message object
   * @returns {boolean} True if message has multiple swipes
   */
  function hasMultipleSwipes(message) {
    return message.swipes && message.swipes.length > 1;
  }

  /**
   * Check if can swipe left (to previous response)
   * @param {object} message - Message object
   * @returns {boolean} True if can swipe left
   */
  function canSwipeLeft(message) {
    // For first messages (greetings), always allow swiping to cycle
    if (message.isFirstMessage) {
      return true;
    }
    return (message.swipeIndex ?? 0) > 0;
  }

  /**
   * Check if can swipe right to existing response (not generate new)
   * @param {object} message - Message object
   * @returns {boolean} True if can navigate to next existing swipe
   */
  function canSwipeRight(message) {
    const currentIndex = message.swipeIndex ?? 0;
    const totalSwipes = message.swipes?.length || 1;
    return currentIndex < totalSwipes - 1;
  }

  /**
   * Check if at last swipe (would generate new on swipe right)
   * @param {object} message - Message object
   * @returns {boolean} True if at the last swipe
   */
  function isAtLastSwipe(message) {
    const currentIndex = message.swipeIndex ?? 0;
    const totalSwipes = message.swipes?.length || 1;
    return currentIndex === totalSwipes - 1;
  }

  /**
   * Get the content for the current swipe
   * @param {object} message - Message object
   * @returns {string} Current swipe content
   */
  function getCurrentSwipeContent(message) {
    if (message.role === 'user') {
      return message.content;
    }
    return message.swipes?.[message.swipeIndex ?? 0] || message.content || '';
  }

  return {
    getTotalSwipes,
    getCurrentSwipeIndex,
    hasMultipleSwipes,
    canSwipeLeft,
    canSwipeRight,
    isAtLastSwipe,
    getCurrentSwipeContent
  };
}
