<template>
  <div class="chat-view">
    <div class="chat-header">
      <button v-if="!tabData" @click="$router.push('/')" class="back-button">← Back</button>
      <h2>{{ chatTitle }}</h2>
      <div class="header-actions">
        <button v-if="isGroupChat" @click="showGroupManager = !showGroupManager" :class="{ 'active': showGroupManager }">👥 Group</button>
      </div>
    </div>

    <!-- Chat Sidebar -->
    <div class="chat-sidebar" :class="{ collapsed: !sidebarOpen }">
      <button @click="sidebarOpen = !sidebarOpen" class="sidebar-toggle" :title="sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'">
        {{ sidebarOpen ? '◀' : '▶' }}
      </button>

      <div v-if="sidebarOpen" class="sidebar-content">
        <div class="sidebar-header">
          <h3>Chat Controls</h3>
        </div>

      <!-- Model/Preset Info -->
      <div class="sidebar-info">
        <div class="info-row">
          <span class="info-label">Model:</span>
          <span class="info-value" :title="settings.model">{{ displayModelName }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Preset:</span>
          <span class="info-value">{{ currentPresetName || 'None' }}</span>
        </div>
        <div class="context-window">
          <div class="context-header">
            <span class="info-label">Context:</span>
            <span class="context-stats">{{ debugInfo.estimatedTokens.toLocaleString() }} / {{ settings.max_tokens.toLocaleString() }}</span>
          </div>
          <div class="context-bar">
            <div class="context-fill" :style="{ width: contextPercentage + '%' }"></div>
          </div>
          <div class="context-percentage">{{ contextPercentage }}%</div>
        </div>
      </div>

        <!-- Sidebar Actions -->
        <div class="sidebar-actions">
          <button @click="newChat" class="sidebar-btn">📝 New Chat</button>
          <button v-if="!isGroupChat && character" @click="convertToGroupChat" class="sidebar-btn">👥 Convert to Group</button>
          <button @click="showChatHistory = !showChatHistory" :class="{ 'active': showChatHistory }" class="sidebar-btn">📜 History</button>
          <button @click="showPersonas = true" class="sidebar-btn">👤 Persona</button>
          <button @click="showLorebooks = true" class="sidebar-btn">📚 Lorebook</button>
          <button @click="showPresets = true" class="sidebar-btn">⚙️ Presets</button>
          <button @click="showDebug = !showDebug" :class="{ 'active': showDebug }" class="sidebar-btn">🐛 Debug</button>
        </div>
      </div>
    </div>

    <!-- Avatar Menu -->
    <div v-if="avatarMenu.show" class="avatar-menu" :style="{ top: avatarMenu.y + 'px', left: avatarMenu.x + 'px' }" @click.stop>
      <div class="avatar-menu-header">
        <strong>{{ avatarMenu.characterName }}</strong>
      </div>
      <button @click="viewCharacterCard" class="avatar-menu-btn">📄 View Card</button>
      <button v-if="isGroupChat" @click="setNextSpeaker" class="avatar-menu-btn">🎤 Set as Next Speaker</button>
      <button @click="closeAvatarMenu" class="avatar-menu-btn cancel">✕ Close</button>
    </div>

    <!-- Character Card Modal -->
    <div v-if="showCharacterCard" class="modal-overlay" @click="showCharacterCard = false">
      <div class="modal-content character-card-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ viewingCharacter?.data?.name || 'Character Card' }}</h3>
          <button @click="showCharacterCard = false" class="close-button">×</button>
        </div>
        <div class="character-card-content" v-if="viewingCharacter">
          <img v-if="viewingCharacter.avatar" :src="viewingCharacter.avatar" :alt="viewingCharacter.data.name" class="card-avatar" />
          <div class="card-field" v-if="viewingCharacter.data.description">
            <strong>Description:</strong>
            <p>{{ viewingCharacter.data.description }}</p>
          </div>
          <div class="card-field" v-if="viewingCharacter.data.personality">
            <strong>Personality:</strong>
            <p>{{ viewingCharacter.data.personality }}</p>
          </div>
          <div class="card-field" v-if="viewingCharacter.data.scenario">
            <strong>Scenario:</strong>
            <p>{{ viewingCharacter.data.scenario }}</p>
          </div>
          <div class="card-field" v-if="viewingCharacter.data.first_mes">
            <strong>First Message:</strong>
            <p>{{ viewingCharacter.data.first_mes }}</p>
          </div>
        </div>
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
          <div class="history-actions">
            <button @click.stop="renameChatFromHistory(chat)" class="history-rename" title="Rename chat">✏️</button>
            <button @click.stop="deleteChat(chat.filename)" class="history-delete" title="Delete chat">🗑️</button>
          </div>
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

    <GroupChatManager
      v-if="showGroupManager && isGroupChat"
      :characters="groupChatCharacters"
      :strategy="groupChatStrategy"
      :explicitMode="groupChatExplicitMode"
      :allCharacters="allCharacters"
      @close="showGroupManager = false"
      @update:strategy="updateGroupStrategy"
      @update:explicit-mode="updateExplicitMode"
      @trigger-response="triggerCharacterResponse"
      @move-up="moveCharacterUp"
      @move-down="moveCharacterDown"
      @remove-character="removeCharacterFromGroup"
      @add-character="addCharacterToGroup"
    />

    <div v-if="showLorebooks" class="lorebook-selector-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Lorebooks</h3>
          <button @click="showLorebooks = false" class="close-button">×</button>
        </div>
        <div class="lorebook-list">
          <div
            v-for="lorebook in lorebooks"
            :key="lorebook.filename"
            class="lorebook-option"
            :class="{ 'auto-selected': isAutoSelected(lorebook.filename) }"
          >
            <input
              type="checkbox"
              :id="'lorebook-' + lorebook.filename"
              :value="lorebook.filename"
              v-model="selectedLorebookFilenames"
              class="lorebook-checkbox"
            />
            <label :for="'lorebook-' + lorebook.filename" class="lorebook-checkbox-label">
              <div class="lorebook-info-wrapper">
                <div class="lorebook-name">
                  {{ lorebook.name }}
                  <span v-if="isAutoSelected(lorebook.filename)" class="auto-tag">AUTO</span>
                </div>
                <div class="lorebook-meta">{{ lorebook.entries?.length || 0 }} entries</div>
              </div>
            </label>
            <button @click="editLorebook(lorebook)" class="edit-button" title="Edit">✏️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Lorebook Editor -->
    <div v-if="editingLorebook" class="lorebook-editor-modal">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>Edit: {{ editingLorebook.name }}</h3>
          <button @click="closeLorebookEditor" class="close-button">×</button>
        </div>
        <div class="lorebook-editor-content">
          <div class="editor-field">
            <label>Lorebook Name:</label>
            <input v-model="editingLorebook.name" type="text" class="lorebook-name-input" />
          </div>

          <div class="lorebook-settings">
            <label>
              <input type="checkbox" v-model="editingLorebook.autoSelect" />
              Auto-select for characters with matching tags
            </label>
            <label v-if="editingLorebook.autoSelect">
              Tags to match:
              <input
                v-model="editingLorebook.matchTags"
                type="text"
                placeholder="tag1, tag2, tag3"
                class="tag-input"
              />
            </label>
            <label>
              Scan depth (0 = all messages):
              <input v-model.number="editingLorebook.scanDepth" type="number" min="0" class="scan-depth-input" />
            </label>
          </div>

          <div class="entries-section">
            <div class="entries-header">
              <h4>Entries</h4>
              <button @click="addEntryToEditing" class="btn-primary">Add Entry</button>
            </div>

            <div
              v-for="(entry, index) in editingLorebook.entries"
              :key="index"
              class="entry-item"
            >
              <div class="entry-header">
                <input
                  v-model="entry.name"
                  type="text"
                  placeholder="Entry Name"
                  class="entry-name-input"
                />
                <div class="entry-controls">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="entry.enabled" />
                    Enabled
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="entry.constant" />
                    Always On
                  </label>
                  <button @click="removeEntryFromEditing(index)" class="btn-delete">Delete</button>
                </div>
              </div>

              <div class="entry-matching">
                <div class="match-section">
                  <label>Keywords (case-insensitive):</label>
                  <input
                    v-model="entry.keysInput"
                    @input="updateEntryKeys(entry)"
                    type="text"
                    placeholder="keyword1, keyword2, keyword3"
                    class="keys-input"
                  />
                </div>

                <div class="match-section">
                  <label>Regex Pattern:</label>
                  <input
                    v-model="entry.regex"
                    type="text"
                    placeholder="^pattern.*"
                    class="regex-input"
                  />
                </div>
              </div>

              <div class="entry-content">
                <label>Content:</label>
                <textarea
                  v-model="entry.content"
                  placeholder="Information to inject when matched..."
                  rows="4"
                  class="content-textarea"
                ></textarea>
              </div>

              <div class="entry-settings">
                <label>
                  Priority (higher = injected first):
                  <input v-model.number="entry.priority" type="number" class="priority-input" />
                </label>
              </div>
            </div>

            <div v-if="!editingLorebook.entries || editingLorebook.entries.length === 0" class="no-entries">
              No entries yet. Click "Add Entry" to create one.
            </div>
          </div>

          <div class="editor-actions">
            <button @click="saveEditingLorebook" class="btn-primary">Save Changes</button>
            <button @click="closeLorebookEditor" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Panel -->
    <div v-if="showDebug" class="debug-panel">
      <div class="debug-header">
        <h3>🐛 Debug Information</h3>
        <button @click="showDebug = false" class="close-debug">×</button>
      </div>

      <div class="debug-content">
        <!-- Token Information -->
        <div class="debug-section">
          <h4>📊 Token Usage</h4>
          <div class="debug-info">
            <div class="debug-row">
              <span class="debug-label">Estimated Tokens Sent:</span>
              <span class="debug-value">{{ debugInfo.estimatedTokens || 'N/A' }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Model Max Tokens:</span>
              <span class="debug-value">{{ settings.max_tokens || 'N/A' }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Model:</span>
              <span class="debug-value">{{ settings.model }}</span>
            </div>
          </div>
        </div>

        <!-- Active Preset -->
        <div class="debug-section">
          <h4>⚙️ Active Preset</h4>
          <div class="debug-info">
            <div class="debug-row">
              <span class="debug-label">Temperature:</span>
              <span class="debug-value">{{ settings.temperature }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Top P:</span>
              <span class="debug-value">{{ settings.top_p }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Top K:</span>
              <span class="debug-value">{{ settings.top_k }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Prompt Processing:</span>
              <span class="debug-value">{{ settings.prompt_processing || 'merge_system' }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">System Prompts:</span>
              <span class="debug-value">{{ settings.systemPrompts?.length || 0 }} prompts</span>
            </div>
          </div>
        </div>

        <!-- Active Lorebooks -->
        <div class="debug-section" v-if="selectedLorebookFilenames.length > 0">
          <h4>📚 Active Lorebooks ({{ selectedLorebookFilenames.length }})</h4>
          <div class="debug-lorebook-list">
            <div v-for="filename in selectedLorebookFilenames" :key="filename" class="debug-lorebook-item">
              <div class="debug-lorebook-header">
                <span class="debug-lorebook-name">{{ getLorebook(filename)?.name || filename }}</span>
                <span v-if="isAutoSelected(filename)" class="auto-badge">AUTO</span>
              </div>
              <div v-if="debugInfo.matchedEntries && debugInfo.matchedEntries[filename]" class="matched-entries">
                <div class="matched-entries-title">Matched Entries ({{ debugInfo.matchedEntries[filename].length }}):</div>
                <div v-for="(entry, idx) in debugInfo.matchedEntries[filename]" :key="idx" class="matched-entry">
                  <div class="matched-entry-header">
                    <span class="entry-name">{{ entry.name }}</span>
                    <span class="entry-priority">Priority: {{ entry.priority || 0 }}</span>
                  </div>
                  <div class="matched-keywords" v-if="entry.matchedKeys && entry.matchedKeys.length > 0">
                    <span class="keywords-label">Matched Keywords:</span>
                    <span v-for="key in entry.matchedKeys" :key="key" class="matched-keyword">{{ key }}</span>
                  </div>
                  <div class="entry-content-preview">{{ entry.content?.substring(0, 100) }}{{ entry.content?.length > 100 ? '...' : '' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Structure -->
        <div class="debug-section">
          <h4>📝 Message Structure</h4>
          <div class="debug-info">
            <div class="debug-row">
              <span class="debug-label">Total Messages:</span>
              <span class="debug-value">{{ debugInfo.messageCount || messages.length }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">System Messages:</span>
              <span class="debug-value">{{ debugInfo.systemMessageCount || 0 }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">User Messages:</span>
              <span class="debug-value">{{ debugInfo.userMessageCount || 0 }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Assistant Messages:</span>
              <span class="debug-value">{{ debugInfo.assistantMessageCount || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Last Request Details -->
        <div class="debug-section" v-if="debugInfo.lastRequest">
          <h4>🔍 Last Request</h4>
          <div class="debug-code">
            <pre>{{ JSON.stringify(debugInfo.lastRequest, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-container" :class="{ 'with-debug': showDebug }">
      <div class="messages" ref="messagesContainer" @scroll="handleScroll">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message', message.role]"
        >
          <img
            v-if="message.role === 'assistant'"
            :src="getMessageAvatar(message)"
            :alt="getMessageCharacterName(message)"
            class="message-avatar clickable"
            @click="showAvatarMenu($event, message, index)"
            :title="'Click for options'"
          />
          <img
            v-else-if="persona.avatar"
            :src="persona.avatar"
            :alt="persona.name"
            class="message-avatar clickable"
            @click="showAvatarMenu($event, message, index)"
            :title="'Click for options'"
          />
          <div v-else class="message-avatar user-avatar clickable" @click="showAvatarMenu($event, message, index)" :title="'Click for options'">
            {{ (persona.nickname || persona.name)[0] }}
          </div>
          <div class="message-bubble">
            <div class="message-actions">
              <button @click="editMessage(index)" title="Edit">✏️</button>
              <button @click="copyMessage(getCurrentContent(message))" title="Copy">📋</button>
              <button @click="deleteMessage(index)" title="Delete">🗑️</button>
            </div>
            <div v-if="editingMessage === index" class="message-edit-container">
              <div
                :ref="'editTextarea' + index"
                class="message-edit-textarea"
                contenteditable="true"
                @keydown.escape="cancelEdit"
                @input="updateEditedContent"
              ></div>
              <div class="edit-inline-actions">
                <button @click="saveEdit" class="edit-confirm" title="Save">✓</button>
                <button @click="cancelEdit" class="edit-cancel" title="Cancel">✕</button>
              </div>
            </div>
            <div v-else class="message-content" v-html="sanitizeHtml(isGeneratingSwipe && generatingSwipeIndex === index ? streamingContent : getCurrentContent(message), message)" :title="`~${estimateTokens(getCurrentContent(message))} tokens`"></div>

            <!-- Swipe navigation for assistant messages -->
            <div v-if="message.role === 'assistant' && getTotalSwipes(message) > 0" class="swipe-controls">
              <button @click="swipeLeft(index)" :disabled="!canSwipeLeft(message)" class="swipe-button">←</button>
              <span class="swipe-counter">{{ getCurrentSwipeIndex(message) + 1 }}/{{ getTotalSwipes(message) }}</span>
              <button @click="swipeRight(index)" :disabled="isStreaming" class="swipe-button">→</button>
            </div>
          </div>
        </div>

        <div v-if="isStreaming && !isGeneratingSwipe" class="message assistant">
          <img
            :src="getStreamingAvatar()"
            :alt="getStreamingCharacterName()"
            class="message-avatar"
          />
          <div class="message-bubble">
            <div v-if="streamingContent" class="message-content" v-html="sanitizeHtml(streamingContent, { characterFilename: currentSpeaker })"></div>
            <div v-else class="message-content typing-indicator">
              <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          </div>
        </div>
      </div>

      <div class="input-area">
        <textarea
          ref="messageInput"
          v-model="userInput"
          @input="autoResizeTextarea"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          :disabled="isStreaming"
        ></textarea>
        <button @click="sendMessage" :disabled="isStreaming || !userInput.trim()">
          <span v-if="isStreaming">
            Generating<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
          <span v-else>Send</span>
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
import MarkdownIt from 'markdown-it';
import { processMacrosForDisplay } from '../utils/macros';
import PresetSelector from './PresetSelector.vue';
import PersonaManager from './PersonaManager.vue';
import GroupChatManager from './GroupChatManager.vue';

export default {
  name: 'ChatView',
  components: {
    PresetSelector,
    PersonaManager,
    GroupChatManager
  },
  props: {
    tabData: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['open-tab', 'update-tab'],
  data() {
    return {
      md: null, // Markdown renderer (initialized in mounted)
      character: null,
      characterName: 'Chat',
      persona: { name: 'User', avatar: null },
      messages: [],
      userInput: '',
      isStreaming: false,
      streamingContent: '',
      isGeneratingSwipe: false,
      generatingSwipeIndex: null,
      sidebarOpen: true,
      showSettings: false,
      showPresets: false,
      showPersonas: false,
      showChatHistory: false,
      showLorebooks: false,
      showDebug: false,
      showGroupManager: false,
      currentPresetName: null,
      userHasScrolledUp: false,
      avatarMenu: {
        show: false,
        x: 0,
        y: 0,
        message: null,
        messageIndex: null,
        characterName: '',
        characterFilename: ''
      },
      showCharacterCard: false,
      viewingCharacter: null,
      chatHistory: [],
      lorebooks: [],
      selectedLorebookFilenames: [],
      autoSelectedLorebookFilenames: [],
      editingLorebook: null,
      debugInfo: {
        estimatedTokens: 0,
        messageCount: 0,
        systemMessageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        matchedEntries: {},
        lastRequest: null
      },
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
      editedContent: '',
      // Group chat specific
      isGroupChat: false,
      groupChatId: null,
      groupChatCharacters: [],
      groupChatStrategy: 'join',
      groupChatExplicitMode: false,
      groupChatName: '',
      groupChatTags: [],
      allCharacters: [],
      currentSpeaker: null, // Track who's currently generating
      nextSpeaker: null // Track who should speak next
    }
  },
  computed: {
    chatTitle() {
      if (this.isGroupChat) {
        if (this.groupChatName) {
          return this.groupChatName;
        }
        const names = this.groupChatCharacters.map(c => c.name).join(', ');
        return `Group: ${names}`;
      }
      return this.characterName;
    },
    displayModelName() {
      if (!this.settings.model) return 'Not set';
      const parts = this.settings.model.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : this.settings.model;
    },
    contextPercentage() {
      if (!this.settings.max_tokens || this.settings.max_tokens === 0) return 0;
      const percentage = (this.debugInfo.estimatedTokens / this.settings.max_tokens) * 100;
      return Math.min(100, Math.round(percentage));
    }
  },
  watch: {
    async showChatHistory(newVal) {
      if (newVal) {
        await this.loadChatHistory();
      }
    },
    async showLorebooks(newVal) {
      if (newVal) {
        await this.loadLorebooks();
      }
    },
    selectedLorebookFilenames: {
      handler(newVal) {
        // Save manually selected lorebooks to localStorage
        const manuallySelected = newVal.filter(
          filename => !this.autoSelectedLorebookFilenames.includes(filename)
        );
        localStorage.setItem('manuallySelectedLorebooks', JSON.stringify(manuallySelected));
      },
      deep: true
    }
  },
  async mounted() {
    // Initialize markdown renderer
    this.md = new MarkdownIt({
      html: true, // Allow HTML (DOMPurify sanitizes it afterward)
      linkify: true, // Auto-convert URLs to links
      breaks: true, // Convert line breaks to <br>
      typographer: true, // Enable smart quotes and other typography
    });

    // Support both tab data and route query params (for backward compatibility)
    const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
    const groupChatId = this.tabData?.groupChatId || this.$route?.query?.groupChat;

    // Load all characters for group chat management
    await this.loadAllCharacters();

    // Check if this is a group chat
    if (groupChatId) {
      this.isGroupChat = true;
      this.groupChatId = groupChatId;
      await this.loadGroupChat(groupChatId);
    } else if (characterFilename) {
      await this.loadCharacter(characterFilename);
    }

    // Load active preset
    await this.loadActivePreset();

    // Load default persona
    await this.loadPersona();

    // Load existing chat if ID provided
    const chatId = this.tabData?.chatId || this.$route?.params?.id;
    if (!this.isGroupChat) {
      if (chatId && chatId !== 'new') {
        await this.loadChat(chatId);
      } else if (this.$route?.params?.id && characterFilename) {
        // Only auto-load most recent chat in router mode (not tab mode)
        await this.loadMostRecentChat(characterFilename);
      } else if (this.tabData && characterFilename) {
        // In tab mode without chatId, start a new chat with greeting
        this.initializeChat();
      }
    }

    // Load manually selected lorebooks from localStorage
    try {
      const manuallySelected = JSON.parse(localStorage.getItem('manuallySelectedLorebooks') || '[]');
      this.selectedLorebookFilenames = [...manuallySelected];
    } catch (err) {
      console.error('Failed to load manually selected lorebooks:', err);
    }

    // Auto-select lorebook based on character tags (will add to existing manual selections)
    if (!this.isGroupChat) {
      await this.autoSelectLorebook();
    }
  },
  methods: {
    updateTabData() {
      // Update tab data when chat state changes (only in tab mode)
      if (this.tabData) {
        const data = {
          characterId: this.tabData.characterId,
          chatId: this.chatId,
          groupChatId: this.groupChatId,
        };
        this.$emit('update-tab', { data });
      }
    },
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
          const characterFilename = this.tabData?.characterId || this.$route?.query?.character;

          // Priority 1: Check if any persona is bound to current character directly
          let boundPersona = personas.find(p =>
            p.characterBindings?.includes(characterFilename)
          );

          // Priority 2: Check if any persona is bound via character tags
          const characterTags = this.character?.data?.tags || this.character?.tags || [];
          if (!boundPersona && characterTags.length > 0) {
            boundPersona = personas.find(p =>
              p.tagBindings?.some(tag => characterTags.includes(tag))
            );
          }

          // Priority 3: Check for default persona in config
          let defaultPersona = null;
          if (!boundPersona) {
            try {
              const configResponse = await fetch('/api/config');
              const config = await configResponse.json();
              if (config.defaultPersona) {
                defaultPersona = personas.find(p =>
                  (p.name + '.json') === config.defaultPersona
                );
              }
            } catch (error) {
              console.error('Failed to load config for default persona:', error);
            }
          }

          // Use bound persona, default persona, or first persona
          this.persona = boundPersona || defaultPersona || personas[0];

          // Ensure persona has all fields
          if (!this.persona.nickname) this.persona.nickname = '';
          if (!this.persona.description) this.persona.description = '';
          if (!this.persona.characterBindings) this.persona.characterBindings = [];
          if (!this.persona.tagBindings) this.persona.tagBindings = [];
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
        this.currentPresetName = preset.name;
      } catch (error) {
        console.error('Failed to load active preset:', error);
        // Continue with default settings if preset fails to load
      }
    },
    initializeChat() {
      if (!this.character) return;

      const firstMessage = this.character.data.first_mes || 'Hello!';
      const alternateGreetings = this.character.data.alternate_greetings || [];

      // Combine first message with alternate greetings
      const allGreetings = [firstMessage, ...alternateGreetings];

      this.messages = [{
        role: 'assistant',
        swipes: allGreetings,
        swipeIndex: 0,
        isFirstMessage: true  // Mark this as the opening message
      }];
    },
    async loadChat(chatId) {
      try {
        const response = await fetch(`/api/chats/${chatId}`);
        const chat = await response.json();
        this.messages = this.normalizeMessages(chat.messages || []);
        this.chatId = chatId;

        // Trigger auto-naming if chat has messages and hasn't been named yet
        await this.autoNameChat(chatId, chat);
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    },
    async autoNameChat(chatId, chat) {
      try {
        // Only auto-name if:
        // 1. Chat has messages
        // 2. Chat hasn't been auto-named before
        // 3. Title is still the default (character name or filename-based)
        if (!chat || !chat.messages || chat.messages.length === 0) {
          return;
        }

        if (chat.autoNamed) {
          return; // Already auto-named
        }

        // Call auto-naming endpoint (runs in background)
        const endpoint = this.isGroupChat
          ? `/api/group-chats/${chatId}/auto-name`
          : `/api/chats/${chatId}/auto-name`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        if (response.ok) {
          const result = await response.json();
          if (!result.skipped && result.title) {
            console.log('Auto-named chat:', result.title);
            // Optionally update tab title if in tab mode
            if (this.tabData) {
              this.$emit('update-tab', {
                id: this.tabData.id,
                title: result.title
              });
            }
          }
        }
      } catch (error) {
        // Fail silently - auto-naming is not critical
        console.debug('Auto-naming skipped:', error.message);
      }
    },
    normalizeMessages(messages) {
      // Convert old format messages to new swipe format
      return messages.map(msg => {
        if (msg.role === 'assistant') {
          // If already has swipes, use as-is
          if (msg.swipes) {
            return {
              ...msg,
              swipeIndex: msg.swipeIndex ?? 0
            };
          }
          // Convert old format
          return {
            role: 'assistant',
            swipes: [msg.content],
            swipeIndex: 0
          };
        }
        // User messages stay as-is
        return msg;
      });
    },
    async loadMostRecentChat(characterFilename) {
      try {
        const response = await fetch(`/api/chats/character/${characterFilename}`);
        if (response.ok) {
          const chat = await response.json();
          this.messages = this.normalizeMessages(chat.messages || []);
          this.chatId = chat.filename;

          // Trigger auto-naming if needed
          await this.autoNameChat(chat.filename, chat);
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
          characterFilename: this.tabData?.characterId || this.$route?.query?.character,
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
    autoResizeTextarea() {
      const textarea = this.$refs.messageInput;
      if (textarea) {
        // Reset to 'auto' to allow shrinking
        textarea.style.height = 'auto';
        // Calculate new height based on content (capped between 60px and 200px)
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 200);
        textarea.style.height = newHeight + 'px';
      }
    },
    async sendMessage() {
      if (this.isStreaming) return;

      // If input is empty, just trigger a response without adding a user message
      if (!this.userInput.trim()) {
        // For group chats in explicit mode, require character selection
        if (this.isGroupChat && this.groupChatExplicitMode) {
          this.$root.$notify('Select a character to respond.', 'info');
          return;
        }

        // For group chats in auto mode, pick a random character to respond
        if (this.isGroupChat && this.groupChatCharacters.length > 0) {
          const randomIndex = Math.floor(Math.random() * this.groupChatCharacters.length);
          this.currentSpeaker = this.groupChatCharacters[randomIndex].filename;
          console.log('Random character selected:', this.currentSpeaker);
        }

        // Build context for API
        const context = this.buildContext();

        // Start streaming
        this.isStreaming = true;
        this.streamingContent = '';
        this.userHasScrolledUp = false; // Reset scroll lock when AI starts responding

        try {
          await this.streamResponse(context);
        } catch (error) {
          console.error('Error streaming response:', error);
          this.isStreaming = false;
          this.$root.$notify('Failed to get response', 'error');
        }
        return;
      }

      // Normal flow: add user message first
      const userMessage = {
        role: 'user',
        content: this.userInput.trim()
      };

      this.messages.push(userMessage);
      this.userInput = '';

      // Reset textarea height
      this.$nextTick(() => {
        const textarea = this.$refs.messageInput;
        if (textarea) {
          textarea.style.height = '60px';
        }
      });

      // Reset scroll lock when user sends a message (they want to see it)
      this.userHasScrolledUp = false;
      this.$nextTick(() => this.scrollToBottom(true));

      // For group chats in explicit mode, just add the message without generating response
      if (this.isGroupChat && this.groupChatExplicitMode) {
        // Save the group chat with the new user message
        await this.saveGroupChat();
        this.$root.$notify('Message added. Select a character to respond.', 'info');
        return;
      }

      // For group chats in auto mode, pick a random character to respond
      if (this.isGroupChat && this.groupChatCharacters.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.groupChatCharacters.length);
        this.currentSpeaker = this.groupChatCharacters[randomIndex].filename;
        console.log('Random character selected:', this.currentSpeaker);
      }

      // Build context for API
      const context = this.buildContext();

      // Start streaming
      this.isStreaming = true;
      this.streamingContent = '';
      this.userHasScrolledUp = false; // Reset scroll lock when AI starts responding

      try {
        await this.streamResponse(context);
      } catch (error) {
        console.error('Error streaming response:', error);
        this.isStreaming = false;
        this.$root.$notify('Failed to get response', 'error');
      }
    },
    buildContext(upToMessageIndex = null) {
      // Use group chat context builder if in group chat mode
      if (this.isGroupChat) {
        return this.buildGroupChatContext(upToMessageIndex);
      }

      const context = [];

      // If we have system prompts from preset, use those
      if (this.settings.systemPrompts && this.settings.systemPrompts.length > 0) {
        // Sort prompts by injection order
        const sortedPrompts = [...this.settings.systemPrompts]
          .filter(p => p.enabled)
          .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

        // Track if any placeholder was used
        let hasCharacterInfo = false;

        // Process each prompt and replace placeholders
        for (const prompt of sortedPrompts) {
          let content = prompt.content || '';
          const originalContent = content;

          // Replace template placeholders
          content = content.replace(/\{\{description\}\}/g, this.character?.data.description || '');
          content = content.replace(/\{\{personality\}\}/g, this.character?.data.personality || '');
          content = content.replace(/\{\{scenario\}\}/g, this.character?.data.scenario || '');
          content = content.replace(/\{\{system_prompt\}\}/g, this.character?.data.system_prompt || '');
          content = content.replace(/\{\{dialogue_examples\}\}/g, this.character?.data.mes_example || '');

          // Check if any placeholders were replaced
          if (content !== originalContent) {
            hasCharacterInfo = true;
          }

          // Only add if there's actual content
          if (content.trim()) {
            context.push({
              role: prompt.role || 'system',
              content: content.trim()
            });
          }
        }

        // If no placeholders were used, add character info separately
        if (!hasCharacterInfo) {
          const systemPrompt = this.character?.data.system_prompt || '';
          const description = this.character?.data.description || '';
          const personality = this.character?.data.personality || '';
          const scenario = this.character?.data.scenario || '';
          const dialogueExamples = this.character?.data.mes_example || '';

          if (systemPrompt || description || personality || scenario || dialogueExamples) {
            let systemContent = '';
            if (systemPrompt) systemContent += systemPrompt + '\n\n';
            if (description) systemContent += `Character: ${description}\n\n`;
            if (personality) systemContent += `Personality: ${personality}\n\n`;
            if (scenario) systemContent += `Scenario: ${scenario}\n\n`;
            if (dialogueExamples) systemContent += `Example Dialogue:\n${dialogueExamples}\n\n`;

            context.push({
              role: 'system',
              content: systemContent.trim()
            });
          }
        }
      } else {
        // Fallback: Build from character card directly
        const systemPrompt = this.character?.data.system_prompt || '';
        const description = this.character?.data.description || '';
        const personality = this.character?.data.personality || '';
        const scenario = this.character?.data.scenario || '';
        const dialogueExamples = this.character?.data.mes_example || '';

        if (systemPrompt || description || personality || scenario || dialogueExamples) {
          let systemContent = '';
          if (systemPrompt) systemContent += systemPrompt + '\n\n';
          if (description) systemContent += `Character: ${description}\n\n`;
          if (personality) systemContent += `Personality: ${personality}\n\n`;
          if (scenario) systemContent += `Scenario: ${scenario}\n\n`;
          if (dialogueExamples) systemContent += `Example Dialogue:\n${dialogueExamples}\n\n`;

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

      // Add conversation history (optionally up to a certain index)
      const messagesToInclude = upToMessageIndex !== null
        ? this.messages.slice(0, upToMessageIndex)
        : this.messages;

      // Convert messages to context format (handling swipes)
      for (const msg of messagesToInclude) {
        if (msg.role === 'user') {
          context.push({
            role: 'user',
            content: msg.content
          });
        } else {
          // For assistant messages, use current swipe
          context.push({
            role: 'assistant',
            content: msg.swipes?.[msg.swipeIndex] || msg.content || ''
          });
        }
      }

      return context;
    },
    async streamResponse(messages) {
      // Build macro context
      const macroContext = {
        charName: this.character?.data.name || 'Character',
        charNickname: this.character?.data.nickname || '',
        userName: this.persona?.name || 'User'
      };

      const requestBody = {
        messages,
        model: this.settings.model,
        options: {
          temperature: this.settings.temperature,
          max_tokens: this.settings.max_tokens,
          top_p: this.settings.top_p,
          top_k: this.settings.top_k
        },
        context: macroContext,
        promptProcessing: this.settings.prompt_processing || 'merge_system',
        lorebookFilenames: this.selectedLorebookFilenames,
        debug: this.showDebug
      };

      // Update basic debug info before sending
      this.updateBasicDebugInfo(messages);

      // Store last request for debugging
      this.debugInfo.lastRequest = requestBody;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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
              // Add new assistant message with swipe
              if (this.isGeneratingSwipe && this.generatingSwipeIndex !== null) {
                // Add to existing message's swipes
                const message = this.messages[this.generatingSwipeIndex];
                message.swipes.push(this.streamingContent);
                message.swipeIndex = message.swipes.length - 1;

                // Track character for group chat swipes
                if (this.isGroupChat && this.currentSpeaker) {
                  if (!message.swipeCharacters) {
                    message.swipeCharacters = new Array(message.swipes.length - 1).fill(message.characterFilename || null);
                  }
                  message.swipeCharacters.push(this.currentSpeaker);
                }
              } else {
                // Create new message
                const newMessage = {
                  role: 'assistant',
                  swipes: [this.streamingContent],
                  swipeIndex: 0
                };

                // Track character for group chats
                if (this.isGroupChat && this.currentSpeaker) {
                  newMessage.characterFilename = this.currentSpeaker;
                  newMessage.swipeCharacters = [this.currentSpeaker];
                }

                this.messages.push(newMessage);
              }

              this.streamingContent = '';
              this.isStreaming = false;
              this.isGeneratingSwipe = false;
              this.generatingSwipeIndex = null;
              this.currentSpeaker = null;
              this.nextSpeaker = null;
              this.$nextTick(() => this.scrollToBottom());

              // Auto-save after AI response
              if (this.isGroupChat) {
                await this.saveGroupChat();
              } else {
                await this.saveChat();
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'debug') {
                // Handle debug information from server
                console.log('Received debug info:', parsed.debug);
                this.debugInfo.matchedEntries = parsed.debug.matchedEntriesByLorebook || {};
                console.log('Updated debugInfo.matchedEntries:', this.debugInfo.matchedEntries);
              } else if (parsed.content) {
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
    estimateTokens(text) {
      if (!text) return 0;
      // Rough estimate: ~4 characters per token
      // Strip HTML tags for more accurate count
      const stripped = text.replace(/<[^>]*>/g, '');
      return Math.ceil(stripped.length / 4);
    },
    sanitizeHtml(html, message = null) {
      // Process macros first - use the specific character for group chats
      let charName = this.character?.data?.name || 'Character';
      let charNickname = this.character?.data?.nickname || '';

      // For group chats, use the message's specific character
      if (this.isGroupChat && message?.characterFilename) {
        const char = this.groupChatCharacters.find(c => c.filename === message.characterFilename);
        if (char) {
          charName = char.name;
          charNickname = char.data?.data?.nickname || '';
        }
      }

      const macroContext = {
        charName: charName,
        charNickname: charNickname,
        userName: this.persona?.name || 'User'
      };
      const processed = processMacrosForDisplay(html, macroContext);

      // Render markdown (if markdown renderer is initialized)
      const rendered = this.md ? this.md.render(processed) : processed;

      // Then sanitize
      return DOMPurify.sanitize(rendered, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div', 'span', 'img', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel']
      });
    },
    getCurrentContent(message) {
      if (message.role === 'user') {
        return message.content;
      }
      // Assistant message with swipes
      return message.swipes?.[message.swipeIndex] || message.content || '';
    },
    hasMultipleSwipes(message) {
      return message.swipes && message.swipes.length > 1;
    },
    getCurrentSwipeIndex(message) {
      return message.swipeIndex ?? 0;
    },
    getTotalSwipes(message) {
      return message.swipes?.length || 1;
    },
    canSwipeLeft(message) {
      return (message.swipeIndex ?? 0) > 0;
    },
    canSwipeRight(message) {
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;
      return currentIndex < totalSwipes - 1;
    },
    async swipeLeft(index) {
      const message = this.messages[index];
      if (this.canSwipeLeft(message)) {
        message.swipeIndex--;

        // Update character filename for group chats
        if (this.isGroupChat && message.swipeCharacters) {
          message.characterFilename = message.swipeCharacters[message.swipeIndex];
        }

        if (this.isGroupChat) {
          await this.saveGroupChat();
        } else {
          await this.saveChat();
        }
      }
    },
    async swipeRight(index) {
      const message = this.messages[index];
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;

      if (message.isFirstMessage) {
        // For the first message, cycle back to the beginning
        if (currentIndex < totalSwipes - 1) {
          message.swipeIndex++;
        } else {
          message.swipeIndex = 0; // Cycle back to first greeting
        }

        // Update character filename for group chats
        if (this.isGroupChat && message.swipeCharacters) {
          message.characterFilename = message.swipeCharacters[message.swipeIndex];
        }

        if (this.isGroupChat) {
          await this.saveGroupChat();
        } else {
          await this.saveChat();
        }
      } else {
        // For other messages, normal swipe behavior
        if (currentIndex < totalSwipes - 1) {
          // Navigate to existing swipe
          message.swipeIndex++;

          // Update character filename for group chats
          if (this.isGroupChat && message.swipeCharacters) {
            message.characterFilename = message.swipeCharacters[message.swipeIndex];
          }

          if (this.isGroupChat) {
            await this.saveGroupChat();
          } else {
            await this.saveChat();
          }
        } else if (currentIndex === totalSwipes - 1) {
          // At the last swipe, generate a new one
          await this.generateNewSwipe(index);
        }
      }
    },
    async generateNewSwipe(index) {
      if (this.isStreaming) return;

      // Build context up to (but not including) this message
      const context = this.buildContext(index);

      // Mark that we're generating a swipe and store the index
      this.isGeneratingSwipe = true;
      this.generatingSwipeIndex = index;
      this.isStreaming = true;
      this.streamingContent = '';

      try {
        await this.streamResponse(context);
      } catch (error) {
        console.error('Error generating swipe:', error);
        this.isStreaming = false;
        this.isGeneratingSwipe = false;
        this.generatingSwipeIndex = null;
        this.$root.$notify('Failed to generate swipe', 'error');
      }
    },
    editMessage(index) {
      this.editingMessage = index;
      this.editedContent = this.getCurrentContent(this.messages[index]);
      this.$nextTick(() => {
        const editDiv = this.$refs['editTextarea' + index];
        if (editDiv && editDiv[0]) {
          const el = editDiv[0];
          el.textContent = this.editedContent;
          el.focus();

          // Place cursor at end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    },
    async saveEdit() {
      if (this.editingMessage !== null && this.editedContent.trim()) {
        const message = this.messages[this.editingMessage];
        if (message.role === 'user') {
          message.content = this.editedContent;
        } else {
          // Update current swipe for assistant messages
          message.swipes[message.swipeIndex] = this.editedContent;
        }
        await this.saveChat();
        this.cancelEdit();
      }
    },
    cancelEdit() {
      this.editingMessage = null;
      this.editedContent = '';
    },
    updateEditedContent(event) {
      this.editedContent = event.target.textContent;
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
    showAvatarMenu(event, message, index) {
      const rect = event.target.getBoundingClientRect();
      this.avatarMenu.x = rect.right + 10;
      this.avatarMenu.y = rect.top;
      this.avatarMenu.message = message;
      this.avatarMenu.messageIndex = index;

      if (message.role === 'assistant') {
        this.avatarMenu.characterName = this.getMessageCharacterName(message);
        this.avatarMenu.characterFilename = message.characterFilename || this.characterFilename;
      } else {
        this.avatarMenu.characterName = this.persona.nickname || this.persona.name;
        this.avatarMenu.characterFilename = null;
      }

      this.avatarMenu.show = true;

      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeAvatarMenu, { once: true });
      }, 0);
    },
    closeAvatarMenu() {
      this.avatarMenu.show = false;
    },
    async viewCharacterCard() {
      if (this.avatarMenu.message?.role === 'assistant' && this.avatarMenu.characterFilename) {
        try {
          // Load character data
          const response = await fetch(`/api/characters/${this.avatarMenu.characterFilename}`);
          if (response.ok) {
            this.viewingCharacter = await response.json();
            this.showCharacterCard = true;
          } else {
            this.$root.$notify('Failed to load character card', 'error');
          }
        } catch (error) {
          console.error('Error loading character card:', error);
          this.$root.$notify('Error loading character card', 'error');
        }
      } else if (this.character) {
        // Viewing current character
        this.viewingCharacter = this.character;
        this.showCharacterCard = true;
      }
      this.closeAvatarMenu();
    },
    setNextSpeaker() {
      if (this.isGroupChat && this.avatarMenu.characterFilename) {
        this.nextSpeaker = this.avatarMenu.characterFilename;
        this.$root.$notify(`Next speaker: ${this.avatarMenu.characterName}`, 'success');
      }
      this.closeAvatarMenu();
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
      this.currentPresetName = preset.name;
      this.$root.$notify(`Applied preset: ${preset.name}`, 'success');
    },
    onPersonaSaved(persona) {
      console.log('ChatView: Switching persona to:', persona);
      console.log('ChatView: Persona avatar:', persona.avatar);

      // Force Vue reactivity by creating a completely new object
      this.persona = {
        name: persona.name || 'User',
        nickname: persona.nickname || '',
        avatar: persona.avatar || null,
        description: persona.description || '',
        tagBindings: persona.tagBindings || [],
        characterBindings: persona.characterBindings || []
      };

      console.log('ChatView: Updated this.persona to:', this.persona);

      const displayName = persona.nickname || persona.name;
      this.$root.$notify(`Now using persona: ${displayName}`, 'success');

      // Save to localStorage as default persona
      localStorage.setItem('default-persona', JSON.stringify(persona));

      // Force re-render by triggering a key update
      this.$forceUpdate();
    },
    async newChat() {
      this.messages = [];

      if (this.isGroupChat) {
        // Don't create a new group chat file, just reset messages
        await this.initializeGroupChat();
        // Don't save yet - let it save on first message
        this.groupChatId = null;
      } else {
        this.chatId = null;
        this.initializeChat();
      }

      // Update tab data to reflect new chat state
      this.updateTabData();

      this.$root.$notify('Started new chat', 'info');
    },
    async loadChatHistory() {
      try {
        if (this.isGroupChat) {
          // Load group chat history
          const response = await fetch('/api/group-chats');
          const allGroupChats = await response.json();

          // For now, show all group chats (could filter by same character set later)
          this.chatHistory = allGroupChats
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .map(gc => ({
              ...gc,
              isGroupChat: true
            }));
        } else {
          // Load regular character chat history
          const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
          const response = await fetch('/api/chats');
          const allChats = await response.json();

          // Filter chats for current character and sort by timestamp
          this.chatHistory = allChats
            .filter(c => c.characterFilename === characterFilename)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    },
    async loadChatFromHistory(chat) {
      this.messages = this.normalizeMessages(chat.messages || []);

      if (chat.isGroupChat) {
        this.groupChatId = chat.filename;
        this.groupChatCharacters = chat.characters || [];
        this.groupChatStrategy = chat.strategy || 'join';
        this.groupChatExplicitMode = chat.explicitMode || false;
        this.groupChatName = chat.name || '';
        this.groupChatTags = chat.tags || [];
      } else {
        this.chatId = chat.filename;
      }

      // Update tab data to reflect loaded chat
      this.updateTabData();

      this.showChatHistory = false;
      this.$nextTick(() => this.scrollToBottom());

      // Trigger auto-naming if needed
      await this.autoNameChat(chat.filename, chat);
    },
    async renameChatFromHistory(chat) {
      const newTitle = prompt('Enter new chat title:', chat.title || 'Untitled Chat');
      if (!newTitle || newTitle.trim() === '' || newTitle === chat.title) return;

      try {
        const response = await fetch(`/api/chats/${chat.filename}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() }),
        });

        if (response.ok) {
          const result = await response.json();

          // Update chat history to show the new title
          await this.loadChatHistory();

          // If this is the current chat, update the chatId (filename may have changed)
          if (chat.filename === this.chatId) {
            this.chatId = result.filename;

            // Update tab data to reflect the new filename and title
            if (this.tabData) {
              this.$emit('update-tab', {
                id: this.tabData.id,
                chatId: result.filename,
                title: result.title
              });
            }
          }

          this.$root.$notify('Chat renamed', 'success');
        } else {
          throw new Error('Failed to rename chat');
        }
      } catch (error) {
        console.error('Failed to rename chat:', error);
        this.$root.$notify('Failed to rename chat', 'error');
      }
    },
    async deleteChat(filename) {
      if (!confirm('Delete this chat?')) return;

      try {
        if (this.isGroupChat) {
          await fetch(`/api/group-chats/${filename}`, { method: 'DELETE' });
        } else {
          await fetch(`/api/chats/${filename}`, { method: 'DELETE' });
        }

        await this.loadChatHistory();

        if (filename === this.chatId || filename === this.groupChatId) {
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
      // Priority 1: Show chat title if it exists
      if (chat.title && chat.title.trim()) {
        return chat.title;
      }

      // Priority 2: For group chats, show character names
      if (chat.isGroupChat) {
        const names = chat.characters?.map(c => c.name).join(', ') || 'Group';
        const messageCount = chat.messages?.length || 0;
        return `${names} (${messageCount} messages)`;
      }

      // Priority 3: Show preview of last message
      const lastMessage = chat.messages?.[chat.messages.length - 1];
      if (!lastMessage) return 'Empty chat';

      // Handle both old format (content) and new format (swipes)
      let content = '';
      if (lastMessage.role === 'user') {
        content = lastMessage.content || '';
      } else {
        // Assistant message - get current swipe or fall back to content
        const swipeIndex = lastMessage.swipeIndex ?? 0;
        content = lastMessage.swipes?.[swipeIndex] || lastMessage.content || '';
      }

      // Strip HTML tags for cleaner preview
      const strippedContent = content.replace(/<[^>]*>/g, '').trim();
      const preview = strippedContent.substring(0, 50);
      return preview + (strippedContent.length > 50 ? '...' : '');
    },
    scrollToBottom(force = false) {
      const container = this.$refs.messagesContainer;
      if (!container) return;

      // If user has scrolled up and we're not forcing, don't auto-scroll
      if (this.userHasScrolledUp && !force) {
        return;
      }

      container.scrollTop = container.scrollHeight;
    },
    handleScroll() {
      const container = this.$refs.messagesContainer;
      if (!container) return;

      // Check if user is near the bottom (within 100px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      // Update flag based on scroll position
      this.userHasScrolledUp = !isNearBottom;
    },
    async loadLorebooks() {
      try {
        const response = await fetch('/api/lorebooks');
        this.lorebooks = await response.json();
      } catch (error) {
        console.error('Failed to load lorebooks:', error);
      }
    },
    isAutoSelected(filename) {
      return this.autoSelectedLorebookFilenames.includes(filename);
    },
    getLorebook(filename) {
      return this.lorebooks.find(l => l.filename === filename);
    },
    estimateTokens(text) {
      // Rough estimation: ~4 characters per token
      return Math.ceil(text.length / 4);
    },
    updateBasicDebugInfo(messages) {
      // Count messages by type
      this.debugInfo.messageCount = messages.length;
      this.debugInfo.systemMessageCount = messages.filter(m => m.role === 'system').length;
      this.debugInfo.userMessageCount = messages.filter(m => m.role === 'user').length;
      this.debugInfo.assistantMessageCount = messages.filter(m => m.role === 'assistant').length;

      // Estimate total tokens
      const allText = messages.map(m => m.content).join(' ');
      this.debugInfo.estimatedTokens = this.estimateTokens(allText);

      // matched entries will be populated by the server response
    },
    editLorebook(lorebook) {
      // Deep clone to avoid mutations
      this.editingLorebook = JSON.parse(JSON.stringify(lorebook));

      // Initialize keysInput for display
      if (this.editingLorebook.entries) {
        this.editingLorebook.entries.forEach(entry => {
          if (!entry.keysInput && entry.keys) {
            entry.keysInput = entry.keys.join(', ');
          }
          if (entry.enabled === undefined) {
            entry.enabled = true;
          }
        });
      }

      this.showLorebooks = false;
    },
    closeLorebookEditor() {
      this.editingLorebook = null;
    },
    async saveEditingLorebook() {
      try {
        const response = await fetch('/api/lorebooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.editingLorebook)
        });

        const result = await response.json();

        if (result.success) {
          await this.loadLorebooks();
          this.editingLorebook = null;
          this.$root.$notify('Lorebook saved successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to save lorebook:', error);
        this.$root.$notify('Failed to save lorebook', 'error');
      }
    },
    addEntryToEditing() {
      if (!this.editingLorebook.entries) {
        this.editingLorebook.entries = [];
      }

      this.editingLorebook.entries.push({
        name: 'New Entry',
        enabled: true,
        constant: false,
        keys: [],
        keysInput: '',
        regex: '',
        content: '',
        priority: 0
      });
    },
    removeEntryFromEditing(index) {
      this.editingLorebook.entries.splice(index, 1);
    },
    updateEntryKeys(entry) {
      // Convert comma-separated string to array
      entry.keys = entry.keysInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    },
    async autoSelectLorebook() {
      try {
        const response = await fetch('/api/lorebooks');
        const lorebooks = await response.json();

        if (!lorebooks || lorebooks.length === 0) return;

        const characterTags = this.character?.data?.tags || [];
        this.autoSelectedLorebookFilenames = [];

        // Find all lorebooks with autoSelect enabled and matching tags
        for (const lorebook of lorebooks) {
          if (lorebook.autoSelect && lorebook.matchTags) {
            const lorebookTags = lorebook.matchTags
              .split(',')
              .map(t => t.trim().toLowerCase())
              .filter(t => t.length > 0);

            // Check if any character tag matches lorebook tags
            const hasMatch = characterTags.some(charTag =>
              lorebookTags.includes(charTag.toLowerCase())
            );

            if (hasMatch) {
              this.autoSelectedLorebookFilenames.push(lorebook.filename);
              if (!this.selectedLorebookFilenames.includes(lorebook.filename)) {
                this.selectedLorebookFilenames.push(lorebook.filename);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to auto-select lorebook:', error);
      }
    },

    // ===== Group Chat Methods =====
    async loadAllCharacters() {
      try {
        const response = await fetch('/api/characters');
        const chars = await response.json();
        this.allCharacters = chars;
      } catch (error) {
        console.error('Failed to load all characters:', error);
      }
    },

    async loadGroupChat(groupChatId) {
      try {
        const response = await fetch(`/api/group-chats/${groupChatId}`);
        const groupChat = await response.json();

        this.groupChatCharacters = groupChat.characters || [];
        this.groupChatStrategy = groupChat.strategy || 'join';
        this.groupChatExplicitMode = groupChat.explicitMode || false;
        this.groupChatName = groupChat.name || '';
        this.groupChatTags = groupChat.tags || [];
        this.messages = this.normalizeMessages(groupChat.messages || []);

        // If no messages, initialize with swipeable greetings
        if (this.messages.length === 0) {
          await this.initializeGroupChat();
        }
      } catch (error) {
        console.error('Failed to load group chat:', error);
        // If group chat doesn't exist, initialize new one
        await this.initializeGroupChat();
      }
    },

    async initializeGroupChat() {
      if (this.groupChatCharacters.length === 0) return;

      console.log('Initializing group chat with characters:', this.groupChatCharacters);

      // Create separate messages for each character with their greetings as swipes
      const messages = [];

      for (const char of this.groupChatCharacters) {
        try {
          const response = await fetch(`/api/characters/${char.filename}`);
          const charData = await response.json();

          console.log(`Loaded character data for ${char.filename}:`, charData);

          const firstMessage = charData.data.first_mes || 'Hello!';
          const alternateGreetings = charData.data.alternate_greetings || [];

          // Create all greetings for this character (first message + alternates)
          const characterGreetings = [firstMessage, ...alternateGreetings];

          // Create a message for this character with all their greetings as swipes
          messages.push({
            role: 'assistant',
            swipes: characterGreetings,
            swipeCharacters: new Array(characterGreetings.length).fill(char.filename),
            swipeIndex: 0,
            isFirstMessage: true,
            characterFilename: char.filename
          });

          console.log(`Added message for ${char.name} with ${characterGreetings.length} greetings`);
        } catch (err) {
          console.error(`Failed to load greetings for ${char.filename}:`, err);
        }
      }

      this.messages = messages;
      console.log('Initialized messages:', this.messages);
    },

    async saveGroupChat() {
      try {
        const groupChat = {
          filename: this.groupChatId || `group_chat_${Date.now()}.json`,
          characters: this.groupChatCharacters,
          strategy: this.groupChatStrategy,
          explicitMode: this.groupChatExplicitMode,
          name: this.groupChatName,
          tags: this.groupChatTags,
          messages: this.messages,
          timestamp: Date.now()
        };

        const response = await fetch('/api/group-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupChat)
        });

        const result = await response.json();
        this.groupChatId = result.filename;
      } catch (error) {
        console.error('Failed to save group chat:', error);
      }
    },

    async convertToGroupChat() {
      if (!this.character) return;

      // Convert current character chat to group chat
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      this.isGroupChat = true;
      this.groupChatCharacters = [{
        filename: characterFilename,
        name: this.character.data.name,
        data: this.character.data
      }];
      this.groupChatStrategy = 'join';

      // Mark all existing messages with character
      this.messages.forEach(msg => {
        if (msg.role === 'assistant' && !msg.characterFilename) {
          msg.characterFilename = characterFilename;
        }
      });

      // Save as new group chat
      await this.saveGroupChat();

      // Update URL (only in router mode)
      if (!this.tabData && this.$router) {
        this.$router.replace({
          name: 'chat',
          params: { id: 'new' },
          query: { groupChat: this.groupChatId }
        });
      }

      this.$root.$notify('Converted to group chat', 'success');
    },

    updateGroupStrategy(strategy) {
      this.groupChatStrategy = strategy;
      this.saveGroupChat();
    },

    updateExplicitMode(mode) {
      this.groupChatExplicitMode = mode;
      this.saveGroupChat();
    },

    async triggerCharacterResponse(characterFilename) {
      if (this.isStreaming) return;

      this.nextSpeaker = characterFilename;
      this.currentSpeaker = characterFilename;

      const context = this.buildGroupChatContext();
      this.isStreaming = true;
      this.streamingContent = '';

      try {
        await this.streamResponse(context);
      } catch (error) {
        console.error('Error generating response:', error);
        this.isStreaming = false;
        this.$root.$notify('Failed to generate response', 'error');
      }
    },

    moveCharacterUp(index) {
      if (index > 0) {
        const temp = this.groupChatCharacters[index];
        this.groupChatCharacters[index] = this.groupChatCharacters[index - 1];
        this.groupChatCharacters[index - 1] = temp;
        this.saveGroupChat();
      }
    },

    moveCharacterDown(index) {
      if (index < this.groupChatCharacters.length - 1) {
        const temp = this.groupChatCharacters[index];
        this.groupChatCharacters[index] = this.groupChatCharacters[index + 1];
        this.groupChatCharacters[index + 1] = temp;
        this.saveGroupChat();
      }
    },

    async removeCharacterFromGroup(index) {
      if (confirm('Remove this character from the group chat?')) {
        this.groupChatCharacters.splice(index, 1);
        if (this.groupChatCharacters.length === 0) {
          this.$root.$notify('Cannot have empty group chat', 'error');
          return;
        }
        await this.saveGroupChat();
      }
    },

    async addCharacterToGroup(characterFilename) {
      const char = this.allCharacters.find(c => c.filename === characterFilename);
      if (!char) return;

      this.groupChatCharacters.push({
        filename: char.filename,
        name: char.name,
        data: char.data
      });

      await this.saveGroupChat();
      this.$root.$notify(`Added ${char.name} to group`, 'success');
    },

    buildGroupChatContext(upToMessageIndex = null) {
      const context = [];

      // Add system prompts from preset
      if (this.settings.systemPrompts && this.settings.systemPrompts.length > 0) {
        const sortedPrompts = [...this.settings.systemPrompts]
          .filter(p => p.enabled)
          .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

        for (const prompt of sortedPrompts) {
          let content = prompt.content || '';

          // For group chats, we'll handle character info differently based on strategy
          if (this.groupChatStrategy === 'join') {
            // Replace with combined character info
            const allDescriptions = this.groupChatCharacters.map(c =>
              `${c.name}: ${c.data?.data?.description || ''}`
            ).join('\n\n');

            content = content.replace(/\{\{description\}\}/g, allDescriptions);
            content = content.replace(/\{\{personality\}\}/g,
              this.groupChatCharacters.map(c =>
                `${c.name}: ${c.data?.data?.personality || ''}`
              ).join('\n\n')
            );
            content = content.replace(/\{\{scenario\}\}/g,
              this.groupChatCharacters.map(c => c.data?.data?.scenario || '').join('\n\n')
            );
          }

          if (content.trim()) {
            context.push({
              role: prompt.role || 'system',
              content: content.trim()
            });
          }
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
      const messagesToInclude = upToMessageIndex !== null
        ? this.messages.slice(0, upToMessageIndex)
        : this.messages;

      for (const msg of messagesToInclude) {
        if (msg.role === 'user') {
          context.push({
            role: 'user',
            content: msg.content
          });
        } else {
          // For assistant messages in group chat
          context.push({
            role: 'assistant',
            content: msg.swipes?.[msg.swipeIndex] || msg.content || ''
          });
        }
      }

      return context;
    },

    getMessageAvatar(message) {
      if (this.isGroupChat && message.characterFilename) {
        return `/api/characters/${message.characterFilename}/image`;
      }
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      return `/api/characters/${characterFilename}/image`;
    },

    getMessageCharacterName(message) {
      if (this.isGroupChat && message.characterFilename) {
        const char = this.groupChatCharacters.find(c => c.filename === message.characterFilename);
        return char?.name || 'Unknown';
      }
      return this.characterName;
    },

    getStreamingAvatar() {
      if (this.isGroupChat && this.currentSpeaker) {
        return `/api/characters/${this.currentSpeaker}/image`;
      }
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      return `/api/characters/${characterFilename}/image`;
    },

    getStreamingCharacterName() {
      if (this.isGroupChat && this.currentSpeaker) {
        const char = this.groupChatCharacters.find(c => c.filename === this.currentSpeaker);
        return char?.name || 'Unknown';
      }
      return this.characterName;
    }
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  color: var(--text-primary);
}

button.active {
  background-color: var(--accent-color);
  color: white;
  box-shadow: var(--shadow-sm);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 100;
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

/* Chat Sidebar */
.chat-sidebar {
  position: fixed;
  left: 0;
  top: 73px;
  bottom: 0;
  width: 280px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  z-index: 50;
  transition: width 0.3s ease, background 0.3s ease;
}

.chat-sidebar.collapsed {
  width: 40px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-right: none;
  box-shadow: none;
}

.sidebar-toggle {
  position: absolute;
  right: -28px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
}

.collapsed .sidebar-toggle {
  right: 8px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
}

.sidebar-toggle:hover {
  background: var(--hover-color);
  transform: translateY(-50%) scale(1.1);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 16px 16px 16px;
  padding-right: 40px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.sidebar-info {
  padding: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-window {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.context-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.context-stats {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.context-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.context-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color) 0%, #22c55e 50%, #eab308 75%, #ef4444 100%);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.context-percentage {
  text-align: right;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
}

.sidebar-actions {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.sidebar-btn {
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  border-radius: 8px;
  transition: all 0.2s;
}

.sidebar-btn:hover {
  background: var(--hover-color);
}

.sidebar-btn.active {
  background-color: var(--accent-color);
  color: white;
}

/* Avatar Menu */
.avatar-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 1000;
  min-width: 200px;
}

.avatar-menu-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.avatar-menu-btn {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.avatar-menu-btn:hover {
  background: var(--hover-color);
}

.avatar-menu-btn.cancel {
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
  padding-top: 10px;
}

.chat-container {
  margin-left: 280px;
  transition: margin-left 0.3s ease;
}

.chat-view:has(.chat-sidebar.collapsed) .chat-container {
  margin-left: 40px;
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
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  transition: all 0.2s;
}

.message-avatar.clickable {
  cursor: pointer;
}

.message-avatar.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px var(--accent-color);
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
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
}

.message.user .message-content {
  background: var(--user-bubble, var(--accent-color));
  color: white;
  border-radius: 18px 6px 18px 18px;
}

.message.assistant .message-content {
  background: var(--assistant-bubble, var(--bg-secondary));
  border: 1px solid var(--border-color);
  border-radius: 6px 18px 18px 18px;
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
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.input-area textarea {
  flex: 1;
  height: 60px;
  min-height: 60px;
  max-height: 200px;
  resize: none !important;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  line-height: 1.5;
}

/* Force hide resize handle on all browsers */
.input-area textarea::-webkit-resizer {
  display: none;
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
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
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
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
  z-index: 999;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
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

.history-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.history-rename,
.history-delete {
  padding: 4px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  font-size: 14px;
  transition: all 0.2s;
}

.history-rename:hover,
.history-delete:hover {
  opacity: 1;
  transform: scale(1.1);
}

.close-history {
  width: 100%;
}

.message-edit-container {
  position: relative;
  border-radius: 18px;
  background: var(--bg-secondary);
  border: 2px solid var(--accent-color);
  line-height: 1.5;
  word-wrap: break-word;
}

.message.user .message-edit-container {
  background: var(--accent-color);
  border-radius: 18px 4px 18px 18px;
}

.message.assistant .message-edit-container {
  background: var(--bg-secondary);
  border-radius: 4px 18px 18px 18px;
}

.message-edit-textarea {
  min-height: 40px;
  padding: 12px 16px;
  padding-right: 88px;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.user .message-edit-textarea {
  color: white;
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

.swipe-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
}

.swipe-button {
  padding: 4px 12px;
  font-size: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 32px;
}

.swipe-button:hover:not(:disabled) {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.swipe-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.swipe-counter {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}

.lorebook-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
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
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-button:hover {
  background-color: var(--hover-color);
}

.lorebook-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lorebook-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  transition: all 0.2s;
}

.lorebook-option:hover {
  background-color: var(--hover-color);
}

.lorebook-option.auto-selected {
  background-color: rgba(90, 159, 212, 0.15);
  border-color: var(--accent-color);
}

.lorebook-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  flex: 1;
  margin: 0;
}

.lorebook-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.lorebook-info-wrapper {
  flex: 1;
}

.lorebook-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-tag {
  background-color: var(--accent-color);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
}

.lorebook-meta {
  font-size: 0.875rem;
  opacity: 0.7;
}

.edit-button {
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.edit-button:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.lorebook-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.modal-content.large {
  max-width: 800px;
  width: 95%;
  max-height: 90vh;
}

.lorebook-editor-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}

.editor-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.lorebook-name-input {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
}

.lorebook-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
}

.lorebook-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tag-input,
.scan-depth-input {
  flex: 1;
  padding: 0.375rem;
}

.entries-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entries-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.entries-header h4 {
  margin: 0;
}

.entry-item {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  background-color: var(--bg-tertiary);
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.entry-name-input {
  flex: 1;
  font-weight: 600;
  padding: 0.375rem;
}

.entry-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  margin: 0;
  cursor: pointer;
}

.entry-matching {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.match-section label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.keys-input,
.regex-input {
  width: 100%;
  padding: 0.375rem;
}

.entry-content label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.content-textarea {
  width: 100%;
  padding: 0.5rem;
  font-family: inherit;
  resize: vertical;
}

.entry-settings {
  margin-top: 0.75rem;
}

.priority-input {
  width: 80px;
  padding: 0.375rem;
}

.no-entries {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn-primary {
  padding: 0.5rem 1rem;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: var(--hover-color);
}

.btn-delete {
  padding: 0.25rem 0.5rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-delete:hover {
  background-color: #b91c1c;
}

/* Debug Panel */
.debug-panel {
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 400px;
  background-color: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.debug-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.close-debug {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-debug:hover {
  background-color: var(--hover-color);
}

.debug-content {
  padding: 1rem;
  flex: 1;
}

.debug-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
}

.debug-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: var(--accent-color);
}

.debug-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.debug-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border-color);
}

.debug-row:last-child {
  border-bottom: none;
}

.debug-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.debug-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: monospace;
}

.debug-lorebook-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.debug-lorebook-item {
  padding: 0.75rem;
  background-color: var(--bg-primary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.debug-lorebook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.debug-lorebook-name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.matched-entries {
  margin-top: 0.75rem;
}

.matched-entries-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.matched-entry {
  padding: 0.625rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border-left: 3px solid var(--accent-color);
}

.matched-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.entry-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.entry-priority {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.matched-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.keywords-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.matched-keyword {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background-color: var(--accent-color);
  color: white;
  border-radius: 12px;
  font-family: monospace;
}

.entry-content-preview {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.4;
}

.debug-code {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  max-height: 400px;
  overflow: auto;
}

.debug-code pre {
  margin: 0;
  font-size: 0.75rem;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.chat-container.with-debug {
  margin-right: 400px;
}

/* Typing indicator animation */
.typing-indicator {
  padding: 12px 16px;
  font-size: 24px;
}

.typing-dots {
  display: inline-block;
}

.typing-dots span {
  animation: typing-dot 1.4s infinite;
  opacity: 0;
}

.typing-dots span:nth-child(1) {
  animation-delay: 0s;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-dot {
  0%, 60%, 100% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
}

/* Character Card Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.character-card-modal {
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
}

.character-card-content {
  padding: 20px;
}

.card-avatar {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
  margin: 0 auto 20px;
  display: block;
}

.card-field {
  margin-bottom: 20px;
}

.card-field strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.card-field p {
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .debug-panel {
    width: 100%;
    max-width: 100%;
  }

  .chat-container.with-debug {
    margin-right: 0;
    display: none;
  }

  /* Make sidebar overlay instead of pushing content */
  .chat-sidebar {
    z-index: 100;
    box-shadow: var(--shadow-lg);
  }

  .chat-sidebar.collapsed {
    transform: translateX(-100%);
    width: 0;
  }

  .chat-container {
    margin-left: 0 !important;
  }

  .chat-view:has(.chat-sidebar.collapsed) .chat-container {
    margin-left: 0 !important;
  }

  /* Make sidebar toggle more accessible on mobile */
  .sidebar-toggle {
    right: -32px;
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .collapsed .sidebar-toggle {
    right: auto;
    left: 16px;
    top: 16px;
    transform: none;
    position: fixed;
  }

  /* Increase message width on mobile */
  .message {
    max-width: 95%;
  }
}
</style>
