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
      @add-memory="showMemoryModal = true"
      @convert-to-group="convertToGroupChat"
      @toggle-history="showChatHistory = !showChatHistory"
      @show-branch-tree="showBranchTree = true"
      @persona-change="handlePersonaChange"
      @preset-change="handlePresetChange"
      @show-lorebooks="showLorebooks = true"
      @toggle-debug="showDebug = !showDebug"
      @toggle-group-manager="showGroupManager = !showGroupManager"
      @open-tab="(...args) => $emit('open-tab', ...args)"
    />

    <!-- Avatar Menu -->
    <AvatarMenu
      :show="avatarMenu.show"
      :x="avatarMenu.x"
      :y="avatarMenu.y"
      :characterName="avatarMenu.characterName"
      :canEdit="avatarMenu.message?.role === 'assistant' && !!avatarMenu.characterFilename"
      :isGroupChat="isGroupChat"
      @close="closeAvatarMenu"
      @view-card="viewCharacterCard"
      @edit-character="editCharacter"
      @set-next-speaker="setNextSpeaker"
    />

    <!-- Character Card Modal (read-only, legacy) -->
    <CharacterCardModal
      :show="showCharacterCard"
      :character="viewingCharacter"
      @close="showCharacterCard = false"
    />

    <!-- Character Quick Edit Modal -->
    <CharacterQuickEditModal
      :show="showQuickEdit"
      :character="quickEditCharacter"
      :characterFilename="quickEditFilename"
      @close="showQuickEdit = false"
      @open-full-editor="openFullCharacterEditor"
      @character-updated="onCharacterUpdated"
    />

    <!-- Chat History Sidebar -->
    <ChatHistorySidebar
      :show="showChatHistory"
      :chatHistory="chatHistory"
      :activeChatId="isGroupChat ? groupChatId : chatId"
      @close="showChatHistory = false"
      @load-chat="loadChatFromHistory"
      @rename-chat="renameChatFromHistory"
      @delete-chat="deleteChat"
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

    <LorebookSelectorModal
      :show="showLorebooks"
      :activeLorebooksForDisplay="activeLorebooksForDisplay"
      :inactiveLorebooksForDisplay="inactiveLorebooksForDisplay"
      :selectedLorebookFilenames="selectedLorebookFilenames"
      :autoSelectedLorebookFilenames="autoSelectedLorebookFilenames"
      @close="showLorebooks = false"
      @update:selectedLorebookFilenames="selectedLorebookFilenames = $event"
      @edit-lorebook="editLorebook"
    />

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

    <!-- Branch Name Input Modal -->
    <BranchNameInput
      :isOpen="branchModal.show"
      :branchCount="Object.keys(branches).length"
      @confirm="createBranch"
      @cancel="branchModal.show = false"
    />

    <!-- Branch Tree Modal -->
    <BranchTreeModal
      :show="showBranchTree"
      :branches="branches"
      :mainBranch="mainBranch"
      :currentBranch="currentBranch"
      :chatId="chatId"
      @close="showBranchTree = false"
      @switch-branch="switchToBranch"
      @rename-branch="renameBranch"
      @delete-branch="deleteBranchFromTree"
    />

    <div class="chat-container">
      <MessageList
        ref="messageList"
        :messages="messages"
        :persona="persona"
        :editingMessage="editingMessage"
        :isGeneratingSwipe="isGeneratingSwipe"
        :generatingSwipeIndex="generatingSwipeIndex"
        :streamingContent="streamingContent"
        :isStreaming="isStreaming"
        :currentToolCall="currentToolCall"
        :toolCallElapsedTime="toolCallElapsedTime"
        :currentSpeaker="currentSpeaker"
        :getMessageAvatar="getMessageAvatar"
        :getMessageCharacterName="getMessageCharacterName"
        :getCurrentContent="getCurrentContent"
        :sanitizeHtml="sanitizeHtml"
        :estimateTokens="estimateTokens"
        :canSwipeLeft="canSwipeLeft"
        :getCurrentSwipeIndex="getCurrentSwipeIndex"
        :getTotalSwipes="getTotalSwipes"
        :getStreamingAvatar="getStreamingAvatar"
        :getStreamingCharacterName="getStreamingCharacterName"
        :formatElapsedTime="formatElapsedTime"
        @scroll="handleScroll"
        @show-avatar-menu="showAvatarMenu"
        @edit-message="editMessage"
        @copy-message="copyMessage"
        @open-branch-modal="openBranchModal"
        @delete-message="deleteMessage"
        @delete-messages-below="deleteMessagesBelow"
        @cancel-edit="cancelEdit"
        @update-edited-content="updateEditedContent"
        @save-edit="saveEdit"
        @swipe-left="swipeLeft"
        @swipe-right="swipeRight"
      />

      <div class="input-area">
        <textarea
          ref="messageInput"
          v-model="userInput"
          @input="autoResizeTextarea"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          :disabled="isStreaming"
        ></textarea>
        <button @click="showImageModal = true" class="attach-btn" :disabled="isStreaming">
          📎
          <span v-if="pendingUserImages.length > 0" class="badge">{{ pendingUserImages.length }}</span>
        </button>
        <button v-if="isStreaming" @click="stopStreaming" class="stop-btn">
          Stop
        </button>
        <button v-else @click="sendMessage">
          Send
        </button>
      </div>
    </div>

    <ImageAttachmentModal
      v-if="showImageModal"
      :initialImages="pendingUserImages"
      @close="showImageModal = false"
      @update-pending="pendingUserImages = $event"
      @send="handleImageMessage"
    />

    <!-- Memory Creation Modal -->
    <MemoryModal
      :show="showMemoryModal"
      :targetName="isGroupChat ? 'all characters' : characterName"
      :isCreating="isCreatingMemory"
      @close="showMemoryModal = false"
      @create="createMemory"
    />

  </div>
