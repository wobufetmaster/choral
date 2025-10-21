<template>
  <div class="chat-view">
    <div class="chat-header">
      <button v-if="!tabData" @click="$router.push('/')" class="back-button">← Back</button>
      <h2>{{ chatTitle }}</h2>
    </div>

    <!-- Chat Sidebar -->
    <ChatSidebar
      v-model:sidebarOpen="sidebarOpen"
      :settings="settings"
      :current-preset-name="currentPresetName"
      :current-preset-filename="currentPresetFilename"
      :estimated-tokens="debugInfo.estimatedTokens"
      :has-messages="messages.length > 0"
      :show-convert-to-group="!isGroupChat && !!character"
      :show-history="showChatHistory"
      :show-debug="showDebug"
      :is-group-chat="isGroupChat"
      :show-group-manager="showGroupManager"
      :persona-name="persona._filename"
      :available-personas="availablePersonas"
      :available-presets="availablePresets"
      @new-chat="newChat"
      @new-chat-from-summary="startNewChatFromSummary"
      @convert-to-group="convertToGroupChat"
      @toggle-history="showChatHistory = !showChatHistory"
      @persona-change="handlePersonaChange"
      @preset-change="handlePresetChange"
      @show-lorebooks="showLorebooks = true"
      @toggle-debug="showDebug = !showDebug"
      @toggle-group-manager="showGroupManager = !showGroupManager"
      @open-tab="(...args) => $emit('open-tab', ...args)"
    />

    <!-- Avatar Menu -->
    <div v-if="avatarMenu.show" class="avatar-menu" :style="{ top: avatarMenu.y + 'px', left: avatarMenu.x + 'px' }" @click.stop>
      <div class="avatar-menu-header">
        <strong>{{ avatarMenu.characterName }}</strong>
      </div>
      <button @click="viewCharacterCard" class="avatar-menu-btn">📄 View Card</button>
      <button v-if="avatarMenu.message?.role === 'assistant' && avatarMenu.characterFilename" @click="editCharacter" class="avatar-menu-btn">✏️ Edit Character</button>
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
          <img v-if="viewingCharacter.avatar" :src="viewingCharacter.avatar" :alt="viewingCharacter.data.name" class="card-avatar" @error="setFallbackAvatar($event)" />
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
        <template v-for="item in chatHistory" :key="item.filename || item.conversationGroup">
          <!-- Group Header (for multiple related chats) -->
          <div v-if="item.isGroupHeader" class="history-group">
            <div class="history-group-header" @click="item.expanded = !item.expanded">
              <span class="expand-icon">{{ item.expanded ? '▼' : '▶' }}</span>
              <div class="history-info">
                <span class="history-date">{{ formatDate(item.latestTimestamp) }}</span>
                <span class="history-preview">{{ item.chatCount }} conversations</span>
              </div>
            </div>
            <!-- Expanded chat list -->
            <div v-if="item.expanded" class="history-group-items">
              <div
                v-for="chat in item.chats"
                :key="chat.filename"
                :class="['history-item', 'grouped', { active: chat.filename === groupChatId }]"
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
          </div>

          <!-- Single Chat (ungrouped) -->
          <div
            v-else
            :class="['history-item', { active: item.filename === chatId || item.filename === groupChatId }]"
            @click="loadChatFromHistory(item)"
          >
            <div class="history-info">
              <span class="history-date">{{ formatDate(item.timestamp) }}</span>
              <span class="history-preview">{{ getPreview(item) }}</span>
            </div>
            <div class="history-actions">
              <button @click.stop="renameChatFromHistory(item)" class="history-rename" title="Rename chat">✏️</button>
              <button @click.stop="deleteChat(item.filename)" class="history-delete" title="Delete chat">🗑️</button>
            </div>
          </div>
        </template>
      </div>
      <button @click="showChatHistory = false" class="close-history">Close</button>
    </div>

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
          <!-- Active Lorebooks Section -->
          <div v-if="activeLorebooksForDisplay.length > 0" class="lorebook-section">
            <div class="lorebook-section-header">
              <h4>Active ({{ activeLorebooksForDisplay.length }})</h4>
            </div>
            <div
              v-for="lorebook in activeLorebooksForDisplay"
              :key="lorebook.filename"
              class="lorebook-option active"
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

          <!-- Inactive Lorebooks Section -->
          <div v-if="inactiveLorebooksForDisplay.length > 0" class="lorebook-section">
            <div class="lorebook-section-header">
              <h4>Available ({{ inactiveLorebooksForDisplay.length }})</h4>
            </div>
            <div
              v-for="lorebook in inactiveLorebooksForDisplay"
              :key="lorebook.filename"
              class="lorebook-option"
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
                  </div>
                  <div class="lorebook-meta">{{ lorebook.entries?.length || 0 }} entries</div>
                </div>
              </label>
              <button @click="editLorebook(lorebook)" class="edit-button" title="Edit">✏️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lorebook Editor -->
    <LorebookEditor
      v-if="editingLorebook"
      :lorebook="editingLorebook"
      @close="closeLorebookEditor"
      @save="saveEditingLorebook"
    />

    <!-- Debug Modal -->
    <DebugModal
      :show="showDebug"
      :debugData="persistedDebugData"
      @close="showDebug = false"
    />

    <div class="chat-container">
      <div class="messages" ref="messagesContainer" @scroll="handleScroll">
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
            @click="showAvatarMenu($event, message, index)"
            @error="setFallbackAvatar($event)"
            :title="'Click for options'"
          />
          <img
            v-else-if="persona.avatar"
            :src="persona.avatar"
            :alt="persona.name"
            class="message-avatar clickable"
            @click="showAvatarMenu($event, message, index)"
            @error="setFallbackAvatar($event)"
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
              <button
                v-if="index < messages.length - 1"
                @click="deleteMessagesBelow(index)"
                title="Delete all messages below this one"
                class="delete-below-button"
              >🗑️↓</button>
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
              <button @click="swipeLeft(index)" :disabled="!canSwipeLeft(message) || isStreaming" class="swipe-button">←</button>
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

      <div class="input-area">
        <textarea
          ref="messageInput"
          v-model="userInput"
          @input="autoResizeTextarea"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          :disabled="isStreaming"
        ></textarea>
        <button v-if="isStreaming" @click="stopStreaming" class="stop-btn">
          Stop
        </button>
        <button v-else @click="sendMessage" :disabled="!userInput.trim()">
          Send
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
import GroupChatManager from './GroupChatManager.vue';
import LorebookEditor from './LorebookEditor.vue';
import ChatSidebar from './ChatSidebar.vue';
import DebugModal from './DebugModal.vue';

// Non-reactive debug data cache (outside Vue's reactivity system)
const debugDataCache = new Map();

