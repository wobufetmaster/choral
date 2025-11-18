<template>
  <div class="character-grid-picker">
    <!-- Search Input -->
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search characters by name or tag..."
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
          :class="['tag-badge', { 'tag-active': selectedTags.some(t => normalizeTag(t) === normalizeTag(tag.name)) }]"
          :style="{ backgroundColor: tag.color, color: getTextColor(tag.color) }"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <!-- Character Grid (Scrollable Container) -->
    <div class="character-grid-wrapper">
      <div :class="['character-grid', gridClass]">
      <div
        v-for="(char, index) in filteredCharacters"
        :key="char.filename || `char-${index}`"
        @click="selectCharacter(char)"
        :class="['character-card', cardClass]"
        tabindex="0"
        role="button"
        :aria-label="`Select ${char.name || 'Unknown'}`"
        @keydown.enter="selectCharacter(char)"
      >
        <img
          v-if="char.filename"
          :src="`/api/characters/${char.filename}/image`"
          :alt="char.name || 'Unknown'"
          :class="['character-image', imageClass]"
        />
        <div :class="['character-name', nameClass]">{{ char.name || 'Unknown' }}</div>
        <slot name="card-footer" :character="char"></slot>
      </div>
      <div v-if="filteredCharacters.length === 0" class="no-characters">
        No characters match your search
      </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useApi } from '../composables/useApi';

export default {
  name: 'CharacterGridPicker',
  setup() {
    const api = useApi();
    return { api };
  },
  props: {
    characters: {
      type: Array,
      required: true
    },
    // Optional: filter out certain characters
    excludeFilenames: {
      type: Array,
      default: () => []
    },
    // Optional: custom CSS classes
    gridClass: {
      type: String,
      default: ''
    },
    cardClass: {
      type: String,
      default: ''
    },
    imageClass: {
      type: String,
      default: ''
    },
    nameClass: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      searchQuery: '',
      selectedTags: [],
      tagColors: {}
    };
  },
  computed: {
    availableCharacters() {
      // Filter out excluded characters
      if (!this.characters || this.characters.length === 0) {
        return [];
      }
      if (this.excludeFilenames.length === 0) {
        return this.characters;
      }
      return this.characters.filter(c => c && c.filename && !this.excludeFilenames.includes(c.filename));
    },
    filteredCharacters() {
      let filtered = this.availableCharacters;

      // Filter by search query
      if (this.searchQuery.trim()) {
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

      // Filter by selected tags
      if (this.selectedTags.length > 0) {
        filtered = filtered.filter(char => {
          const charTags = char.tags || [];
          return this.selectedTags.every(selectedTag =>
            charTags.some(tag => this.normalizeTag(tag) === this.normalizeTag(selectedTag))
          );
        });
      }

      return filtered;
    },
    allTags() {
      // Collect all unique tags from ALL characters
      const tagMap = new Map();
      if (!this.characters || !Array.isArray(this.characters)) {
        return [];
      }
      try {
        this.characters.forEach(char => {
          if (!char || !char.tags) return;
          const tags = char.tags || [];
          tags.forEach(tag => {
            if (!tag) return;
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
      } catch (error) {
        console.error('[CharacterGridPicker] Error computing allTags:', error);
        return [];
      }
    }
  },
  async mounted() {
    await this.loadTagColors();
  },
  methods: {
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
    toggleTagFilter(tagName) {
      const index = this.selectedTags.findIndex(t =>
        this.normalizeTag(t) === this.normalizeTag(tagName)
      );
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(tagName);
      }
    },
    getTagColor(tag) {
      const normalized = this.normalizeTag(tag);
      return this.tagColors[normalized] || '#6b7280';
    },
    getTextColor(backgroundColor) {
      if (!backgroundColor || typeof backgroundColor !== 'string') {
        return '#ffffff';
      }
      const hex = backgroundColor.replace('#', '');
      if (hex.length !== 6) {
        return '#ffffff';
      }
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return '#ffffff';
      }
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    },
    selectCharacter(character) {
      this.$emit('select', character);
    },
    clearSearch() {
      this.searchQuery = '';
      this.selectedTags = [];
    }
  }
};
</script>

<style scoped>
.character-grid-picker {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.search-input {
  width: 100%;
  padding: 10px;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  font-size: 1em;
}

.character-grid-wrapper {
  max-height: 400px;
  overflow-y: auto;
}

.search-input::placeholder {
  color: var(--text-muted, #666);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color, #4a9eff);
}

.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-filter-label {
  color: var(--text-muted, #888);
  font-size: 0.9em;
}

.tag-list-scrollable {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-height: 150px;
  overflow-y: auto;
}

.tag-badge {
  padding: 4px 12px;
  font-size: 12px;
  border: 2px solid;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tag-badge:hover {
  opacity: 0.8;
}

.tag-badge.tag-active {
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 10px;
}

.character-card {
  background: var(--bg-secondary, #1a1a1a);
  border: 2px solid var(--border-color, #333);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.character-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: var(--accent-color, #4a9eff);
}

.character-card:focus {
  outline: 2px solid var(--accent-color, #4a9eff);
  outline-offset: 2px;
}

.character-image {
  width: 100%;
  height: 150px;
  object-fit: cover;
  background: var(--bg-tertiary, #2a2a2a);
}

.character-name {
  padding: 10px;
  font-weight: 600;
  text-align: center;
  color: var(--text-color, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9em;
}

.no-characters {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-muted, #888);
  padding: 40px;
  font-style: italic;
}
</style>
