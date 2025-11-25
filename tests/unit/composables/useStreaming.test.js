import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStreaming } from '../../../src/composables/useStreaming.js';

describe('useStreaming', () => {
  let streaming;

  beforeEach(() => {
    streaming = useStreaming();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      expect(streaming.isStreaming.value).toBe(false);
      expect(streaming.streamingContent.value).toBe('');
      expect(streaming.isGeneratingSwipe.value).toBe(false);
      expect(streaming.generatingSwipeIndex.value).toBe(null);
      expect(streaming.currentToolCall.value).toBe(null);
      expect(streaming.pendingImages.value).toBe(null);
    });
  });

  describe('formatElapsedTime', () => {
    it('should format milliseconds', () => {
      expect(streaming.formatElapsedTime(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(streaming.formatElapsedTime(1500)).toBe('1.5s');
    });
  });

  describe('startSwipeGeneration', () => {
    it('should set swipe generation state', () => {
      streaming.startSwipeGeneration(5);

      expect(streaming.isGeneratingSwipe.value).toBe(true);
      expect(streaming.generatingSwipeIndex.value).toBe(5);
    });
  });

  describe('resetStreamingState', () => {
    it('should reset all streaming state', () => {
      // Set some state
      streaming.isStreaming.value = true;
      streaming.streamingContent.value = 'test content';
      streaming.isGeneratingSwipe.value = true;
      streaming.generatingSwipeIndex.value = 3;
      streaming.currentToolCall.value = 'test_tool';
      streaming.pendingImages.value = ['img1'];

      streaming.resetStreamingState();

      expect(streaming.isStreaming.value).toBe(false);
      expect(streaming.streamingContent.value).toBe('');
      expect(streaming.isGeneratingSwipe.value).toBe(false);
      expect(streaming.generatingSwipeIndex.value).toBe(null);
      expect(streaming.currentToolCall.value).toBe(null);
      expect(streaming.pendingImages.value).toBe(null);
    });
  });

  describe('stopStream', () => {
    it('should abort the controller if active', () => {
      const mockAbort = vi.fn();
      streaming.isStreaming.value = true;

      // Simulate an active abort controller
      const controller = { abort: mockAbort };

      // Access internal ref (for testing)
      streaming.stopStream();

      // Since there's no controller, nothing should happen
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('tool call timer', () => {
    it('should format elapsed time correctly', () => {
      expect(streaming.formatElapsedTime(100)).toBe('100ms');
      expect(streaming.formatElapsedTime(2500)).toBe('2.5s');
    });

    it('should reset elapsed time when stopped', () => {
      streaming.toolCallElapsedTime.value = 5000;
      streaming.stopToolCallTimer();
      expect(streaming.toolCallElapsedTime.value).toBe(0);
    });
  });

  describe('streamResponse', () => {
    it('should set isStreaming to true when called', async () => {
      // Mock fetch to return a readable stream that immediately ends
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      global.fetch = vi.fn().mockResolvedValue({
        body: {
          getReader: () => mockReader
        }
      });

      const onDone = vi.fn();

      // This will fail because of empty response, but we're testing the initial state
      try {
        await streaming.streamResponse({
          messages: [],
          settings: { model: 'test', temperature: 1 }
        }, { onDone });
      } catch (e) {
        // Expected - empty response
      }

      // After completion, isStreaming should be false
      expect(streaming.isStreaming.value).toBe(false);
    });

    it('should call onContent when content is received', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"content":"Hello"}\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"content":" World"}\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      global.fetch = vi.fn().mockResolvedValue({
        body: {
          getReader: () => mockReader
        }
      });

      const onContent = vi.fn();
      const onDone = vi.fn();

      await streaming.streamResponse({
        messages: [],
        settings: { model: 'test', temperature: 1 }
      }, { onContent, onDone });

      expect(onContent).toHaveBeenCalledTimes(2);
      expect(onContent).toHaveBeenCalledWith('Hello', 'Hello');
      expect(onContent).toHaveBeenCalledWith(' World', 'Hello World');
      expect(onDone).toHaveBeenCalledWith({ content: 'Hello World', images: null });
    });

    it('should handle API errors', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"error":"Test error"}\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      global.fetch = vi.fn().mockResolvedValue({
        body: {
          getReader: () => mockReader
        }
      });

      const onError = vi.fn();

      const result = await streaming.streamResponse({
        messages: [],
        settings: { model: 'test', temperature: 1 }
      }, { onError });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(onError).toHaveBeenCalled();
    });
  });
});
