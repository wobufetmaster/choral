import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessageFormatting } from '../../../src/composables/useMessageFormatting.js';
import { ref } from 'vue';

describe('useMessageFormatting', () => {
  let formatting;

  beforeEach(() => {
    formatting = useMessageFormatting();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const tokens = formatting.estimateTokens(text);
      expect(tokens).toBe(2); // "Hello" + "world" = 2 tokens (rough estimate)
    });

    it('should handle empty strings', () => {
      expect(formatting.estimateTokens('')).toBe(0);
    });

    it('should handle whitespace', () => {
      expect(formatting.estimateTokens('   ')).toBe(1);
    });

    it('should estimate longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens';
      const tokens = formatting.estimateTokens(text);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('applyTextStyling', () => {
    it('should apply bold styling', () => {
      const text = '**bold text**';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toContain('<strong>bold text</strong>');
    });

    it('should apply italic styling', () => {
      const text = '*italic text*';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toContain('<em>italic text</em>');
    });

    it('should preserve newlines as <br>', () => {
      const text = 'line1\nline2';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toContain('line1<br>line2');
    });

    it('should handle mixed formatting', () => {
      const text = '**bold** and *italic*\nnew line';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toContain('<strong>bold</strong>');
      expect(styled).toContain('<em>italic</em>');
      expect(styled).toContain('<br>');
    });

    it('should handle text without formatting', () => {
      const text = 'plain text';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toBe('plain text');
    });
  });

  describe('getCurrentContent', () => {
    it('should return isStreaming content when streaming', () => {
      const message = ref({
        content: 'final content',
        isStreaming: true,
        streamingContent: 'streaming content'
      });

      const content = formatting.getCurrentContent(message.value);
      expect(content).toBe('streaming content');
    });

    it('should return regular content when not streaming', () => {
      const message = ref({
        content: 'final content',
        isStreaming: false,
        streamingContent: 'streaming content'
      });

      const content = formatting.getCurrentContent(message.value);
      expect(content).toBe('final content');
    });

    it('should handle missing streamingContent', () => {
      const message = ref({
        content: 'final content',
        isStreaming: true
      });

      const content = formatting.getCurrentContent(message.value);
      expect(content).toBe('final content');
    });

    it('should handle empty content', () => {
      const message = ref({
        content: '',
        isStreaming: false
      });

      const content = formatting.getCurrentContent(message.value);
      expect(content).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const html = '<strong>bold</strong> <em>italic</em>';
      const sanitized = formatting.sanitizeHtml(html);
      expect(sanitized).toContain('<strong>bold</strong>');
      expect(sanitized).toContain('<em>italic</em>');
    });

    it('should remove script tags', () => {
      const html = '<script>alert("xss")</script>safe text';
      const sanitized = formatting.sanitizeHtml(html);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const html = '<div onclick="alert(\'xss\')">click me</div>';
      const sanitized = formatting.sanitizeHtml(html);
      expect(sanitized).not.toContain('onclick');
    });

    it('should allow br tags', () => {
      const html = 'line1<br>line2';
      const sanitized = formatting.sanitizeHtml(html);
      expect(sanitized).toContain('<br>');
    });

    it('should handle empty strings', () => {
      expect(formatting.sanitizeHtml('')).toBe('');
    });
  });
});
