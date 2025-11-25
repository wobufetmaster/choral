# ChatView.vue Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 5083-line ChatView.vue into focused composables and a separate styles file for maintainability.

**Architecture:** Composables-first extraction - logic moves to composables, ChatView becomes an orchestrator. Template stays mostly unchanged.

**Tech Stack:** Vue 3 Composition API, Vitest for testing

---

## Task 1: Extract Styles to Separate File

**Files:**
- Create: `src/components/ChatView.styles.css`
- Modify: `src/components/ChatView.vue`

**Step 1: Create the styles file**

Copy lines 3470-5083 (everything inside `<style scoped>`) from ChatView.vue to a new file:

```bash
# The CSS content starts after </script> and is inside <style scoped>
```

Create `src/components/ChatView.styles.css` with all the CSS content (no `<style>` tags, just the raw CSS).

**Step 2: Update ChatView.vue to use external styles**

Replace the entire `<style scoped>` block with:

```vue
<style scoped src="./ChatView.styles.css"></style>
```

**Step 3: Verify the app still works**

Run: `npm run dev`
Expected: App loads, chat view displays correctly with all styles applied

**Step 4: Commit**

```bash
git add src/components/ChatView.styles.css src/components/ChatView.vue
git commit -m "refactor(ChatView): extract styles to separate file

Move ~1600 lines of CSS to ChatView.styles.css for better maintainability.
No functional changes."
```

---

## Task 2: Create useMessageFormatting Composable

**Files:**
- Create: `src/composables/useMessageFormatting.js`
- Create: `tests/unit/composables/useMessageFormatting.test.js`
- Modify: `src/components/ChatView.vue`

**Step 1: Write the failing tests**

Create `tests/unit/composables/useMessageFormatting.test.js`:

```javascript
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
      expect(formatting.estimateTokens('test')).toBe(1);
      expect(formatting.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
    });

    it('should strip HTML tags before counting', () => {
      expect(formatting.estimateTokens('<p>test</p>')).toBe(1); // only "test" counts
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

    it('should handle missing swipeIndex', () => {
      const msg = { role: 'assistant', swipes: ['first', 'second'] };
      expect(formatting.getCurrentContent(msg)).toBe('first');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/composables/useMessageFormatting.test.js`
Expected: FAIL - module not found

**Step 3: Create the composable**

Create `src/composables/useMessageFormatting.js`:

```javascript
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { processMacrosForDisplay } from '../utils/macros.js';

/**
 * Message formatting composable
 *
 * Provides text processing utilities for chat messages:
 * - Token estimation
 * - Text styling (quotes, actions)
 * - Markdown rendering
 * - HTML sanitization
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
   * Estimate token count for text
   * @param {string} text - Text to estimate
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
   * Apply styling for quoted text and asterisk actions
   * @param {string} text - Text to style
   * @returns {string} Styled text with span wrappers
   */
  function applyTextStyling(text) {
    // Protect HTML tags first
    const htmlTagPattern = /<[^>]+>/g;
    const protectedTags = [];
    let protectedText = text.replace(htmlTagPattern, (match) => {
      protectedTags.push(match);
      return `__HTML_TAG_${protectedTags.length - 1}__`;
    });

    // Style text in double quotes as dialogue
    protectedText = protectedText.replace(/"([^"]+)"/g, '<span class="dialogue">"$1"</span>');

    // Style text in asterisks as action (avoid markdown bold **)
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
   * @param {object} macroContext - Context for macro replacement
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
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/composables/useMessageFormatting.test.js`
Expected: All tests PASS

**Step 5: Integrate into ChatView.vue**

In ChatView.vue, add the import:

```javascript
import { useMessageFormatting } from '../composables/useMessageFormatting.js';
```

Update setup():

```javascript
setup() {
  const api = useApi();
  const formatting = useMessageFormatting();
  return { api, formatting };
},
```

Update methods to use the composable (replace these methods with delegating calls):

```javascript
// In methods section, replace:
estimateTokens(text) {
  return this.formatting.estimateTokens(text);
},
applyTextStyling(text) {
  return this.formatting.applyTextStyling(text);
},
getCurrentContent(message) {
  return this.formatting.getCurrentContent(message);
},
```

