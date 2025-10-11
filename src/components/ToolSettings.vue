<template>
  <div class="tool-settings-page">
    <div class="page-header">
      <h2>🔧 Tool Calling Settings</h2>
    </div>

    <div class="tool-settings-content">
        <!-- Global Toggle -->
        <div class="settings-section">
          <label class="toggle-setting">
            <input type="checkbox" v-model="settings.enableToolCalling" />
            <span>Enable Tool Calling</span>
          </label>
          <p class="setting-description">
            When enabled, characters can use tools like creating character cards, generating images, etc.
          </p>
        </div>

        <!-- Character Tool Permissions -->
        <div class="settings-section" v-if="settings.enableToolCalling">
          <h4>Character Tool Permissions</h4>
          <p class="setting-description">
            Configure which tools each character can access.
          </p>

          <!-- Search and Filter -->
          <div class="search-filter">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search characters by name or tag..."
              class="search-input"
            />
            <div v-if="allTags.length > 0" class="tag-filter">
              <span class="filter-label">Filter by tag:</span>
              <div class="filter-tags">
                <button
                  v-for="tag in allTags"
                  :key="tag"
                  :class="['filter-tag', { active: selectedTags.includes(tag) }]"
                  @click="toggleTagFilter(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>

          <div class="character-tools-list">
            <div
              v-for="character in filteredCharacters"
              :key="character.filename"
              class="character-tool-item"
            >
              <div class="character-info">
                <img
                  v-if="character.avatar"
                  :src="character.avatar"
                  :alt="character.name"
                  class="character-avatar-small"
                />
                <span class="character-name">{{ character.name }}</span>
              </div>

              <div class="tool-checkboxes">
                <label
                  v-for="tool in availableTools"
                  :key="tool.id"
                  class="tool-checkbox"
                  :title="tool.description"
                >
                  <input
                    type="checkbox"
                    :checked="isToolEnabled(character.filename, tool.id)"
                    @change="toggleTool(character.filename, tool.id)"
                  />
                  <span>{{ tool.name }}</span>
                </label>
                <span v-if="availableTools.length === 0" class="no-tools">No tools available</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Available Tools Info -->
        <div class="settings-section">
          <h4>Available Tools</h4>
          <div class="tools-info">
            <div v-for="tool in availableTools" :key="tool.id" class="tool-info-item">
              <strong>{{ tool.name }}</strong>
              <p>{{ tool.description }}</p>
            </div>
            <p v-if="availableTools.length === 0" class="no-tools">
              No tools are currently available.
            </p>
          </div>
        </div>
    </div>

    <div class="page-footer">
      <button @click="saveSettings" class="btn-primary">💾 Save Settings</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ToolSettings',
  data() {
    return {
      settings: {
        enableToolCalling: true,
        characterTools: []
      },
      characters: [],
      availableTools: [],
      searchQuery: '',
      selectedTags: []
    };
  },
  computed: {
    filteredCharacters() {
      let filtered = this.characters;

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(char =>
          char.name.toLowerCase().includes(query) ||
          char.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }

      // Filter by selected tags
      if (this.selectedTags.length > 0) {
        filtered = filtered.filter(char =>
          this.selectedTags.every(selectedTag =>
            char.tags?.includes(selectedTag)
          )
        );
      }

      return filtered;
    },
    allTags() {
      const tags = new Set();
      this.characters.forEach(char => {
        char.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
    }
  },
  async mounted() {
    await this.loadSettings();
    await this.loadCharacters();
    await this.loadAvailableTools();
  },
  methods: {
    async loadSettings() {
      try {
        const response = await fetch('/api/tool-settings');
        if (response.ok) {
          this.settings = await response.json();
        }
      } catch (error) {
        console.error('Failed to load tool settings:', error);
        this.$root.$notify('Failed to load tool settings', 'error');
      }
    },
    async loadCharacters() {
      try {
        const response = await fetch('/api/characters');
        if (response.ok) {
          this.characters = await response.json();
        }
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    async loadAvailableTools() {
      try {
        const response = await fetch('/api/tools/available');
        if (response.ok) {
          const data = await response.json();
          this.availableTools = data.tools || [];
        }
      } catch (error) {
        console.error('Failed to load available tools:', error);
      }
    },
    isToolEnabled(characterFilename, toolId) {
      const charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === characterFilename
      );
      return charConfig?.tools?.includes(toolId) || false;
    },
    toggleTool(characterFilename, toolId) {
      // Find or create character config
      let charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === characterFilename
      );

      if (!charConfig) {
        charConfig = {
          characterFilename: characterFilename,
          tools: []
        };
        this.settings.characterTools.push(charConfig);
      }

      // Toggle tool
      const toolIndex = charConfig.tools.indexOf(toolId);
      if (toolIndex === -1) {
        charConfig.tools.push(toolId);
      } else {
        charConfig.tools.splice(toolIndex, 1);
      }

      // Clean up empty configs
      if (charConfig.tools.length === 0) {
        const configIndex = this.settings.characterTools.indexOf(charConfig);
        this.settings.characterTools.splice(configIndex, 1);
      }
    },
    async saveSettings() {
      try {
        const response = await fetch('/api/tool-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.settings)
        });

        if (response.ok) {
          this.$root.$notify('Tool settings saved', 'success');
        } else {
          throw new Error('Failed to save settings');
        }
      } catch (error) {
        console.error('Failed to save tool settings:', error);
        this.$root.$notify('Failed to save tool settings', 'error');
      }
    },
    toggleTagFilter(tag) {
      const index = this.selectedTags.indexOf(tag);
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(tag);
      }
    }
  }
};
</script>

