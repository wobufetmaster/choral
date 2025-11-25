import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageFormatting } from '../../../src/composables/useMessageFormatting.js';

describe('useMessageFormatting', () => {
  let formatting;

  beforeEach(() => {
    formatting = useMessageFormatting();
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty text', () => {
      expect(formatting.estimateTokens('')).toBe(0);
      expect(formatting.estimateTokens(null)).toBe(0);
      expect(formatting.estimateTokens(undefined)).toBe(0);
    });

    it('should estimate ~4 characters per token', () => {
      expect(formatting.estimateTokens('test')).toBe(1); // 4 chars
      expect(formatting.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
    });

    it('should strip HTML tags before counting', () => {
      expect(formatting.estimateTokens('<p>test</p>')).toBe(1); // only "test" counts (4 chars)
    });

    it('should estimate longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens';
      const tokens = formatting.estimateTokens(text);
      expect(tokens).toBeGreaterThan(10); // 59 chars / 4 = ~15 tokens
    });
  });

  describe('applyTextStyling', () => {
    it('should wrap quoted text in dialogue spans', () => {
      const result = formatting.applyTextStyling('She said "hello" to him');
      expect(result).toContain('<span class="dialogue">"hello"</span>');
    });

    it('should wrap asterisk text in action spans', () => {
      const result = formatting.applyTextStyling('*waves hand*');
      expect(result).toContain('<span class="action">*waves hand*</span>');
    });

    it('should not break double asterisks (markdown bold)', () => {
      const result = formatting.applyTextStyling('**bold text**');
      expect(result).not.toContain('<span class="action">');
    });

    it('should preserve HTML tags', () => {
      const result = formatting.applyTextStyling('<a href="test">link</a>');
      expect(result).toContain('<a href="test">link</a>');
    });

    it('should handle null/undefined', () => {
      expect(formatting.applyTextStyling(null)).toBe(null);
      expect(formatting.applyTextStyling(undefined)).toBe(undefined);
    });

    it('should handle text without formatting', () => {
      const text = 'plain text';
      const styled = formatting.applyTextStyling(text);
      expect(styled).toBe('plain text');
    });
  });

  describe('getCurrentContent', () => {
    it('should return content for user messages', () => {
      const msg = { role: 'user', content: 'hello' };
      expect(formatting.getCurrentContent(msg)).toBe('hello');
    });

    it('should return current swipe for assistant messages', () => {
      const msg = { role: 'assistant', swipes: ['first', 'second'], swipeIndex: 1 };
      expect(formatting.getCurrentContent(msg)).toBe('second');
    });

    it('should handle missing swipeIndex (default to 0)', () => {
      const msg = { role: 'assistant', swipes: ['first', 'second'] };
      expect(formatting.getCurrentContent(msg)).toBe('first');
    });

    it('should fall back to content if no swipes', () => {
      const msg = { role: 'assistant', content: 'fallback' };
      expect(formatting.getCurrentContent(msg)).toBe('fallback');
    });

    it('should return empty string if no content', () => {
      const msg = { role: 'assistant' };
      expect(formatting.getCurrentContent(msg)).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const result = formatting.sanitizeHtml('<strong>bold</strong> and <em>italic</em>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should remove script tags', () => {
      const result = formatting.sanitizeHtml('<script>alert("xss")</script>text');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should render markdown', () => {
      const result = formatting.sanitizeHtml('# Heading');
      expect(result).toContain('<h1>');
    });

    it('should process macros', () => {
      const result = formatting.sanitizeHtml('Hello {{user}}', { userName: 'Alice' });
      expect(result).toContain('Alice');
    });

    it('should allow br tags', () => {
      const html = 'line1<br>line2';
      const sanitized = formatting.sanitizeHtml(html);
      expect(sanitized).toContain('<br>');
    });
  });
});
