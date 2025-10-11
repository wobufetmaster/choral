<template>
  <div class="group-chat-manager">
    <div class="manager-header">
      <h3>Group Chat Settings</h3>
      <button @click="$emit('close')" class="close-button">×</button>
    </div>

    <div class="manager-content">
      <!-- Response Mode -->
      <div class="setting-section">
        <h4>Response Mode</h4>
        <div class="strategy-options">
          <label class="radio-option">
            <input
              type="radio"
              :value="false"
              v-model="localExplicitMode"
              @change="$emit('update:explicit-mode', localExplicitMode)"
            />
            <span>Auto-Select (Random)</span>
            <small>Pressing Enter picks a random character to respond</small>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              :value="true"
              v-model="localExplicitMode"
              @change="$emit('update:explicit-mode', localExplicitMode)"
            />
            <span>Explicit Selection</span>
            <small>Must click a character button to generate response</small>
          </label>
        </div>
      </div>

      <!-- Strategy Selection -->
      <div class="setting-section">
        <h4>Description Strategy</h4>
        <div class="strategy-options">
          <label class="radio-option">
            <input
              type="radio"
              :value="'swap'"
              v-model="localStrategy"
              @change="$emit('update:strategy', localStrategy)"
            />
            <span>Swap per Message</span>
            <small>Use only the speaking character's description</small>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              :value="'join'"
              v-model="localStrategy"
              @change="$emit('update:strategy', localStrategy)"
            />
            <span>Join All</span>
            <small>Include all character descriptions together</small>
          </label>
        </div>
      </div>

      <!-- Character List -->
      <div class="setting-section">
        <h4>Characters in Group ({{ characters.length }})</h4>
        <div class="character-list">
          <div
            v-for="(char, index) in characters"
            :key="char.filename"
            class="character-item"
          >
            <img
              :src="`/api/characters/${char.filename}/image`"
              :alt="char.name"
              class="character-thumb"
            />
            <div class="character-details">
              <span class="character-name">{{ char.name }}</span>
              <span class="character-order">Order: {{ index + 1 }}</span>
            </div>
            <div class="character-actions">
              <button
                @click="$emit('trigger-response', char.filename)"
                class="trigger-btn"
                title="Generate response from this character"
              >
                💬
              </button>
              <button
                v-if="index > 0"
                @click="$emit('move-up', index)"
                class="move-btn"
                title="Move up"
              >
                ↑
              </button>
              <button
                v-if="index < characters.length - 1"
                @click="$emit('move-down', index)"
                class="move-btn"
                title="Move down"
              >
                ↓
              </button>
              <button
                @click="$emit('remove-character', index)"
                class="remove-btn"
                title="Remove from group"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Character -->
      <div class="setting-section">
        <button @click="showCharacterPicker = true" class="add-character-btn">
          ➕ Add Character to Group
        </button>
      </div>
    </div>

    <!-- Character Picker Modal -->
    <div v-if="showCharacterPicker" class="character-picker-modal" @click.self="showCharacterPicker = false">
      <div class="picker-modal-content">
        <div class="picker-modal-header">
          <h3>Add Character to Group</h3>
          <button @click="showCharacterPicker = false" class="close-button">×</button>
        </div>

        <div class="picker-modal-body">
          <!-- Search Input -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search characters..."
            class="search-input"
          />

          <!-- Tag Filter -->
          <div v-if="allTags.length > 0" class="tag-filter">
            <div class="tag-filter-label">Filter by tag:</div>
            <div class="tag-list-scrollable">
              <button
                v-for="tag in allTags"
                :key="tag.name"
                @click="toggleTagFilter(tag.name)"
                :class="['tag-badge', { 'tag-active': selectedTags.includes(tag.name) }]"
                :style="{ backgroundColor: tag.color, color: getTextColor(tag.color) }"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>

          <!-- Character Grid -->
          <div class="character-picker-grid">
            <div
              v-for="char in filteredAvailableCharacters"
              :key="char.filename"
              @click="quickAddCharacter(char.filename)"
              class="character-picker-card"
            >
              <img
                :src="`/api/characters/${char.filename}/image`"
                :alt="char.name"
                class="character-picker-thumb"
              />
              <div class="character-picker-name">{{ char.name }}</div>
            </div>
            <div v-if="filteredAvailableCharacters.length === 0" class="no-characters">
              No characters match your search
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GroupChatManager',
  props: {
    characters: {
      type: Array,
      required: true
    },
    strategy: {
      type: String,
      default: 'join'
    },
    explicitMode: {
      type: Boolean,
      default: false
    },
    allCharacters: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      localStrategy: this.strategy,
      localExplicitMode: this.explicitMode,
      searchQuery: '',
      selectedTags: [],
      showCharacterPicker: false
    };
  },
  computed: {
    availableCharacters() {
      // Filter out characters already in the group
      const existingFilenames = this.characters.map(c => c.filename);
      return this.allCharacters.filter(c => !existingFilenames.includes(c.filename));
    },
    filteredAvailableCharacters() {
      let filtered = this.availableCharacters;

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(char => {
          const nameMatch = char.name.toLowerCase().includes(query);
          const tagMatch = char.data?.tags?.some(tag =>
            tag.toLowerCase().includes(query)
          );
          return nameMatch || tagMatch;
        });
      }

      // Filter by selected tags
      if (this.selectedTags.length > 0) {
        filtered = filtered.filter(char => {
          const charTags = char.data?.tags || [];
          return this.selectedTags.every(selectedTag =>
            charTags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
          );
        });
      }

      return filtered;
    },
    allTags() {
      // Collect all unique tags from available characters
      const tagMap = new Map();
      this.availableCharacters.forEach(char => {
        const tags = char.data?.tags || [];
        tags.forEach(tag => {
          if (!tagMap.has(tag.toLowerCase())) {
            tagMap.set(tag.toLowerCase(), {
              name: tag,
              color: this.getTagColor(tag)
            });
          }
        });
      });
      return Array.from(tagMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }
  },
  watch: {
    strategy(newVal) {
      this.localStrategy = newVal;
    },
    explicitMode(newVal) {
      this.localExplicitMode = newVal;
    }
  },
  methods: {
    toggleTagFilter(tagName) {
      const index = this.selectedTags.indexOf(tagName);
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(tagName);
      }
    },
    getTagColor(tag) {
      // Try to get color from local storage (same as CharacterList)
      const tagColors = JSON.parse(localStorage.getItem('tagColors') || '{}');
      if (tagColors[tag]) {
        return tagColors[tag];
      }
      // Default gray color
      return '#6b7280';
    },
    getTextColor(backgroundColor) {
      // Calculate luminance to determine if text should be black or white
      const hex = backgroundColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    },
    quickAddCharacter(filename) {
      this.$emit('add-character', filename);
      this.showCharacterPicker = false;
      this.searchQuery = '';
      this.selectedTags = [];
    }
  }
};
</script>