export default {
  name: 'ChatView',
  components: {
    GroupChatManager,
    LorebookEditor,
    ChatSidebar,
    DebugModal
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
      abortController: null,
      isGeneratingSwipe: false,
      generatingSwipeIndex: null,
      currentToolCall: null,
      toolCallStartTime: null,
      toolCallElapsedTime: 0,
      toolCallTimerInterval: null,
      sidebarOpen: true,
      showSettings: false,
      showChatHistory: false,
      showLorebooks: false,
      showDebug: false,
      showGroupManager: false,
      currentPresetName: null,
      currentPresetFilename: null,
      availablePresets: [],
      availablePersonas: [],
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
      saveDebugDataThrottle: null, // Throttle saves to prevent loops
      handleScrollThrottle: null, // Throttle scroll handler
      scrollToBottomPending: false, // Flag to batch scroll calls
      currentDebugData: null, // Current debug data for this chat session
      settings: {
        model: 'anthropic/claude-opus-4',
        temperature: 1.0,
        max_tokens: 4096,
        top_p: 0.92,
        top_k: 0,
        systemPrompts: []
      },
      chatId: null,
      chatDisplayTitle: null, // Custom title for the chat (from title field in file)
      editingMessage: null,
      editedContent: '',
      // Group chat specific
      isGroupChat: false,
      groupChatId: null,
      conversationGroup: null, // UUID shared across related chats (e.g., chat + continuations)
      groupChatCharacters: [],
      groupChatStrategy: 'join',
      groupChatExplicitMode: false,
      groupChatName: '',
      groupChatTags: [],
      allCharacters: [],
      currentSpeaker: null, // Track who's currently generating
      nextSpeaker: null, // Track who should speak next
      narratorInfo: null // Store narrator character info for avatar display
    }
  },
  computed: {
    characterFilename() {
      return this.tabData?.characterId || this.$route?.query?.character;
    },
    chatTitle() {
      // Priority 1: Use custom display title if set
      if (this.chatDisplayTitle) {
        return this.chatDisplayTitle;
      }

      // Priority 2: Group chat name
      if (this.isGroupChat) {
        if (this.groupChatName) {
          return this.groupChatName;
        }
        const names = this.groupChatCharacters.map(c => c.name).join(', ');
        return `Group: ${names}`;
      }

      // Priority 3: Character name
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
    },
    validSelectedLorebookFilenames() {
      // Filter out lorebooks that don't exist (e.g., deleted files still in localStorage)
      return this.selectedLorebookFilenames.filter(filename =>
        this.lorebooks.some(l => l.filename === filename)
      );
    },
    activeLorebooksForDisplay() {
      // Lorebooks that are currently selected/active
      return this.lorebooks.filter(lorebook =>
        this.selectedLorebookFilenames.includes(lorebook.filename)
      );
    },
    inactiveLorebooksForDisplay() {
      // Lorebooks that are not currently selected
      return this.lorebooks.filter(lorebook =>
        !this.selectedLorebookFilenames.includes(lorebook.filename)
      );
    },
    persistedDebugData() {
      // Return current debug data for this session
      return this.currentDebugData;
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
  beforeUnmount() {
    // Clean up timer when component is destroyed
    this.stopToolCallTimer();
  },
  async mounted() {
    // Initialize markdown renderer
    this.md = new MarkdownIt({
      html: true, // Allow HTML (DOMPurify sanitizes it afterward)
      linkify: true, // Auto-convert URLs to links
      breaks: true, // Convert line breaks to <br>
      typographer: true, // Enable smart quotes and other typography
    });

    // Custom renderer for code blocks to add language classes
    const defaultRender = this.md.renderer.rules.fence || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

    this.md.renderer.rules.fence = function(tokens, idx, options, env, self) {
      const token = tokens[idx];
      const info = token.info ? token.info.trim() : '';
      const langName = info ? info.split(/\s+/g)[0] : '';

      if (langName) {
        token.attrSet('class', `language-${langName}`);
      }

      return defaultRender(tokens, idx, options, env, self);
    };

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

    // Load available presets and personas for selectors
    await this.loadAvailablePresets();
    await this.loadAvailablePersonas();

    // Load existing chat if ID provided
    // Check both chatId and chatFilename (TabManager stores as chatFilename)
    const chatId = this.tabData?.chatId || this.tabData?.chatFilename || this.$route?.params?.id;
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
    await this.autoSelectLorebook();

    // Scroll to bottom when tab is opened/reopened
    // Use double nextTick to ensure all messages have fully rendered
    this.$nextTick(() => {
      this.$nextTick(() => {
        // Add a small delay to ensure DOM is fully rendered
        setTimeout(() => this.scrollToBottom(true), 100);
      });
    });
  },
  methods: {
    formatElapsedTime(ms) {
      if (!ms || ms < 0) return '0.0s';
      const seconds = Math.floor(ms / 1000);
      const tenths = Math.floor((ms % 1000) / 100);
      return `${seconds}.${tenths}s`;
    },
    startToolCallTimer() {
      // Clear any existing timer
      if (this.toolCallTimerInterval) {
        clearInterval(this.toolCallTimerInterval);
      }

      // Update elapsed time every 100ms
      this.toolCallTimerInterval = setInterval(() => {
        if (this.toolCallStartTime) {
          this.toolCallElapsedTime = Date.now() - this.toolCallStartTime;
        }
      }, 100);
    },
    stopToolCallTimer() {
      if (this.toolCallTimerInterval) {
        clearInterval(this.toolCallTimerInterval);
        this.toolCallTimerInterval = null;
      }
      this.toolCallElapsedTime = 0;
    },
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

        // Handle both V3 format (with data) and direct format
        if (this.character.data) {
          this.characterName = this.character.data.name;
        } else {
          // Fallback for non-V3 format
          this.characterName = this.character.name || 'Character';
        }
      } catch (error) {
        console.error('Failed to load character:', error);
        this.$root.$notify('Failed to load character', 'error');
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
                  p._filename === config.defaultPersona
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
        this.currentPresetFilename = activePresetFilename;
      } catch (error) {
        console.error('Failed to load active preset:', error);
        // Continue with default settings if preset fails to load
      }
    },
    initializeChat() {
      if (!this.character) return;

      // Handle both V3 format (with data) and direct format
      const characterData = this.character.data || this.character;
      const firstMessage = characterData.first_mes || 'Hello!';
      const alternateGreetings = characterData.alternate_greetings || [];

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

        // Capture the custom title if it exists
        this.chatDisplayTitle = chat.title || null;

        // Trigger auto-naming if chat has messages and hasn't been named yet
        await this.autoNameChat(chatId, chat);

        // Load debug data for this chat
        this.loadDebugDataFromStorage();
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
            // Update display title
            this.chatDisplayTitle = result.title;
            // Don't update tab title - keep it constant
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
            const normalized = {
              ...msg,
              swipeIndex: msg.swipeIndex ?? 0
            };

            // For group chat messages, ensure swipeCharacters array exists and matches swipes length
            if (this.isGroupChat && !normalized.swipeCharacters && normalized.characterFilename) {
              normalized.swipeCharacters = new Array(normalized.swipes.length).fill(normalized.characterFilename);
            }

            return normalized;
          }
          // Convert old format
          const normalized = {
            role: 'assistant',
            swipes: [msg.content],
            swipeIndex: 0
          };

          // For group chat messages, initialize swipeCharacters
          if (this.isGroupChat && msg.characterFilename) {
            normalized.characterFilename = msg.characterFilename;
            normalized.swipeCharacters = [msg.characterFilename];
          }

          return normalized;
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
          // Ignore AbortError - user cancelled the request
          if (error.name === 'AbortError') {
            return;
          }
          console.error('Error streaming response:', error);
          this.isStreaming = false;
          this.$root.$notify('Failed to get response', 'error');
        }
        return;
      }

      // Normal flow: add user message first
      const userMessage = {
        role: 'user',
        content: this.userInput.trim(),
        _id: Date.now() + Math.random() // Unique ID for Vue key
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
        // Ignore AbortError - user cancelled the request
        if (error.name === 'AbortError') {
          return;
        }
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
      // Create AbortController for this request
      this.abortController = new AbortController();

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
        debug: true // Always collect debug data for persistence
      };

      // Check if characters have tools enabled
      if (this.isGroupChat) {
        // For group chats, collect tools from all characters
        try {
          const allTools = [];
          for (const char of this.groupChatCharacters) {
            const toolsResponse = await fetch(`/api/tools/schemas/${encodeURIComponent(char.filename)}`);
            const toolsData = await toolsResponse.json();
            if (toolsData.tools && toolsData.tools.length > 0) {
              allTools.push(...toolsData.tools);
              console.log(`Tool calling enabled for ${char.name}:`, toolsData.tools.map(t => t.function.name));
            }
          }

          // Remove duplicate tools (same function name)
          const uniqueTools = [];
          const seenNames = new Set();
          for (const tool of allTools) {
            if (!seenNames.has(tool.function.name)) {
              uniqueTools.push(tool);
              seenNames.add(tool.function.name);
            }
          }

          if (uniqueTools.length > 0) {
            requestBody.tools = uniqueTools;
            console.log('Group chat tools enabled:', uniqueTools.map(t => t.function.name));
          }
        } catch (error) {
          console.error('Failed to fetch tool schemas for group chat:', error);
        }
      } else if (this.characterFilename) {
        // For 1-on-1 chats, check single character
        try {
          const toolsResponse = await fetch(`/api/tools/schemas/${encodeURIComponent(this.characterFilename)}`);
          const toolsData = await toolsResponse.json();
          if (toolsData.tools && toolsData.tools.length > 0) {
            requestBody.tools = toolsData.tools;
            console.log(`Tool calling enabled for ${this.characterFilename}:`, toolsData.tools.map(t => t.function.name));
          }
        } catch (error) {
          console.error('Failed to fetch tool schemas:', error);
        }
      }

      // Update basic debug info before sending
      this.updateBasicDebugInfo(messages);

      // Store last request for debugging
      this.debugInfo.lastRequest = requestBody;

      // Save debug data immediately (before streaming) so it's available right away
      // The lorebook matches will be updated when we receive the debug response from server
      this.saveDebugData(requestBody, {});

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
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
                    // Initialize array with the original character for all existing swipes
                    const originalCharacter = message.characterFilename || this.currentSpeaker;
                    message.swipeCharacters = new Array(message.swipes.length - 1).fill(originalCharacter);
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
              this.currentToolCall = null;
              this.toolCallStartTime = null;
              this.stopToolCallTimer();
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

                // Save complete debug data to localStorage
                this.saveDebugData(requestBody, parsed.debug);
              } else if (parsed.type === 'tool_call_start') {
                // Handle early tool call notification (as soon as streaming detects it)
                console.log('Tool call starting:', parsed.toolName);
                console.log('Setting currentToolCall to:', parsed.toolName);
                this.currentToolCall = parsed.toolName;
                this.toolCallStartTime = Date.now();
                this.startToolCallTimer();
                console.log('currentToolCall is now:', this.currentToolCall);
                console.log('isStreaming:', this.isStreaming);
                this.$nextTick(() => {
                  console.log('After nextTick, currentToolCall:', this.currentToolCall);
                  this.scrollToBottom();
                });
              } else if (parsed.type === 'tool_call') {
                // Handle full tool call notification (complete with arguments)
                console.log('Tool called:', parsed.toolCall);
                // currentToolCall should already be set from tool_call_start
                // Don't add to streamingContent yet - let the indicator show
                // The tool result will add the execution message
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'tool_result') {
                // Handle tool execution result
                console.log('Tool result:', parsed.result);

                // Ensure indicator is visible for at least 500ms
                const elapsedTime = Date.now() - (this.toolCallStartTime || 0);
                const minDisplayTime = 500; // milliseconds
                const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

                setTimeout(() => {
                  this.currentToolCall = null; // Clear tool call indicator
                  this.stopToolCallTimer(); // Stop the timer
                }, remainingTime);

                if (parsed.result.success) {
                  // Format success message based on which tool was called
                  let successMessage = '';

                  if (parsed.result.name && parsed.result.filename && parsed.result.details) {
                    // create_character_card response
                    successMessage = `\n\n✓ **create_character_card succeeded!**\n\n`;
                    successMessage += `**Character Name:** ${parsed.result.name}\n`;
                    successMessage += `**Filename:** \`${parsed.result.filename}\`\n\n`;
                    successMessage += `*${parsed.result.details}*\n\n`;
                    this.$root.$notify(`Character created: ${parsed.result.name}`, 'success');
                  } else if (parsed.result.addedGreetings && parsed.result.characterName) {
                    // add_greetings response
                    successMessage = `\n\n✓ **add_greetings succeeded!**\n\n`;
                    successMessage += `**Character:** ${parsed.result.characterName}\n`;
                    successMessage += `**Added ${parsed.result.addedCount} greeting(s)** (Total: ${parsed.result.totalGreetings})\n\n`;

                    // Show the full greeting text(s) formatted like regular messages
                    parsed.result.addedGreetings.forEach((greeting, idx) => {
                      if (parsed.result.addedCount > 1) {
                        successMessage += `**Greeting ${idx + 1}:**\n\n`;
                      }
                      successMessage += greeting + '\n\n';
                    });

                    this.$root.$notify(`Added ${parsed.result.addedCount} greeting(s)`, 'success');
                  } else if (parsed.result.updatedFields && parsed.result.characterName) {
                    // update_character_card response
                    successMessage = `\n\n✓ **update_character_card succeeded!**\n\n`;
                    successMessage += `**Character:** ${parsed.result.characterName}\n`;
                    successMessage += `**Updated Fields:** ${parsed.result.updatedFields.join(', ')}\n\n`;
                    this.$root.$notify(`Updated ${parsed.result.characterName}`, 'success');
                  } else {
                    // Generic success message
                    successMessage = `\n\n✓ **Tool succeeded!**\n\n${parsed.result.message || 'Operation completed successfully'}\n\n`;
                    this.$root.$notify('Tool executed successfully', 'success');
                  }

                  this.streamingContent += successMessage;
                } else {
                  this.streamingContent += `\n\n✗ **Tool failed:** ${parsed.result.error}\n\n`;
                  this.$root.$notify('Tool execution failed', 'error');
                }
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'tool_error') {
                // Handle tool execution error
                console.error('Tool error:', parsed.error);
                this.streamingContent += `\n\n✗ Error executing tool: ${parsed.error}\n\n`;
                this.$root.$notify('Tool execution failed', 'error');
                this.$nextTick(() => this.scrollToBottom());
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
    stopStreaming() {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      // Save partial response if any content was generated
      if (this.streamingContent) {
        if (this.isGeneratingSwipe && this.generatingSwipeIndex !== null) {
          // Add partial swipe
          const message = this.messages[this.generatingSwipeIndex];
          message.swipes.push(this.streamingContent);
          message.swipeIndex = message.swipes.length - 1;

          // Track character for group chat swipes
          if (this.isGroupChat && this.currentSpeaker) {
            if (!message.swipeCharacters) {
              // Initialize array with the original character for all existing swipes
              const originalCharacter = message.characterFilename || this.currentSpeaker;
              message.swipeCharacters = new Array(message.swipes.length - 1).fill(originalCharacter);
            }
            message.swipeCharacters.push(this.currentSpeaker);
          }
        } else {
          // Create new message with partial content
          const newMessage = {
            role: 'assistant',
            swipes: [this.streamingContent],
            swipeIndex: 0,
            _id: Date.now() + Math.random() // Unique ID for Vue key
          };

          // Track character for group chats
          if (this.isGroupChat && this.currentSpeaker) {
            newMessage.characterFilename = this.currentSpeaker;
            newMessage.swipeCharacters = [this.currentSpeaker];
          }

          this.messages.push(newMessage);
        }
      }

      // Clean up state
      this.streamingContent = '';
      this.isStreaming = false;
      this.isGeneratingSwipe = false;
      this.generatingSwipeIndex = null;
      this.currentSpeaker = null;
      this.currentToolCall = null;
      this.toolCallStartTime = null;
      this.stopToolCallTimer();
      this.nextSpeaker = null;

      // Save chat
      this.$nextTick(async () => {
        if (this.isGroupChat) {
          await this.saveGroupChat();
        } else {
          await this.saveChat();
        }
      });

      this.$root.$notify('Response cancelled', 'info');
    },
    estimateTokens(text) {
      if (!text) return 0;
      // Rough estimate: ~4 characters per token
      // Strip HTML tags for more accurate count
      const stripped = text.replace(/<[^>]*>/g, '');
      return Math.ceil(stripped.length / 4);
    },
    applyTextStyling(text) {
      // Apply special styling for quoted text and asterisk text
      // Protect HTML tags and their attributes first to avoid breaking URLs and attributes

      // Temporarily store HTML tags to protect them
      const htmlTagPattern = /<[^>]+>/g;
      const protectedTags = [];
      let protectedText = text.replace(htmlTagPattern, (match) => {
        protectedTags.push(match);
        return `__HTML_TAG_${protectedTags.length - 1}__`;
      });

      // Style text in double quotes as dialogue (now safe from HTML attributes)
      protectedText = protectedText.replace(/"([^"]+)"/g, '<span class="dialogue">"$1"</span>');

      // Style text in asterisks as action/narration (avoid markdown bold **)
      // Only match single asterisks, not double
      protectedText = protectedText.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<span class="action">*$1*</span>');

      // Restore HTML tags
      protectedText = protectedText.replace(/__HTML_TAG_(\d+)__/g, (match, index) => {
        return protectedTags[parseInt(index)];
      });

      return protectedText;
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

      // Apply text styling (quotes and asterisks) before markdown
      const styled = this.applyTextStyling(processed);

      // Render markdown (if markdown renderer is initialized)
      const rendered = this.md ? this.md.render(styled) : styled;

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
      // For first messages (greetings), always allow swiping left to loop
      if (message.isFirstMessage) {
        return true;
      }
      return (message.swipeIndex ?? 0) > 0;
    },
    canSwipeRight(message) {
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;
      return currentIndex < totalSwipes - 1;
    },
    async swipeLeft(index) {
      const message = this.messages[index];
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;

      if (message.isFirstMessage) {
        // For the first message, cycle back to the last greeting
        if (currentIndex > 0) {
          message.swipeIndex--;
        } else {
          message.swipeIndex = totalSwipes - 1; // Cycle back to last greeting
        }

        // Update character filename for group chats
        if (this.isGroupChat && message.swipeCharacters && message.swipeCharacters[message.swipeIndex]) {
          message.characterFilename = message.swipeCharacters[message.swipeIndex];
          // Force Vue to re-render the avatar
          this.$forceUpdate();
        }

        // Only save if the chat has more than just the greeting (i.e., user has actually sent messages)
        if (this.messages.length > 1 || this.chatId) {
          if (this.isGroupChat) {
            await this.saveGroupChat(false); // Save without notification
          } else {
            await this.saveChat();
          }
        }
      } else {
        // For other messages, normal swipe behavior
        if (this.canSwipeLeft(message)) {
          message.swipeIndex--;

          // Update character filename for group chats
          if (this.isGroupChat && message.swipeCharacters && message.swipeCharacters[message.swipeIndex]) {
            message.characterFilename = message.swipeCharacters[message.swipeIndex];
            // Force Vue to re-render the avatar
            this.$forceUpdate();
          }

          if (this.isGroupChat) {
            await this.saveGroupChat(false); // Save without notification
          } else {
            await this.saveChat();
          }
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
        if (this.isGroupChat && message.swipeCharacters && message.swipeCharacters[message.swipeIndex]) {
          message.characterFilename = message.swipeCharacters[message.swipeIndex];
          // Force Vue to re-render the avatar
          this.$forceUpdate();
        }

        // Only save if the chat has more than just the greeting (i.e., user has actually sent messages)
        if (this.messages.length > 1 || this.chatId) {
          if (this.isGroupChat) {
            await this.saveGroupChat(false); // Save without notification
          } else {
            await this.saveChat();
          }
        }
      } else {
        // For other messages, normal swipe behavior
        if (currentIndex < totalSwipes - 1) {
          // Navigate to existing swipe
          message.swipeIndex++;

          // Update character filename for group chats
          if (this.isGroupChat && message.swipeCharacters && message.swipeCharacters[message.swipeIndex]) {
            message.characterFilename = message.swipeCharacters[message.swipeIndex];
            // Force Vue to re-render the avatar
            this.$forceUpdate();
          }

          if (this.isGroupChat) {
            await this.saveGroupChat(false); // Save without notification
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

      // For group chats, set the speaker before building context
      if (this.isGroupChat) {
        const message = this.messages[index];
        if (message.characterFilename) {
          // Use the character that originally created this message
          this.currentSpeaker = message.characterFilename;
        } else if (message.swipeCharacters && message.swipeCharacters[0]) {
          // Fallback to first swipe's character
          this.currentSpeaker = message.swipeCharacters[0];
        } else {
          // Last resort: pick a random character
          const randomIndex = Math.floor(Math.random() * this.groupChatCharacters.length);
          this.currentSpeaker = this.groupChatCharacters[randomIndex].filename;
        }
        console.log('generateNewSwipe - currentSpeaker:', this.currentSpeaker);
      }

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
        // Ignore AbortError - user cancelled the request
        if (error.name === 'AbortError') {
          return;
        }
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

        // Save the chat (handles both regular and group chats)
        if (this.isGroupChat) {
          await this.saveGroupChat(false); // Save without notification
        } else {
          await this.saveChat();
        }

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

        // Save the chat (handles both regular and group chats)
        if (this.isGroupChat) {
          await this.saveGroupChat(false); // Save without notification
        } else {
          await this.saveChat();
        }
      }
    },
    async deleteMessagesBelow(index) {
      const messagesToDelete = this.messages.length - index - 1;
      if (messagesToDelete <= 0) return;

      const confirmMessage = `Delete ${messagesToDelete} message${messagesToDelete > 1 ? 's' : ''} below this one?`;
      if (confirm(confirmMessage)) {
        // Delete all messages after this index (keep the message at index)
        this.messages.splice(index + 1);

        // Save the chat (handles both regular and group chats)
        if (this.isGroupChat) {
          await this.saveGroupChat(false); // Save without notification
        } else {
          await this.saveChat();
        }

        this.$root.$notify(`Deleted ${messagesToDelete} message${messagesToDelete > 1 ? 's' : ''}`, 'success');
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
      // Don't allow viewing narrator character card
      if (this.avatarMenu.characterFilename === '__narrator__') {
        this.$root.$notify('Narrator has no character card', 'info');
        this.closeAvatarMenu();
        return;
      }

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
    async editCharacter() {
      // Don't allow editing narrator
      if (this.avatarMenu.characterFilename === '__narrator__') {
        this.$root.$notify('Cannot edit narrator', 'info');
        this.closeAvatarMenu();
        return;
      }

      if (this.avatarMenu.message?.role === 'assistant' && this.avatarMenu.characterFilename) {
        try {
          // Load character data
          const response = await fetch(`/api/characters/${this.avatarMenu.characterFilename}`);
          if (response.ok) {
            const characterData = await response.json();
            // Open character editor in a new tab
            this.$emit('open-tab', 'character-editor', {
              character: {
                ...characterData,
                filename: this.avatarMenu.characterFilename,
                image: `/api/characters/${this.avatarMenu.characterFilename}/image`
              }
            }, `Edit: ${characterData.data.name}`, false);
          } else {
            this.$root.$notify('Failed to load character', 'error');
          }
        } catch (error) {
          console.error('Error loading character for editing:', error);
          this.$root.$notify('Error loading character', 'error');
        }
      }
      this.closeAvatarMenu();
    },
    setNextSpeaker() {
      // Don't allow setting narrator as next speaker
      if (this.avatarMenu.characterFilename === '__narrator__') {
        this.$root.$notify('Cannot set narrator as next speaker', 'warning');
        this.closeAvatarMenu();
        return;
      }

      if (this.isGroupChat && this.avatarMenu.characterFilename) {
        this.nextSpeaker = this.avatarMenu.characterFilename;
        this.$root.$notify(`Next speaker: ${this.avatarMenu.characterName}`, 'success');
      }
      this.closeAvatarMenu();
    },
    async loadAvailablePresets() {
      try {
        const response = await fetch('/api/presets');
        this.availablePresets = await response.json();
      } catch (error) {
        console.error('Failed to load available presets:', error);
      }
    },
    async loadAvailablePersonas() {
      try {
        const response = await fetch('/api/personas');
        this.availablePersonas = await response.json();
        // Ensure "User" default persona is available
        if (!this.availablePersonas.find(p => p.name === 'User')) {
          this.availablePersonas.unshift({ name: 'User', avatar: null });
        }
      } catch (error) {
        console.error('Failed to load available personas:', error);
      }
    },
    async handlePresetChange(filename) {
      // Load and apply the selected preset
      if (!filename) return;

      this.currentPresetFilename = filename;

      try {
        const response = await fetch(`/api/presets/${filename}`);
        const preset = await response.json();
        this.applyPreset(preset);
      } catch (error) {
        console.error('Failed to load preset:', error);
        this.$root.$notify('Failed to load preset', 'error');
      }
    },
    async handlePersonaChange(personaFilename) {
      // Load and apply the selected persona
      console.log('ChatView: handlePersonaChange called with filename:', personaFilename);
      console.log('ChatView: Current persona:', this.persona);

      if (!personaFilename) return;

      try {
        const response = await fetch('/api/personas');
        const personas = await response.json();
        console.log('ChatView: Available personas from API:', personas.map(p => `${p.name} (${p._filename})`));

        const selectedPersona = personas.find(p => p._filename === personaFilename || p.name === personaFilename);
        console.log('ChatView: Found persona:', selectedPersona);

        if (selectedPersona) {
          this.onPersonaSaved(selectedPersona);
        } else if (personaFilename === 'User') {
          // Default User persona
          this.onPersonaSaved({ name: 'User', avatar: null, _filename: 'User' });
        } else {
          console.warn('ChatView: Persona not found:', personaFilename);
          this.$root.$notify(`Persona not found`, 'warning');
        }
      } catch (error) {
        console.error('Failed to load persona:', error);
        this.$root.$notify('Failed to load persona', 'error');
      }
    },
    // Deprecated: kept for backward compatibility
    async onPresetChange() {
      await this.handlePresetChange(this.currentPresetFilename);
    },
    async onPersonaChange() {
      await this.handlePersonaChange(this.persona._filename);
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
      this.currentPresetFilename = preset.filename;
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
        characterBindings: persona.characterBindings || [],
        _filename: persona._filename || persona.name
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
      this.chatDisplayTitle = null; // Reset display title for new chat
      this.conversationGroup = null; // Start fresh conversation thread (not a continuation)
      this.currentDebugData = null; // Clear debug data for new chat

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
    async startNewChatFromSummary() {
      // Show confirmation dialog
      const confirmed = confirm(
        'This will create a new chat with a summary of the current conversation. The characters will continue from where the summary leaves off. Continue?'
      );

      if (!confirmed) return;

      try {
        this.$root.$notify('Generating summary...', 'info');

        // Load the current preset from the API
        let preset;
        if (this.currentPresetFilename) {
          try {
            const presetResponse = await fetch(`/api/presets/${this.currentPresetFilename}`);
            if (presetResponse.ok) {
              preset = await presetResponse.json();
            }
          } catch (err) {
            console.error('Failed to load preset:', err);
          }
        }

        // Fall back to building preset from settings if API load failed
        if (!preset || !preset.model) {
          if (!this.settings || !this.settings.model) {
            throw new Error('No preset is currently selected. Please select a preset first.');
          }

          preset = {
            name: this.currentPresetName || 'Current Settings',
            model: this.settings.model,
            temperature: this.settings.temperature,
            max_tokens: this.settings.max_tokens,
            top_p: this.settings.top_p,
            top_k: this.settings.top_k,
            frequency_penalty: this.settings.frequency_penalty,
            presence_penalty: this.settings.presence_penalty,
            repetition_penalty: this.settings.repetition_penalty,
            prompts: this.settings.systemPrompts || [],
            promptProcessing: this.settings.prompt_processing || 'merge_system'
          };
        }

        // Get current chat title
        const chatTitle = this.chatDisplayTitle || (this.isGroupChat ? 'Group Chat' : this.character?.data?.name || 'Chat');

        // Build context for macro processing
        const context = {
          char: this.isGroupChat ? 'Character' : (this.characterName || 'Character'),
          user: this.persona.name || 'User'
        };

        // Get character filenames for group chats
        let characterFilenames = null;
        if (this.isGroupChat && this.groupChatCharacters) {
          characterFilenames = this.groupChatCharacters.map(c => c.filename);
        }

        // Prepare request data with preset and context
        const requestData = {
          messages: this.messages,
          chatTitle: chatTitle,
          preset: preset,
          context: context,
          isGroupChat: this.isGroupChat,
          characterFilenames: characterFilenames,
          characterFilename: !this.isGroupChat ? this.character?.filename : null
        };

        console.log('Requesting summary with preset:', preset.name);
        console.log('Model:', preset.model);
        console.log('Character filenames:', characterFilenames);

        // Call API to generate summary (streaming)
        const response = await fetch('/api/chat/summarize-and-continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          throw new Error('Failed to start summary generation');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let newChatData = null;
        let narratorCharacter = null;
        let streamingMessage = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                if (event.type === 'init') {
                  // Initialize new chat immediately
                  newChatData = event.chatData;
                  narratorCharacter = event.narrator;

                  // Preserve conversationGroup from current chat (for history grouping)
                  const inheritedConversationGroup = this.conversationGroup;

                  // Clear current chat state
                  this.messages = [];
                  this.chatId = null;
                  this.groupChatId = null; // New chat ID will be generated on save
                  this.chatDisplayTitle = newChatData.title;

                  // Inherit the conversationGroup to link this continuation to the original
                  this.conversationGroup = inheritedConversationGroup;

                  // Determine if this should be a group chat or single character chat
                  const shouldBeGroupChat = newChatData.characterFilenames.length > 1;
                  this.isGroupChat = shouldBeGroupChat;

                  // Load characters (only the original characters, not the narrator)
                  const characters = [];
                  for (const filename of newChatData.characterFilenames) {
                    try {
                      const charResponse = await fetch(`/api/characters/${filename}`);
                      if (charResponse.ok) {
                        const charData = await charResponse.json();
                        characters.push({
                          filename: filename,
                          name: charData.data.name,
                          data: charData.data
                        });
                      }
                    } catch (err) {
                      console.error(`Failed to load character ${filename}:`, err);
                    }
                  }

                  if (shouldBeGroupChat) {
                    this.groupChatCharacters = characters;
                  } else {
                    // Single character chat
                    this.character = characters[0] ? { data: characters[0].data, filename: characters[0].filename } : null;
                  }

                  // Create placeholder streaming message from narrator
                  streamingMessage = {
                    role: 'assistant',
                    character: narratorCharacter.name,
                    characterFilename: '__narrator__',
                    characterAvatar: narratorCharacter.avatar, // Store narrator avatar with the message
                    content: '',
                    timestamp: newChatData.timestamp,
                    swipes: [''],
                    swipeIndex: 0
                  };
                  this.messages.push(streamingMessage);

                  // Store narrator info for avatar display
                  this.narratorInfo = narratorCharacter;

                  // Update tab data
                  this.updateTabData();

                  this.$root.$notify('Generating summary...', 'info');

                } else if (event.type === 'chunk' && streamingMessage) {
                  // Update streaming message
                  streamingMessage.content += event.content;
                  streamingMessage.swipes[0] = streamingMessage.content;
                  this.$forceUpdate();

                } else if (event.type === 'complete') {
                  // Finalize the message
                  if (streamingMessage && event.message) {
                    streamingMessage.content = event.message.content;
                    streamingMessage.swipes = event.message.swipes;
                  }

                  // Save the new chat
                  try {
                    // Call appropriate save method based on chat type
                    if (this.isGroupChat) {
                      await this.saveGroupChat(false); // Save without notification
                    } else {
                      await this.saveChat(false); // Save single character chat
                    }
                    this.$root.$notify('Summary complete! Chat continued with narrator.', 'success');
                  } catch (saveError) {
                    console.error('Failed to save chat:', saveError);
                    this.$root.$notify('Summary complete, but failed to save chat', 'warning');
                  }

                } else if (event.type === 'error') {
                  throw new Error(event.error);
                }
              } catch (err) {
                console.error('Failed to parse SSE event:', err);
              }
            }
          }
        }

      } catch (error) {
        console.error('Failed to start new chat from summary:', error);
        this.$root.$notify(`Failed to generate summary: ${error.message}`, 'error');
      }
    },
    async loadChatHistory() {
      try {
        if (this.isGroupChat) {
          // Load group chat history
          const response = await fetch('/api/group-chats');
          const allGroupChats = await response.json();

          // Filter group chats to only show those with the same character set
          const currentCharacterSet = this.groupChatCharacters
            ? this.groupChatCharacters.map(c => c.filename).sort().join(',')
            : '';

          const filteredChats = allGroupChats
            .filter(gc => {
              // Get character filenames from the group chat
              let gcCharFilenames = [];
              if (gc.characterFilenames) {
                gcCharFilenames = gc.characterFilenames;
              } else if (gc.characters) {
                gcCharFilenames = gc.characters.map(c => c.filename);
              }

              const gcCharacterSet = gcCharFilenames.sort().join(',');
              return gcCharacterSet === currentCharacterSet;
            })
            .map(gc => ({
              ...gc,
              isGroupChat: true
            }));

          // Group chats by conversationGroup, then flatten for display
          const grouped = this.groupChatsByConversationGroup(filteredChats);
          this.chatHistory = grouped;

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

    groupChatsByConversationGroup(chats) {
      // Group chats by conversationGroup
      const groups = {};

      for (const chat of chats) {
        const groupId = chat.conversationGroup || chat.filename; // Use filename as fallback for ungrouped chats
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(chat);
      }

      // Flatten groups back into a list, with most recent group first
      // Within each group, sort by timestamp
      const result = [];
      const sortedGroupIds = Object.keys(groups).sort((a, b) => {
        const maxTimestampA = Math.max(...groups[a].map(c => c.timestamp || 0));
        const maxTimestampB = Math.max(...groups[b].map(c => c.timestamp || 0));
        return maxTimestampB - maxTimestampA;
      });

      for (const groupId of sortedGroupIds) {
        const groupChats = groups[groupId].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (groupChats.length > 1) {
          // Multiple chats in group - add a group header
          result.push({
            isGroupHeader: true,
            conversationGroup: groupId,
            chatCount: groupChats.length,
            latestTimestamp: Math.max(...groupChats.map(c => c.timestamp || 0)),
            chats: groupChats,
            expanded: false // Start collapsed
          });
        } else {
          // Single chat - add directly
          result.push(groupChats[0]);
        }
      }

      return result;
    },
    async loadChatFromHistory(chat) {
      this.messages = this.normalizeMessages(chat.messages || []);

      // Set display title from chat data
      this.chatDisplayTitle = chat.title || null;

      if (chat.isGroupChat) {
        this.groupChatId = chat.filename;
        this.groupChatCharacters = chat.characters || [];
        this.groupChatStrategy = chat.strategy || 'join';
        this.groupChatExplicitMode = chat.explicitMode || false;
        this.groupChatName = chat.name || '';
        this.groupChatTags = chat.tags || [];
        this.conversationGroup = chat.conversationGroup || null; // Restore conversation group
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

          // If this is the current chat, update the display title
          if (chat.filename === this.chatId) {
            this.chatDisplayTitle = result.title;
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
      // Batch scroll calls to prevent excessive updates
      if (this.scrollToBottomPending && !force) {
        return;
      }

      this.scrollToBottomPending = true;
      this.$nextTick(() => {
        this.scrollToBottomPending = false;

        const container = this.$refs.messagesContainer;
        if (!container) return;

        // If user has scrolled up and we're not forcing, don't auto-scroll
        if (this.userHasScrolledUp && !force) {
          return;
        }

        container.scrollTop = container.scrollHeight;
      });
    },
    handleScroll() {
      // DISABLE scroll tracking during streaming to prevent infinite loops
      if (this.isStreaming) {
        return;
      }

      // Throttle to prevent excessive calls (max once per 100ms)
      const now = Date.now();
      if (this.handleScrollThrottle && now - this.handleScrollThrottle < 100) {
        return;
      }
      this.handleScrollThrottle = now;

      const container = this.$refs.messagesContainer;
      if (!container) return;

      // Check if user is near the bottom (within 100px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      const newValue = !isNearBottom;

      // Only update if the value actually changed to prevent unnecessary reactivity
      if (this.userHasScrolledUp !== newValue) {
        this.userHasScrolledUp = newValue;
      }
    },
    async loadLorebooks() {
      try {
        const response = await fetch('/api/lorebooks');
        this.lorebooks = await response.json();

        // Clean up selectedLorebookFilenames: remove any that don't exist anymore
        const validFilenames = this.lorebooks.map(l => l.filename);
        const originalLength = this.selectedLorebookFilenames.length;
        this.selectedLorebookFilenames = this.selectedLorebookFilenames.filter(filename =>
          validFilenames.includes(filename)
        );

        // If we removed any, update localStorage
        if (this.selectedLorebookFilenames.length < originalLength) {
          const manuallySelected = this.selectedLorebookFilenames.filter(
            filename => !this.autoSelectedLorebookFilenames.includes(filename)
          );
          localStorage.setItem('manuallySelectedLorebooks', JSON.stringify(manuallySelected));
          console.log('Cleaned up invalid lorebook references from selection');
        }
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
    loadDebugDataFromStorage() {
      const chatKey = this.isGroupChat ? this.groupChatId : this.chatId;
      if (!chatKey) {
        return;
      }

      try {
        const stored = localStorage.getItem(`debug_${chatKey}`);
        if (stored) {
          debugDataCache.set(chatKey, JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to load persisted debug data:', err);
      }
    },
    saveDebugData(requestBody, debugInfoFromServer) {
      // Use processed messages from server if available, otherwise use original request messages
      const finalMessages = debugInfoFromServer?.processedMessages || requestBody.messages;

      // Simply store the debug data in memory for the current session
      this.currentDebugData = {
        timestamp: Date.now(),
        // Request info
        model: requestBody.model,
        messages: finalMessages, // These are the FINAL messages sent to the API after processing
        options: requestBody.options,
        promptProcessing: requestBody.promptProcessing,
        lorebookFilenames: requestBody.lorebookFilenames || [],
        tools: requestBody.tools || [],
        // Context info (persona)
        context: requestBody.context || {},
        personaName: this.persona?.name || 'User',
        personaNickname: this.persona?.nickname || '',
        personaDescription: this.persona?.description || '',
        // Debug info from server
        matchedEntriesByLorebook: debugInfoFromServer?.matchedEntriesByLorebook || {},
        // Computed info
        estimatedTokens: this.debugInfo.estimatedTokens,
        messageCount: this.debugInfo.messageCount,
        systemMessageCount: this.debugInfo.systemMessageCount,
        userMessageCount: this.debugInfo.userMessageCount,
        assistantMessageCount: this.debugInfo.assistantMessageCount
      };
    },
    editLorebook(lorebook) {
      // Set the lorebook to edit (LorebookEditor will handle cloning)
      this.editingLorebook = lorebook;
      this.showLorebooks = false;
    },
    closeLorebookEditor() {
      this.editingLorebook = null;
    },
    async saveEditingLorebook(lorebook) {
      try {
        const response = await fetch('/api/lorebooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lorebook)
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
    async autoSelectLorebook() {
      try {
        const response = await fetch('/api/lorebooks');
        const lorebooks = await response.json();

        if (!lorebooks || lorebooks.length === 0) return;

        // Collect tags based on chat type
        let allTags = [];
        if (this.isGroupChat) {
          // For group chats: collect tags from the group itself and all characters
          allTags = [...(this.groupChatTags || [])];

          // Add tags from all characters in the group
          for (const char of this.groupChatCharacters || []) {
            const charTags = char.data?.tags || char.data?.data?.tags || char.tags || [];
            allTags.push(...charTags);
          }
        } else {
          // For regular chats: just use the character's tags
          allTags = this.character?.data?.tags || [];
        }

        // Remove duplicates and normalize to lowercase
        const uniqueTags = [...new Set(allTags.map(t => t.toLowerCase()))];
        this.autoSelectedLorebookFilenames = [];

        // Find all lorebooks with autoSelect enabled and matching tags
        for (const lorebook of lorebooks) {
          if (lorebook.autoSelect && lorebook.matchTags) {
            const lorebookTags = lorebook.matchTags
              .split(',')
              .map(t => t.trim().toLowerCase())
              .filter(t => t.length > 0);

            // Check if any tag matches lorebook tags
            const hasMatch = uniqueTags.some(tag =>
              lorebookTags.includes(tag)
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

        // Refresh character data from actual PNG files to get latest edits
        const refreshedCharacters = [];
        for (const cachedChar of groupChat.characters || []) {
          try {
            const charResponse = await fetch(`/api/characters/${cachedChar.filename}`);
            if (charResponse.ok) {
              const freshCharData = await charResponse.json();
              refreshedCharacters.push({
                filename: cachedChar.filename,
                name: freshCharData.data.name,
                data: freshCharData.data  // Store just the data object, not the whole character
              });
            } else {
              // If character file is missing, keep the cached version
              console.warn(`Character ${cachedChar.filename} not found, using cached data`);
              refreshedCharacters.push(cachedChar);
            }
          } catch (err) {
            console.error(`Failed to refresh character ${cachedChar.filename}:`, err);
            // Fall back to cached data if refresh fails
            refreshedCharacters.push(cachedChar);
          }
        }

        this.groupChatCharacters = refreshedCharacters;
        this.groupChatStrategy = groupChat.strategy || 'join';
        this.groupChatExplicitMode = groupChat.explicitMode || false;
        this.groupChatName = groupChat.name || '';
        this.groupChatTags = groupChat.tags || [];
        this.conversationGroup = groupChat.conversationGroup || null; // Load conversation group
        this.messages = this.normalizeMessages(groupChat.messages || []);

        // If no messages, initialize with swipeable greetings
        if (this.messages.length === 0) {
          await this.initializeGroupChat();
        }

        // Load debug data for this chat
        this.loadDebugDataFromStorage();
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

    async saveGroupChat(showNotification = true) {
      try {
        // Generate conversationGroup UUID if it doesn't exist
        if (!this.conversationGroup) {
          this.conversationGroup = this.generateUUID();
        }

        const groupChat = {
          filename: this.groupChatId || `group_chat_${Date.now()}.json`,
          characters: this.groupChatCharacters,
          characterFilenames: this.groupChatCharacters.map(c => c.filename), // Add for compatibility
          conversationGroup: this.conversationGroup, // Link related chats together
          strategy: this.groupChatStrategy,
          explicitMode: this.groupChatExplicitMode,
          name: this.groupChatName,
          tags: this.groupChatTags,
          messages: this.messages,
          timestamp: Date.now(),
          title: this.chatDisplayTitle // Include title for chat history
        };

        const response = await fetch('/api/group-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupChat)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        this.groupChatId = result.filename;

        if (showNotification) {
          this.$root.$notify('Group chat saved', 'success');
        }
      } catch (error) {
        console.error('Failed to save group chat:', error);
        if (showNotification) {
          this.$root.$notify('Failed to save group chat', 'error');
        }
      }
    },

    async convertToGroupChat() {
      if (!this.character) return;

      // Convert current character chat to group chat
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      const characterData = this.character.data || this.character;
      this.isGroupChat = true;
      this.groupChatCharacters = [{
        filename: characterFilename,
        name: characterData.name,
        data: characterData
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
        // Ignore AbortError - user cancelled the request
        if (error.name === 'AbortError') {
          return;
        }
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

      // Determine which character will be speaking (for swap strategy)
      const speakerFilename = this.nextSpeaker || this.currentSpeaker;
      const speakingCharacter = speakerFilename
        ? this.groupChatCharacters.find(c => c.filename === speakerFilename)
        : null;

      // Track if character info was injected via placeholders
      let hasCharacterInfo = false;

      // Add system prompts from preset
      if (this.settings.systemPrompts && this.settings.systemPrompts.length > 0) {
        const sortedPrompts = [...this.settings.systemPrompts]
          .filter(p => p.enabled)
          .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));

        for (const prompt of sortedPrompts) {
          let content = prompt.content || '';
          const originalContent = content;

          // For group chats, handle character info differently based on strategy
          if (this.groupChatStrategy === 'join') {
            // Check if any character placeholders exist
            const hasCharPlaceholders = /\{\{(description|personality|scenario|system_prompt|dialogue_examples)\}\}/g.test(content);

            if (hasCharPlaceholders) {
              // Build complete info for each character, then join them
              const allCharacterInfo = this.groupChatCharacters.map(c => {
                const charData = c.data?.data || c.data || {};

                // Create macro context for THIS specific character
                const charMacroContext = {
                  charName: c.name,
                  charNickname: charData.nickname || '',
                  userName: this.persona?.name || 'User'
                };

                let info = `=== Character: ${c.name} ===\n`;

                // Process macros in each field for this character
                if (charData.description) {
                  info += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
                }
                if (charData.personality) {
                  info += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
                }
                if (charData.scenario) {
                  info += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
                }
                if (charData.system_prompt) {
                  info += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
                }
                if (charData.mes_example) {
                  info += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
                }

                return info.trim();
              }).join('\n');

              // Replace the FIRST placeholder with all character info, remove the rest
              let replacedFirst = false;
              content = content.replace(/\{\{(description|personality|scenario|system_prompt|dialogue_examples)\}\}/g, (match) => {
                if (!replacedFirst) {
                  replacedFirst = true;
                  return allCharacterInfo;
                }
                return ''; // Remove subsequent placeholders
              });
            }
          } else if (this.groupChatStrategy === 'swap' && speakingCharacter) {
            // Replace with only the speaking character's info
            const charData = speakingCharacter.data?.data || speakingCharacter.data || {};

            // Create macro context for the speaking character
            const charMacroContext = {
              charName: speakingCharacter.name,
              charNickname: charData.nickname || '',
              userName: this.persona?.name || 'User'
            };

            // Process macros in each field before replacing placeholders
            content = content.replace(/\{\{description\}\}/g,
              charData.description ? processMacrosForDisplay(charData.description, charMacroContext) : '');
            content = content.replace(/\{\{personality\}\}/g,
              charData.personality ? processMacrosForDisplay(charData.personality, charMacroContext) : '');
            content = content.replace(/\{\{scenario\}\}/g,
              charData.scenario ? processMacrosForDisplay(charData.scenario, charMacroContext) : '');
            content = content.replace(/\{\{system_prompt\}\}/g,
              charData.system_prompt ? processMacrosForDisplay(charData.system_prompt, charMacroContext) : '');
            content = content.replace(/\{\{dialogue_examples\}\}/g,
              charData.mes_example ? processMacrosForDisplay(charData.mes_example, charMacroContext) : '');
          }

          // Check if any placeholders were replaced
          if (content !== originalContent) {
            hasCharacterInfo = true;
          }

          if (content.trim()) {
            context.push({
              role: prompt.role || 'system',
              content: content.trim()
            });
          }
        }
      }

      // If no placeholders were used, add character info as fallback
      if (!hasCharacterInfo) {
        if (this.groupChatStrategy === 'join') {
          // Add all character info
          const characterInfos = this.groupChatCharacters.map(c => {
            const charData = c.data?.data || c.data || {};

            // Create macro context for THIS specific character
            const charMacroContext = {
              charName: c.name,
              charNickname: charData.nickname || '',
              userName: this.persona?.name || 'User'
            };

            let info = `${c.name}:\n`;
            // Process macros in each field for this character
            if (charData.description) {
              info += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
            }
            if (charData.personality) {
              info += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
            }
            if (charData.scenario) {
              info += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
            }
            if (charData.system_prompt) {
              info += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
            }
            if (charData.mes_example) {
              info += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
            }
            return info;
          }).join('\n\n');

          if (characterInfos.trim()) {
            context.push({
              role: 'system',
              content: characterInfos.trim()
            });
          }
        } else if (this.groupChatStrategy === 'swap' && speakingCharacter) {
          // Add only the speaking character's info
          const charData = speakingCharacter.data?.data || speakingCharacter.data || {};

          // Create macro context for the speaking character
          const charMacroContext = {
            charName: speakingCharacter.name,
            charNickname: charData.nickname || '',
            userName: this.persona?.name || 'User'
          };

          let characterInfo = `${speakingCharacter.name}:\n`;
          // Process macros in each field for this character
          if (charData.description) {
            characterInfo += `Description: ${processMacrosForDisplay(charData.description, charMacroContext)}\n`;
          }
          if (charData.personality) {
            characterInfo += `Personality: ${processMacrosForDisplay(charData.personality, charMacroContext)}\n`;
          }
          if (charData.scenario) {
            characterInfo += `Scenario: ${processMacrosForDisplay(charData.scenario, charMacroContext)}\n`;
          }
          if (charData.system_prompt) {
            characterInfo += `${processMacrosForDisplay(charData.system_prompt, charMacroContext)}\n`;
          }
          if (charData.mes_example) {
            characterInfo += `Example Dialogue:\n${processMacrosForDisplay(charData.mes_example, charMacroContext)}\n`;
          }

          if (characterInfo.trim() !== `${speakingCharacter.name}:\n`) {
            context.push({
              role: 'system',
              content: characterInfo.trim()
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
      // If the message has a direct avatar field (e.g., for narrator), use it
      if (message.characterAvatar) {
        return message.characterAvatar;
      }

      if (this.isGroupChat && message.characterFilename) {
        return `/api/characters/${message.characterFilename}/image`;
      }
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      return `/api/characters/${characterFilename}/image`;
    },

    setFallbackAvatar(event) {
      // Set a fallback SVG when avatar image fails to load
      const svgQuestionMark = `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
          <rect width="48" height="48" fill="#3a3f4b" rx="12"/>
          <text x="24" y="32" font-family="Arial, sans-serif" font-size="28" fill="#8b92a8" text-anchor="middle" font-weight="bold">?</text>
        </svg>
      `)}`;
      event.target.src = svgQuestionMark;
    },

    getMessageCharacterName(message) {
      // If the message has a direct character name (e.g., for narrator), use it
      if (message.character) {
        return message.character;
      }

      if (this.isGroupChat && message.characterFilename) {
        const char = this.groupChatCharacters.find(c => c.filename === message.characterFilename);
        return char?.name || 'Unknown';
      }
      return this.characterName;
    },

    getStreamingAvatar() {
      // Handle narrator during streaming
      if (this.currentSpeaker === '__narrator__' && this.narratorInfo) {
        return this.narratorInfo.avatar;
      }

      if (this.isGroupChat && this.currentSpeaker) {
        return `/api/characters/${this.currentSpeaker}/image`;
      }
      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      return `/api/characters/${characterFilename}/image`;
    },

    getStreamingCharacterName() {
      // Handle narrator during streaming
      if (this.currentSpeaker === '__narrator__' && this.narratorInfo) {
        return this.narratorInfo.name;
      }

      if (this.isGroupChat && this.currentSpeaker) {
        const char = this.groupChatCharacters.find(c => c.filename === this.currentSpeaker);
        return char?.name || 'Unknown';
      }
      return this.characterName;
    },

    generateUUID() {
      // Simple UUID v4 generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
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

/* Terminal-style code blocks */
.message-content :deep(pre) {
  position: relative;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0;
  margin: 12px 0;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.message-content :deep(pre code) {
  display: block;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  background: transparent;
  border: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Console-specific styling */
.message-content :deep(pre code.language-console::before),
.message-content :deep(pre code.language-bash::before),
.message-content :deep(pre code.language-shell::before),
.message-content :deep(pre code.language-terminal::before) {
  content: '●●●';
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 10px;
  letter-spacing: 2px;
  color: #666;
}

.message-content :deep(pre code.language-console),
.message-content :deep(pre code.language-bash),
.message-content :deep(pre code.language-shell),
.message-content :deep(pre code.language-terminal) {
  padding-top: 32px;
  background: linear-gradient(to bottom, #2d2d2d 28px, #1e1e1e 28px);
  color: #00ff00;
  text-shadow: 0 0 2px rgba(0, 255, 0, 0.3);
}

/* Inline code styling */
.message-content :deep(code) {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 0.9em;
}

.message-content :deep(pre code) {
  padding: 16px;
  background: transparent;
  border: none;
}

/* Special text styling - dialogue and actions */
.message-content :deep(.dialogue) {
  color: var(--accent-hover);
  font-style: italic;
  font-weight: 600;
  text-shadow:
    0 0 12px var(--accent-muted),
    0 0 6px var(--accent-muted),
    0 1px 2px rgba(0, 0, 0, 0.3);
  filter: brightness(1.3) saturate(1.2);
}

.message-content :deep(.action) {
  color: var(--text-primary);
  font-style: italic;
  font-weight: 500;
  opacity: 0.75;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  filter: brightness(0.9);
}

/* Make dialogue stand out more in user messages (white background) */
.message.user .message-content :deep(.dialogue) {
  color: rgba(255, 255, 255, 1);
  text-shadow:
    0 0 15px rgba(255, 255, 255, 0.5),
    0 0 8px rgba(255, 255, 255, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.4);
  font-weight: 700;
  filter: brightness(1.15);
}

.message.user .message-content :deep(.action) {
  color: rgba(255, 255, 255, 0.85);
  opacity: 1;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
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

.message-actions .delete-below-button {
  color: #ff6b6b;
  font-weight: bold;
}

.message-actions .delete-below-button:hover {
  background: rgba(255, 107, 107, 0.1);
  border-color: #ff6b6b;
  color: #ff4757;
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

.input-area .stop-btn {
  background: #dc3545;
  color: white;
}

.input-area .stop-btn:hover {
  background: #c82333;
  opacity: 1;
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

/* Grouped conversation styles */
.history-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-group-header:hover {
  background: var(--hover-color);
}

.expand-icon {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 12px;
}

.history-group-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 20px;
}

.history-item.grouped {
  background: var(--bg-secondary);
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

.lorebook-section {
  margin-bottom: 1rem;
}

.lorebook-section-header {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 0.5rem;
  border-radius: 4px 4px 0 0;
}

.lorebook-section-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.lorebook-option.active {
  background-color: rgba(90, 159, 212, 0.08);
  border-left: 3px solid var(--accent-color);
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

/* Tool Call Indicator */
.tool-call-indicator {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-style: italic;
  color: var(--text-secondary);
}

.tool-call-icon {
  font-size: 18px;
  animation: tool-call-pulse 1.5s infinite;
}

.tool-call-text {
  font-size: 14px;
}

@keyframes tool-call-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
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
  .chat-container {
    margin-left: 0 !important;
  }

  /* Increase message width on mobile */
  .message {
    max-width: 95%;
  }
}
</style>
