<template>
  <div class="character-list">
    <div class="header">
      <h1>Choral</h1>
      <div class="actions">
        <input
          type="file"
          ref="fileInput"
          accept=".png"
          @change="uploadCharacter"
          style="display: none"
        />
        <button @click="$refs.fileInput.click()">Import Character</button>
        <button @click="createNewCharacter" class="create-btn">Create New</button>
        <button @click="showGroupChatCreator = true" class="group-btn">Create Group Chat</button>
        <button @click="autoTagAll" class="autotag-btn" :disabled="isAutoTaggingAll">
          {{ isAutoTaggingAll ? 'Auto-tagging...' : '✨ Auto-tag All' }}
        </button>
        <button @click="$router.push('/lorebooks')" class="lorebook-btn">Lorebooks</button>
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
          <span class="filter-label">Filter by tag:</span>
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
        v-for="group in groupChats"
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
                <input
                  v-model="tag.name"
                  type="text"
                  class="tag-input"
                  placeholder="Tag name"
                />
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

          <div class="character-selector-list">
            <div
              v-for="char in characters"
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

    <div v-if="filteredCharacters.length === 0 && groupChats.length === 0" class="empty-state">
      <p>No characters found. Import a character card to get started.</p>
    </div>
  </div>
</template>

<script>
import CharacterEditor from './CharacterEditor.vue'