</template>

<script>
import { useApi } from '../composables/useApi.js';
import { useMessageFormatting } from '../composables/useMessageFormatting.js';
import { useSwipes } from '../composables/useSwipes.js';
import { useBranches } from '../composables/useBranches.js';
import { useChatHistory } from '../composables/useChatHistory.js';
import { useContextBuilder } from '../composables/useContextBuilder.js';
import { useBranchOperations } from '../composables/useBranchOperations.js';
import { useGroupChatOperations } from '../composables/useGroupChatOperations.js';
import { useChatPersistence } from '../composables/useChatPersistence.js';
import { useStreamHandlers } from '../composables/useStreamHandlers.js';
import { useDebugData } from '../composables/useDebugData.js';
import { useSummaryChat } from '../composables/useSummaryChat.js';
import GroupChatManager from './GroupChatManager.vue';
import LorebookEditor from './LorebookEditor.vue';
import ChatSidebar from './ChatSidebar.vue';
import DebugModal from './DebugModal.vue';
import BranchNameInput from './BranchNameInput.vue';
import BranchTreeModal from './BranchTreeModal.vue';
import ImageAttachmentModal from './ImageAttachmentModal.vue';
import ChatHistorySidebar from './ChatHistorySidebar.vue';
import LorebookSelectorModal from './LorebookSelectorModal.vue';
import MessageList from './MessageList.vue';
import CharacterCardModal from './CharacterCardModal.vue';
import CharacterQuickEditModal from './CharacterQuickEditModal.vue';
import AvatarMenu from './AvatarMenu.vue';
import MemoryModal from './MemoryModal.vue';

