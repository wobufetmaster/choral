# Choral TODO List

## Priority Issues (Organized by Difficulty)

### 🟢 Easy Fixes (Quick Wins)
- [x] **Tab hitbox is too small** - CSS adjustment to expand clickable area ✅
- [x] **Your message bar should expand as you type** - CSS/textarea auto-resize ✅
- [x] **Rename chats option** - Add rename UI + API endpoint ✅
- [x] **Group chat button is gone** - Restore "convert to group" button in chat sidebar ✅
- [ ] **Remove get_character_card tool** - Clean up unused tool (schema, endpoint, execution logic)
- [ ] **Auto-apply preset changes** - Remove "Apply to Chat" button, auto-apply when preset is changed
- [ ] **Fix mobile sidebar button position** - Expand sidebar button is in wrong spot on mobile
- [ ] **Fix persona saving issues** - Address issues with persona save functionality
- [ ] **Update docs with tool calling** - Document the tool calling system (create_character_card, update_character_card, add_greetings)

### 🟡 Medium Complexity
- [x] **Set default persona** - Add config option + settings UI ✅
- [x] **Markdown rendering** - Integrate markdown-it for message display ✅
- [x] **Tabs should be draggable** - Implement drag-and-drop tab reordering ✅
- [x] **Auto-name chats with bookkeeping model** - Generate chat title from first message/response ✅
- [ ] **Tag searching in character pickers** - Add tag filtering to group chat creation screen (300+ cards need filtering!)
- [ ] **Start new chat from summary** - AI summarizes current chat, creates new chat with same characters and summary as first message
- [ ] **Stop button for streaming** - Add ability to cancel/stop streaming AI responses

### 🔴 Complex Features
- [ ] **Regex replacement system** - Post-process AI responses with regex find/replace
  - UI for managing regex patterns
  - Pattern storage (config/separate file)
  - Processing logic with dynamic functions (random.choice, etc.)
  - Example: `r/ozone/{random.choice(sulfur,ammonia,chlorine,bleach)}`
- [ ] **Branching for real** - Full conversation tree with branching UI

---

## Completed
- [x] **Tab hitbox expansion** - Entire tab area now clickable
- [x] **Message bar auto-resize** - Expands/contracts as you type (60-200px)
- [x] **Chat renaming** - Double-click tabs to rename chats
- [x] **Convert to Group button** - Restored in chat sidebar
- [x] **Default persona** - Set in Settings, auto-applies to new chats
- [x] **Markdown rendering** - Full markdown support in messages (bold, italic, code blocks, lists, tables, etc.)
- [x] **Tab dragging** - Drag-and-drop tab reordering with visual feedback
- [x] **Auto-name chats** - AI generates chat titles using bookkeeping model

## ✅ Already Working (Not in original list)
- **PWA Support** - Manifest and service worker functional, works well on Termux (service worker disabled during dev to prevent cache conflicts, re-enable in production)
- **Mobile compatibility** - Runs on Termux/Android

---

**Last Updated**: 2025-10-10