export default {
  name: 'CharacterList',
  components: {
    CharacterEditor
  },
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
      showGroupChatCreator: false,
      selectedForGroup: [],
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
      autoTagCurrentCharacter: ''
    }
  },
  computed: {
    filteredCharacters() {
      let filtered = this.characters;

      // Filter by selected tags (must have ALL selected tags - case insensitive)
      if (this.selectedTags.length > 0) {
        filtered = filtered.filter(char =>
          this.selectedTags.every(selectedTag =>
            char.tags?.some(charTag =>
              this.normalizeTag(charTag) === this.normalizeTag(selectedTag)
            )
          )
        );
      }

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(char =>
          char.name.toLowerCase().includes(query) ||
          char.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }

      // Sort characters
      return this.sortCharacters(filtered);
    },
    allTags() {
      // Get all unique tags across all characters
      const tags = new Set();
      this.characters.forEach(char => {
        char.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
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
        const response = await fetch('/api/characters');
        this.characters = await response.json();
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    async uploadCharacter(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        await fetch('/api/characters', {
          method: 'POST',
          body: formData
        });

        this.loadCharacters();
        event.target.value = '';
        this.$root.$notify('Character imported successfully', 'success');
      } catch (error) {
        console.error('Failed to upload character:', error);
        this.$root.$notify('Failed to upload character', 'error');
      }
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
    startChat(character) {
      this.$router.push({
        name: 'chat',
        params: { id: 'new' },
        query: { character: character.filename }
      });
    },
    createNewCharacter() {
      this.characterBeingEdited = null;
      this.isEditorOpen = true;
    },
    editCharacter(character) {
      // Prepare character data with image URL
      // character.data is the full card object from the API
      this.characterBeingEdited = {
        ...character.data, // Spread the card data (spec, spec_version, data)
        filename: character.filename,
        image: `/api/characters/${character.filename}/image`
      };
      this.isEditorOpen = true;
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

          const response = await fetch(`/api/characters/${originalFilename}`, {
            method: 'PUT',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to update character');
          }

          this.$root.$notify('Character updated successfully', 'success');
        } else {
          // Create new character
          const formData = new FormData();

          if (imageFile) {
            formData.append('file', imageFile);
          }
          formData.append('card', JSON.stringify(card));

          const response = await fetch('/api/characters', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to create character');
          }

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
        const response = await fetch('/api/tags');
        if (response.ok) {
          this.tagColors = await response.json();
        }
      } catch (error) {
        console.error('Failed to load tag colors:', error);
      }
    },
    normalizeTag(tag) {
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
    },
    addTag() {
      this.editingTags.push({ name: '', color: '#6b7280' });
    },
    removeTag(index) {
      this.editingTags.splice(index, 1);
    },
    addExistingTag(tag) {
      this.editingTags.push({
        name: tag,
        color: this.getTagColor(tag)
      });
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

          await fetch('/api/group-chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedGroup)
          });

          await this.loadGroupChats();
        } else {
          // Update character tags
          const response = await fetch(`/api/characters/${this.characterBeingTagged.filename}/tags`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags })
          });

          if (!response.ok) {
            throw new Error('Failed to update tags');
          }

          await this.loadCharacters();
        }

        // Save tag colors
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.tagColors)
        });

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
        const response = await fetch(`/api/characters/${this.characterBeingTagged.filename}/auto-tag`, {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error('Failed to auto-generate tags');
        }

        const result = await response.json();

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
        this.$root.$notify('Failed to auto-generate tags', 'error');
      } finally {
        this.isAutoTagging = false;
      }
    },

    // Group chat methods
    async loadGroupChats() {
      try {
        const response = await fetch('/api/group-chats');
        this.groupChats = await response.json();
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
      this.$router.push({
        name: 'chat',
        params: { id: 'new' },
        query: { groupChat: group.filename }
      });
    },

    deleteGroupChat(group) {
      this.showConfirm(
        'Delete Group Chat',
        `Are you sure you want to delete "${this.getGroupChatName(group)}"? This action cannot be undone.`,
        'Delete',
        async () => {
          try {
            await fetch(`/api/group-chats/${group.filename}`, { method: 'DELETE' });
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
            await fetch(`/api/characters/${char.filename}`, { method: 'DELETE' });
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

        // Create the group chat
        const groupChat = {
          filename: `group_chat_${Date.now()}.json`,
          characters: selectedCharacters,
          strategy: 'join',
          messages: [],
          timestamp: Date.now()
        };

        const response = await fetch('/api/group-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupChat)
        });

        const result = await response.json();

        // Navigate to the new group chat
        this.$router.push({
          name: 'chat',
          params: { id: 'new' },
          query: { groupChat: result.filename }
        });

        this.$root.$notify('Group chat created', 'success');
      } catch (error) {
        console.error('Failed to create group chat:', error);
        this.$root.$notify('Failed to create group chat', 'error');
      }
    },

    closeGroupChatCreator() {
      this.showGroupChatCreator = false;
      this.selectedForGroup = [];
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

        await fetch('/api/group-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedGroup)
        });

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
        const [chatsResponse, groupChatsResponse] = await Promise.all([
          fetch('/api/chats'),
          fetch('/api/group-chats')
        ]);

        const chats = await chatsResponse.json();
        const groupChatsData = await groupChatsResponse.json();

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
          // Sort by filename (which includes timestamp for auto-generated names)
          // For character cards, use the filename as a proxy for creation date
          sorted.sort((a, b) => {
            return b.filename.localeCompare(a.filename);
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
            const response = await fetch(`/api/characters/${char.filename}/auto-tag`, {
              method: 'POST'
            });

            if (!response.ok) {
              console.error(`Failed to auto-tag ${char.name}`);
              continue;
            }

            const result = await response.json();

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
            await fetch(`/api/characters/${char.filename}/tags`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tags })
            });

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            console.error(`Error auto-tagging ${char.name}:`, error);
          }
        }

        // Save tag colors
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.tagColors)
        });

        // Reload characters to show updated tags
        await this.loadCharacters();

        this.$root.$notify(`Successfully auto-tagged ${characters.length} character${characters.length === 1 ? '' : 's'}!`, 'success');
      } catch (error) {
        console.error('Error during batch auto-tagging:', error);
        this.$root.$notify('Auto-tagging completed with some errors', 'error');
      } finally {
        this.isAutoTaggingAll = false;
        this.showAutoTagProgress = false;
        this.autoTagCurrentIndex = 0;
        this.autoTagTotal = 0;
        this.autoTagCurrentCharacter = '';
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
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
}

.search-bar {
  padding: 16px 20px;
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
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.filter-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
}

.character-card:hover {
  background: var(--bg-tertiary);
  transform: translateY(-2px);
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

.create-btn {
  background: var(--accent-color);
  color: white;
}

.create-btn:hover {
  opacity: 0.9;
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

.tag-input {
  flex: 1;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
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

/* Auto-tag All Button */
.autotag-btn {
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: white;
}

.autotag-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.autotag-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Group Chat Styles */
.group-btn {
  background: #22c55e;
  color: white;
}

.group-btn:hover {
  opacity: 0.9;
}

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
</style>
