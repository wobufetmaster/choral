# Character Memories Feature Design

**Date:** 2025-11-20
**Status:** Design Complete, Ready for Implementation

## Overview

Add a "memories" feature allowing users to summarize long conversations and embed them into character cards as first-person diary entries. Memories are stored with timestamps, displayed with relative dates, and injected into AI context via a new `{{memories}}` macro.

## Requirements

- Summarize entire chat history and save as character memory
- Support three memory sizes: Small (2-4 sentences), Medium (1-2 paragraphs), Large (2-4 paragraphs)
- Store memories in character card V3 `extensions` field
- Display memories with relative dates ("3 days ago", "2 weeks ago")
- Allow editing and deleting memories from character editor
- Support both single-character and group chats
- Inject memories via `{{memories}}` macro in presets
- Use active preset model/settings for summarization

## Data Structure

### Character Card Schema Extension

```javascript
{
  spec: "chara_card_v3",
  data: {
    // ... existing fields ...
    extensions: {
      choral_memories: [
        {
          id: "uuid-v4",
          content: "Summary of conversation about...",
          created_at: "2025-11-20T10:30:00Z",  // ISO 8601 timestamp
          source_chat: "character-name_2025-11-20.json"  // optional reference
        }
      ]
    }
  }
}
```

### Storage Details

- **Location:** `extensions.choral_memories` array (follows V3 spec extension pattern)
- **ID:** UUID v4 for unique identification and deletion
- **Timestamp:** ISO 8601 format for precise relative date calculation
- **Source Chat:** Optional reference for traceability
- **PNG Updates:** Read PNG → Parse JSON → Modify array → Re-encode → Write PNG
- **Backward Compatibility:** Maintains both `ccv3` (V3) and `chara` (V2) chunks

## Memory Creation Flow

### Summarization Settings

Reuse the same approach as the existing `summarize-and-continue` endpoint:

- **Model:** `preset?.model || 'anthropic/claude-3.5-sonnet'`
- **Temperature:** `0.7`
- **No max_tokens restriction** (let the prompt guide length naturally)

### Summarization Prompts (Diary Style)

**Small (2-4 sentences):**
```javascript
const smallPrompt = `You are ${characterName}, writing a brief entry in your personal diary about this conversation. In 2-4 sentences, reflect on what happened as the character in first person.

Conversation:
${conversationText}`;
```

**Medium (1-2 paragraphs):**
```javascript
const mediumPrompt = `You are ${characterName}, writing an entry in your personal diary about this conversation. In 1-2 paragraphs, reflect on what happened, what you learned, and how you feel about it. Write in first person as the character.

Conversation:
${conversationText}`;
```

**Large (2-4 paragraphs):**
```javascript
const largePrompt = `You are ${characterName}, writing a detailed entry in your personal diary about this conversation. In 2-4 paragraphs, thoroughly reflect on what happened, what you learned, how you feel about it, and any important revelations or character development. Write in first person as the character.

Conversation:
${conversationText}`;
```

### User Flow - Single Character

1. User clicks "Add Memory" button in ChatView toolbar
2. Modal appears: "Add memory to [Character Name]?" with three size buttons (Small/Medium/Large)
3. User selects size
4. Loading indicator shown
5. API generates diary entry summary
6. Memory added to character PNG file
7. Success notification displayed

### User Flow - Group Chat

1. User clicks "Add Memory" button in ChatView toolbar
2. Modal appears: "Add memory to all characters in this chat?" with three size buttons
3. User selects size
4. For each character in group:
   - Generate diary entry from their unique perspective
   - Update their character PNG file with their memory
5. Success notification: "Added [size] memory to [Character1], [Character2], [Character3]"

### Conversation Text Formatting

Reuse the same format as `summarize-and-continue`:

```javascript
const conversationText = messages
  .map(m => {
    const charName = m.character || m.role;
    if (typeof m.content === 'string') {
      return `${charName}: ${m.content}`;
    } else if (Array.isArray(m.content)) {
      const textParts = m.content.filter(p => p.type === 'text');
      return `${charName}: ${textParts.map(p => p.text).join(' ')}`;
    }
    return '';
  })
  .filter(Boolean)
  .join('\n\n');
```

## Macro System & Context Injection

### New Macro: `{{memories}}`

**Processing Location:** Server-side in `server/macros.js` `processMacros()` function

**Example Usage in Preset:**
```
Previous interactions:
{{memories}}
```

**Expands to (if character has memories):**
```
Previous interactions:
- 3 days ago: I had a wonderful conversation about poetry and the meaning of life...
- 2 weeks ago: Today we discussed my fears about the future. I opened up about my past...
- 1 month ago: We spent time talking about art and creativity...
```

**Expands to (if no memories):**
```
Previous interactions:
[None]
```

### Relative Date Formatting

```javascript
function formatRelativeDate(isoTimestamp) {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
```

### Memory Formatting Rules

- **Order:** Most recent first (reverse chronological)
- **Format:** `- [relative date]: [diary entry content]`
- **Separator:** Each memory on its own line with bullet point
- **Context Passing:** Character data (including memories) already passed in `context.character` to chat endpoints