<style scoped>
.group-chat-manager {
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 350px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.manager-header h3 {
  margin: 0;
  font-size: 1.125rem;
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
  background: var(--hover-color);
}

.manager-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-section h4 {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.strategy-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-option {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  background: var(--hover-color);
}

.radio-option input {
  margin-right: 0.5rem;
}

.radio-option span {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.radio-option small {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin-left: 1.5rem;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.character-thumb {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.character-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.character-name {
  font-weight: 500;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-order {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.character-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.trigger-btn,
.move-btn,
.remove-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trigger-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.move-btn:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.remove-btn {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.remove-btn:hover {
  background: #b91c1c;
}

.add-character {
  display: flex;
  gap: 0.5rem;
}

.character-select {
  flex: 1;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.add-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Add Character Button */
.add-character-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.add-character-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Character Picker Modal */
.character-picker-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(4px);
}

.picker-modal-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.picker-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 8px 8px 0 0;
}

.picker-modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.picker-modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

/* Search Input */
.search-input {
  width: 100%;
  padding: 0.625rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Tag Filter */
.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tag-filter-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.tag-list-scrollable {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  max-height: 120px;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.tag-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.6;
}

.tag-badge:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.tag-badge.tag-active {
  opacity: 1;
  border-color: var(--text-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.character-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.875rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  flex: 1;
  overflow-y: auto;
}

.character-picker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.character-picker-card:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.character-picker-thumb {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-color);
  flex-shrink: 0;
}

.character-picker-card:hover .character-picker-thumb {
  border-color: var(--accent-color);
}

.character-picker-name {
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  line-height: 1.2;
}

.no-characters {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.875rem;
}
</style>
