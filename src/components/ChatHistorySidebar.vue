<template>
  <div v-if="show" class="chat-history-sidebar">
    <h3>Chat History</h3>
    <div class="history-list">
      <div
        v-for="item in chatHistory"
        :key="item.filename"
        :class="['history-item', { active: item.filename === activeChatId }]"
        @click="$emit('load-chat', item)"
      >
        <div class="history-info">
          <span class="history-date">{{ formatDate(item.timestamp) }}</span>
          <span class="history-preview">{{ getPreview(item) }}</span>
        </div>
        <div class="history-actions">
          <button @click.stop="$emit('rename-chat', item)" class="history-rename" title="Rename chat">✏️</button>
          <button @click.stop="$emit('delete-chat', item.filename)" class="history-delete" title="Delete chat">🗑️</button>
        </div>
      </div>
    </div>
    <button @click="$emit('close')" class="close-history">Close</button>
  </div>
</template>

<script>
import { formatRelativeDate } from '../utils/dateFormat.js';

export default {
  name: 'ChatHistorySidebar',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    chatHistory: {
      type: Array,
      default: () => []
    },
    activeChatId: {
      type: String,
      default: null
    }
  },
  emits: ['close', 'load-chat', 'rename-chat', 'delete-chat'],
  methods: {
    formatDate(timestamp) {
      return formatRelativeDate(timestamp);
    },
    getPreview(chat) {
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
  }
};
</script>

<style scoped>
.chat-history-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 300px;
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 1rem;
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.chat-history-sidebar h3 {
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.history-list {
  flex: 1;
  overflow-y: auto;
}

.history-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.history-item:hover {
  background: var(--bg-hover);
}

.history-item.active {
  background: var(--accent-color);
  color: white;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-date {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.history-item.active .history-date {
  color: rgba(255, 255, 255, 0.8);
}

.history-preview {
  display: block;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.history-rename,
.history-delete {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.9rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.history-rename:hover,
.history-delete:hover {
  opacity: 1;
}

.close-history {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
}

.close-history:hover {
  background: var(--bg-hover);
}
</style>
