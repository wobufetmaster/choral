# Image Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multimodal image support for sending and receiving images in chat conversations

**Architecture:** Modal-based image attachment UI + base64 storage + OpenRouter multimodal API integration

**Tech Stack:** Vue 3, FileReader API, OpenRouter multimodal endpoints

---

## Task 1: Create ImageAttachmentModal Component

**Files:**
- Create: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ImageAttachmentModal.vue`

**Step 1: Create the modal component file**

Create `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ImageAttachmentModal.vue` with this initial structure:

```vue
<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content image-attachment-modal" @click.stop>
      <div class="modal-header">
        <h3>Compose Message with Images</h3>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>

      <div class="modal-body">
        <!-- Text input -->
        <div class="text-input-section">
          <label>Message:</label>
          <textarea
            v-model="messageText"
            placeholder="Type your message (optional)..."
            rows="4"
            @paste="handlePaste"
          ></textarea>
        </div>

        <!-- Image attachment controls -->
        <div class="attachment-controls">
          <button @click="triggerFilePicker" class="upload-btn">
            📁 Upload Image
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            multiple
            @change="handleFileSelect"
            style="display: none"
          />
          <span class="paste-hint">or press Ctrl+V / Cmd+V to paste</span>
        </div>

        <!-- Image previews -->
        <div v-if="attachedImages.length > 0" class="image-previews">
          <div
            v-for="(img, index) in attachedImages"
            :key="index"
            class="image-preview"
          >
            <img :src="img.dataUrl" :alt="img.filename" />
            <div class="image-info">
              <span class="filename">{{ img.filename }}</span>
              <span class="filesize">{{ formatFileSize(img.size) }}</span>
            </div>
            <button @click="removeImage(index)" class="remove-btn">×</button>
          </div>
        </div>

        <!-- Warning for large files -->
        <div v-if="totalSize > 5000000" class="size-warning">
          ⚠️ Total size > 5MB. Some models may reject large images.
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="cancel-btn">Cancel</button>
        <button
          @click="sendMessage"
          :disabled="!canSend"
          class="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ImageAttachmentModal',
  emits: ['close', 'send'],
  data() {
    return {
      messageText: '',
      attachedImages: [], // { dataUrl, filename, size, type }
    };
  },
  computed: {
    canSend() {
      return this.messageText.trim() || this.attachedImages.length > 0;
    },
    totalSize() {
      return this.attachedImages.reduce((sum, img) => sum + img.size, 0);
    },
  },
  methods: {
    triggerFilePicker() {
      this.$refs.fileInput.click();
    },

    async handleFileSelect(event) {
      const files = Array.from(event.target.files);
      for (const file of files) {
        await this.addImageFile(file);
      }
      // Reset input so same file can be selected again
      event.target.value = '';
    },

    async handlePaste(event) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await this.addImageFile(file);
          }
        }
      }
    },

    async addImageFile(file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        this.$root.$notify(`Unsupported format. Use JPG, PNG, WebP, or GIF.`, 'error');
        return;
      }

      try {
        const dataUrl = await this.readFileAsDataURL(file);
        this.attachedImages.push({
          dataUrl,
          filename: file.name,
          size: file.size,
          type: file.type,
        });
      } catch (error) {
        console.error('Failed to read image:', error);
        this.$root.$notify('Failed to read image file', 'error');
      }
    },

    readFileAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    removeImage(index) {
      this.attachedImages.splice(index, 1);
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    sendMessage() {
      this.$emit('send', {
        text: this.messageText,
        images: this.attachedImages,
      });
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.close-button:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.text-input-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.text-input-section textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.attachment-controls {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.upload-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upload-btn:hover {
  opacity: 0.9;
}

.paste-hint {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.image-previews {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.image-preview {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}

.image-info {
  padding: 0.5rem;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filename {
  font-size: 0.8rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filesize {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.remove-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(255, 0, 0, 0.8);
}

.size-warning {
  margin-top: 1rem;
  padding: 0.5rem;
  background: rgba(255, 165, 0, 0.1);
  border: 1px solid rgba(255, 165, 0, 0.3);
  border-radius: 4px;
  color: orange;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}

.cancel-btn,
.send-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.cancel-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--bg-secondary);
}

.send-btn {
  background: var(--accent-color);
  color: white;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

**Step 2: Verify the component file was created**

Run:
```bash
ls -la /Users/sean/Desktop/choral/.worktrees/image-support/src/components/ImageAttachmentModal.vue
```

Expected: File exists with ~400+ lines

**Step 3: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add src/components/ImageAttachmentModal.vue && git commit -m "feat: create ImageAttachmentModal component

- Upload images via file picker
- Paste images from clipboard
- Image preview grid with file info
- Size warning for >5MB
- Validates file types (jpg/png/webp/gif)"
```

---

## Task 2: Integrate Modal into ChatView

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue:402-411` (imports)
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue:420-450` (data)
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue:355-365` (template)

**Step 1: Import the ImageAttachmentModal component**

In `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue`, find the `import` section around line 402-411 and add:

```javascript
import ImageAttachmentModal from './ImageAttachmentModal.vue';
```

Then add it to the `components` object:

```javascript
components: {
  GroupChatManager,
  LorebookEditor,
  ChatSidebar,
  DebugModal,
  BranchNameInput,
  BranchTreeModal,
  ImageAttachmentModal,  // Add this line
},
```

**Step 2: Add modal state to data()**

In the `data()` function around line 420-450, add:

```javascript
showImageModal: false,
```

**Step 3: Add attach image button to template**

Find the message input section around line 355-365 (the textarea and send button area). Add an attach button before the send button:

```vue
<button @click="showImageModal = true" class="attach-btn" :disabled="isStreaming">
  📎
</button>
```

**Step 4: Add modal to template**

At the end of the template (before closing `</div>` of chat-view), add:

```vue
<!-- Image Attachment Modal -->
<ImageAttachmentModal
  v-if="showImageModal"
  @close="showImageModal = false"
  @send="handleImageMessage"
/>
```

**Step 5: Verify changes compile**

Check the dev server output for any errors. The component should compile without errors.

**Step 6: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add src/components/ChatView.vue && git commit -m "feat: integrate ImageAttachmentModal into ChatView

- Add attach button (📎) next to send button
- Show/hide modal on button click
- Wire up send handler (stub for now)"
```

---

## Task 3: Handle Image Messages in ChatView

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue` (methods section)

**Step 1: Add handleImageMessage method**

In the `methods` section of ChatView.vue, add this method (before or after `sendMessage`):

```javascript
handleImageMessage({ text, images }) {
  // Close modal
  this.showImageModal = false;

  // Build message content array
  const content = [];

  // Add text if provided
  if (text.trim()) {
    content.push({ type: 'text', text: text.trim() });
  }

  // Add images
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: img.dataUrl, // Already in base64 format
      },
    });
  }

  // Create message object
  const userMessage = {
    role: 'user',
    content: content, // Array format for multimodal
  };

  // Add to messages
  this.messages.push(userMessage);

  // Trigger AI response
  this.streamResponse();

  // Save chat
  this.saveChat();
},
```

**Step 2: Verify the method exists**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && grep -n "handleImageMessage" src/components/ChatView.vue
```

Expected: Should show the method definition and the @send="handleImageMessage" binding

**Step 3: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add src/components/ChatView.vue && git commit -m "feat: implement handleImageMessage method

- Build content array with text and images
- Push multimodal message to chat
- Trigger AI response
- Save chat history"
```

---

## Task 4: Update Message Display for Images (User Messages)

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue` (template section for message rendering)

**Step 1: Find the message rendering section**

Search for where user messages are displayed in the template. Look for `v-for="message in messages"` or similar.

**Step 2: Add image rendering logic**

Update the message display template to handle array content. Replace the simple message.content display with:

```vue
<!-- Message content (text and images) -->
<div class="message-content">
  <!-- Handle string content (legacy) -->
  <div
    v-if="typeof message.content === 'string'"
    class="message-text"
    v-html="renderMarkdown(message.content)"
  ></div>

  <!-- Handle array content (multimodal) -->
  <template v-else-if="Array.isArray(message.content)">
    <div
      v-for="(part, partIndex) in message.content"
      :key="partIndex"
      class="content-part"
    >
      <!-- Text part -->
      <div
        v-if="part.type === 'text'"
        class="message-text"
        v-html="renderMarkdown(part.text)"
      ></div>

      <!-- Image part -->
      <div v-else-if="part.type === 'image_url'" class="message-image">
        <img
          :src="part.image_url.url"
          alt="Attached image"
          class="inline-image"
        />
      </div>
    </div>
  </template>

  <!-- Handle AI-generated images (separate images field) -->
  <div v-if="message.images && message.images.length > 0" class="ai-generated-images">
    <div
      v-for="(img, imgIndex) in message.images"
      :key="imgIndex"
      class="message-image"
    >
      <img
        :src="img.image_url.url"
        alt="AI-generated image"
        class="inline-image"
      />
    </div>
  </div>
</div>
```

**Step 3: Add CSS for inline images**

In the `<style>` section of ChatView.vue, add:

```css
.content-part {
  margin-bottom: 0.5rem;
}

.message-image {
  margin-top: 0.5rem;
}

.inline-image {
  max-width: 100%;
  max-height: 600px;
  border-radius: 4px;
  display: block;
}

.ai-generated-images {
  margin-top: 0.5rem;
}
```

**Step 4: Test in browser**

Open the app, click attach button, upload an image, send. The image should display inline.

**Step 5: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add src/components/ChatView.vue && git commit -m "feat: render images in user messages

- Handle array content format
- Display images inline below text
- Support AI-generated images field
- Add responsive image styling"
```

---

## Task 5: Update Server to Handle Multimodal Messages

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/server/index.js` (chat endpoints)

**Step 1: Create message normalization function**

In `/Users/sean/Desktop/choral/.worktrees/image-support/server/index.js`, add this helper function before the chat endpoints (around line 150-200):

```javascript
// Normalize message content to array format for OpenRouter
function normalizeMessageContent(message) {
  // If content is already an array, pass through
  if (Array.isArray(message.content)) {
    return { ...message, content: message.content };
  }

  // If string, convert to array format
  if (typeof message.content === 'string') {
    return {
      ...message,
      content: [{ type: 'text', text: message.content }],
    };
  }

  // Otherwise, pass through unchanged
  return message;
}
```

**Step 2: Apply normalization in streaming endpoint**

Find the `/api/chat/stream` endpoint. Before calling `streamChatCompletion`, add:

```javascript
// Normalize all messages to array format
const normalizedMessages = messages.map(normalizeMessageContent);
```

Then pass `normalizedMessages` instead of `messages` to `streamChatCompletion`.

**Step 3: Apply normalization in non-streaming endpoint**

Find the `/api/chat` endpoint. Apply the same normalization:

```javascript
// Normalize all messages to array format
const normalizedMessages = messages.map(normalizeMessageContent);
```

Then pass `normalizedMessages` to `chatCompletion`.

**Step 4: Test the endpoint**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Hello"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,test"}}
        ]
      }
    ],
    "model": "anthropic/claude-3.5-sonnet",
    "options": {}
  }'
```

Expected: No errors (may fail on actual API due to invalid base64, but should accept the format)

**Step 5: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add server/index.js && git commit -m "feat: normalize multimodal messages for OpenRouter

- Add normalizeMessageContent helper
- Convert string content to array format
- Apply to both streaming and non-streaming endpoints
- Maintain backward compatibility"
```

---

## Task 6: Update Macro Processing for Multimodal Messages

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/server/macros.js`

**Step 1: Update processMessagesWithMacros to handle array content**

In `/Users/sean/Desktop/choral/.worktrees/image-support/server/macros.js`, find the `processMessagesWithMacros` function. Update it to process only text parts:

```javascript
function processMessagesWithMacros(messages, context) {
  return messages.map((message) => {
    // Handle string content (legacy)
    if (typeof message.content === 'string') {
      return {
        ...message,
        content: processMacros(message.content, context),
      };
    }

    // Handle array content (multimodal)
    if (Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map((part) => {
          // Only process text parts
          if (part.type === 'text') {
            return {
              ...part,
              text: processMacros(part.text, context),
            };
          }
          // Pass through image_url parts unchanged
          return part;
        }),
      };
    }

    // Pass through unchanged if neither
    return message;
  });
}
```

**Step 2: Verify the function update**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && grep -A 20 "function processMessagesWithMacros" server/macros.js
```

Expected: Should show the updated function with array handling

**Step 3: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add server/macros.js && git commit -m "feat: update macro processing for multimodal messages

- Handle array content format
- Process only text parts
- Skip image_url parts unchanged
- Maintain backward compatibility with string content"
```

---

## Task 7: Update Logger to Truncate Base64 Images

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/server/logger.js`

**Step 1: Add image truncation helper**

In `/Users/sean/Desktop/choral/.worktrees/image-support/server/logger.js`, add this helper function:

```javascript
// Truncate base64 images in messages for logging
function truncateImages(messages) {
  return messages.map((msg) => {
    if (!Array.isArray(msg.content)) return msg;

    return {
      ...msg,
      content: msg.content.map((part) => {
        if (part.type === 'image_url') {
          const url = part.image_url.url;
          const truncated = url.length > 50 ? url.slice(0, 50) + '...[truncated]' : url;
          return {
            ...part,
            image_url: { url: truncated },
          };
        }
        return part;
      }),
    };
  });
}
```

**Step 2: Apply truncation in logRequest**

Find the `logRequest` function. Before logging messages, truncate them:

```javascript
function logRequest(model, messages, options, context, processingMode) {
  const truncatedMessages = truncateImages(messages);

  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'request',
    model,
    options,
    context,
    messages: truncatedMessages,  // Use truncated instead of original
    processingMode,
  };

  // ... rest of function
}
```

**Step 3: Verify truncation works**

Check the logs after sending a message with images. The log should show truncated base64 data.

**Step 4: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add server/logger.js && git commit -m "feat: truncate base64 images in API logs

- Add truncateImages helper
- Show first 50 chars + '[truncated]'
- Apply to logRequest function
- Keep full data in actual API calls"
```

---

## Task 8: Handle AI-Generated Images in Streaming Response

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/server/openrouter.js`
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue`

**Step 1: Update openrouter.js to include images field**

In `/Users/sean/Desktop/choral/.worktrees/image-support/server/openrouter.js`, find the `streamChatCompletion` function. Look for where the final message is constructed. Update it to include the `images` field if present:

```javascript
// In the stream parsing logic, capture images field
if (data.choices && data.choices[0]) {
  const choice = data.choices[0];

  // Capture text content
  if (choice.delta && choice.delta.content) {
    // ... existing content handling
  }

  // Capture images if present (only comes in final message)
  if (choice.message && choice.message.images) {
    // Send images as separate event or include in final message
    const imagesData = JSON.stringify({
      type: 'images',
      images: choice.message.images,
    });
    res.write(`data: ${imagesData}\n\n`);
  }
}
```

**Step 2: Update ChatView to handle images events**

In `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue`, find the `streamResponse` method. Look for the event parsing logic. Add handling for images:

```javascript
// In the stream event handler
if (data.type === 'images') {
  // Add images to the last assistant message
  const lastMessage = this.messages[this.messages.length - 1];
  if (lastMessage && lastMessage.role === 'assistant') {
    lastMessage.images = data.images;
  }
}
```

**Step 3: Test with an image generation model**

Use a model like `google/gemini-2.0-flash-exp:generate-image` and ask it to generate an image. Verify the image displays.

**Step 4: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add server/openrouter.js src/components/ChatView.vue && git commit -m "feat: handle AI-generated images in streaming

- Parse images field from OpenRouter response
- Send images as separate SSE event
- Store images in assistant message
- Display AI-generated images inline"
```

---

## Task 9: Add Attach Button Badge for Image Count

**Files:**
- Modify: `/Users/sean/Desktop/choral/.worktrees/image-support/src/components/ChatView.vue`

**Step 1: Track attached image count in data**

In ChatView.vue's `data()`, add:

```javascript
pendingImages: [], // Images queued for next message
```

**Step 2: Update ImageAttachmentModal to persist images**

Instead of closing and losing images, update `handleImageMessage` to clear pendingImages after sending:

```javascript
handleImageMessage({ text, images }) {
  // ... existing code ...

  // Clear pending images
  this.pendingImages = [];
  this.showImageModal = false;
},
```

**Step 3: Show badge on attach button**

Update the attach button template:

```vue
<button @click="showImageModal = true" class="attach-btn" :disabled="isStreaming">
  📎
  <span v-if="pendingImages.length > 0" class="badge">{{ pendingImages.length }}</span>
</button>
```

**Step 4: Add badge styles**

```css
.attach-btn {
  position: relative;
}

.attach-btn .badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--accent-color);
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 0.7rem;
  font-weight: bold;
}
```

**Step 5: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add src/components/ChatView.vue && git commit -m "feat: add image count badge to attach button

- Track pendingImages in ChatView state
- Show badge with count when images queued
- Clear after sending message
- Add badge styling"
```

---

## Task 10: Final Testing and Documentation

**Step 1: Test complete workflow**

1. Open browser to `http://localhost:5173`
2. Start a chat with a vision model (e.g., `anthropic/claude-3.5-sonnet`)
3. Click attach button (📎)
4. Upload an image file
5. Type a message: "What's in this image?"
6. Send
7. Verify image displays in chat
8. Verify AI responds with analysis
9. Test paste: Copy an image, click attach, Ctrl+V
10. Verify pasted image appears

**Step 2: Test AI image generation**

1. Use model `google/gemini-2.0-flash-exp:generate-image`
2. Ask: "Generate an image of a sunset"
3. Verify generated image displays inline

**Step 3: Test edge cases**

1. Send image without text - should work
2. Send multiple images - should all display
3. Try invalid file type (.txt) - should show error
4. Test backward compatibility: Load old chat with string content - should still work

**Step 4: Update CLAUDE.md**

Add to the "Completed Features" section:

```markdown
### Image Support
- **Multimodal Messages**: Send and receive images with OpenRouter API
- **Image Attachment Modal**: Upload or paste images with preview
- **Inline Display**: Images shown at full width in chat messages
- **AI Image Generation**: Support for models that generate images
- **Base64 Storage**: Images embedded in chat JSON files
- **Format Support**: JPG, PNG, WebP, GIF
- **Backward Compatible**: Existing text-only chats work unchanged
```

**Step 5: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git add CLAUDE.md && git commit -m "docs: update CLAUDE.md with image support feature"
```

**Step 6: Create final summary commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/image-support && git log --oneline feature/image-support ^main
```

Review the commit history. All tasks should be complete.

---

## Execution Complete

**What we built:**
- ImageAttachmentModal component with upload + paste
- Multimodal message handling in ChatView
- Server-side message normalization
- Macro processing for mixed content
- Image truncation in logs
- AI-generated image support
- Inline image display
- Backward compatibility with string content

**Next steps:**
1. Test thoroughly in browser
2. Review code quality
3. Use superpowers:requesting-code-review
4. Create PR using superpowers:finishing-a-development-branch
