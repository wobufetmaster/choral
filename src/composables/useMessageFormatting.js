import DOMPurify from 'dompurify';

/**
 * Composable for message formatting and sanitization
 * Extracted from ChatView.vue for reusability
 */
export function useMessageFormatting() {
  /**
   * Estimate token count for text (rough approximation)
   * Uses simple whitespace-based splitting
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  function estimateTokens(text) {
    if (!text || text.trim().length === 0) {
      return text && text.length > 0 ? 1 : 0; // Whitespace counts as 1 token
    }
    // Simple approximation: split on whitespace and punctuation
    // This is a rough estimate - real tokenization is more complex
    const tokens = text
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);
    return tokens.length;
  }

  /**
   * Apply basic text styling (bold, italic, line breaks)
   * Converts markdown-style formatting to HTML
   * @param {string} text - Text to style
   * @returns {string} Styled text with HTML tags
   */
  function applyTextStyling(text) {
    if (!text) return text;

    let styled = text;

    // Convert **bold** to <strong>bold</strong>
    styled = styled.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>italic</em> (but not ** which was already processed)
    // Use negative lookbehind/lookahead to avoid matching **
    styled = styled.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Convert newlines to <br>
    styled = styled.replace(/\n/g, '<br>');

    return styled;
  }

  /**
   * Get current content from message (handles streaming vs final)
   * @param {Object} message - Message object
   * @returns {string} Current message content
   */
  function getCurrentContent(message) {
    if (!message) return '';

    // If streaming, use streamingContent if available
    if (message.isStreaming && message.streamingContent) {
      return message.streamingContent;
    }

    // Otherwise use regular content
    return message.content || '';
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   * Allows safe formatting tags but removes scripts and event handlers
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  function sanitizeHtml(html) {
    if (!html) return html;

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'br', 'p', 'span', 'div', 'code', 'pre'],
      ALLOWED_ATTR: []
    });
  }

  return {
    estimateTokens,
    applyTextStyling,
    getCurrentContent,
    sanitizeHtml
  };
}
