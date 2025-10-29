# Image Support Design

**Date:** 2025-10-29
**Status:** Approved for implementation

## Overview

Add support for sending and receiving images in chat conversations using OpenRouter's multimodal API. Users can attach images via file upload or clipboard paste, and models that support image generation can return images in their responses.

## Requirements

### User Input Methods
- Upload images from device via file picker
- Paste images from clipboard (Ctrl+V / Cmd+V)

### Storage
- Images stored as base64 data URIs embedded in chat JSON files
- Portable, self-contained chat history

### Display
- Images displayed inline at full width within message bubbles
- Support for both user-sent and AI-generated images

### API Compatibility
- Follow OpenRouter's multimodal message format
- Support both image inputs and image generation responses

## Architecture

### Message Data Structure

**Current format (text-only):**
```javascript
{
  role: "user",
  content: "Hello!"
}
```

**New format (with images - user messages):**
```javascript
{
  role: "user",
  content: [
    { type: "text", text: "What's in this image?" },
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
  ]
}
```

**New format (AI-generated images - assistant messages):**
```javascript
{
  role: "assistant",
  content: "Here's your image:",
  images: [
    { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
  ]
}
```

**Backward compatibility:**
- String content format still supported for text-only messages
- Server normalizes messages to array format before API calls
- Existing chats load without migration

### Frontend Components

#### ChatView.vue Updates
- Add "📎 Attach Image" button next to send button
- Button shows badge with image count when images are queued
- Clicking opens ImageAttachmentModal

#### ImageAttachmentModal.vue (New Component)
- **Purpose:** Compose message with text and images
- **UI Elements:**
  - Text input area for message content
  - "Upload Image" button (file picker)
  - Paste detection with visual feedback
  - Image preview grid with delete buttons
  - Send button (enabled with text or images)
  - Cancel button
- **File picker:** Accepts `.jpg, .jpeg, .png, .webp, .gif`
- **State:** `attachedImages: []` array with metadata

#### Message Display
- User messages: Text first, then images inline below
- Assistant messages: Text content, then check for `images` field
- Images: Full width, max-height constraint to prevent dominance
- Alt text: Filename or "Attached image"

### Image Processing

**Client-side (ImageAttachmentModal.vue):**
1. Validate file type (jpg/jpeg/png/webp/gif)
2. Read file using FileReader API
3. Convert to base64 data URI: `data:image/[type];base64,[data]`
4. Store metadata: `{ dataUrl, filename, size, type }`
5. Display preview using dataUrl

**Size handling:**
- No automatic resizing/compression (YAGNI)
- Show file size in KB/MB
- Optional warning if total size > 5MB (non-blocking)
- Let OpenRouter handle rejection

**Data flow:**
- Modal maintains local `attachedImages` state
- On send: construct message with content array
- Pass to existing `sendMessage` function
- No changes needed to streaming/save logic

### Backend Changes

**Server message handling (server/index.js):**

```javascript
function normalizeMessage(msg) {
  // If content is already an array, pass through
  if (Array.isArray(msg.content)) return msg;

  // If string, convert to array format
  return {
    ...msg,
    content: [{ type: "text", text: msg.content }]
  };
}
```

**Context building:**
- System prompts stay as strings (normalized to array)
- User/assistant messages support mixed text/image content
- Macro processing only applies to text parts (skip image_url/images objects)

**Logging (logger.js):**
- Truncate base64 data in logs (first 50 chars + "...")
- Log image count and types
- Keep full data in actual API request

**Streaming response handling:**
- Check for `message.images` field in assistant responses
- Store images array in message object
- Display images inline below text content

**No changes needed:**
- Chat save/load (JSON handles new format)
- Preset system (prompts are text)
- Basic streaming logic (SSE passes through)

## Error Handling

### Error Scenarios

1. **Invalid file type**
   Toast: "Unsupported format. Use JPG, PNG, WebP, or GIF"

2. **File read failure**
   Toast: "Failed to read image file"

3. **Paste without image**
   Ignore silently

4. **API rejection**
   - Display error in chat
   - Don't save failed message
   - Keep modal open for retry

### Edge Cases

1. **Empty text** - Allow images without text (model-dependent)
2. **Multiple images** - Support multiple per message (both directions)
3. **Model compatibility** - No client-side checking (API handles)
4. **AI-generated images** - Handle `images` field in assistant messages
5. **Edit/delete with images** - Works normally (stored in message)
6. **Macro processing** - Only process text, skip image objects

## User Feedback

- Loading state while reading large files
- File size display in previews
- Clear success feedback on send
- Error toasts for failures

## OpenRouter API Reference

### Image Input Format
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "What's in this image?" },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
      ]
    }
  ]
}
```

### Image Generation Response Format
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Text description",
        "images": [
          { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
        ]
      }
    }
  ]
}
```

### Supported Formats
- image/png
- image/jpeg
- image/webp
- image/gif

### Recommendations
- Send text prompt first, then images
- No specified file size limits (varies by model/provider)
- Images returned as base64-encoded PNG data URIs

## Implementation Notes

- Modal composer approach for clean separation of concerns
- Base64 storage for portability (chat files are self-contained)
- Minimal backend changes (normalization + logging)
- Backward compatible with existing text-only chats
- No automatic image optimization (keep it simple)
- Bidirectional image support (send and receive)

## Success Criteria

- Users can upload images via file picker
- Users can paste images from clipboard
- Images display inline in chat messages
- Images persist in chat history
- Messages with images send successfully to vision models
- AI-generated images display correctly
- Error handling provides clear feedback
- Backward compatibility maintained
