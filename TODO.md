# Choral TODO List

## Priority Issues (Organized by Difficulty)

### 🟢 Easy Fixes (Quick Wins)
- [x] **Tab hitbox is too small** - CSS adjustment to expand clickable area ✅
- [x] **Your message bar should expand as you type** - CSS/textarea auto-resize ✅
- [x] **Rename chats option** - Add rename UI + API endpoint ✅
- [x] **Group chat button is gone** - Restore "convert to group" button in chat sidebar ✅
- [x] **Remove get_character_card tool** - Clean up unused tool (schema, endpoint, execution logic) ✅
- [x] **Auto-apply preset changes** - Remove "Apply to Chat" button, auto-apply when preset is changed ✅
- [x] **Improved preset button layout** - Moved Save/Set Active buttons to top with better styling ✅
- [x] **Fix mobile sidebar button position** - Expand sidebar button is in wrong spot on mobile ✅
- [x] **Fix persona saving issues** - Address issues with persona save functionality ✅
- [x] **Update docs with tool calling** - Document the tool calling system (create_character_card, update_character_card, add_greetings) ✅
- [x] **Sorting characters by date created actually sorts them alphabetically Z-A** ✅
- [x] **Group chats ignore tag filters and always appear at the top of the character select screen** ✅
- [x] **Docs should have a back button to go back to the web application** ✅
- [ ] **In the edit tags screen, typing tags should search for them, like in the persona manager.
- [ ] **In the edit tags screen, after adding a tag, it should automatically save the added tag.
- [ ] **Auto lorebooks don't work in group chats, even if the tags match.
- [ ] **In the debug screen in chats, it always lists Test_lorebook.json in chats. 
- [ ] **In chats, the lorebook view should put active lorebooks at the top in a seperate section.
- [ ] **In group chats, the swap character cards feature doesn't properly send context.




### 🟡 Medium Complexity
- [x] **Set default persona** - Add config option + settings UI ✅
- [x] **Markdown rendering** - Integrate markdown-it for message display ✅
- [x] **Tabs should be draggable** - Implement drag-and-drop tab reordering ✅
- [x] **Auto-name chats with bookkeeping model** - Generate chat title from first message/response ✅
- [x] **Tag searching in character pickers** - Add tag filtering to group chat creation screen (300+ cards need filtering!) ✅
- [x] **Stop button for streaming** - Add ability to cancel/stop streaming AI responses ✅
- [x] **Settings tab deduplication** - If you try to open a tab containing a settings page, redirect to existing one if already open ✅
- [x] **Start new chat from summary** - AI summarizes current chat, creates new chat with same characters and summary as first message ✅
- [ ] **Maybe tool call results should just be saved in the message that called them if they return anything. 
- [ ] **All of the prompts that are used for external calls should probably be documented somewhere, eg the tool calling prompts and bookkeeping prompts.
- [ ] **Button that gives all of your gray, default colored tags a random color. 
- [ ] **Auto rename chats seems to run on chats that are already named.
- [ ] **ChatView.vue file is probably too big and should be refactored. 
- [x] **Lorebooks in the lorebook manager screen should be searchable. ✅
- [x] **When typing in tags in the lorebook manager, they should be searched for, exactly the same as in the persona manager tag field. (high priority) ✅


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
- [x] **Start new chat from summary** - Creates new chat with AI-generated summary of current conversation, retains characters, streams in real-time

## ✅ Already Working (Not in original list)
- **PWA Support** - Manifest and service worker functional, works well on Termux (service worker disabled during dev to prevent cache conflicts, re-enable in production)
- **Mobile compatibility** - Runs on Termux/Android

---

**Last Updated**: 2025-10-11
