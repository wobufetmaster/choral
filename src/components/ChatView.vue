<template>
  <div class="chat-view">
    <div class="chat-header">
      <button @click="$router.push('/')" class="back-button">← Back</button>
      <h2>{{ characterName }}</h2>
      <div class="header-actions">
        <button @click="newChat">New Chat</button>
        <button @click="showChatHistory = !showChatHistory">History</button>
        <button @click="showPersonas = true">Persona</button>
        <button @click="showPresets = true">Presets</button>
        <button @click="showSettings = !showSettings">Settings</button>
      </div>
    </div>

    <!-- Chat History Sidebar -->
    <div v-if="showChatHistory" class="chat-history-sidebar">
      <h3>Chat History</h3>
      <div class="history-list">
        <div
          v-for="chat in chatHistory"
          :key="chat.filename"
          :class="['history-item', { active: chat.filename === chatId }]"
          @click="loadChatFromHistory(chat)"
        >
          <div class="history-info">
            <span class="history-date">{{ formatDate(chat.timestamp) }}</span>
            <span class="history-preview">{{ getPreview(chat) }}</span>
          </div>
          <button @click.stop="deleteChat(chat.filename)" class="history-delete">🗑️</button>
        </div>
      </div>
      <button @click="showChatHistory = false" class="close-history">Close</button>
    </div>

    <PersonaManager
      v-if="showPersonas"
      :currentPersona="persona"
      @persona-saved="onPersonaSaved"
      @close="showPersonas = false"
    />

    <PresetSelector
      v-if="showPresets"
      :currentSettings="settings"
      @apply="applyPreset"
      @close="showPresets = false"
    />

    <div class="chat-container">
      <div class="messages" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message', message.role]"
        >
          <img
            v-if="message.role === 'assistant'"
            :src="`/api/characters/${$route.query.character}/image`"
            :alt="characterName"
            class="message-avatar"
          />
          <img
            v-else-if="persona.avatar"
            :src="persona.avatar"
            :alt="persona.name"
            class="message-avatar"
          />
          <div v-else class="message-avatar user-avatar">
            {{ persona.name[0] }}
          </div>
          <div class="message-bubble">
            <div class="message-actions">
              <button @click="editMessage(index)" title="Edit">✏️</button>
              <button @click="copyMessage(message.content)" title="Copy">📋</button>
              <button @click="deleteMessage(index)" title="Delete">🗑️</button>
              <button @click="branch(index)" title="Branch (Coming Soon)">🌿</button>
            </div>
            <div v-if="editingMessage === index" class="message-edit-container">
              <textarea
                v-model="editedContent"
                class="message-edit-textarea"
                :ref="'editTextarea' + index"
                @keydown.escape="cancelEdit"
                @input="autoResizeTextarea"
              ></textarea>
              <div class="edit-inline-actions">
                <button @click="saveEdit" class="edit-confirm" title="Save">✓</button>
                <button @click="cancelEdit" class="edit-cancel" title="Cancel">✕</button>
              </div>
            </div>
            <div v-else class="message-content" v-html="sanitizeHtml(message.content)"></div>
          </div>
        </div>

        <div v-if="isStreaming" class="message assistant">
          <img
            :src="`/api/characters/${$route.query.character}/image`"
            :alt="characterName"
            class="message-avatar"
          />
          <div class="message-bubble">
            <div class="message-content" v-html="sanitizeHtml(streamingContent)"></div>
          </div>
        </div>
      </div>

      <div class="input-area">
        <textarea
          v-model="userInput"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          :disabled="isStreaming"
        ></textarea>
        <button @click="sendMessage" :disabled="isStreaming || !userInput.trim()">
          {{ isStreaming ? 'Generating...' : 'Send' }}
        </button>
      </div>
    </div>

    <div v-if="showSettings" class="settings-panel">
      <h3>Settings</h3>
      <div class="setting">
        <label>Model:</label>
        <input v-model="settings.model" type="text" />
      </div>
      <div class="setting">
        <label>Temperature:</label>
        <input v-model.number="settings.temperature" type="number" min="0" max="2" step="0.1" />
      </div>
      <div class="setting">
        <label>Max Tokens:</label>
        <input v-model.number="settings.max_tokens" type="number" />
      </div>
      <button @click="showSettings = false">Close</button>
    </div>

  </div>
</template>

<script>
import DOMPurify from 'dompurify';
import { processMacrosForDisplay } from '../utils/macros';
import PresetSelector from './PresetSelector.vue';
import PersonaManager from './PersonaManager.vue';

