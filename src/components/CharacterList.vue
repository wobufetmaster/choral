<template>
  <div class="character-list">
    <div class="header">
      <div class="header-top">
        <h1>Choral</h1>
        <button @click="showHeaderActions = !showHeaderActions" class="header-toggle-mobile">
          <span>☰</span>
          <span class="toggle-arrow">{{ showHeaderActions ? '▲' : '▼' }}</span>
        </button>
      </div>
      <div class="actions" :class="{ 'actions-collapsed': !showHeaderActions }">
        <input
          type="file"
          ref="fileInput"
          accept=".png"
          @change="uploadCharacter"
          style="display: none"
        />
        <!-- Character Actions -->
        <div class="action-group">
          <button @click="$refs.fileInput.click()">📥 Import Character</button>
          <button @click="createNewCharacter">➕ Create New</button>
          <button @click="showGroupChatCreator = true">👥 Create Group Chat</button>
        </div>

        <!-- Management -->
        <div class="action-group">
          <button @click="$emit('open-tab', 'presets', {}, 'Presets', false)">⚙️ Presets</button>
          <button @click="$emit('open-tab', 'personas', {}, 'Personas', false)">👤 Personas</button>
          <button @click="$emit('open-tab', 'lorebooks', {}, 'Lorebooks', false)">📚 Lorebooks</button>
        </div>

        <!-- System -->
        <div class="action-group">
          <div class="dropdown-container">
            <button @click="showAdvancedDropdown = !showAdvancedDropdown" class="dropdown-trigger">
              ⚙️ Settings
              <span class="dropdown-arrow">{{ showAdvancedDropdown ? '▲' : '▼' }}</span>
            </button>
            <div v-if="showAdvancedDropdown" class="dropdown-menu" @click="showAdvancedDropdown = false">
              <button @click="$emit('open-tab', 'settings', {}, 'Core Settings', false)" class="dropdown-item">⚙️ Core Settings</button>
              <button @click="$emit('open-tab', 'tool-settings', {}, 'Tool Settings', false)" class="dropdown-item">🔧 Tool Settings</button>
              <button @click="$emit('open-tab', 'bookkeeping-settings', {}, 'Bookkeeping', false)" class="dropdown-item">📊 Bookkeeping</button>
            </div>
          </div>
        </div>

        <!-- Help -->
        <div class="action-group">
          <button @click="openDocs">📖 Docs</button>
        </div>
      </div>
    </div>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        placeholder="Search characters by name or tag..."
        type="text"
      />

      <div class="filters-row">
        <div class="sort-section">
          <span class="filter-label">Sort by:</span>
          <select v-model="sortBy" class="sort-select">
            <option value="recent">Recent Chats</option>
            <option value="amount">Amount of Chats</option>
            <option value="created">Date Created</option>
            <option value="random">Random</option>
          </select>
        </div>

        <div v-if="allTags.length > 0" class="tag-filter">
          <div class="tag-filter-header">
            <div class="tag-filter-left">
              <span class="filter-label">Filter by tag:</span>
              <button @click="autoTagAll" :disabled="isAutoTaggingAll" class="auto-tag-all-btn">
                {{ isAutoTaggingAll ? 'Auto-tagging...' : '✨ Auto-tag All' }}
              </button>
              <button @click="randomizeAllGrayColors" class="randomize-all-btn">
                🎨 Randomize Gray Colors
              </button>
            </div>
            <button v-if="selectedTags.length > 0" @click="clearAllTags" class="clear-tags-btn">Clear All</button>
          </div>
          <div class="filter-tags">
            <button
              v-for="tag in allTags"
              :key="tag"
              :class="['filter-tag', { active: selectedTags.some(t => normalizeTag(t) === normalizeTag(tag)) }]"
              :style="selectedTags.some(t => normalizeTag(t) === normalizeTag(tag)) ? { background: getTagColor(tag), borderColor: getTagColor(tag), color: 'white' } : { borderColor: getTagColor(tag), color: getTagColor(tag) }"
              @click="toggleTagFilter(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="characters-grid">
      <!-- Group Chats -->
      <div
        v-for="group in filteredGroupChats"
        :key="'group-' + group.filename"
        class="character-card group-chat-card"
      >
        <div class="group-avatars" @click="startGroupChat(group)">
          <img
            v-for="(char, idx) in group.characters.slice(0, 4)"
            :key="idx"
            :src="`/api/characters/${char.filename}/image`"
            :alt="char.name"
            class="group-avatar"
            :style="{ zIndex: 4 - idx }"
          />
        </div>
        <div class="character-info" @click="startGroupChat(group)">
          <h3>👥 {{ getGroupChatName(group) }}</h3>
          <div v-if="group.tags && group.tags.length > 0" class="tags">
            <span
              v-for="tag in group.tags.slice(0, 3)"
              :key="tag"
              class="tag"
              :style="{ background: getTagColor(tag), color: 'white' }"
            >
              {{ tag }}
            </span>
            <span v-if="group.tags.length > 3" class="tag">+{{ group.tags.length - 3 }}</span>
          </div>
          <div v-else class="group-members">
            <span class="member-count">{{ group.characters.length }} members</span>
          </div>
        </div>
        <div class="character-actions">
          <button @click.stop="editGroupChatTags(group)" class="action-button" title="Edit Tags">🏷️</button>
          <button @click.stop="renameGroupChat(group)" class="action-button" title="Rename Group">✏️</button>
          <button @click.stop="deleteGroupChat(group)" class="action-button" title="Delete Group">🗑️</button>
        </div>
      </div>

      <!-- Regular Characters -->
      <div
        v-for="char in filteredCharacters"
        :key="char.filename"
        class="character-card"
      >
        <img
          :src="`/api/characters/${char.filename}/image`"
          :alt="char.name"
          class="character-avatar"
          @click="startChat(char)"
        />
        <div class="character-info" @click="startChat(char)">
          <h3>{{ char.name }}</h3>
          <div class="tags" v-if="char.tags && char.tags.length > 0">
            <span
              v-for="tag in char.tags.slice(0, 3)"
              :key="tag"
              class="tag"
              :style="{ background: getTagColor(tag), color: 'white' }"
            >
              {{ tag }}
            </span>
            <span v-if="char.tags.length > 3" class="tag">+{{ char.tags.length - 3 }}</span>
          </div>
          <div class="no-tags" v-else>
            <span class="tag-placeholder">No tags</span>
          </div>
        </div>
        <div class="character-actions">
          <button @click.stop="editTags(char)" class="action-button" title="Edit Tags">🏷️</button>
          <button @click.stop="editCharacter(char)" class="action-button" title="Edit Character">✏️</button>
          <button @click.stop="deleteCharacter(char)" class="action-button" title="Delete Character">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Character Editor Modal -->
    <CharacterEditor
      :is-open="isEditorOpen"
      :character="characterBeingEdited"
      @close="closeEditor"
      @save="saveCharacter"
    />

    <!-- Tag Editor Modal -->
    <div v-if="isTagEditorOpen" class="tag-editor-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Tags: {{ characterBeingTagged?.name }}</h3>
          <button @click="closeTagEditor" class="close-button">×</button>
        </div>
        <div class="tag-editor-content">
          <div class="current-tags">
            <h4>Current Tags:</h4>
            <div class="tag-list">
              <div
                v-for="(tag, index) in editingTags"
                :key="index"
                class="tag-item"
                :style="{ borderColor: getTagColor(tag.name) }"
              >
                <div class="tag-input-wrapper">
                  <input
                    v-model="tag.name"
                    type="text"
                    class="tag-input"
                    placeholder="Tag name"
                    @input="updateTagInputSuggestions(index)"
                    @focus="currentTagInputIndex = index"
                    @blur="clearTagInputSuggestions"
                  />
                  <div v-if="tagInputSuggestions.length > 0 && currentTagInputIndex === index" class="tag-input-suggestions">
                    <div
                      v-for="suggestion in tagInputSuggestions"
                      :key="suggestion"
                      @mousedown.prevent="applyTagSuggestion(index, suggestion)"
                      class="tag-input-suggestion"
                    >
                      {{ suggestion }}
                    </div>
                  </div>
                </div>
                <input
                  v-model="tag.color"
                  type="color"
                  class="color-picker"
                  :title="tag.color"
                />
                <button @click="removeTag(index)" class="remove-tag-btn">×</button>
              </div>
              <button @click="addTag" class="add-tag-btn">+ Add Tag</button>
            </div>
          </div>

          <div class="tag-suggestions">
            <h4>Available Tags:</h4>
            <div class="suggestion-tags">
              <button
                v-for="tag in availableTags"
                :key="tag"
                class="suggestion-tag"
                :style="{ borderColor: getTagColor(tag), color: getTagColor(tag) }"
                @click="addExistingTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>

          <div class="auto-tag-section">
            <button @click="autoGenerateTags" class="auto-tag-btn" :disabled="isAutoTagging">
              {{ isAutoTagging ? 'Generating...' : '✨ Auto-Generate Tags' }}
            </button>
          </div>

          <div class="modal-actions">
            <button @click="saveTagChanges" class="btn-primary">Save Tags</button>
            <button @click="closeTagEditor" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Chat Creator Modal -->
    <div v-if="showGroupChatCreator" class="group-chat-creator-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create Group Chat</h3>
          <button @click="closeGroupChatCreator" class="close-button">×</button>
        </div>
        <div class="group-chat-creator-content">
          <p class="instructions">Select characters for the group chat (minimum 2):</p>

          <!-- Search and Filter -->
          <div class="group-chat-filters">
            <input
              v-model="groupChatSearchQuery"
              placeholder="Search characters by name or tag..."
              type="text"
              class="group-chat-search"
            />

            <div v-if="allTags.length > 0" class="group-chat-tag-filter">
              <span class="filter-label">Filter by tag:</span>
              <button v-if="groupChatSelectedTags.length > 0" @click="clearGroupChatTags" class="clear-tags-btn">Clear All</button>
              <div class="filter-tags">
                <button
                  v-for="tag in allTags"
                  :key="tag"
                  :class="['filter-tag', { active: groupChatSelectedTags.some(t => normalizeTag(t) === normalizeTag(tag)) }]"
                  :style="groupChatSelectedTags.some(t => normalizeTag(t) === normalizeTag(tag)) ? { background: getTagColor(tag), borderColor: getTagColor(tag), color: 'white' } : { borderColor: getTagColor(tag), color: getTagColor(tag) }"
                  @click="toggleGroupChatTagFilter(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>

          <div class="character-selector-list">
            <div
              v-for="char in filteredCharactersForGroupChat"
              :key="char.filename"
              :class="['selectable-character', { selected: selectedForGroup.includes(char.filename) }]"
              @click="toggleCharacterSelection(char.filename)"
            >
              <input
                type="checkbox"
                :checked="selectedForGroup.includes(char.filename)"
                class="character-checkbox"
              />
              <img
                :src="`/api/characters/${char.filename}/image`"
                :alt="char.name"
                class="character-thumb"
              />
              <span class="character-name-select">{{ char.name }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button
              @click="createGroupChat"
              :disabled="selectedForGroup.length < 2"
              class="btn-primary"
            >
              Create Group ({{ selectedForGroup.length }} selected)
            </button>
            <button @click="closeGroupChatCreator" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="confirm-modal">
      <div class="modal-content confirm-content">
        <div class="modal-header">
          <h3>{{ confirmTitle }}</h3>
        </div>
        <div class="confirm-body">
          <p>{{ confirmMessage }}</p>
        </div>
        <div class="modal-actions">
          <button @click="confirmAction" class="btn-danger">{{ confirmButtonText }}</button>
          <button @click="cancelConfirm" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Auto-tag Progress Modal -->
    <div v-if="showAutoTagProgress" class="confirm-modal">
      <div class="modal-content confirm-content">
        <div class="modal-header">
          <h3>Auto-tagging Characters</h3>
        </div>
        <div class="confirm-body">
          <p>Processing {{ autoTagCurrentIndex + 1 }} of {{ autoTagTotal }} characters...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: autoTagProgress + '%' }"></div>
          </div>
          <p class="current-character">{{ autoTagCurrentCharacter }}</p>
        </div>
      </div>
    </div>

    <div v-if="filteredCharacters.length === 0 && filteredGroupChats.length === 0" class="empty-state">
      <p>No characters found. Import a character card to get started.</p>
    </div>
  </div>
