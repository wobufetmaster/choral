import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { processMacrosForDisplay } from '../utils/macros.js';

/**
 * Message formatting composable
 * Extracted from ChatView.vue for reusability
 */
export function useMessageFormatting() {
  // Initialize markdown renderer
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true,
  });

  // Custom renderer for code blocks
  const defaultRender = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const langName = info ? info.split(/\s+/g)[0] : '';

    if (langName) {
      token.attrSet('class', `language-${langName}`);
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  /**
   * Estimate token count for text (rough approximation)
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token
    // Strip HTML tags for more accurate count
    const stripped = text.replace(/<[^>]*>/g, '');
    return Math.ceil(stripped.length / 4);
  }

  /**
   * Apply special styling for quoted text and asterisk text
   * @param {string} text - Text to style
   * @returns {string} Styled text with span wrappers
   */
  function applyTextStyling(text) {
    if (!text) return text;

    // Protect HTML tags and their attributes first to avoid breaking URLs and attributes
    const htmlTagPattern = /<[^>]+>/g;
    const protectedTags = [];
    let protectedText = text.replace(htmlTagPattern, (match) => {
      protectedTags.push(match);
      return `__HTML_TAG_${protectedTags.length - 1}__`;
    });

    // Style text in double quotes as dialogue (now safe from HTML attributes)
    protectedText = protectedText.replace(/"([^"]+)"/g, '<span class="dialogue">"$1"</span>');

    // Style text in asterisks as action/narration (avoid markdown bold **)
    // Only match single asterisks, not double
    protectedText = protectedText.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<span class="action">*$1*</span>');

    // Restore HTML tags
    protectedText = protectedText.replace(/__HTML_TAG_(\d+)__/g, (match, index) => {
      return protectedTags[parseInt(index)];
    });

    return protectedText;
  }

  /**
   * Get the current content from a message (handles swipes)
   * @param {object} message - Message object
   * @returns {string|Array} Current content
   */
  function getCurrentContent(message) {
    if (message.role === 'user') {
      return message.content;
    }
    // Assistant message with swipes
    return message.swipes?.[message.swipeIndex ?? 0] || message.content || '';
  }

  /**
   * Sanitize and render HTML with markdown and macros
   * @param {string} html - Raw HTML/markdown content
   * @param {object} macroContext - Context for macro replacement (charName, charNickname, userName)
   * @returns {string} Sanitized HTML
   */
  function sanitizeHtml(html, macroContext = {}) {
    // Process macros first
    const processed = processMacrosForDisplay(html, macroContext);

    // Apply text styling (quotes and asterisks) before markdown
    const styled = applyTextStyling(processed);

    // Render markdown
    const rendered = md.render(styled);

    // Sanitize
    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div', 'span', 'img', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel']
    });
  }

  return {
    estimateTokens,
    applyTextStyling,
    getCurrentContent,
    sanitizeHtml,
    processMacrosForDisplay
  };
}
