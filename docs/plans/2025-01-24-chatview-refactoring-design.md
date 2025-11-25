# ChatView.vue Refactoring Design

## Overview

Refactor the 5083-line ChatView.vue into smaller, maintainable pieces using Vue 3 composables.

**Approach:** Composables-first extraction
**Priority:** Minimize risk - incremental extraction, preserve existing behavior
**Split level:** Moderate (5-7 composables + styles extraction)

## Current State

ChatView.vue contains:
- ~450 lines template
- ~3000 lines script (100+ methods)
- ~1600 lines CSS

| Domain | Methods | Purpose |
|--------|---------|---------|
| Chat messaging | sendMessage, streamResponse, stopStreaming | Core message flow |
| Swipe management | swipeLeft, swipeRight, generateNewSwipe | Response alternatives |
| Group chat | buildGroupChatContext, triggerCharacterResponse | Multi-character |
| Branch management | createBranch, switchToBranch, deleteBranch | Conversation branching |
| Chat history | loadChatHistory, loadChat, saveChat | Persistence |
| Message formatting | sanitizeHtml, applyTextStyling | Display processing |

## Target Structure

```
src/
  components/
    ChatView.vue                    # Orchestrator (~800-1000 lines)
    ChatView.styles.css             # Extracted styles (~1600 lines)

  composables/
    useApi.js                       # Already exists
    useChat.js                      # Core chat operations
    useGroupChat.js                 # Group chat specifics
    useBranches.js                  # Branch management
    useSwipes.js                    # Swipe navigation
    useChatHistory.js               # History & persistence
    useMessageFormatting.js         # sanitizeHtml, styling, macros
```

## Composable Interfaces

### useMessageFormatting.js (pure functions)

```javascript
export function useMessageFormatting() {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

  return {
    sanitizeHtml(html, macroContext),
    applyTextStyling(text),
    estimateTokens(text),
    processMacrosForDisplay(text, context)
  }
}
```

### useSwipes.js

```javascript
export function useSwipes(messages, { onSave }) {
  return {
    getCurrentContent(message),
    getTotalSwipes(message),
    canSwipeLeft(message),
    canSwipeRight(message),
    async swipeLeft(index),
    async swipeRight(index),
    async generateNewSwipe(index, streamFn)
  }
}
```

### useBranches.js

```javascript
export function useBranches(messages, { chatId, onSave }) {
  const branches = ref({});
  const mainBranch = ref(null);
  const currentBranch = ref(null);

  return {
    branches, mainBranch, currentBranch,
    async createBranch(messageIndex, branchName),
    async switchToBranch(branchId),
    async renameBranch(branchId, newName),
    async deleteBranch(branchId, deleteChildren)
  }
}
```

### useChatHistory.js

```javascript
export function useChatHistory(api) {
  const chatHistory = ref([]);

  return {
    chatHistory,
    async loadChatHistory(characterFilename, isGroupChat),
    async loadChat(chatId),
    async saveChat(chatData),
    async deleteChat(filename),
    formatDate(timestamp),
    getPreview(chat)
  }
}
```

### useChat.js (core)

```javascript
export function useChat(api, { character, persona, settings }) {
  const messages = ref([]);
  const isStreaming = ref(false);
  const streamingContent = ref('');

  return {
    messages, isStreaming, streamingContent,
    async sendMessage(userInput, images),
    async streamResponse(context),
    stopStreaming(),
    buildContext(upToMessageIndex),
    initializeChat()
  }
}
```

### useGroupChat.js

```javascript
export function useGroupChat(api, baseChat) {
  const groupChatCharacters = ref([]);
  const currentSpeaker = ref(null);
  const groupChatStrategy = ref('join');

  return {
    ...baseChat,
    groupChatCharacters, currentSpeaker, groupChatStrategy,
    buildGroupChatContext(upToMessageIndex),
    async triggerCharacterResponse(characterFilename),
    async loadGroupChat(groupChatId),
    async saveGroupChat()
  }
}
```

## ChatView.vue After Refactoring

```vue
<script>
import { useChat } from '../composables/useChat.js';
import { useGroupChat } from '../composables/useGroupChat.js';
import { useBranches } from '../composables/useBranches.js';
import { useSwipes } from '../composables/useSwipes.js';
import { useChatHistory } from '../composables/useChatHistory.js';
import { useMessageFormatting } from '../composables/useMessageFormatting.js';
import { useApi } from '../composables/useApi.js';

export default {
  setup() {
    const api = useApi();
    const formatting = useMessageFormatting();
    const chat = useChat(api, { /* reactive refs */ });
    const branches = useBranches(chat.messages, { onSave: chat.saveChat });
    const swipes = useSwipes(chat.messages, { onSave: chat.saveChat });
    const history = useChatHistory(api);

    return { api, formatting, chat, branches, swipes, history };
  },

  data() {
    return {
      // UI state only
      sidebarOpen: true,
      showSettings: false,
      showChatHistory: false,
      avatarMenu: { show: false, x: 0, y: 0 },
      editingMessage: null,
    }
  }
}
</script>

<style src="./ChatView.styles.css"></style>
```

## Extraction Order (Incremental)

1. **Styles** - Zero risk, move CSS to ChatView.styles.css
2. **useMessageFormatting** - Pure functions, no state dependencies
3. **useSwipes** - Self-contained swipe logic
4. **useBranches** - Self-contained branching logic
5. **useChatHistory** - Load/save operations
6. **useChat** - Core messaging (depends on above)
7. **useGroupChat** - Group-specific extensions

Each step should be tested before proceeding to the next.

## Risk Mitigation

- Extract one composable at a time
- Run existing tests after each extraction
- Keep original method signatures where possible
- Template changes are minimal (just prefixing with composable name)
