import { describe, it, expect, beforeEach } from 'vitest';
import { useSwipes } from '../../../src/composables/useSwipes.js';

describe('useSwipes', () => {
  let swipes;

  beforeEach(() => {
    swipes = useSwipes();
  });

  describe('getTotalSwipes', () => {
    it('should return swipe count', () => {
      const msg = { role: 'assistant', swipes: ['Response 1', 'Response 2'], swipeIndex: 0 };
      expect(swipes.getTotalSwipes(msg)).toBe(2);
    });

    it('should return 1 for messages without swipes array', () => {
      expect(swipes.getTotalSwipes({ role: 'assistant', content: 'test' })).toBe(1);
    });

    it('should return 1 for empty swipes array', () => {
      expect(swipes.getTotalSwipes({ role: 'assistant', swipes: [] })).toBe(1);
    });
  });

  describe('getCurrentSwipeIndex', () => {
    it('should return current index', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 1 };
      expect(swipes.getCurrentSwipeIndex(msg)).toBe(1);
    });

    it('should default to 0 if not set', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'] };
      expect(swipes.getCurrentSwipeIndex(msg)).toBe(0);
    });
  });

  describe('hasMultipleSwipes', () => {
    it('should return true for multiple swipes', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'] };
      expect(swipes.hasMultipleSwipes(msg)).toBe(true);
    });

    it('should return false for single swipe', () => {
      const msg = { role: 'assistant', swipes: ['a'] };
      expect(swipes.hasMultipleSwipes(msg)).toBe(false);
    });

    it('should return false for no swipes array', () => {
      const msg = { role: 'assistant', content: 'test' };
      expect(swipes.hasMultipleSwipes(msg)).toBeFalsy();
    });
  });

  describe('canSwipeLeft', () => {
    it('should return false at index 0 for non-first messages', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 0 };
      expect(swipes.canSwipeLeft(msg)).toBe(false);
    });

    it('should return true at index > 0', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 1 };
      expect(swipes.canSwipeLeft(msg)).toBe(true);
    });

    it('should always return true for first messages (greetings)', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 0, isFirstMessage: true };
      expect(swipes.canSwipeLeft(msg)).toBe(true);
    });
  });

  describe('canSwipeRight', () => {
    it('should return true if not at last swipe', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 0 };
      expect(swipes.canSwipeRight(msg)).toBe(true);
    });

    it('should return false at last swipe', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 1 };
      expect(swipes.canSwipeRight(msg)).toBe(false);
    });
  });

  describe('isAtLastSwipe', () => {
    it('should return true at last swipe', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 1 };
      expect(swipes.isAtLastSwipe(msg)).toBe(true);
    });

    it('should return false if not at last swipe', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'], swipeIndex: 0 };
      expect(swipes.isAtLastSwipe(msg)).toBe(false);
    });

    it('should return true for single swipe at index 0', () => {
      const msg = { role: 'assistant', swipes: ['a'], swipeIndex: 0 };
      expect(swipes.isAtLastSwipe(msg)).toBe(true);
    });
  });

  describe('getCurrentSwipeContent', () => {
    it('should return content for user messages', () => {
      const msg = { role: 'user', content: 'Hello' };
      expect(swipes.getCurrentSwipeContent(msg)).toBe('Hello');
    });

    it('should return current swipe for assistant messages', () => {
      const msg = { role: 'assistant', swipes: ['first', 'second'], swipeIndex: 1 };
      expect(swipes.getCurrentSwipeContent(msg)).toBe('second');
    });

    it('should default to first swipe if no index', () => {
      const msg = { role: 'assistant', swipes: ['first', 'second'] };
      expect(swipes.getCurrentSwipeContent(msg)).toBe('first');
    });

    it('should fall back to content if no swipes', () => {
      const msg = { role: 'assistant', content: 'fallback' };
      expect(swipes.getCurrentSwipeContent(msg)).toBe('fallback');
    });

    it('should return empty string if no content', () => {
      const msg = { role: 'assistant' };
      expect(swipes.getCurrentSwipeContent(msg)).toBe('');
    });
  });
});