export default {
  name: 'ChatView',
  components: {
    GroupChatManager,
    LorebookEditor,
    ChatSidebar,
    DebugModal,
    BranchNameInput,
    BranchTreeModal,
    ImageAttachmentModal,
    ChatHistorySidebar,
    LorebookSelectorModal,
    MessageList,
    CharacterCardModal,
    CharacterQuickEditModal,
    AvatarMenu,
    MemoryModal
  },
  setup() {
    const api = useApi();
    const formatting = useMessageFormatting();
    const swipeHelpers = useSwipes();
    const branchHelpers = useBranches();
    const historyHelpers = useChatHistory(api);
    const contextBuilder = useContextBuilder();
    const branchOps = useBranchOperations();
    const groupChatOps = useGroupChatOperations();
    const chatPersistence = useChatPersistence();
    const streamHandlers = useStreamHandlers();
    const debugData = useDebugData();
    const summaryChat = useSummaryChat();
    return { api, formatting, swipeHelpers, branchHelpers, historyHelpers, contextBuilder, branchOps, groupChatOps, chatPersistence, streamHandlers, debugData, summaryChat };
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
      character: null,
      characterName: 'Chat',
      persona: { name: 'User', avatar: null, _filename: 'default.json' },
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
      showChatHistory: false,
      showBranchTree: false,
      showLorebooks: false,
      showDebug: false,
      showGroupManager: false,
      showImageModal: false,
      pendingImages: null, // Temporary storage for AI-generated images
      pendingUserImages: [], // User images queued for next message
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
      branchModal: {
        show: false,
        messageIndex: null
      },
      branches: {},
      mainBranch: null,
      currentBranch: null,
      showCharacterCard: false,
      viewingCharacter: null,
      showQuickEdit: false,
      quickEditCharacter: null,
      quickEditFilename: '',
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
      isUpdatingLorebooks: false, // Guard flag to prevent recursive watcher loops
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
      narratorInfo: null, // Store narrator character info for avatar display
      showMemoryModal: false,
      isCreatingMemory: false
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
        // Guard against recursive watcher triggers
        if (this.isUpdatingLorebooks) {
          return;
        }

        try {
          this.isUpdatingLorebooks = true;

          // Save manually selected lorebooks to localStorage
          const manuallySelected = newVal.filter(
            filename => !this.autoSelectedLorebookFilenames.includes(filename)
          );
          localStorage.setItem('manuallySelectedLorebooks', JSON.stringify(manuallySelected));
        } finally {
          this.isUpdatingLorebooks = false;
        }
      },
      deep: true
    }
  },
  beforeUnmount() {
    // Clean up timer when component is destroyed
    this.stopToolCallTimer();
  },
  async mounted() {
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
      // Use guard flag during initialization to prevent watcher recursion
      this.isUpdatingLorebooks = true;
      this.selectedLorebookFilenames = [...manuallySelected];
      this.isUpdatingLorebooks = false;
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
    async createMemory(size) {
      this.isCreatingMemory = true;
      try {
        const messages = this.messages;
        const model = this.settings.model;

        if (this.isGroupChat) {
          await this.api.createBatchMemories({
            messages,
            characters: this.groupChatCharacters.map(c => ({
              filename: c.filename,
              name: c.name
            })),
            size,
            model
          });
          this.$root.$notify('Memories added to all characters', 'success');
        } else {
          await this.api.createMemory(this.characterFilename, {
            messages,
            characterName: this.characterName,
            size,
            model
          });
          this.$root.$notify(`Memory added to ${this.characterName}`, 'success');
          // Reload character to get updated memories
          await this.loadCharacter(this.characterFilename);
        }
        this.showMemoryModal = false;
      } catch (error) {
        console.error('Failed to create memory:', error);
        this.$root.$notify('Failed to create memory: ' + error.message, 'error');
      } finally {
        this.isCreatingMemory = false;
      }
    },
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
        this.character = await this.api.getCharacter(filename);

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
        const personas = await this.api.getPersonas();

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
              const config = await this.api.getConfig();
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
        const config = await this.api.getConfig();
        const activePresetFilename = config.activePreset || 'default.json';

        // Load the preset
        const preset = await this.api.getPreset(activePresetFilename);

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
        const result = await this.chatPersistence.loadChat({
          chatId,
          api: this.api,
          normalizeMessages: this.normalizeMessages
        });

        this.chatId = result.chatId;
        this.messages = result.messages;
        this.chatDisplayTitle = result.displayTitle;

        if (result.branches) {
          this.branches = result.branches;
          this.mainBranch = result.mainBranch;
          this.currentBranch = result.currentBranch;
        }

        if (result.personaFilename) {
          await this.handlePersonaChange(result.personaFilename);
        }

        await this.autoNameChat(chatId, result.chat);
        this.loadDebugDataFromStorage();
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    },
    async autoNameChat(chatId, chat) {
      try {
        const result = await this.chatPersistence.autoNameChat({
          chatId,
          chat,
          isGroupChat: this.isGroupChat
        });

        if (!result.skipped && result.title) {
            this.chatDisplayTitle = result.title;
        }
      } catch (error) {
        console.debug('Auto-naming skipped:', error.message);
      }
    },
    normalizeMessages(messages) {
      return this.chatPersistence.normalizeMessages(messages, this.isGroupChat);
    },
    async loadMostRecentChat(characterFilename) {
      try {
        const result = await this.chatPersistence.loadMostRecentChat({
          characterFilename,
          normalizeMessages: this.normalizeMessages
        });

        if (result) {
          this.messages = result.messages;
          this.chatId = result.chatId;
          await this.autoNameChat(result.chatId, result.chat);
        } else {
          this.initializeChat();
        }
      } catch (error) {
        this.initializeChat();
      }
    },
    async saveChat(showNotification = false) {
      try {
        const result = await this.chatPersistence.saveChat({
          chatId: this.chatId,
          character: this.character,
          characterFilename: this.tabData?.characterId || this.$route?.query?.character,
          persona: this.persona,
          messages: this.messages,
          branches: this.branches,
          mainBranch: this.mainBranch,
          currentBranch: this.currentBranch,
          api: this.api
        });

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

      // Explicit mode: add message without generating response
      if (this.isGroupChat && this.groupChatExplicitMode) {
        await this.saveGroupChat();
        this.$root.$notify('Message added. Select a character to respond.', 'info');
        return;
      }

      // For group chats in auto mode, pick a random character to respond
      if (this.isGroupChat && this.groupChatCharacters.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.groupChatCharacters.length);
        this.currentSpeaker = this.groupChatCharacters[randomIndex].filename;
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
    async handleImageMessage({ text, images }) {
      // Validate we have content to send
      if (!text.trim() && (!images || images.length === 0)) {
        this.showImageModal = false;
        this.$root.$notify('Cannot send empty message', 'error');
        return;
      }

      // Close modal
      this.showImageModal = false;

      // Clear pending images since we're sending them now
      this.pendingUserImages = [];

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
        _id: Date.now() + Math.random() // Unique ID for Vue key
      };

      // Add to messages
      this.messages.push(userMessage);

      // Reset scroll lock when user sends a message (they want to see it)
      this.userHasScrolledUp = false;
      this.$nextTick(() => this.scrollToBottom(true));

      // Save immediately to prevent loss if stream fails
      await this.saveCurrentChat(false);

      // Explicit mode: add message without generating response
      if (this.isGroupChat && this.groupChatExplicitMode) {
        await this.saveGroupChat();
        this.$root.$notify('Message added. Select a character to respond.', 'info');
        return;
      }

      // For group chats in auto mode, pick a random character to respond
      if (this.isGroupChat && this.groupChatCharacters.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.groupChatCharacters.length);
        this.currentSpeaker = this.groupChatCharacters[randomIndex].filename;
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

      // Delegate to composable
      return this.contextBuilder.buildSingleChatContext({
        settings: this.settings,
        character: this.character,
        persona: this.persona,
        messages: this.messages,
        upToMessageIndex
      });
    },
    async streamResponse(messages) {
      // Create AbortController for this request
      this.abortController = new AbortController();

      // Build macro context using composable
      const macroContext = this.streamHandlers.buildMacroContext({
        isGroupChat: this.isGroupChat,
        currentSpeaker: this.currentSpeaker,
        groupChatCharacters: this.groupChatCharacters,
        character: this.character,
        persona: this.persona
      });

      // Fetch tool schemas
      const tools = await this.streamHandlers.fetchToolSchemas({
        isGroupChat: this.isGroupChat,
        groupChatCharacters: this.groupChatCharacters,
        characterFilename: this.characterFilename
      });

      // Build request body using composable
      const requestBody = this.streamHandlers.buildStreamRequestBody({
        messages,
        settings: this.settings,
        macroContext,
        lorebookFilenames: this.selectedLorebookFilenames,
        tools
      });

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
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              // Check if response is empty
              const hasContent = this.streamingContent && this.streamingContent.trim().length > 0;

              if (!hasContent) {
                // Empty response - don't add swipe, just clean up and notify
                Object.assign(this, this.streamHandlers.getCleanupState());
                this.stopToolCallTimer();
                this.$root.$notify('Received empty response - swipe not added', 'warning');
                return;
              }

              // Add new assistant message with swipe
              if (this.isGeneratingSwipe && this.generatingSwipeIndex !== null) {
                // Add to existing message's swipes using composable
                this.streamHandlers.addSwipeToMessage(this.messages[this.generatingSwipeIndex], {
                  content: this.streamingContent,
                  isGroupChat: this.isGroupChat,
                  currentSpeaker: this.currentSpeaker
                });
              } else {
                // Create new message using composable
                const newMessage = this.streamHandlers.createAssistantMessage({
                  content: this.streamingContent,
                  isGroupChat: this.isGroupChat,
                  currentSpeaker: this.currentSpeaker,
                  pendingImages: this.pendingImages
                });
                this.messages.push(newMessage);
              }

              // Clean up streaming state
              Object.assign(this, this.streamHandlers.getCleanupState());
              this.stopToolCallTimer();
              this.$nextTick(() => this.scrollToBottom());

              // Auto-save after AI response
              await this.saveCurrentChat();
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // Check for error from server
              if (parsed.error) {
                console.error('API Error:', parsed.error);
                Object.assign(this, this.streamHandlers.getCleanupState());
                this.stopToolCallTimer();
                this.$root.$notify(`API Error: ${parsed.error}`, 'error');
                return;
              }

              if (parsed.type === 'debug') {
                this.debugInfo.matchedEntries = parsed.debug.matchedEntriesByLorebook || {};
                this.saveDebugData(requestBody, parsed.debug);
              } else if (parsed.type === 'tool_call_start') {
                this.currentToolCall = parsed.toolName;
                this.toolCallStartTime = Date.now();
                this.startToolCallTimer();
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'tool_call') {
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'tool_result') {

                // Ensure indicator is visible for at least 500ms
                const elapsedTime = Date.now() - (this.toolCallStartTime || 0);
                const minDisplayTime = 500;
                const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

                setTimeout(() => {
                  this.currentToolCall = null;
                  this.stopToolCallTimer();
                }, remainingTime);

                // Use composable to format tool result message
                const formatted = this.streamHandlers.formatToolResultMessage(parsed.result);
                this.streamingContent += formatted.message;
                this.$root.$notify(formatted.notification.text, formatted.notification.type);
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'tool_error') {
                // Handle tool execution error
                console.error('Tool error:', parsed.error);
                this.streamingContent += `\n\n✗ Error executing tool: ${parsed.error}\n\n`;
                this.$root.$notify('Tool execution failed', 'error');
                this.$nextTick(() => this.scrollToBottom());
              } else if (parsed.type === 'images') {
                // Handle AI-generated images
                // Find the last assistant message (could be streaming or the one we're about to create)
                // We'll store the images temporarily and add them when [DONE] is received
                this.pendingImages = parsed.images;
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

      // Save partial response only if there's actual content (not just whitespace)
      if (this.streamingContent && this.streamingContent.trim().length > 0) {
        if (this.isGeneratingSwipe && this.generatingSwipeIndex !== null) {
          // Add partial swipe using composable
          this.streamHandlers.addSwipeToMessage(this.messages[this.generatingSwipeIndex], {
            content: this.streamingContent,
            isGroupChat: this.isGroupChat,
            currentSpeaker: this.currentSpeaker
          });
        } else {
          // Create new message using composable
          const newMessage = this.streamHandlers.createAssistantMessage({
            content: this.streamingContent,
            isGroupChat: this.isGroupChat,
            currentSpeaker: this.currentSpeaker
          });
          newMessage._id = Date.now() + Math.random(); // Unique ID for Vue key
          this.messages.push(newMessage);
        }
      }

      // Clean up state
      Object.assign(this, this.streamHandlers.getCleanupState());
      this.stopToolCallTimer();

      // Save chat
      this.$nextTick(() => this.saveCurrentChat());

      this.$root.$notify('Response cancelled', 'info');
    },
    estimateTokens(text) {
      return this.formatting.estimateTokens(text);
    },
    applyTextStyling(text) {
      return this.formatting.applyTextStyling(text);
    },
    sanitizeHtml(html, message = null) {
      // Build macro context - use the specific character for group chats
      let charName = this.character?.data?.name || 'Character';
      let charNickname = this.character?.data?.nickname || '';

      if (this.isGroupChat && message?.characterFilename) {
        const char = this.groupChatCharacters.find(c => c.filename === message.characterFilename);
        if (char) {
          charName = char.name;
          charNickname = char.data?.data?.nickname || '';
        }
      }

      const macroContext = {
        charName,
        charNickname,
        userName: this.persona?.name || 'User'
      };

      return this.formatting.sanitizeHtml(html, macroContext);
    },
    getCurrentContent(message) {
      return this.formatting.getCurrentContent(message);
    },
    hasMultipleSwipes(message) {
      return this.swipeHelpers.hasMultipleSwipes(message);
    },
    getCurrentSwipeIndex(message) {
      return this.swipeHelpers.getCurrentSwipeIndex(message);
    },
    getTotalSwipes(message) {
      return this.swipeHelpers.getTotalSwipes(message);
    },
    canSwipeLeft(message) {
      return this.swipeHelpers.canSwipeLeft(message);
    },
    canSwipeRight(message) {
      return this.swipeHelpers.canSwipeRight(message);
    },
    async swipeLeft(index) {
      const message = this.messages[index];
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;

      if (message.isFirstMessage) {
        message.swipeIndex = currentIndex > 0 ? currentIndex - 1 : totalSwipes - 1;
        this.updateSwipeCharacter(message);
        if (this.messages.length > 1 || this.chatId) await this.saveCurrentChat(false);
      } else if (this.canSwipeLeft(message)) {
        message.swipeIndex--;
        this.updateSwipeCharacter(message);
        await this.saveCurrentChat(false);
      }
    },
    updateSwipeCharacter(message) {
      if (this.isGroupChat && message.swipeCharacters?.[message.swipeIndex]) {
        message.characterFilename = message.swipeCharacters[message.swipeIndex];
        this.$forceUpdate();
      }
    },
    async swipeRight(index) {
      const message = this.messages[index];
      const currentIndex = message.swipeIndex ?? 0;
      const totalSwipes = message.swipes?.length || 1;

      if (message.isFirstMessage) {
        message.swipeIndex = currentIndex < totalSwipes - 1 ? currentIndex + 1 : 0;
        this.updateSwipeCharacter(message);
        if (this.messages.length > 1 || this.chatId) await this.saveCurrentChat(false);
      } else if (currentIndex < totalSwipes - 1) {
        message.swipeIndex++;
        this.updateSwipeCharacter(message);
        await this.saveCurrentChat(false);
      } else if (currentIndex === totalSwipes - 1) {
        await this.generateNewSwipe(index);
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
        const el = this.$refs.messageList?.getEditTextareaRef(index);
        if (el) {
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

        await this.saveCurrentChat(false);
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
      // Handle array content (multimodal messages)
      const htmlContent = Array.isArray(content)
        ? content.map(part => {
            if (part.type === 'text') return part.text;
            if (part.type === 'image_url') return `<img src="${part.image_url.url}" alt="Attached image">`;
            return '';
          }).join('\n')
        : content;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([textContent], { type: 'text/plain' })
          })
        ]);
        this.$root.$notify('Message copied to clipboard', 'success');
      } catch {
        try {
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
        await this.saveCurrentChat(false);
      }
    },
    async deleteMessagesBelow(index) {
      const messagesToDelete = this.messages.length - index - 1;
      if (messagesToDelete <= 0) return;

      const confirmMessage = `Delete ${messagesToDelete} message${messagesToDelete > 1 ? 's' : ''} below this one?`;
      if (confirm(confirmMessage)) {
        this.messages.splice(index + 1);
        await this.saveCurrentChat(false);
        this.$root.$notify(`Deleted ${messagesToDelete} message${messagesToDelete > 1 ? 's' : ''}`, 'success');
      }
    },
    openBranchModal(index) {
      this.branchModal.messageIndex = index;
      this.branchModal.show = true;
    },
    async createBranch(branchName) {
      try {
        const messageIndex = this.branchModal.messageIndex;
        this.branchModal.show = false;

        // Ensure chat is saved and has a chatId
        if (!this.chatId && !this.groupChatId) {
          await this.saveCurrentChat(false);
        }

        const saveFn = () => this.saveCurrentChat(false);

        const result = await this.branchOps.createBranch({
          branchName,
          messageIndex,
          branches: this.branches,
          currentBranch: this.currentBranch,
          messages: this.messages,
          mainBranch: this.mainBranch,
          chatId: this.chatId,
          groupChatId: this.groupChatId,
          isGroupChat: this.isGroupChat,
          saveFn
        });

        // Update local state from result
        this.branches = result.branches;
        this.mainBranch = result.mainBranch;
        this.currentBranch = result.currentBranch;
        this.messages = result.messages;

        // Save the chat to persist the new branch
        await saveFn();

        this.$root.$notify(`Branch "${branchName}" created`, 'success');
      } catch (error) {
        console.error('Failed to create branch:', error);
        this.$root.$notify(`Failed to create branch: ${error.message}`, 'error');
      }
    },
    async switchToBranch(branchId) {
      try {
        const result = await this.branchOps.switchToBranch({
          branchId,
          branches: this.branches,
          chatId: this.chatId,
          groupChatId: this.groupChatId,
          isGroupChat: this.isGroupChat,
          normalizeMessages: this.normalizeMessages
        });

        this.currentBranch = result.currentBranch;
        this.messages = result.messages;
        this.showBranchTree = false;
        this.$root.$notify(`Switched to branch "${result.branchName}"`, 'success');
        this.$nextTick(() => this.scrollToBottom());
      } catch (error) {
        console.error('Failed to switch branch:', error);
        this.$root.$notify('Failed to switch branch', 'error');
      }
    },
    async renameBranch(branchId, newName) {
      try {
        const result = await this.branchOps.renameBranch({
          branchId,
          newName,
          branches: this.branches,
          chatId: this.chatId,
          groupChatId: this.groupChatId,
          isGroupChat: this.isGroupChat
        });

        this.branches = result.branches;
        this.$root.$notify(`Branch renamed to "${newName}"`, 'success');
      } catch (error) {
        console.error('Failed to rename branch:', error);
        this.$root.$notify('Failed to rename branch', 'error');
      }
    },
    async deleteBranchFromTree(branchId, deleteChildren) {
      try {
        const result = await this.branchOps.deleteBranch({
          branchId,
          deleteChildren,
          branches: this.branches,
          currentBranch: this.currentBranch,
          mainBranch: this.mainBranch,
          chatId: this.chatId,
          groupChatId: this.groupChatId,
          isGroupChat: this.isGroupChat,
          normalizeMessages: this.normalizeMessages
        });

        this.branches = result.branches;
        if (result.messages) {
          this.currentBranch = result.currentBranch;
          this.messages = result.messages;
          this.$nextTick(() => this.scrollToBottom());
        }

        this.$root.$notify(`Branch deleted`, 'success');
      } catch (error) {
        console.error('Failed to delete branch:', error);
        this.$root.$notify(`Failed to delete branch: ${error.message}`, 'error');
      }
    },
    async showAvatarMenu(event, message, index) {
      // For assistant messages, open quick edit modal directly
      if (message.role === 'assistant') {
        const characterFilename = message.characterFilename || this.characterFilename;

        // Don't allow editing narrator
        if (characterFilename === '__narrator__') {
          this.$root.$notify('Narrator has no character card', 'info');
          return;
        }

        try {
          this.quickEditFilename = characterFilename;
          this.quickEditCharacter = await this.api.getCharacter(characterFilename);
          this.showQuickEdit = true;
        } catch (error) {
          console.error('Error loading character:', error);
          this.$root.$notify('Error loading character', 'error');
        }
        return;
      }

      // For user messages, show the avatar menu (for persona options)
      const rect = event.target.getBoundingClientRect();
      this.avatarMenu.x = rect.right + 10;
      this.avatarMenu.y = rect.top;
      this.avatarMenu.message = message;
      this.avatarMenu.messageIndex = index;
      this.avatarMenu.characterName = this.persona.nickname || this.persona.name;
      this.avatarMenu.characterFilename = null;

      this.avatarMenu.show = true;

      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeAvatarMenu, { once: true });
      }, 0);
    },
    closeAvatarMenu() {
      // Remove document listener explicitly - it may not have fired if click was on menu item
      // (menu items use @click.stop which prevents bubbling to document)
      document.removeEventListener('click', this.closeAvatarMenu);
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
          this.viewingCharacter = await this.api.getCharacter(this.avatarMenu.characterFilename);
          this.showCharacterCard = true;
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
          const characterData = await this.api.getCharacter(this.avatarMenu.characterFilename);
          // Open character editor in a new tab
          this.$emit('open-tab', 'character-editor', {
            character: {
              ...characterData,
              filename: this.avatarMenu.characterFilename,
              image: `/api/characters/${this.avatarMenu.characterFilename}/image`
            }
          }, `Edit: ${characterData.data.name}`, false);
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
    async openFullCharacterEditor() {
      // Close quick edit modal and open full editor in a new tab
      this.showQuickEdit = false;

      if (this.quickEditFilename && this.quickEditCharacter) {
        this.$emit('open-tab', 'character-editor', {
          character: {
            ...this.quickEditCharacter,
            filename: this.quickEditFilename,
            image: `/api/characters/${this.quickEditFilename}/image`
          }
        }, `Edit: ${this.quickEditCharacter.data.name}`, false);
      }
    },
    onCharacterUpdated(updatedCharacter) {
      // Update local character data if it matches
      if (this.character && this.quickEditFilename === this.characterFilename) {
        this.character = updatedCharacter;
        this.characterName = updatedCharacter.data.name;
      }

      // Update group chat character if applicable
      if (this.isGroupChat) {
        const index = this.groupChatCharacters.findIndex(c => c.filename === this.quickEditFilename);
        if (index !== -1) {
          this.groupChatCharacters[index] = {
            ...this.groupChatCharacters[index],
            name: updatedCharacter.data.name,
            data: updatedCharacter
          };
        }
      }
    },
    async loadAvailablePresets() {
      try {
        const presets = await this.api.getPresets();
        this.availablePresets = presets;
      } catch (error) {
        console.error('Failed to load available presets:', error);
      }
    },
    async loadAvailablePersonas() {
      try {
        const personas = await this.api.getPersonas();
        this.availablePersonas = personas;
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
        const preset = await this.api.getPreset(filename);
        this.applyPreset(preset);
      } catch (error) {
        console.error('Failed to load preset:', error);
        this.$root.$notify('Failed to load preset', 'error');
      }
    },
    async handlePersonaChange(personaFilename) {
      if (!personaFilename) return;

      try {
        const personas = await this.api.getPersonas();
        const selectedPersona = personas.find(p => p._filename === personaFilename || p.name === personaFilename);

        if (selectedPersona) {
          this.onPersonaSaved(selectedPersona);
        } else if (personaFilename === 'User' || personaFilename === 'default.json') {
          this.onPersonaSaved({ name: 'User', avatar: null, _filename: 'default.json' });
        } else {
          this.$root.$notify(`Persona not found: ${personaFilename}`, 'warning');
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
      // Force Vue reactivity by creating a completely new object
      this.persona = {
        name: persona.name || 'User',
        nickname: persona.nickname || '',
        avatar: persona.avatar || null,
        description: persona.description || '',
        tagBindings: persona.tagBindings || [],
        characterBindings: persona.characterBindings || [],
        _filename: persona._filename || (persona.name === 'User' ? 'default.json' : `${persona.name}.json`)
      };

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
      if (!confirm('This will create a new chat with a summary of the current conversation. Continue?')) return;

      try {
        this.$root.$notify('Generating summary...', 'info');

        // Get or build preset
        let preset = this.currentPresetFilename ? await this.api.getPreset(this.currentPresetFilename).catch(() => null) : null;
        if (!preset?.model) {
          if (!this.settings?.model) throw new Error('No preset selected. Please select a preset first.');
          preset = this.summaryChat.buildPresetFromSettings(this.settings, this.currentPresetName);
        }

        // Build request
        const requestData = this.summaryChat.buildSummaryRequest({
          messages: this.messages,
          chatTitle: this.chatDisplayTitle || (this.isGroupChat ? 'Group Chat' : this.character?.data?.name || 'Chat'),
          preset,
          context: {
            charName: this.isGroupChat ? 'Character' : (this.character?.data?.name || 'Character'),
            charNickname: this.isGroupChat ? '' : (this.character?.data?.nickname || ''),
            userName: this.persona?.name || 'User'
          },
          isGroupChat: this.isGroupChat,
          groupChatCharacters: this.groupChatCharacters,
          characterFilename: this.characterFilename // Pass filename explicitly
        });

        const response = await fetch('/api/chat/summarize-and-continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        if (!response.ok) throw new Error('Failed to start summary generation');

        let streamingMessage = null;
        await this.summaryChat.processSummaryStream(response.body.getReader(), {
          onInit: async (event) => {
            const { chatData, narrator } = event;
            this.messages = [];
            this.chatId = null;
            this.groupChatId = null;
            this.chatDisplayTitle = chatData.title;

            if (!this.conversationGroup) {
              this.conversationGroup = chatData.characterFilenames?.length > 0
                ? this.getConversationGroupId(chatData.characterFilenames)
                : this.generateUUID();
            }

            const characters = [];
            // Filter out null/undefined filenames
            const validFilenames = (chatData.characterFilenames || []).filter(f => f);
            const shouldBeGroupChat = validFilenames.length > 1;
            this.isGroupChat = shouldBeGroupChat;
            for (const filename of validFilenames) {
              try {
                const charData = await this.api.getCharacter(filename);
                characters.push({ filename, name: charData.data.name, data: charData.data });
              } catch (err) { console.error(`Failed to load character ${filename}:`, err); }
            }

            if (shouldBeGroupChat) {
              this.groupChatCharacters = characters;
              this.groupChatStrategy = this.groupChatStrategy || 'join';
              this.groupChatExplicitMode = this.groupChatExplicitMode || false;
              this.groupChatName = '';
              this.groupChatTags = this.groupChatTags || [];
            } else {
              this.character = characters[0] ? { data: characters[0].data, filename: characters[0].filename } : null;
            }

            streamingMessage = this.summaryChat.createStreamingMessage(narrator, chatData.timestamp);
            this.messages.push(streamingMessage);

            // Add the kept messages (ones that weren't summarized) after the narrator summary
            if (chatData.keptMessages && chatData.keptMessages.length > 0) {
              this.messages.push(...chatData.keptMessages);
            }

            this.narratorInfo = narrator;
            this.updateTabData();
          },
          onChunk: (event) => {
            if (streamingMessage) {
              streamingMessage.content += event.content;
              streamingMessage.swipes[0] = streamingMessage.content;
              this.$forceUpdate();
            }
          },
          onComplete: async (event) => {
            if (streamingMessage && event.message) {
              streamingMessage.content = event.message.content;
              streamingMessage.swipes = event.message.swipes;
            }
            try {
              if (this.isGroupChat) await this.saveGroupChat(false);
              else await this.saveChat(false);
              this.updateTabData();
              this.$root.$notify('Summary complete! Chat continued with narrator.', 'success');
            } catch (saveError) {
              console.error('Failed to save chat:', saveError);
              this.$root.$notify('Summary complete, but failed to save chat', 'warning');
            }
          },
          onError: (event) => { throw new Error(event.error); }
        });
      } catch (error) {
        console.error('Failed to start new chat from summary:', error);
        this.$root.$notify(`Failed to generate summary: ${error.message}`, 'error');
      }
    },
    async loadChatHistory() {
      try {
        if (this.isGroupChat) {
          // Load group chat history
          const allGroupChats = await this.api.getGroupChats();

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
          const allChats = await this.api.getChats();

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
      // Just return all chats sorted by timestamp (flatten, no grouping)
      return chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    },
    async loadChatFromHistory(chat) {
      // Handle both branch-based structure and old flat structure
      if (chat.branches && chat.mainBranch) {
        this.branches = chat.branches;
        this.mainBranch = chat.mainBranch;
        this.currentBranch = chat.currentBranch || chat.mainBranch;

        // Load messages from current branch
        const branch = this.branches[this.currentBranch];
        this.messages = this.normalizeMessages(branch?.messages || []);
      } else {
        // Old format
        this.messages = this.normalizeMessages(chat.messages || []);
      }

      // Set display title from chat data
      this.chatDisplayTitle = chat.title || null;

      // Load persona if saved in chat
      if (chat.personaFilename) {
        await this.handlePersonaChange(chat.personaFilename);
      }

      // Detect group chats (explicit flag or presence of characters/characterFilenames)
      const isGroupChat = chat.isGroupChat || chat.characters || chat.characterFilenames;

      if (isGroupChat) {
        this.isGroupChat = true;
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
          await this.api.deleteGroupChat(filename);
        } else {
          await this.api.deleteChat(filename);
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
    scrollToBottom(force = false) {
      // Batch scroll calls to prevent excessive updates
      if (this.scrollToBottomPending && !force) {
        return;
      }

      this.scrollToBottomPending = true;
      this.$nextTick(() => {
        this.scrollToBottomPending = false;

        const container = this.$refs.messageList?.getMessagesContainer();
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

      const container = this.$refs.messageList?.getMessagesContainer();
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
        const lorebooks = await this.api.getLorebooks();
        this.lorebooks = lorebooks;

        // Clean up selectedLorebookFilenames: remove any that don't exist anymore
        const validFilenames = this.lorebooks.map(l => l.filename);
        const originalLength = this.selectedLorebookFilenames.length;

        // Use guard flag to prevent watcher recursion
        this.isUpdatingLorebooks = true;
        this.selectedLorebookFilenames = this.selectedLorebookFilenames.filter(filename =>
          validFilenames.includes(filename)
        );
        this.isUpdatingLorebooks = false;

        // If we removed any, update localStorage (watcher is disabled, so do it manually)
        if (this.selectedLorebookFilenames.length < originalLength) {
          const manuallySelected = this.selectedLorebookFilenames.filter(
            filename => !this.autoSelectedLorebookFilenames.includes(filename)
          );
          localStorage.setItem('manuallySelectedLorebooks', JSON.stringify(manuallySelected));
        }
      } catch (error) {
        console.error('Failed to load lorebooks:', error);
      }
    },
    getLorebook(filename) {
      return this.lorebooks.find(l => l.filename === filename);
    },
    updateBasicDebugInfo(messages) {
      const info = this.debugData.calculateBasicDebugInfo(messages);
      Object.assign(this.debugInfo, info);
    },
    loadDebugDataFromStorage() {
      const chatKey = this.isGroupChat ? this.groupChatId : this.chatId;
      this.debugData.loadFromStorage(chatKey);
    },
    saveDebugData(requestBody, debugInfoFromServer) {
      // Build character info using composable
      const characterInfo = this.debugData.buildCharacterInfo({
        isGroupChat: this.isGroupChat,
        groupChatStrategy: this.groupChatStrategy,
        currentSpeaker: this.currentSpeaker,
        groupChatCharacters: this.groupChatCharacters,
        character: this.character,
        characterFilename: this.characterFilename
      });

      // Build and store debug data using composable
      this.currentDebugData = this.debugData.buildDebugData({
        requestBody,
        debugInfoFromServer,
        basicDebugInfo: this.debugInfo,
        persona: this.persona,
        characterInfo
      });
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
        const result = await this.api.saveLorebook(lorebook);

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
        const lorebooks = await this.api.getLorebooks();
        

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
                // Use guard flag to prevent watcher recursion
                this.isUpdatingLorebooks = true;
                this.selectedLorebookFilenames.push(lorebook.filename);
                this.isUpdatingLorebooks = false;
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
        const characters = await this.api.getCharacters();
        this.allCharacters = characters;
      } catch (error) {
        console.error('Failed to load all characters:', error);
      }
    },

    async loadGroupChat(groupChatId) {
      try {
        const result = await this.groupChatOps.loadGroupChat({
          groupChatId,
          api: this.api,
          normalizeMessages: this.normalizeMessages
        });

        this.groupChatCharacters = result.characters;
        this.groupChatStrategy = result.strategy;
        this.groupChatExplicitMode = result.explicitMode;
        this.groupChatName = result.name;
        this.groupChatTags = result.tags;
        this.conversationGroup = result.conversationGroup;
        this.messages = result.messages;

        if (result.branches) {
          this.branches = result.branches;
          this.mainBranch = result.mainBranch;
          this.currentBranch = result.currentBranch;
        }

        if (result.needsInitialization) {
          await this.initializeGroupChat();
        }

        this.loadDebugDataFromStorage();
      } catch (error) {
        console.error('Failed to load group chat:', error);
        await this.initializeGroupChat();
      }
    },

    async initializeGroupChat() {
      this.messages = await this.groupChatOps.initializeGroupChat({
        characters: this.groupChatCharacters,
        api: this.api
      });
    },

    async saveGroupChat(showNotification = true) {
      try {
        const result = await this.groupChatOps.saveGroupChat({
          groupChatId: this.groupChatId,
          characters: this.groupChatCharacters,
          strategy: this.groupChatStrategy,
          explicitMode: this.groupChatExplicitMode,
          name: this.groupChatName,
          tags: this.groupChatTags,
          conversationGroup: this.conversationGroup,
          displayTitle: this.chatDisplayTitle,
          messages: this.messages,
          branches: this.branches,
          mainBranch: this.mainBranch,
          currentBranch: this.currentBranch,
          api: this.api,
          getConversationGroupId: this.getConversationGroupId
        });

        this.groupChatId = result.filename;
        this.conversationGroup = result.conversationGroup;

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

    async saveCurrentChat(showNotification = false) {
      if (this.isGroupChat) {
        await this.saveGroupChat(showNotification);
      } else {
        await this.saveChat(showNotification);
      }
    },

    async convertToGroupChat() {
      if (!this.character) return;

      const characterFilename = this.tabData?.characterId || this.$route?.query?.character;
      const result = this.groupChatOps.convertToGroupChat({
        character: this.character,
        characterFilename,
        messages: this.messages
      });

      this.isGroupChat = result.isGroupChat;
      this.groupChatCharacters = result.characters;
      this.groupChatStrategy = result.strategy;
      this.messages = result.messages;

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
      const result = this.groupChatOps.moveCharacterUp(index, this.groupChatCharacters);
      if (result) {
        this.groupChatCharacters = result;
        this.saveGroupChat();
      }
    },

    moveCharacterDown(index) {
      const result = this.groupChatOps.moveCharacterDown(index, this.groupChatCharacters);
      if (result) {
        this.groupChatCharacters = result;
        this.saveGroupChat();
      }
    },

    async removeCharacterFromGroup(index) {
      if (!confirm('Remove this character from the group chat?')) return;

      const result = this.groupChatOps.removeCharacterFromGroup({
        index,
        characters: this.groupChatCharacters
      });

      if (!result.success) {
        this.$root.$notify(result.error, 'error');
        return;
      }

      this.groupChatCharacters = result.characters;
      await this.saveGroupChat();
    },

    async addCharacterToGroup(characterFilename) {
      const newChar = this.groupChatOps.addCharacterToGroup({
        characterFilename,
        allCharacters: this.allCharacters,
        currentCharacters: this.groupChatCharacters
      });

      if (!newChar) return;

      this.groupChatCharacters.push(newChar);
      await this.saveGroupChat();
      this.$root.$notify(`Added ${newChar.name} to group`, 'success');
    },

    buildGroupChatContext(upToMessageIndex = null) {
      // Delegate to composable
      const speakerFilename = this.nextSpeaker || this.currentSpeaker;
      return this.contextBuilder.buildGroupChatContext({
        settings: this.settings,
        groupChatCharacters: this.groupChatCharacters,
        strategy: this.groupChatStrategy,
        speakerFilename,
        persona: this.persona,
        messages: this.messages,
        upToMessageIndex
      });
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
    },

    // Generate a deterministic conversation group ID based on character filenames
    // This ensures all group chats with the same characters share the same conversationGroup
    getConversationGroupId(characterFilenames) {
      if (!characterFilenames || characterFilenames.length === 0) {
        return this.generateUUID(); // Fallback to random UUID
      }

      // Sort filenames to ensure order doesn't matter
      const sortedFilenames = [...characterFilenames].sort().join('|');

      // Simple hash function to create a deterministic "UUID"
      let hash = 0;
      for (let i = 0; i < sortedFilenames.length; i++) {
        const char = sortedFilenames.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Convert hash to hex and format as UUID
      const hex = Math.abs(hash).toString(16).padStart(8, '0');
      return `gc-${hex}-${sortedFilenames.length}-xxxx-xxxxxxxxxxxx`.replace(/[x]/g, () => {
        const r = Math.random() * 16 | 0;
        return r.toString(16);
      });
    }
  }
}
</script>

<style scoped src="./ChatView.styles.css"></style>