For `sanitizeHtml`, build the macroContext and delegate:

```javascript
sanitizeHtml(html, message = null) {
  let charName = this.character?.data?.name || 'Character';
  let charNickname = this.character?.data?.nickname || '';

  if (this.isGroupChat && message?.characterFilename) {
    const char = this.groupChatCharacters.find(c => c.filename === message.characterFilename);
    if (char) {
      charName = char.name;
      charNickname = char.data?.data?.nickname || '';
    }
  }

  const macroContext = {
    charName,
    charNickname,
    userName: this.persona?.name || 'User'
  };

  return this.formatting.sanitizeHtml(html, macroContext);
},
```

Remove the markdown initialization from mounted() (lines 679-702) since it's now in the composable.

**Step 6: Verify the app still works**

Run: `npm run dev`
Test: Open a chat, verify messages display correctly with formatting

**Step 7: Commit**

```bash
git add src/composables/useMessageFormatting.js tests/unit/composables/useMessageFormatting.test.js src/components/ChatView.vue
git commit -m "refactor(ChatView): extract useMessageFormatting composable

Extract message formatting logic to reusable composable:
- estimateTokens
- applyTextStyling
- getCurrentContent
- sanitizeHtml

Includes unit tests for all formatting functions."
```

---

## Task 3: Create useSwipes Composable

**Files:**
- Create: `src/composables/useSwipes.js`
- Create: `tests/unit/composables/useSwipes.test.js`
- Modify: `src/components/ChatView.vue`

**Step 1: Write the failing tests**

Create `tests/unit/composables/useSwipes.test.js`:

```javascript
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
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/composables/useSwipes.test.js`
Expected: FAIL - module not found

**Step 3: Create the composable**

Create `src/composables/useSwipes.js`:

```javascript
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
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/composables/useSwipes.test.js`
Expected: All tests PASS

**Step 5: Integrate into ChatView.vue**

Add import:

```javascript
import { useSwipes } from '../composables/useSwipes.js';
```

This composable needs `messages` as a ref, which currently lives in `data()`. For now, we'll use it as a helper while keeping messages in data. Update setup():

```javascript
setup() {
  const api = useApi();
  const formatting = useMessageFormatting();
  // useSwipes will be initialized in mounted() after messages ref exists
  return { api, formatting };
},
```

In mounted(), after messages exist, we can't easily use the composable pattern without larger refactoring. Instead, update the methods to use helper functions from the composable:

Actually, for minimal risk, let's just ensure the composable works and defer full integration. The composable is available for future use.

For now, keep the existing methods but note they can be replaced later.

**Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/composables/useSwipes.js tests/unit/composables/useSwipes.test.js
git commit -m "refactor: add useSwipes composable

Extract swipe navigation logic to reusable composable:
- getTotalSwipes
- getCurrentSwipeIndex
- canSwipeLeft/canSwipeRight
- swipeLeft/swipeRight

Includes unit tests. Integration with ChatView deferred for later task."
```

---

## Task 4: Create useBranches Composable

**Files:**
- Create: `src/composables/useBranches.js`
- Create: `tests/unit/composables/useBranches.test.js`

**Step 1: Write the failing tests**

Create `tests/unit/composables/useBranches.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBranches } from '../../../src/composables/useBranches.js';