export default {
  name: 'ChatView',
  components: {
    PresetSelector,
    PersonaManager
  },
  data() {
    return {
      character: null,
      characterName: 'Chat',
      persona: { name: 'User', avatar: null },
      messages: [],
      userInput: '',
      isStreaming: false,
      streamingContent: '',
      showSettings: false,
      showPresets: false,
      showPersonas: false,
      showChatHistory: false,
      chatHistory: [],
      settings: {
        model: 'anthropic/claude-opus-4',
        temperature: 1.0,
        max_tokens: 4096,
        top_p: 0.92,
        top_k: 0,
        systemPrompts: []
      },
      chatId: null,
      editingMessage: null,
      editedContent: ''
    }
  },
  watch: {
    async showChatHistory(newVal) {
      if (newVal) {
        await this.loadChatHistory();
      }
    }
  },
  async mounted() {
    const characterFilename = this.$route.query.character;

    if (characterFilename) {
      await this.loadCharacter(characterFilename);
    }

    // Load active preset
    await this.loadActivePreset();

    // Load default persona
    await this.loadPersona();

    // Load existing chat if ID provided, or load most recent for character
    const chatId = this.$route.params.id;
    if (chatId && chatId !== 'new') {
      await this.loadChat(chatId);
    } else if (characterFilename) {
      // Try to load most recent chat for this character
      await this.loadMostRecentChat(characterFilename);
    }
  },
  methods: {
    async loadCharacter(filename) {
      try {
        const response = await fetch(`/api/characters/${filename}`);
        this.character = await response.json();
        this.characterName = this.character.data.name;
      } catch (error) {
        console.error('Failed to load character:', error);
      }
    },
    async loadPersona() {
      try {
        const response = await fetch('/api/personas');
        const personas = await response.json();

        if (personas.length > 0) {
          // Check if any persona is bound to current character
          const characterFilename = this.$route.query.character;
          const boundPersona = personas.find(p =>
            p.characterBindings?.includes(characterFilename)
          );

          // Use bound persona if found, otherwise use first persona
          this.persona = boundPersona || personas[0];

          // Ensure persona has all fields
          if (!this.persona.description) this.persona.description = '';
          if (!this.persona.characterBindings) this.persona.characterBindings = [];
        }
      } catch (error) {
        console.error('Failed to load persona:', error);
      }
    },
    async loadActivePreset() {
      try {
        // Get active preset filename from config
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        const activePresetFilename = config.activePreset || 'default.json';

        // Load the preset
        const presetResponse = await fetch(`/api/presets/${activePresetFilename}`);
        const preset = await presetResponse.json();

        // Apply to settings
        this.settings = {
          model: preset.model,
          temperature: preset.temperature,
          max_tokens: preset.max_tokens,
          top_p: preset.top_p,
          top_k: preset.top_k,
          systemPrompts: preset.prompts || [],
          prompt_processing: preset.prompt_processing || 'merge_system'
        };
      } catch (error) {
        console.error('Failed to load active preset:', error);
        // Continue with default settings if preset fails to load
      }
    },
    initializeChat() {
      if (!this.character) return;

      const firstMessage = this.character.data.first_mes || 'Hello!';
      this.messages = [{
        role: 'assistant',
        content: firstMessage
      }];
    },
    async loadChat(chatId) {
      try {
        const response = await fetch(`/api/chats/${chatId}`);
        const chat = await response.json();
        this.messages = chat.messages || [];
        this.chatId = chatId;
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    },
    async loadMostRecentChat(characterFilename) {
      try {
        const response = await fetch(`/api/chats/character/${characterFilename}`);
        if (response.ok) {
          const chat = await response.json();
          this.messages = chat.messages || [];
          this.chatId = chat.filename;
        } else {
          // No existing chat, initialize new one
          this.initializeChat();
        }
      } catch (error) {
        // No existing chat, initialize new one
        this.initializeChat();
      }
    },
    async saveChat(showNotification = false) {
      try {
        const chat = {
          filename: this.chatId || `chat_${Date.now()}.json`,
          character: this.character?.data.name || 'Unknown',
          characterFilename: this.$route.query.character,
          messages: this.messages,
          timestamp: Date.now()
        };

        const response = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chat)
        });

        const result = await response.json();
        this.chatId = result.filename;
        if (showNotification) {
          this.$root.$notify('Chat saved successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to save chat:', error);
        if (showNotification) {
          this.$root.$notify('Failed to save chat', 'error');
        }
      }
    },
    async sendMessage() {
      if (!this.userInput.trim() || this.isStreaming) return;

      const userMessage = {
        role: 'user',
        content: this.userInput.trim()
      };

      this.messages.push(userMessage);
      this.userInput = '';

      // Build context for API
      const context = this.buildContext();

      // Start streaming
      this.isStreaming = true;
      this.streamingContent = '';

      try {
        await this.streamResponse(context);
      } catch (error) {
        console.error('Error streaming response:', error);
        this.isStreaming = false;
        this.$root.$notify('Failed to get response', 'error');
      }
    },
    buildContext() {
      const context = [];

      // If we have system prompts from preset, use those
      if (this.settings.systemPrompts && this.settings.systemPrompts.length > 0) {
        // Sort prompts by injection order
        const sortedPrompts = [...this.settings.systemPrompts]
          .filter(p => p.enabled)
          .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

        // Process each prompt and replace placeholders
        for (const prompt of sortedPrompts) {
          let content = prompt.content || '';

          // Replace template placeholders
          content = content.replace(/\{\{description\}\}/g, this.character?.data.description || '');
          content = content.replace(/\{\{personality\}\}/g, this.character?.data.personality || '');
          content = content.replace(/\{\{scenario\}\}/g, this.character?.data.scenario || '');
          content = content.replace(/\{\{system_prompt\}\}/g, this.character?.data.system_prompt || '');

          // Only add if there's actual content
          if (content.trim()) {
            context.push({
              role: prompt.role || 'system',
              content: content.trim()
            });
          }
        }
      } else {
        // Fallback: Build from character card directly
        const systemPrompt = this.character?.data.system_prompt || '';
        const description = this.character?.data.description || '';
        const personality = this.character?.data.personality || '';
        const scenario = this.character?.data.scenario || '';

        if (systemPrompt || description || personality || scenario) {
          let systemContent = '';
          if (systemPrompt) systemContent += systemPrompt + '\n\n';
          if (description) systemContent += `Character: ${description}\n\n`;
          if (personality) systemContent += `Personality: ${personality}\n\n`;
          if (scenario) systemContent += `Scenario: ${scenario}\n\n`;

          context.push({
            role: 'system',
            content: systemContent.trim()
          });
        }
      }

      // Add persona description if present
      if (this.persona?.description?.trim()) {
        context.push({
          role: 'system',
          content: `User persona: ${this.persona.description.trim()}`
        });
      }

      // Add conversation history
      context.push(...this.messages);

      return context;
    },
    async streamResponse(messages) {
      // Build macro context
      const macroContext = {
        charName: this.character?.data.name || 'Character',
        charNickname: this.character?.data.nickname || '',
        userName: this.persona?.name || 'User'
      };

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: this.settings.model,
          options: {
            temperature: this.settings.temperature,
            max_tokens: this.settings.max_tokens,
            top_p: this.settings.top_p,
            top_k: this.settings.top_k
          },
          context: macroContext,
          promptProcessing: this.settings.prompt_processing || 'merge_system'
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              this.messages.push({
                role: 'assistant',
                content: this.streamingContent
              });
              this.streamingContent = '';
              this.isStreaming = false;
              this.$nextTick(() => this.scrollToBottom());

              // Auto-save after AI response
              await this.saveChat();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                this.streamingContent += parsed.content;
                this.$nextTick(() => this.scrollToBottom());
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (!data.trim()) continue;
              console.error('Parse error:', e);
            }
          }
        }
      }
    },
    sanitizeHtml(html) {
      // Process macros first
      const macroContext = {
        charName: this.character?.data.name || 'Character',
        charNickname: this.character?.data.nickname || '',
        userName: this.persona?.name || 'User'
      };
      const processed = processMacrosForDisplay(html, macroContext);

      // Then sanitize
      return DOMPurify.sanitize(processed, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div', 'span', 'img', 'h1', 'h2', 'h3', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style']
      });
    },
    editMessage(index) {
      this.editingMessage = index;
      this.editedContent = this.messages[index].content;
      this.$nextTick(() => {
        const textarea = this.$refs['editTextarea' + index];
        if (textarea && textarea[0]) {
          const el = textarea[0];
          // Auto-resize to fit content
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';

          el.focus();
          // Place cursor at end
          el.selectionStart = el.selectionEnd = el.value.length;
        }
      });
    },
    async saveEdit() {
      if (this.editingMessage !== null && this.editedContent.trim()) {
        this.messages[this.editingMessage].content = this.editedContent;
        await this.saveChat();
        this.cancelEdit();
      }
    },
    cancelEdit() {
      this.editingMessage = null;
      this.editedContent = '';
    },
    autoResizeTextarea(event) {
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    },
    async copyMessage(content) {
      try {
        // Copy both HTML and plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        // Use the modern Clipboard API with both formats
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([content], { type: 'text/html' }),
            'text/plain': new Blob([textContent], { type: 'text/plain' })
          })
        ]);

        this.$root.$notify('Message copied to clipboard', 'success');
      } catch (err) {
        // Fallback to plain text if HTML copy fails
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          const textContent = tempDiv.textContent || tempDiv.innerText || '';
          await navigator.clipboard.writeText(textContent);
          this.$root.$notify('Message copied (plain text)', 'success');
        } catch (fallbackErr) {
          console.error('Failed to copy:', fallbackErr);
          this.$root.$notify('Failed to copy message', 'error');
        }
      }
    },
    async deleteMessage(index) {
      if (confirm('Delete this message?')) {
        this.messages.splice(index, 1);
        await this.saveChat();
      }
    },
    branch(index) {
      // TODO: Implement branching system
      this.$root.$notify('Branching system coming soon!', 'info');
    },
    applyPreset(preset) {
      // Apply preset settings to current chat
      this.settings = {
        model: preset.model,
        temperature: preset.temperature,
        max_tokens: preset.max_tokens,
        top_p: preset.top_p,
        top_k: preset.top_k,
        systemPrompts: preset.prompts || []
      };
      this.$root.$notify(`Applied preset: ${preset.name}`, 'success');
    },
    onPersonaSaved(persona) {
      this.persona = persona;
      this.$root.$notify(`Now using persona: ${persona.name}`, 'success');
    },
    newChat() {
      this.messages = [];
      this.chatId = null;
      this.initializeChat();
      this.$root.$notify('Started new chat', 'info');
    },
    async loadChatHistory() {
      try {
        const characterFilename = this.$route.query.character;
        const response = await fetch('/api/chats');
        const allChats = await response.json();

        // Filter chats for current character and sort by timestamp
        this.chatHistory = allChats
          .filter(c => c.characterFilename === characterFilename)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    },
    async loadChatFromHistory(chat) {
      this.messages = chat.messages || [];
      this.chatId = chat.filename;
      this.showChatHistory = false;
      this.$nextTick(() => this.scrollToBottom());
    },
    async deleteChat(filename) {
      if (!confirm('Delete this chat?')) return;

      try {
        await fetch(`/api/chats/${filename}`, { method: 'DELETE' });
        await this.loadChatHistory();
        if (filename === this.chatId) {
          this.newChat();
        }
        this.$root.$notify('Chat deleted', 'success');
      } catch (error) {
        console.error('Failed to delete chat:', error);
        this.$root.$notify('Failed to delete chat', 'error');
      }
    },
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    },
    getPreview(chat) {
      const lastMessage = chat.messages?.[chat.messages.length - 1];
      if (!lastMessage) return 'Empty chat';
      const preview = lastMessage.content.substring(0, 50);
      return preview + (lastMessage.content.length > 50 ? '...' : '');
    },
    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.back-button {
  padding: 8px 12px;
}