<style scoped>
.tool-settings-page {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-primary, #0a0a0a);
}

.page-header {
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color, #333);
}

.page-header h2 {
  margin: 0;
  color: var(--text-color, #e0e0e0);
  font-size: 1.8em;
}

.tool-settings-content {
  padding: 20px;
  color: var(--text-color, #e0e0e0);
}

.settings-section {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color, #333);
  color: var(--text-color, #e0e0e0);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  margin: 0 0 10px 0;
  color: var(--text-color, #e0e0e0);
}

.settings-section p {
  color: var(--text-muted, #888);
}

.setting-description {
  color: var(--text-muted, #888);
  font-size: 0.9em;
  margin: 5px 0 15px 0;
}

.toggle-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1em;
  cursor: pointer;
  color: var(--text-color, #e0e0e0);
}

.toggle-setting span {
  color: var(--text-color, #e0e0e0);
}

.toggle-setting input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.character-tools-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-tool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: var(--bg-secondary, #1a1a1a);
  border-radius: 8px;
  gap: 15px;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}

.character-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
}

.character-name {
  font-weight: 500;
  color: var(--text-color, #e0e0e0);
}

.tool-checkboxes {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.tool-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 0.9em;
  color: var(--text-color, #e0e0e0);
}

.tool-checkbox span {
  color: var(--text-color, #e0e0e0);
}

.tool-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.tools-info {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.tool-info-item {
  padding: 10px;
  background: var(--bg-secondary, #1a1a1a);
  border-radius: 8px;
}

.tool-info-item strong {
  display: block;
  margin-bottom: 5px;
  color: var(--accent-color, #4a9eff);
}

.tool-info-item p {
  margin: 0;
  color: var(--text-muted, #888);
  font-size: 0.9em;
}

.no-tools {
  color: var(--text-muted, #888);
  font-style: italic;
}

.search-filter {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 10px;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  font-size: 1em;
  margin-bottom: 15px;
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
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-label {
  color: var(--text-muted, #888);
  font-size: 0.9em;
  white-space: nowrap;
}

.filter-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tag {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color, #e0e0e0);
}

.filter-tag:hover {
  background: var(--hover-color, #333);
  border-color: var(--accent-color, #4a9eff);
}

.filter-tag.active {
  background: var(--accent-color, #4a9eff);
  color: white;
  border-color: var(--accent-color, #4a9eff);
}

.page-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px 0;
  margin-top: 30px;
  border-top: 1px solid var(--border-color, #333);
}

.btn-primary {
  padding: 10px 20px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 1em;
  background: var(--accent-color, #4a9eff);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-color-hover, #3a8eef);
}
</style>