</template>

<script>
import CharacterEditor from './CharacterEditor.vue'
import { useApi } from '../composables/useApi.js';

export default {
  name: 'CharacterList',
  components: {
    CharacterEditor
  },
  setup() {
    const api = useApi();
    return { api };
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
      characters: [],
      groupChats: [],
      searchQuery: '',
      selectedTags: [],
      sortBy: 'recent',
      chatMetadata: {}, // Store chat counts and timestamps per character/group
      randomSeed: Math.random(), // For consistent random sorting
      isEditorOpen: false,
      characterBeingEdited: null,
      isTagEditorOpen: false,
      characterBeingTagged: null,
      editingTags: [],
      isAutoTagging: false,
      tagColors: {}, // Store tag colors: { "normalized-tag": "#color" }
      tagInputSuggestions: [], // Autocomplete suggestions for tag inputs
      currentTagInputIndex: null, // Track which tag input is focused
      showGroupChatCreator: false,
      selectedForGroup: [],
      groupChatSearchQuery: '',
      groupChatSelectedTags: [],
      // Confirmation modal
      showConfirmModal: false,
      confirmTitle: '',
      confirmMessage: '',
      confirmButtonText: 'Confirm',
      confirmCallback: null,
      // Auto-tag all
      isAutoTaggingAll: false,
      showAutoTagProgress: false,
      autoTagCurrentIndex: 0,
      autoTagTotal: 0,
      autoTagCurrentCharacter: '',
      // Dropdown
      showAdvancedDropdown: false,
      // Mobile header toggle
      showHeaderActions: false
    }
  },
  computed: {
    filteredCharacters() {
      try {
        let filtered = this.characters;

        // Filter by selected tags (must have ALL selected tags - case insensitive)
        if (this.selectedTags.length > 0) {
          filtered = filtered.filter(char => {
            if (!char || !char.tags) return false;
            return this.selectedTags.every(selectedTag =>
              char.tags?.some(charTag =>
                charTag && this.normalizeTag(charTag) === this.normalizeTag(selectedTag)
              )
            );
          });
        }

        // Filter by search query
        if (this.searchQuery) {
          const query = this.searchQuery.toLowerCase();
          filtered = filtered.filter(char => {
            if (!char || !char.name) return false;
            const nameMatch = char.name.toLowerCase().includes(query);
            const tagMatch = char.tags?.some(tag => {
              if (!tag || typeof tag !== 'string') return false;
              return tag.toLowerCase().includes(query);
            });
            return nameMatch || tagMatch;
          });
        }

        // Sort characters
        return this.sortCharacters(filtered);
      } catch (error) {
        console.error('[CharacterList] Error in filteredCharacters:', error);
        return [];
      }
    },
    filteredGroupChats() {
      // Group chats by character composition (sorted filenames) to deduplicate
      // This fixes issues where conversationGroup IDs differ due to random components
      const groupedByCharacters = {};

      for (const chat of this.groupChats) {
        // Create a canonical key from sorted character filenames
        const characterKey = (chat.characterFilenames || []).slice().sort().join('|');

        // If we haven't seen this character combination, or this chat is newer, keep it
        if (!groupedByCharacters[characterKey] ||
            (chat.timestamp || 0) > (groupedByCharacters[characterKey].timestamp || 0)) {
          groupedByCharacters[characterKey] = chat;
        }
      }

      // Convert back to array (only the most recent from each character combination)
      let filtered = Object.values(groupedByCharacters);

      // Filter by selected tags (must have ALL selected tags - case insensitive)
      if (this.selectedTags.length > 0) {
        filtered = filtered.filter(group =>
          this.selectedTags.every(selectedTag =>
            group.tags?.some(groupTag =>
              this.normalizeTag(groupTag) === this.normalizeTag(selectedTag)
            )
          )
        );
      }

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(group => {
          const groupName = this.getGroupChatName(group).toLowerCase();
          const matchesName = groupName.includes(query);
          const matchesTags = group.tags?.some(tag => tag.toLowerCase().includes(query));
          const matchesMemberNames = group.characters?.some(char =>
            char.name.toLowerCase().includes(query)
          );
          return matchesName || matchesTags || matchesMemberNames;
        });
      }

      return filtered;
    },
    allTags() {
      // Get all unique tags across all characters
      const tags = new Set();
      try {
        if (!this.characters || !Array.isArray(this.characters)) {
          return [];
        }
        this.characters.forEach(char => {
          if (!char || !char.tags) return;
          char.tags.forEach(tag => {
            if (!tag || typeof tag !== 'string') return;
            tags.add(tag);
          });
        });
        return Array.from(tags).sort();
      } catch (error) {
        console.error('[CharacterList] Error computing allTags:', error);
        return [];
      }
    },
    availableTags() {
      // Get tags from other characters that aren't already applied
      const currentTagsNormalized = this.editingTags.map(t => this.normalizeTag(t.name));
      return this.allTags.filter(tag =>
        !currentTagsNormalized.includes(this.normalizeTag(tag))
      );
    },
    autoTagProgress() {
      if (this.autoTagTotal === 0) return 0;
      return Math.round((this.autoTagCurrentIndex / this.autoTagTotal) * 100);
    },
    filteredCharactersForGroupChat() {
      let filtered = this.characters;

      // Filter by selected tags
      if (this.groupChatSelectedTags.length > 0) {
        filtered = filtered.filter(char => {
          if (!char || !char.tags) return false;
          return this.groupChatSelectedTags.every(selectedTag =>
            char.tags?.some(charTag =>
              charTag && this.normalizeTag(charTag) === this.normalizeTag(selectedTag)
            )
          );
        });
      }

      // Filter by search query
      if (this.groupChatSearchQuery) {
        const query = this.groupChatSearchQuery.toLowerCase();
        filtered = filtered.filter(char => {
          if (!char || !char.name) return false;
          const nameMatch = char.name.toLowerCase().includes(query);
          const tagMatch = char.tags?.some(tag => tag && tag.toLowerCase().includes(query));
          return nameMatch || tagMatch;
        });
      }

      return filtered;
    }
  },
  async mounted() {
    await this.loadCharacters();
    await this.loadGroupChats();
    await this.loadTagColors();
    await this.loadChatMetadata();
  },
  watch: {
    sortBy(newVal) {
      // Regenerate random seed when switching to random sort
      if (newVal === 'random') {
        this.randomSeed = Math.random();
      }
    }
  },
  methods: {
    async loadCharacters() {
      try {
        this.characters = await this.api.getCharacters();
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    async uploadCharacter(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Check for problematic characters in filename
      const problematicChars = /["':<>?*|\/\\]/;
      const hasProblematicChars = problematicChars.test(file.name);

      if (hasProblematicChars) {
        // Show warning about filename sanitization
        const originalName = file.name;
        const sanitizedName = this.sanitizeFilename(file.name);

        const message = `The filename "${originalName}" contains special characters that may cause sync issues.\n\nIt will be automatically renamed to: "${sanitizedName}"\n\nDo you want to continue?`;

        if (!confirm(message)) {
          event.target.value = '';
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        await this.api.saveCharacter(formData);

        this.loadCharacters();
        event.target.value = '';

        if (hasProblematicChars) {
          this.$root.$notify('Character imported and filename sanitized for compatibility', 'success');
        } else {
          this.$root.$notify('Character imported successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to upload character:', error);
        this.$root.$notify('Failed to upload character', 'error');
      }
    },
    sanitizeFilename(filename) {
      // Client-side preview of what the server will do
      const lastDot = filename.lastIndexOf('.');
      const ext = lastDot > 0 ? filename.substring(lastDot) : '';
      let nameWithoutExt = lastDot > 0 ? filename.substring(0, lastDot) : filename;

      nameWithoutExt = nameWithoutExt
        .replace(/"/g, '')
        .replace(/'/g, '')
        .replace(/:/g, '-')
        .replace(/[<>]/g, '')
        .replace(/[?*|]/g, '')
        .replace(/[\/\\]/g, '-')
        .trim();

      if (!nameWithoutExt) {
        nameWithoutExt = 'character';
      }

      return nameWithoutExt + ext;
    },
    toggleTagFilter(tag) {
      // Case-insensitive tag filter toggle
      const index = this.selectedTags.findIndex(t =>
        this.normalizeTag(t) === this.normalizeTag(tag)
      );
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(tag);
      }
    },
    clearAllTags() {
      this.selectedTags = [];
    },
    toggleGroupChatTagFilter(tag) {
      const index = this.groupChatSelectedTags.findIndex(t =>
        this.normalizeTag(t) === this.normalizeTag(tag)
      );
      if (index > -1) {
        this.groupChatSelectedTags.splice(index, 1);
      } else {
        this.groupChatSelectedTags.push(tag);
      }
    },
    clearGroupChatTags() {
      this.groupChatSelectedTags = [];
    },
    startChat(character) {
      this.$emit('open-tab', 'chat', {
        characterId: character.filename,
        characterName: character.name
      }, character.name);
    },
    createNewCharacter() {
      // Open character editor in a new tab for creating a new character
      this.$emit('open-tab', 'character-editor', {}, 'New Character', false);
    },
    async editCharacter(character) {
      // Need to fetch the full character card for editing
      try {
        const fullCard = await this.api.getCharacter(character.filename);

        // Open character editor in a new tab with the full card data
        this.$emit('open-tab', 'character-editor', {
          character: {
            ...fullCard,
            filename: character.filename,
            image: `/api/characters/${character.filename}/image`
          }
        }, `Edit: ${character.name}`, false);
      } catch (error) {
        console.error('Failed to load character for editing:', error);
      }
    },
    closeEditor() {
      this.isEditorOpen = false;
      this.characterBeingEdited = null;
    },
    async saveCharacter(characterData) {
      try {
        const { card, imageFile, originalFilename } = characterData;

        if (originalFilename) {
          // Update existing character
          const formData = new FormData();

          if (imageFile) {
            formData.append('file', imageFile);
          }
          formData.append('card', JSON.stringify(card));

          await this.api.updateCharacter(originalFilename, formData);

          this.$root.$notify('Character updated successfully', 'success');
        } else {
          // Create new character
          const formData = new FormData();

          if (imageFile) {
            formData.append('file', imageFile);
          }
          formData.append('card', JSON.stringify(card));

          await this.api.saveCharacter(formData);

          this.$root.$notify('Character created successfully', 'success');
        }

        this.closeEditor();
        await this.loadCharacters();
      } catch (error) {
        console.error('Failed to save character:', error);
        this.$root.$notify(`Failed to save character: ${error.message}`, 'error');
      }
    },
    async loadTagColors() {
      try {
        this.tagColors = await this.api.getTags();
      } catch (error) {
        console.error('Failed to load tag colors:', error);
      }
    },
    normalizeTag(tag) {
      if (!tag || typeof tag !== 'string') {
        return '';
      }
      return tag.toLowerCase().trim();
    },
    getTagColor(tag) {
      const normalized = this.normalizeTag(tag);
      return this.tagColors[normalized] || '#6b7280'; // Default gray color
    },
    editTags(character) {
      this.characterBeingTagged = character;
      // Initialize editing tags with current tags and their colors
      this.editingTags = (character.tags || []).map(tag => ({
        name: tag,
        color: this.getTagColor(tag)
      }));
      this.isTagEditorOpen = true;
    },
    closeTagEditor() {
      this.isTagEditorOpen = false;
      this.characterBeingTagged = null;
      this.editingTags = [];
      this.tagInputSuggestions = [];
      this.currentTagInputIndex = null;
    },
    generateRandomColor() {
      // Generate random vibrant color using HSL
      const hue = Math.floor(Math.random() * 360);
      const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
      const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%

      // Convert HSL to RGB to HEX
      const h = hue / 360;
      const s = saturation / 100;
      const l = lightness / 100;

      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
      const g = Math.round(hue2rgb(p, q, h) * 255);
      const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },
    addTag() {
      this.editingTags.push({ name: '', color: this.generateRandomColor() });
    },
    removeTag(index) {
      this.editingTags.splice(index, 1);
      // Auto-save when tag is removed
      this.autoSaveTagChanges();
    },
    addExistingTag(tag) {
      this.editingTags.push({
        name: tag,
        color: this.getTagColor(tag)
      });
      // Auto-save when tag is added
      this.autoSaveTagChanges();
    },
    updateTagInputSuggestions(index) {
      const tag = this.editingTags[index];
      if (!tag || !tag.name || !tag.name.trim()) {
        this.tagInputSuggestions = [];
        return;
      }

      const query = tag.name.toLowerCase();
      const currentTagsNormalized = this.editingTags.map(t => this.normalizeTag(t.name));

      this.tagInputSuggestions = this.allTags
        .filter(existingTag =>
          existingTag.toLowerCase().includes(query) &&
          !currentTagsNormalized.includes(this.normalizeTag(existingTag))
        )
        .slice(0, 5);
    },
    applyTagSuggestion(index, suggestion) {
      this.editingTags[index].name = suggestion;
      this.editingTags[index].color = this.getTagColor(suggestion);
      this.tagInputSuggestions = [];
      // Auto-save when tag is applied
      this.autoSaveTagChanges();
    },
    clearTagInputSuggestions() {
      // Small delay to allow click events to fire
      setTimeout(() => {
        this.tagInputSuggestions = [];
        this.currentTagInputIndex = null;
      }, 200);
    },
    async autoSaveTagChanges() {
      // Debounce auto-save
      if (this.autoSaveTimeout) {
        clearTimeout(this.autoSaveTimeout);
      }

      this.autoSaveTimeout = setTimeout(async () => {
        try {
          // Filter out empty tags and get unique tag names
          const tags = this.editingTags
            .filter(t => t.name && t.name.trim())
            .map(t => t.name.trim());

          // Update tag colors
          const updatedColors = {};
          this.editingTags.forEach(tag => {
            if (tag.name && tag.name.trim()) {
              const normalized = this.normalizeTag(tag.name);
              updatedColors[normalized] = tag.color;
            }
          });

          // Merge with existing colors
          this.tagColors = { ...this.tagColors, ...updatedColors };

          // Save tags to character or group chat
          if (this.characterBeingTagged.isGroupChat) {
            // Update group chat tags
            const updatedGroup = {
              ...this.characterBeingTagged,
              tags
            };
            delete updatedGroup.isGroupChat; // Remove temporary flag

            await this.api.saveGroupChat(updatedGroup);

            await this.loadGroupChats();
          } else {
            // Update character tags
            await this.api.updateCharacterTags(this.characterBeingTagged.filename, tags);

            await this.loadCharacters();
          }

          // Save tag colors
          await this.api.saveTags(this.tagColors);

          console.log('Tags auto-saved');
        } catch (error) {
          console.error('Failed to auto-save tags:', error);
        }
      }, 1000); // 1 second debounce
    },
    async saveTagChanges() {
      try {
        // Filter out empty tags and get unique tag names
        const tags = this.editingTags
          .filter(t => t.name.trim())
          .map(t => t.name.trim());

        // Update tag colors
        const updatedColors = {};
        this.editingTags.forEach(tag => {
          if (tag.name.trim()) {
            const normalized = this.normalizeTag(tag.name);
            updatedColors[normalized] = tag.color;
          }
        });

        // Merge with existing colors
        this.tagColors = { ...this.tagColors, ...updatedColors };

        // Save tags to character or group chat
        if (this.characterBeingTagged.isGroupChat) {
          // Update group chat tags
          const updatedGroup = {
            ...this.characterBeingTagged,
            tags
          };
          delete updatedGroup.isGroupChat; // Remove temporary flag

          await this.api.saveGroupChat(updatedGroup);

          await this.loadGroupChats();
        } else {
          // Update character tags
          await this.api.updateCharacterTags(this.characterBeingTagged.filename, tags);

          await this.loadCharacters();
        }

        // Save tag colors
        await this.api.saveTags(this.tagColors);

        this.$root.$notify('Tags updated successfully', 'success');
        this.closeTagEditor();
      } catch (error) {
        console.error('Failed to save tags:', error);
        this.$root.$notify('Failed to save tags', 'error');
      }
    },
    async autoGenerateTags() {
      if (this.isAutoTagging) return;

      try {
        this.isAutoTagging = true;
        const result = await this.api.autoGenerateCharacterTags(this.characterBeingTagged.filename);

        // Add generated tags to editing tags
        result.tags.forEach(tag => {
          const normalized = this.normalizeTag(tag.name);
          // Only add if not already present
          if (!this.editingTags.some(t => this.normalizeTag(t.name) === normalized)) {
            this.editingTags.push({
              name: tag.name,
              color: tag.color
            });
          }
        });

        this.$root.$notify('Tags generated successfully', 'success');
      } catch (error) {
        console.error('Failed to auto-generate tags:', error);
        this.$root.$notify(error.message || 'Failed to auto-generate tags', 'error');
      } finally {
        this.isAutoTagging = false;
      }
    },

    // Group chat methods
    async loadGroupChats() {
      try {
        this.groupChats = await this.api.getGroupChats();
      } catch (error) {
        console.error('Failed to load group chats:', error);
      }
    },

    getGroupChatName(group) {
      if (group.name) {
        return group.name;
      }
      const names = group.characters.map(c => c.name).join(', ');
      return names.length > 30 ? names.substring(0, 30) + '...' : names;
    },

    startGroupChat(group) {
      this.$emit('open-tab', 'group-chat', {
        groupChatId: group.filename,
        groupChatName: this.getGroupChatName(group)
      }, `👥 ${this.getGroupChatName(group)}`);
    },

    deleteGroupChat(group) {
      this.showConfirm(
        'Delete Group Chat',
        `Are you sure you want to delete "${this.getGroupChatName(group)}"? This action cannot be undone.`,
        'Delete',
        async () => {
          try {
            await this.api.deleteGroupChat(group.filename);
            await this.loadGroupChats();
            this.$root.$notify('Group chat deleted', 'success');
          } catch (error) {
            console.error('Failed to delete group chat:', error);
            this.$root.$notify('Failed to delete group chat', 'error');
          }
        }
      );
    },

    deleteCharacter(char) {
      this.showConfirm(
        'Delete Character',
        `Are you sure you want to delete "${char.name}"? This will also delete all associated chats. This action cannot be undone.`,
        'Delete',
        async () => {
          try {
            await this.api.deleteCharacter(char.filename);
            await this.loadCharacters();
            this.$root.$notify('Character deleted', 'success');
          } catch (error) {
            console.error('Failed to delete character:', error);
            this.$root.$notify('Failed to delete character', 'error');
          }
        }
      );
    },

    toggleCharacterSelection(filename) {
      const index = this.selectedForGroup.indexOf(filename);
      if (index > -1) {
        this.selectedForGroup.splice(index, 1);
      } else {
        this.selectedForGroup.push(filename);
      }
    },

    async createGroupChat() {
      if (this.selectedForGroup.length < 2) {
        this.$root.$notify('Select at least 2 characters', 'error');
        return;
      }

      try {
        // Build character array with full data
        const selectedCharacters = this.selectedForGroup.map(filename => {
          const char = this.characters.find(c => c.filename === filename);
          return {
            filename: char.filename,
            name: char.name,
            data: char.data
          };
        });

        // Generate deterministic conversationGroup based on character filenames
        const characterFilenames = selectedCharacters.map(c => c.filename).sort();
        const sortedFilenames = characterFilenames.join('|');
        let hash = 0;
        for (let i = 0; i < sortedFilenames.length; i++) {
          const char = sortedFilenames.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        const conversationGroup = `gc-${hex}-${characterFilenames.length}-xxxx-xxxxxxxxxxxx`.replace(/[x]/g, function(c) {
          const r = Math.random() * 16 | 0;
          return r.toString(16);
        });

        // Create the group chat
        const groupChat = {
          filename: `group_chat_${Date.now()}.json`,
          isGroupChat: true,
          characters: selectedCharacters,
          characterFilenames: characterFilenames,
          conversationGroup: conversationGroup,
          strategy: 'join',
          messages: [],
          timestamp: Date.now()
        };

        const result = await this.api.saveGroupChat(groupChat);

        // Navigate to the new group chat
        const groupName = selectedCharacters.map(c => c.name).join(', ');
        const displayName = groupName.length > 30 ? groupName.substring(0, 30) + '...' : groupName;

        this.$emit('open-tab', 'group-chat', {
          groupChatId: result.filename,
          groupChatName: displayName
        }, `👥 ${displayName}`, false);

        this.$root.$notify('Group chat created', 'success');
      } catch (error) {
        console.error('Failed to create group chat:', error);
        this.$root.$notify('Failed to create group chat', 'error');
      }
    },

    closeGroupChatCreator() {
      this.showGroupChatCreator = false;
      this.selectedForGroup = [];
      this.groupChatSearchQuery = '';
      this.groupChatSelectedTags = [];
    },

    renameGroupChat(group) {
      // For now, keep using prompt for rename since it needs input
      // Could be enhanced with a custom input modal later
      const currentName = group.name || group.characters.map(c => c.name).join(', ');
      const newName = prompt('Enter new group chat name:', currentName);

      if (newName === null) return; // User cancelled

      this.performRename(group, newName);
    },

    async performRename(group, newName) {
      try {
        const updatedGroup = {
          ...group,
          name: newName.trim()
        };

        await this.api.saveGroupChat(updatedGroup);

        await this.loadGroupChats();
        this.$root.$notify('Group chat renamed', 'success');
      } catch (error) {
        console.error('Failed to rename group chat:', error);
        this.$root.$notify('Failed to rename group chat', 'error');
      }
    },

    editGroupChatTags(group) {
      this.characterBeingTagged = {
        ...group,
        isGroupChat: true
      };
      this.editingTags = (group.tags || []).map(tag => ({
        name: tag,
        color: this.getTagColor(tag)
      }));
      this.isTagEditorOpen = true;
    },

    async loadChatMetadata() {
      try {
        // Load all chats to get metadata
        const [chats, groupChatsData] = await Promise.all([
          this.api.getChats(),
          this.api.getGroupChats()
        ]);

        const metadata = {};

        // Process regular character chats
        chats.forEach(chat => {
          const charFile = chat.characterFilename;
          if (!charFile) return;

          if (!metadata[charFile]) {
            metadata[charFile] = {
              count: 0,
              lastChatTimestamp: 0,
              isGroupChat: false
            };
          }

          metadata[charFile].count++;
          if (chat.timestamp > metadata[charFile].lastChatTimestamp) {
            metadata[charFile].lastChatTimestamp = chat.timestamp;
          }
        });

        // Process group chats
        groupChatsData.forEach(gc => {
          const key = `group_${gc.filename}`;
          metadata[key] = {
            count: 1, // Each group chat file is one "chat"
            lastChatTimestamp: gc.timestamp || 0,
            isGroupChat: true
          };
        });

        this.chatMetadata = metadata;
      } catch (error) {
        console.error('Failed to load chat metadata:', error);
      }
    },

    sortCharacters(characters) {
      const sorted = [...characters];

      switch (this.sortBy) {
        case 'recent':
          // Sort by most recent chat timestamp, characters with no chats go to bottom
          sorted.sort((a, b) => {
            const aTime = this.chatMetadata[a.filename]?.lastChatTimestamp || 0;
            const bTime = this.chatMetadata[b.filename]?.lastChatTimestamp || 0;
            return bTime - aTime;
          });
          break;

        case 'amount':
          // Sort by number of chats, descending
          sorted.sort((a, b) => {
            const aCount = this.chatMetadata[a.filename]?.count || 0;
            const bCount = this.chatMetadata[b.filename]?.count || 0;
            return bCount - aCount;
          });
          break;

        case 'created':
          // Sort by actual file creation time (newest first)
          sorted.sort((a, b) => {
            const aTime = a.createdAt || 0;
            const bTime = b.createdAt || 0;
            return bTime - aTime;
          });
          break;

        case 'random':
          // Consistent random sort using stored seed
          sorted.sort((a, b) => {
            const hash = (str) => {
              let h = 0;
              for (let i = 0; i < str.length; i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h = h & h;
              }
              return h;
            };
            const aHash = (hash(a.filename + this.randomSeed) % 10000) / 10000;
            const bHash = (hash(b.filename + this.randomSeed) % 10000) / 10000;
            return aHash - bHash;
          });
          break;

        default:
          // No sorting
          break;
      }

      return sorted;
    },

    // Confirmation modal helpers
    showConfirm(title, message, buttonText, callback) {
      this.confirmTitle = title;
      this.confirmMessage = message;
      this.confirmButtonText = buttonText;
      this.confirmCallback = callback;
      this.showConfirmModal = true;
    },

    async confirmAction() {
      if (this.confirmCallback) {
        await this.confirmCallback();
      }
      this.cancelConfirm();
    },

    cancelConfirm() {
      this.showConfirmModal = false;
      this.confirmTitle = '';
      this.confirmMessage = '';
      this.confirmButtonText = 'Confirm';
      this.confirmCallback = null;
    },

    async autoTagAll() {
      // Find all characters without tags
      const untaggedCharacters = this.characters.filter(char =>
        !char.tags || char.tags.length === 0
      );

      if (untaggedCharacters.length === 0) {
        this.$root.$notify('All characters already have tags!', 'info');
        return;
      }

      // Show confirmation dialog
      const count = untaggedCharacters.length;
      const message = count === 1
        ? 'This will auto-tag 1 untagged character. This may take a moment.'
        : `This will auto-tag ${count} untagged characters. This may take a while.`;

      this.showConfirm(
        'Auto-tag All Characters',
        message,
        'Start Auto-tagging',
        async () => {
          await this.performAutoTagAll(untaggedCharacters);
        }
      );
    },

    openDocs() {
      // Open documentation in a new tab
      window.open('/docs/index.html', '_blank');
    },

    async performAutoTagAll(characters) {
      this.isAutoTaggingAll = true;
      this.showAutoTagProgress = true;
      this.autoTagTotal = characters.length;
      this.autoTagCurrentIndex = 0;

      try {
        for (let i = 0; i < characters.length; i++) {
          const char = characters[i];
          this.autoTagCurrentIndex = i;
          this.autoTagCurrentCharacter = char.name;

          try {
            // Call the auto-tag API for this character
            const result = await this.api.autoGenerateCharacterTags(char.filename);

            // Apply the tags to the character
            const tags = result.tags.map(t => t.name);

            // Update tag colors
            const updatedColors = {};
            result.tags.forEach(tag => {
              const normalized = this.normalizeTag(tag.name);
              updatedColors[normalized] = tag.color;
            });
            this.tagColors = { ...this.tagColors, ...updatedColors };

            // Save tags to character
            await this.api.updateCharacterTags(char.filename, tags);

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            // Re-throw errors that should stop the process (like bookkeeping disabled)
            if (error.message && error.message.includes('Bookkeeping features are disabled')) {
              throw error;
            }
            console.error(`Error auto-tagging ${char.name}:`, error);
          }
        }

        // Save tag colors
        await this.api.saveTags(this.tagColors);

        // Reload characters to show updated tags
        await this.loadCharacters();

        this.$root.$notify(`Successfully auto-tagged ${characters.length} character${characters.length === 1 ? '' : 's'}!`, 'success');
      } catch (error) {
        console.error('Error during batch auto-tagging:', error);
        this.$root.$notify(error.message || 'Auto-tagging completed with some errors', 'error');
      } finally {
        this.isAutoTaggingAll = false;
        this.showAutoTagProgress = false;
        this.autoTagCurrentIndex = 0;
        this.autoTagTotal = 0;
        this.autoTagCurrentCharacter = '';
      }
    },

    async randomizeAllGrayColors() {
      const DEFAULT_GRAY = '#6b7280';
      let totalRandomized = 0;

      // Find all tags with gray color
      const grayTags = [];
      for (const [normalizedTag, color] of Object.entries(this.tagColors)) {
        if (color.toLowerCase() === DEFAULT_GRAY.toLowerCase()) {
          grayTags.push(normalizedTag);
        }
      }

      if (grayTags.length === 0) {
        this.$root.$notify('No gray tags found to randomize', 'info');
        return;
      }

      // Randomize each gray tag's color
      grayTags.forEach(normalizedTag => {
        this.tagColors[normalizedTag] = this.generateRandomColor();
        totalRandomized++;
      });

      // Save updated tag colors
      try {
        await this.api.saveTags(this.tagColors);

        this.$root.$notify(`Randomized ${totalRandomized} gray tag${totalRandomized === 1 ? '' : 's'}!`, 'success');

        // Reload to show updated colors
        await this.loadCharacters();
        await this.loadGroupChats();
      } catch (error) {
        console.error('Failed to randomize colors:', error);
        this.$root.$notify('Failed to randomize tag colors', 'error');
      }
    }
  }
}
</script>

<style scoped>
.character-list {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 100;
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.action-group {
  display: flex;
  gap: 8px;
  padding-right: 16px;
  border-right: 1px solid var(--border-color);
}

.action-group:last-child {
  border-right: none;
  padding-right: 0;
}

/* Dropdown Styles */
.dropdown-container {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-trigger:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.dropdown-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--hover-color);
  color: var(--accent-color);
}

/* Hide mobile toggle on desktop */
.header-toggle-mobile {
  display: none;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 768px) {
  .character-list {
    height: 100vh;
    overflow: hidden;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 8px;
    flex-shrink: 0;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .header h1 {
    font-size: 18px;
    margin: 0;
  }

  .header-toggle-mobile {
    display: flex !important;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .header-toggle-mobile:active {
    background: var(--bg-tertiary);
    transform: scale(0.98);
  }

  .toggle-arrow {
    font-size: 10px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-height: 1000px;
    overflow: hidden;
    transition: max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin-top 0.2s ease-in-out;
    opacity: 1;
    margin-top: 8px;
  }

  .actions-collapsed {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding-right: 0;
    border-right: none;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .action-group:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .action-group button,
  .action-group .dropdown-trigger {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    justify-content: center;
  }

  .search-bar {
    padding: 8px;
    flex-shrink: 0;
  }

  .search-bar input {
    margin-bottom: 6px;
    padding: 6px 8px;
    font-size: 14px;
  }

  .filters-row {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .sort-section {
    width: 100%;
  }

  .sort-select {
    flex: 1;
    padding: 6px 8px;
    font-size: 13px;
  }

  .tag-filter {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .filter-label {
    font-size: 13px;
  }

  .filter-tags {
    max-height: 60px;
    overflow-y: auto;
  }

  .characters-grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
    grid-template-columns: 1fr;
    gap: 10px;
    -webkit-overflow-scrolling: touch;
  }

  .character-card {
    padding: 10px;
  }

  .character-avatar {
    width: 44px;
    height: 44px;
  }

  .character-info h3 {
    font-size: 15px;
  }

  /* Make action buttons always visible on mobile for easier access */
  .character-actions {
    opacity: 1;
  }

  /* Adjust modal for mobile */
  .modal-content {
    max-height: 90vh;
    width: 95%;
  }

  .character-selector-list {
    max-height: 300px;
  }
}

.search-bar {
  padding: 16px 20px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-bottom: 1px solid var(--border-color);
}

.search-bar input {
  width: 100%;
  max-width: 600px;
  margin-bottom: 12px;
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.sort-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  min-width: 150px;
}

.sort-select:hover {
  border-color: var(--accent-color);
}

.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.tag-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tag-filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.auto-tag-all-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: var(--accent-color);
  color: white;
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.auto-tag-all-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.auto-tag-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.randomize-all-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: #8b5cf6;
  color: white;
  border: 1px solid #8b5cf6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.randomize-all-btn:hover {
  background: #7c3aed;
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.clear-tags-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.clear-tags-btn:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.filter-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
}

.filter-tag {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.filter-tag:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.filter-tag.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.characters-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-content: start;
}

.character-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.character-card:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color-hover, var(--border-color));
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.character-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.character-card:hover .character-actions {
  opacity: 1;
}

.action-button {
  padding: 4px 8px;
  font-size: 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.character-avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.character-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.character-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  color: var(--text-secondary);
}

.tag-placeholder {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.5;
  font-style: italic;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}


/* Tag Editor Modal */
.tag-editor-modal {
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
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
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

.tag-editor-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-tags h4,
.tag-suggestions h4 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
  color: var(--text-secondary);
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
}

.tag-input-wrapper {
  position: relative;
  flex: 1;
}

.tag-input {
  width: 100%;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.tag-input-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tag-input-suggestion {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--text-primary);
}

.tag-input-suggestion:hover {
  background: var(--hover-color);
}

.color-picker {
  width: 40px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.remove-tag-btn {
  padding: 0.25rem 0.5rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-tag-btn:hover {
  background-color: #b91c1c;
}

.add-tag-btn {
  padding: 0.5rem 1rem;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-tag-btn:hover {
  opacity: 0.9;
}

.suggestion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.suggestion-tag {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  background: transparent;
  border: 1px solid;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-tag:hover {
  background: var(--hover-color);
  opacity: 0.8;
}

.auto-tag-section {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.auto-tag-btn {
  padding: 0.625rem 1.25rem;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9375rem;
}

.auto-tag-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.auto-tag-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
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
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: var(--hover-color);
}

.btn-danger {
  padding: 0.5rem 1rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-danger:hover {
  background-color: #b91c1c;
}

/* Confirmation Modal */
.confirm-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.confirm-content {
  max-width: 500px;
  width: 90%;
}

.confirm-body {
  padding: 1rem 0;
}

.confirm-body p {
  margin: 0;
  line-height: 1.5;
  color: var(--text-primary);
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin: 1rem 0;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.current-character {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
}

/* Group Chat Styles */

.group-chat-card {
  border: 2px solid var(--accent-color);
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
}

.group-avatars {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.group-avatar {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--bg-secondary);
}

.group-avatar:nth-child(1) {
  top: 0;
  left: 0;
}

.group-avatar:nth-child(2) {
  top: 0;
  right: 0;
}

.group-avatar:nth-child(3) {
  bottom: 0;
  left: 0;
}

.group-avatar:nth-child(4) {
  bottom: 0;
  right: 0;
}

.group-members {
  font-size: 12px;
  color: var(--text-secondary);
}

.member-count {
  font-weight: 500;
}

/* Group Chat Creator Modal */
.group-chat-creator-modal {
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

.group-chat-creator-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.instructions {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

.character-selector-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.selectable-character {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.selectable-character:hover {
  background: var(--hover-color);
}

.selectable-character.selected {
  border-color: var(--accent-color);
  background: rgba(90, 159, 212, 0.15);
}

.character-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.character-thumb {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.character-name-select {
  font-weight: 500;
  flex: 1;
}

/* Group Chat Creator Filters */
.group-chat-filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.group-chat-search {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.group-chat-search:focus {
  outline: none;
  border-color: var(--accent-color);
}

.group-chat-tag-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-chat-tag-filter .filter-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.group-chat-tag-filter .filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 100px;
  overflow-y: auto;
  padding: 0.25rem;
}
</style>
