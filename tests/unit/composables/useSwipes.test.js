import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useSwipes } from '../../../src/composables/useSwipes.js';

describe('useSwipes', () => {
  let messages;
  let onSave;
  let swipes;

  beforeEach(() => {
    messages = ref([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', swipes: ['Response 1', 'Response 2'], swipeIndex: 0 }
    ]);
    onSave = vi.fn().mockResolvedValue(undefined);
    swipes = useSwipes(messages, { onSave });
  });

  describe('getTotalSwipes', () => {
    it('should return swipe count', () => {
      expect(swipes.getTotalSwipes(messages.value[1])).toBe(2);
    });

    it('should return 1 for messages without swipes array', () => {
      expect(swipes.getTotalSwipes({ role: 'assistant', content: 'test' })).toBe(1);
    });
  });

  describe('getCurrentSwipeIndex', () => {
    it('should return current index', () => {
      expect(swipes.getCurrentSwipeIndex(messages.value[1])).toBe(0);
    });

    it('should default to 0 if not set', () => {
      const msg = { role: 'assistant', swipes: ['a', 'b'] };
      expect(swipes.getCurrentSwipeIndex(msg)).toBe(0);
    });
  });

  describe('canSwipeLeft', () => {
    it('should return false at index 0 for non-first messages', () => {
      expect(swipes.canSwipeLeft(messages.value[1])).toBe(false);
    });

    it('should return true at index > 0', () => {
      messages.value[1].swipeIndex = 1;
      expect(swipes.canSwipeLeft(messages.value[1])).toBe(true);
    });

    it('should always return true for first messages (greetings)', () => {
      messages.value[1].isFirstMessage = true;
      expect(swipes.canSwipeLeft(messages.value[1])).toBe(true);
    });
  });

  describe('canSwipeRight', () => {
    it('should return true if not at last swipe', () => {
      expect(swipes.canSwipeRight(messages.value[1])).toBe(true);
    });

    it('should return false at last swipe', () => {
      messages.value[1].swipeIndex = 1;
      expect(swipes.canSwipeRight(messages.value[1])).toBe(false);
    });
  });

  describe('swipeLeft', () => {
    it('should decrement swipeIndex', async () => {
      messages.value[1].swipeIndex = 1;
      await swipes.swipeLeft(1);
      expect(messages.value[1].swipeIndex).toBe(0);
      expect(onSave).toHaveBeenCalled();
    });

    it('should cycle to end for first messages', async () => {
      messages.value[1].isFirstMessage = true;
      messages.value[1].swipeIndex = 0;
      await swipes.swipeLeft(1);
      expect(messages.value[1].swipeIndex).toBe(1); // cycles to last
    });
  });

  describe('swipeRight', () => {
    it('should increment swipeIndex', async () => {
      await swipes.swipeRight(1, null); // null for generateFn to skip generation
      expect(messages.value[1].swipeIndex).toBe(1);
      expect(onSave).toHaveBeenCalled();
    });
  });
});
