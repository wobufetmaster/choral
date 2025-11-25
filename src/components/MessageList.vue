<template>
  <div class="messages" ref="messagesContainer" @scroll="$emit('scroll', $event)">
    <div
      v-for="(message, index) in messages"
      :key="message._id || index"
      :class="['message', message.role]"
    >
      <img
        v-if="message.role === 'assistant'"
        :src="getMessageAvatar(message)"
        :alt="getMessageCharacterName(message)"
        class="message-avatar clickable"
        @click="$emit('show-avatar-menu', $event, message, index)"
        @error="setFallbackAvatar($event)"
        :title="'Click for options'"
      />
      <img
        v-else-if="persona.avatar"
        :src="persona.avatar"
        :alt="persona.name"
        class="message-avatar clickable"
        @click="$emit('show-avatar-menu', $event, message, index)"
        @error="setFallbackAvatar($event)"
        :title="'Click for options'"
      />
      <div v-else class="message-avatar user-avatar clickable" @click="$emit('show-avatar-menu', $event, message, index)" :title="'Click for options'">
        {{ (persona.nickname || persona.name)[0] }}
      </div>
      <div class="message-bubble">
        <div class="message-actions">
          <button @click="$emit('edit-message', index)" title="Edit">✏️</button>
          <button @click="$emit('copy-message', getCurrentContent(message))" title="Copy">📋</button>
          <button @click="$emit('open-branch-modal', index)" title="Create Branch" class="branch-button">🌿</button>
          <button @click="$emit('delete-message', index)" title="Delete">🗑️</button>
          <button
            v-if="index < messages.length - 1"
            @click="$emit('delete-messages-below', index)"
            title="Delete all messages below this one"
            class="delete-below-button"
          >🗑️↓</button>
        </div>
        <div v-if="editingMessage === index" class="message-edit-container">
          <div
            :ref="'editTextarea' + index"
            class="message-edit-textarea"
            contenteditable="true"
            @keydown.escape="$emit('cancel-edit')"
            @input="$emit('update-edited-content', $event)"
          ></div>
          <div class="edit-inline-actions">
            <button @click="$emit('save-edit')" class="edit-confirm" title="Save">✓</button>
            <button @click="$emit('cancel-edit')" class="edit-cancel" title="Cancel">✕</button>
          </div>
        </div>
        <!-- Only show content when: not generating swipe for this message, or there's streaming content -->
        <div v-else-if="!isGeneratingSwipe || generatingSwipeIndex !== index || streamingContent" class="message-content">
          <!-- Handle string content (legacy text-only messages) -->
          <div
            v-if="typeof getCurrentContent(message) === 'string'"
            class="message-text"
            v-html="sanitizeHtml(isGeneratingSwipe && generatingSwipeIndex === index ? streamingContent : getCurrentContent(message), message)"
            :title="`~${estimateTokens(getCurrentContent(message))} tokens`"
          ></div>

          <!-- Handle array content (multimodal messages) -->
          <template v-else-if="Array.isArray(getCurrentContent(message))">
            <div
              v-for="(part, partIndex) in getCurrentContent(message)"
              :key="partIndex"
              class="content-part"
            >
              <!-- Text part -->
              <div
                v-if="part.type === 'text'"
                class="message-text"
                v-html="sanitizeHtml(part.text, message)"
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

        <!-- Tool call indicator for swipe generation -->
        <div v-else-if="isGeneratingSwipe && generatingSwipeIndex === index && currentToolCall" class="message-content tool-call-indicator">
          <span class="tool-call-icon">🔧</span>
          <span class="tool-call-text">Calling {{ currentToolCall }}... ({{ formatElapsedTime(toolCallElapsedTime) }})</span>
        </div>

        <!-- Swipe navigation for assistant messages -->
        <div v-if="message.role === 'assistant' && getTotalSwipes(message) > 0" class="swipe-controls">
          <button @click="$emit('swipe-left', index)" :disabled="!canSwipeLeft(message) || isStreaming" class="swipe-button">←</button>
          <span class="swipe-counter">{{ getCurrentSwipeIndex(message) + 1 }}/{{ getTotalSwipes(message) }}</span>
          <button @click="$emit('swipe-right', index)" :disabled="isStreaming" class="swipe-button">→</button>
        </div>
      </div>
    </div>

    <div v-if="isStreaming && !isGeneratingSwipe" class="message assistant">
      <img
        :src="getStreamingAvatar()"
        :alt="getStreamingCharacterName()"
        class="message-avatar"
        @error="setFallbackAvatar($event)"
      />
      <div class="message-bubble">
        <!-- Show streaming content if it exists -->
        <div v-if="streamingContent" class="message-content" v-html="sanitizeHtml(streamingContent, { characterFilename: currentSpeaker })"></div>

        <!-- Show tool call indicator (can appear alongside content or alone) -->
        <div v-if="currentToolCall" class="message-content tool-call-indicator">
          <span class="tool-call-icon">🔧</span>
          <span class="tool-call-text">Calling {{ currentToolCall }}... ({{ formatElapsedTime(toolCallElapsedTime) }})</span>
        </div>

        <!-- Show typing indicator only if no content and no tool call -->
        <div v-if="!streamingContent && !currentToolCall" class="message-content typing-indicator">
          <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MessageList',
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    persona: {
      type: Object,
      default: () => ({ name: 'User' })
    },
    editingMessage: {
      type: Number,
      default: null
    },
    isGeneratingSwipe: {
      type: Boolean,
      default: false
    },
    generatingSwipeIndex: {
      type: Number,
      default: null
    },
    streamingContent: {
      type: String,
      default: ''
    },
    isStreaming: {
      type: Boolean,
      default: false
    },
    currentToolCall: {
      type: String,
      default: null
    },
    toolCallElapsedTime: {
      type: Number,
      default: 0
    },
    currentSpeaker: {
      type: String,
      default: null
    },
    // Functions passed as props
    getMessageAvatar: {
      type: Function,
      required: true
    },
    getMessageCharacterName: {
      type: Function,
      required: true
    },
    getCurrentContent: {
      type: Function,
      required: true
    },
    sanitizeHtml: {
      type: Function,
      required: true
    },
    estimateTokens: {
      type: Function,
      required: true
    },
    canSwipeLeft: {
      type: Function,
      required: true
    },
    getCurrentSwipeIndex: {
      type: Function,
      required: true
    },
    getTotalSwipes: {
      type: Function,
      required: true
    },
    getStreamingAvatar: {
      type: Function,
      required: true
    },
    getStreamingCharacterName: {
      type: Function,
      required: true
    },
    formatElapsedTime: {
      type: Function,
      required: true
    }
  },
  emits: [
    'scroll',
    'show-avatar-menu',
    'edit-message',
    'copy-message',
    'open-branch-modal',
    'delete-message',
    'delete-messages-below',
    'cancel-edit',
    'update-edited-content',
    'save-edit',
    'swipe-left',
    'swipe-right'
  ],
  methods: {
    setFallbackAvatar(event) {
      const svgQuestionMark = `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
          <rect width="48" height="48" fill="#3a3f4b" rx="12"/>
          <text x="24" y="32" font-family="Arial, sans-serif" font-size="28" fill="#8b92a8" text-anchor="middle" font-weight="bold">?</text>
        </svg>
      `)}`;
      event.target.src = svgQuestionMark;
    },
    getEditTextareaRef(index) {
      return this.$refs['editTextarea' + index]?.[0] || this.$refs['editTextarea' + index];
    },
    getMessagesContainer() {
      return this.$refs.messagesContainer;
    }
  }
};
</script>

<style scoped>
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.message-avatar.clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.message-avatar.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.user-avatar {
  background: var(--accent-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.message-bubble {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  position: relative;
  max-width: 100%;
}

.message.user .message-bubble {
  background: var(--accent-color);
  color: white;
}

.message-actions {
  position: absolute;
  top: -24px;
  right: 0;
  display: none;
  gap: 4px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 2px;
}

.message:hover .message-actions {
  display: flex;
}

.message-actions button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.85rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.message-actions button:hover {
  opacity: 1;
}

.message-content {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-text {
  line-height: 1.5;
}

.message-text :deep(p) {
  margin: 0 0 0.5rem 0;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.content-part {
  margin-bottom: 0.5rem;
}

.content-part:last-child {
  margin-bottom: 0;
}

.message-image {
  margin: 0.5rem 0;
}

.inline-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  cursor: pointer;
}

.ai-generated-images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.swipe-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.swipe-button {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.swipe-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.swipe-counter {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.message-edit-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-edit-textarea {
  width: 100%;
  min-height: 60px;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.edit-inline-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.edit-confirm,
.edit-cancel {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.edit-confirm {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.edit-cancel {
  background: var(--bg-tertiary);
}

.tool-call-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.9rem;
}

.tool-call-icon {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.typing-indicator {
  padding: 0.5rem;
}

.typing-dots span {
  animation: typing 1s ease-in-out infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.delete-below-button {
  color: var(--text-warning, #f59e0b);
}

.branch-button {
  color: var(--text-success, #22c55e);
}
</style>