describe('useBranches', () => {
  let messages;
  let onSave;
  let branches;

  beforeEach(() => {
    messages = ref([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', swipes: ['Hi there!'], swipeIndex: 0 }
    ]);
    onSave = vi.fn().mockResolvedValue(undefined);
    branches = useBranches(messages, { onSave });
  });

  describe('initializeBranches', () => {
    it('should create main branch structure', () => {
      branches.initializeBranches();

      expect(branches.mainBranch.value).toBe('branch-main');
      expect(branches.currentBranch.value).toBe('branch-main');
      expect(branches.branches.value['branch-main']).toBeDefined();
      expect(branches.branches.value['branch-main'].name).toBe('Main');
    });
  });

  describe('createBranch', () => {
    it('should create a new branch from message index', async () => {
      branches.initializeBranches();

      const branchId = await branches.createBranch(0, 'Test Branch');

      expect(branchId).toMatch(/^branch-/);
      expect(branches.branches.value[branchId]).toBeDefined();
      expect(branches.branches.value[branchId].name).toBe('Test Branch');
      expect(branches.currentBranch.value).toBe(branchId);
    });
  });

  describe('switchToBranch', () => {
    it('should switch to existing branch and load its messages', async () => {
      branches.initializeBranches();
      const branchId = await branches.createBranch(0, 'Alt Branch');

      // Add a message to the new branch
      messages.value.push({ role: 'user', content: 'New message' });
      branches.branches.value[branchId].messages = [...messages.value];

      // Switch back to main
      await branches.switchToBranch('branch-main');

      expect(branches.currentBranch.value).toBe('branch-main');
      expect(messages.value.length).toBe(2); // Original messages
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/composables/useBranches.test.js`
Expected: FAIL

**Step 3: Create the composable**

Create `src/composables/useBranches.js`:

```javascript
import { ref } from 'vue';

/**
 * Branch management composable
 *
 * Manages conversation branching - creating alternate conversation paths
 * from any point in the chat history.
 */
export function useBranches(messages, { onSave }) {
  const branches = ref({});
  const mainBranch = ref(null);
  const currentBranch = ref(null);

  /**
   * Initialize branch structure with main branch
   */
  function initializeBranches() {
    if (Object.keys(branches.value).length > 0) return;

    const mainBranchId = 'branch-main';
    branches.value = {
      [mainBranchId]: {
        id: mainBranchId,
        name: 'Main',
        createdAt: new Date().toISOString(),
        parentBranchId: null,
        branchPointMessageIndex: null,
        messages: [...messages.value]
      }
    };
    mainBranch.value = mainBranchId;
    currentBranch.value = mainBranchId;
  }

  /**
   * Create a new branch from a message index
   * @param {number} messageIndex - Index to branch from
   * @param {string} branchName - Name for the new branch
   * @returns {string} New branch ID
   */
  async function createBranch(messageIndex, branchName) {
    // Ensure branches are initialized
    if (Object.keys(branches.value).length === 0) {
      initializeBranches();
    }

    // Save current branch state
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    // Generate unique branch ID
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new branch with messages up to branch point
    branches.value[branchId] = {
      id: branchId,
      name: branchName,
      createdAt: new Date().toISOString(),
      parentBranchId: currentBranch.value,
      branchPointMessageIndex: messageIndex,
      messages: messages.value.slice(0, messageIndex + 1)
    };

    // Switch to new branch
    currentBranch.value = branchId;
    messages.value = [...branches.value[branchId].messages];

    await onSave?.();
    return branchId;
  }

  /**
   * Switch to an existing branch
   * @param {string} branchId - Branch to switch to
   */
  async function switchToBranch(branchId) {
    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Save current branch state
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    // Load target branch
    currentBranch.value = branchId;
    messages.value.splice(0, messages.value.length, ...branches.value[branchId].messages);

    await onSave?.();
  }

  /**
   * Rename a branch
   */
  async function renameBranch(branchId, newName) {
    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    branches.value[branchId].name = newName;
    await onSave?.();
  }

  /**
   * Delete a branch
   * @param {string} branchId - Branch to delete
   * @param {boolean} deleteChildren - Also delete child branches
   */
  async function deleteBranch(branchId, deleteChildren = false) {
    if (branchId === mainBranch.value) {
      throw new Error('Cannot delete main branch');
    }

    if (!branches.value[branchId]) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Find children
    const children = Object.keys(branches.value).filter(
      id => branches.value[id].parentBranchId === branchId
    );

    if (deleteChildren) {
      // Recursively delete children
      for (const childId of children) {
        await deleteBranch(childId, true);
      }
    } else {
      // Re-parent children to deleted branch's parent
      const newParent = branches.value[branchId].parentBranchId;
      for (const childId of children) {
        branches.value[childId].parentBranchId = newParent;
      }
    }

    // If deleting current branch, switch to parent
    if (currentBranch.value === branchId) {
      const parentId = branches.value[branchId].parentBranchId || mainBranch.value;
      await switchToBranch(parentId);
    }

    delete branches.value[branchId];
    await onSave?.();
  }

  /**
   * Load branch structure from saved chat data
   */
  function loadBranches(chatData) {
    if (chatData.branches) {
      branches.value = chatData.branches;
      mainBranch.value = chatData.mainBranch;
      currentBranch.value = chatData.currentBranch || chatData.mainBranch;

      // Load current branch messages
      if (branches.value[currentBranch.value]) {
        messages.value.splice(0, messages.value.length, ...branches.value[currentBranch.value].messages);
      }
    }
  }

  /**
   * Get branch data for saving
   */
  function getBranchDataForSave() {
    // Update current branch messages before saving
    if (currentBranch.value && branches.value[currentBranch.value]) {
      branches.value[currentBranch.value].messages = [...messages.value];
    }

    return {
      branches: branches.value,
      mainBranch: mainBranch.value,
      currentBranch: currentBranch.value
    };
  }

  return {
    branches,
    mainBranch,
    currentBranch,
    initializeBranches,
    createBranch,
    switchToBranch,
    renameBranch,
    deleteBranch,
    loadBranches,
    getBranchDataForSave
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/composables/useBranches.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/composables/useBranches.js tests/unit/composables/useBranches.test.js
git commit -m "refactor: add useBranches composable

Extract branch management logic to reusable composable:
- initializeBranches
- createBranch
- switchToBranch
- renameBranch
- deleteBranch
- loadBranches/getBranchDataForSave

Includes unit tests. Integration with ChatView deferred."
```

---

## Task 5: Create useChatHistory Composable

**Files:**
- Create: `src/composables/useChatHistory.js`
- Create: `tests/unit/composables/useChatHistory.test.js`

**Step 1: Write the failing tests**

Create `tests/unit/composables/useChatHistory.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatHistory } from '../../../src/composables/useChatHistory.js';

describe('useChatHistory', () => {
  let api;
  let history;

  beforeEach(() => {
    api = {
      getChats: vi.fn(),
      getGroupChats: vi.fn(),
      deleteChat: vi.fn(),
      deleteGroupChat: vi.fn()
    };
    history = useChatHistory(api);
  });

  describe('formatDate', () => {
    it('should format recent timestamps as relative time', () => {
      const now = Date.now();
      const result = history.formatDate(now - 30000); // 30 seconds ago
      expect(result).toMatch(/just now|seconds? ago/i);
    });

    it('should format older dates with date string', () => {
      const oldDate = new Date('2023-01-15').getTime();
      const result = history.formatDate(oldDate);
      expect(result).toContain('2023');
    });
  });

  describe('getPreview', () => {
    it('should extract preview from chat messages', () => {
      const chat = {
        messages: [
          { role: 'user', content: 'Hello there' },
          { role: 'assistant', swipes: ['Hi!'], swipeIndex: 0 }
        ]
      };
      const preview = history.getPreview(chat);
      expect(preview).toBeTruthy();
    });

    it('should handle branch-based chats', () => {
      const chat = {
        branches: {
          'branch-main': {
            messages: [{ role: 'user', content: 'Test message' }]
          }
        },
        mainBranch: 'branch-main'
      };
      const preview = history.getPreview(chat);
      expect(preview).toBeTruthy();
    });

    it('should truncate long previews', () => {
      const longMessage = 'A'.repeat(200);
      const chat = {
        messages: [{ role: 'user', content: longMessage }]
      };
      const preview = history.getPreview(chat);
      expect(preview.length).toBeLessThan(longMessage.length);
    });
  });

  describe('loadChatHistory', () => {
    it('should load regular chat history', async () => {
      const mockChats = [{ filename: 'chat1.json' }];
      api.getChats.mockResolvedValue(mockChats);

      await history.loadChatHistory('char.png', false);

      expect(api.getChats).toHaveBeenCalled();
      expect(history.chatHistory.value).toEqual(mockChats);
    });

    it('should load group chat history', async () => {
      const mockGroupChats = [{ filename: 'group1.json' }];
      api.getGroupChats.mockResolvedValue(mockGroupChats);

      await history.loadChatHistory(null, true);

      expect(api.getGroupChats).toHaveBeenCalled();
      expect(history.chatHistory.value).toEqual(mockGroupChats);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/composables/useChatHistory.test.js`
Expected: FAIL

**Step 3: Create the composable**

Create `src/composables/useChatHistory.js`:

```javascript
import { ref } from 'vue';
import { formatRelativeDate } from '../utils/dateFormat.js';

/**
 * Chat history management composable
 */
export function useChatHistory(api) {
  const chatHistory = ref([]);

  /**
   * Format timestamp for display
   */
  function formatDate(timestamp) {
    return formatRelativeDate(timestamp);
  }

  /**
   * Get preview text from a chat
   */
  function getPreview(chat) {
    let messages = chat.messages;

    // Handle branch-based structure
    if (chat.branches && chat.mainBranch) {
      const branch = chat.branches[chat.currentBranch || chat.mainBranch];
      messages = branch?.messages || [];
    }

    if (!messages || messages.length === 0) {
      return 'Empty chat';
    }

    // Get last message content
    const lastMsg = messages[messages.length - 1];
    let content = '';

    if (lastMsg.role === 'user') {
      content = typeof lastMsg.content === 'string'
        ? lastMsg.content
        : lastMsg.content?.find(p => p.type === 'text')?.text || '';
    } else {
      content = lastMsg.swipes?.[lastMsg.swipeIndex ?? 0] || lastMsg.content || '';
    }

    // Truncate
    const maxLength = 100;
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...';
    }
    return content || 'No preview';
  }

  /**
   * Load chat history for a character or group
   */
  async function loadChatHistory(characterFilename, isGroupChat) {
    try {
      if (isGroupChat) {
        chatHistory.value = await api.getGroupChats();
      } else {
        const allChats = await api.getChats();
        // Filter by character if specified
        if (characterFilename) {
          chatHistory.value = allChats.filter(
            chat => chat.characterFilename === characterFilename
          );
        } else {
          chatHistory.value = allChats;
        }
      }

      // Sort by timestamp descending
      chatHistory.value.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (error) {
      console.error('Failed to load chat history:', error);
      chatHistory.value = [];
    }
  }

  /**
   * Delete a chat
   */
  async function deleteChat(filename, isGroupChat) {
    if (isGroupChat) {
      await api.deleteGroupChat(filename);
    } else {
      await api.deleteChat(filename);
    }

    // Remove from local list
    chatHistory.value = chatHistory.value.filter(c => c.filename !== filename);
  }

  return {
    chatHistory,
    formatDate,
    getPreview,
    loadChatHistory,
    deleteChat
  };
}
```

**Step 4: Create the dateFormat utility**

Create `src/utils/dateFormat.js`:

```javascript
/**
 * Format a timestamp as a relative date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date string
 */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/composables/useChatHistory.test.js`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/composables/useChatHistory.js tests/unit/composables/useChatHistory.test.js src/utils/dateFormat.js
git commit -m "refactor: add useChatHistory composable

Extract chat history management to reusable composable:
- formatDate (relative time formatting)
- getPreview (chat preview extraction)
- loadChatHistory
- deleteChat

Also adds dateFormat utility. Includes unit tests."
```

---

## Task 6: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run E2E tests**

Run: `npm run test:e2e`
Expected: All E2E tests pass

**Step 3: Manual verification**

Run: `npm run dev`

Verify:
- [ ] Chat view loads correctly
- [ ] Messages display with formatting
- [ ] Swipe navigation works
- [ ] Branch creation works
- [ ] Chat history sidebar works
- [ ] Styles are applied correctly

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test failures from refactoring"
```

---

## Summary

This plan extracts ChatView.vue into:

| File | Purpose | Lines (approx) |
|------|---------|----------------|
| `ChatView.styles.css` | All CSS | ~1600 |
| `useMessageFormatting.js` | Text processing | ~100 |
| `useSwipes.js` | Swipe navigation | ~100 |
| `useBranches.js` | Branch management | ~150 |
| `useChatHistory.js` | History & persistence | ~80 |
| `dateFormat.js` | Date utility | ~30 |

ChatView.vue after refactoring: ~3000 lines (down from 5083)

The composables are standalone and tested. Full integration into ChatView.vue can be done incrementally as a follow-up task.