## Character Editor UI

### Memory Management Section

Add "Memories" tab/section to existing character editor modal.

**Visual Layout:**
```
┌─ Memories ────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ 3 days ago (Small)                    [×] │ │
│ │ I had a wonderful conversation about      │ │  ← Click to edit
│ │ poetry and the meaning of life...         │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ 2 weeks ago (Medium)              [✓] [×] │ │
│ │ [Textarea showing editable text...]       │ │  ← Edit mode
│ └───────────────────────────────────────────┘ │
│                                               │
│ [No older memories]                           │
└───────────────────────────────────────────────┘
```

### Features

- **List View:** Display all memories in reverse chronological order
- **Relative Dates:** Use same formatting as macro system
- **Size Indicator:** Show (Small/Medium/Large) next to date
- **Inline Editing:**
  - Click memory text to enter edit mode
  - Text becomes auto-sized textarea
  - Show [✓] Save and [×] Cancel buttons
  - ESC key cancels, Enter (Ctrl+Enter for multiline) saves
  - Preserve `created_at` timestamp (history stays accurate)
- **Delete:** [×] button in header with confirmation modal
- **Validation:** Prevent empty memories
- **Empty State:** "No memories yet. Add memories from the chat view."

### Delete Confirmation

- Modal: "Delete this memory from [Character Name]?"
- Show memory preview (first 100 chars)
- Confirm/Cancel buttons
- On confirm: Update character PNG, remove from array

## API Endpoints

### 1. Create Memory (Single Character)

**Endpoint:** `POST /api/characters/:filename/memories`

**Request:**
```json
{
  "messages": [...],
  "characterName": "Alice",
  "size": "small" | "medium" | "large"
}
```

**Response:**
```json
{
  "success": true,
  "memory": {
    "id": "uuid-v4",
    "content": "I had a wonderful...",
    "created_at": "2025-11-20T10:30:00Z",
    "source_chat": "alice_2025-11-20.json"
  }
}
```

### 2. Create Memories (Group Chat Batch)

**Endpoint:** `POST /api/characters/memories/batch`

**Request:**
```json
{
  "messages": [...],
  "characters": [
    { "filename": "alice.png", "name": "Alice" },
    { "filename": "bob.png", "name": "Bob" }
  ],
  "size": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "memories": [
    { "characterName": "Alice", "memory": {...} },
    { "characterName": "Bob", "memory": {...} }
  ]
}
```

### 3. Update Memory

**Endpoint:** `PATCH /api/characters/:filename/memories/:memoryId`

**Request:**
```json
{
  "content": "Updated diary entry text..."
}
```

**Response:**
```json
{
  "success": true,
  "memory": {...}
}
```

### 4. Delete Memory

**Endpoint:** `DELETE /api/characters/:filename/memories/:memoryId`

**Response:**
```json
{
  "success": true
}
```

## Data Flow

1. User triggers memory creation from ChatView
2. Frontend sends messages + character info + size to API
3. API builds conversation text and diary prompt
4. API calls OpenRouter with active preset model/settings
5. API receives diary entry summary
6. API reads character PNG file
7. API adds memory to `extensions.choral_memories` array
8. API writes updated PNG back to disk
9. API returns success + memory object
10. Frontend updates local character data
11. On next chat message, macro processor expands `{{memories}}` with relative dates

## Error Handling

- **PNG read/write failures:** Return 500, preserve original file (use atomic writes if possible)
- **OpenRouter API failures:** Return 502 with error message
- **Memory not found:** Return 404
- **Invalid memory ID:** Return 400
- **Empty memory content:** Return 400
- **Character not found:** Return 404

## Implementation Files

### Backend
- `server/routes/characters.js` - Memory CRUD endpoints
- `server/characterCard.js` - PNG read/write (already exists, reuse)
- `server/macros.js` - Add `{{memories}}` macro processing
- `server/openrouter.js` - Summarization calls (already exists, reuse)

### Frontend
- `src/components/ChatView.vue` - Add Memory button + modal
- `src/components/CharacterEditor.vue` - Add Memories tab with edit/delete
- `src/utils/dateFormat.js` - Relative date formatter (new utility)

## Testing Checklist

- [ ] Create small/medium/large memory in single-character chat
- [ ] Create memory in group chat (all characters get unique entries)
- [ ] Edit memory inline in character editor
- [ ] Delete memory with confirmation
- [ ] Verify `{{memories}}` macro expands correctly in chat
- [ ] Verify relative dates update correctly over time
- [ ] Verify memories persist across character import/export
- [ ] Test empty state (no memories)
- [ ] Test error handling (API failures, PNG corruption)
- [ ] Verify V2 backward compatibility maintained

## Future Enhancements (Not in Scope)

- Memory search/filtering
- Memory categories/tags
- Automatic memory creation after N messages
- Memory regeneration (re-summarize from original chat)
- Memory versioning/history
- Import/export memories separately from character cards