.chat-header h2 {
  flex: 1;
  font-size: 20px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 85%;
  animation: fadeIn 0.2s;
  align-items: flex-start;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
  flex-direction: row;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.message-bubble {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.message-content {
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
  word-wrap: break-word;
}

.message.user .message-content {
  background: var(--accent-color);
  color: white;
  border-radius: 18px 18px 4px 18px;
}

.message.assistant .message-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 18px 18px 18px 4px;
}

.message-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  margin-bottom: 4px;
}

.message.user .message-actions {
  flex-direction: row-reverse;
}

.message:hover .message-actions {
  opacity: 1;
}

.message-actions button {
  padding: 4px 8px;
  font-size: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.message-actions button:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.input-area textarea {
  flex: 1;
  min-height: 60px;
  max-height: 200px;
  resize: vertical;
}

.input-area button {
  align-self: flex-end;
  padding: 12px 24px;
  background: var(--accent-color);
  color: white;
  border: none;
}

.input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
}

.settings-panel h3 {
  margin-bottom: 16px;
}

.setting {
  margin-bottom: 16px;
}

.setting label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  color: var(--text-secondary);
}

.setting input {
  width: 100%;
}

.chat-history-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 350px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
  z-index: 999;
  display: flex;
  flex-direction: column;
}

.chat-history-sidebar h3 {
  margin-bottom: 16px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: var(--hover-color);
}

.history-item.active {
  border-color: var(--accent-color);
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.history-date {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.history-preview {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-delete {
  padding: 4px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}

.history-delete:hover {
  opacity: 1;
}

.close-history {
  width: 100%;
}

.message-edit-container {
  position: relative;
  padding: 12px 16px;
  border-radius: 18px;
  background: var(--bg-primary);
  border: 2px solid var(--accent-color);
}

.message-edit-textarea {
  width: 100%;
  min-height: auto;
  resize: vertical;
  padding: 8px;
  padding-right: 72px; /* Space for buttons */
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  overflow-y: hidden;
}

.message-edit-textarea:focus {
  outline: none;
}

.edit-inline-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.edit-confirm,
.edit-cancel {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
}

.edit-confirm {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.edit-confirm:hover {
  opacity: 0.9;
}

.edit-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.edit-cancel:hover {
  background: var(--bg-tertiary);
}
</style>
