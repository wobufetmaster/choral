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
          Click a character card to configure which tools they can access.
        </p>

        <CharacterGridPicker
          :characters="characters"
          @select="openToolModal"
          grid-class="tool-settings-grid"
          card-class="tool-settings-card"
          image-class="tool-settings-image"
        >
          <template #card-footer="{ character }">
            <div :class="['tool-status-badge', getToolStatusClass(character.filename)]">
              {{ getToolStatusText(character.filename) }}
            </div>
          </template>
        </CharacterGridPicker>
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

    <!-- Tool Configuration Modal -->
    <div
      v-if="showToolModal"
      class="tool-modal-backdrop"
      @click.self="closeToolModal"
    >
      <div class="tool-modal">
        <div class="tool-modal-header">
          <div class="modal-character-info">
            <img
              :src="`/api/characters/${selectedCharacter.filename}/image`"
              :alt="selectedCharacter.name"
              class="modal-character-avatar"
            />
            <div>
              <h3>{{ selectedCharacter.name }}</h3>
              <p class="tool-count-text">{{ getToolCountText() }}</p>
            </div>
          </div>
          <button @click="closeToolModal" class="close-button">×</button>
        </div>

        <div class="tool-modal-body">
          <!-- Tool Search (if needed) -->
          <input
            v-if="availableTools.length >= 5"
            v-model="toolSearchQuery"
            type="text"
            placeholder="Search tools..."
            class="tool-search-input"
          />

          <!-- Tool Cards Grid -->
          <div class="tool-cards-grid">
            <div
              v-for="tool in filteredTools"
              :key="tool.id"
              :class="['tool-card', { 'tool-card-enabled': isToolEnabledInModal(tool.id) }]"
              @click="toggleToolInModal(tool.id)"
              tabindex="0"
              role="button"
              :aria-label="`Toggle ${tool.name}`"
              @keydown.enter="toggleToolInModal(tool.id)"
            >
              <div class="tool-card-icon">{{ tool.icon || '⚙️' }}</div>
              <div class="tool-card-name">{{ tool.name }}</div>
              <div class="tool-card-description">{{ tool.description }}</div>
              <div v-if="isToolEnabledInModal(tool.id)" class="tool-card-checkmark">✓</div>
            </div>
          </div>
        </div>

        <div class="tool-modal-footer">
          <button @click="closeToolModal" class="btn-secondary">Cancel</button>
          <button @click="saveToolModal" class="btn-primary">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CharacterGridPicker from './CharacterGridPicker.vue';

export default {
  name: 'ToolSettings',
  components: {
    CharacterGridPicker
  },
  data() {
    return {
      settings: {
        enableToolCalling: true,
        characterTools: []
      },
      characters: [],
      availableTools: [],
      showToolModal: false,
      selectedCharacter: null,
      modalToolSelections: [],
      toolSearchQuery: ''
    };
  },
  computed: {
    filteredTools() {
      if (!this.toolSearchQuery) return this.availableTools;

      const query = this.toolSearchQuery.toLowerCase();
      return this.availableTools.filter(tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
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
    getToolStatusText(characterFilename) {
      const charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === characterFilename
      );
      const enabledCount = charConfig?.tools?.length || 0;
      const totalCount = this.availableTools.length;

      if (enabledCount === 0) return '○ No tools';
      if (enabledCount === totalCount) return '✓ All tools';
      return `⚙ ${enabledCount}/${totalCount} tools`;
    },
    getToolStatusClass(characterFilename) {
      const charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === characterFilename
      );
      const enabledCount = charConfig?.tools?.length || 0;
      const totalCount = this.availableTools.length;

      if (enabledCount === 0) return 'status-none';
      if (enabledCount === totalCount) return 'status-all';
      return 'status-partial';
    },
    openToolModal(character) {
      this.selectedCharacter = character;
      const charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === character.filename
      );
      this.modalToolSelections = charConfig?.tools ? [...charConfig.tools] : [];
      this.toolSearchQuery = '';
      this.showToolModal = true;
    },
    closeToolModal() {
      this.showToolModal = false;
      this.selectedCharacter = null;
      this.modalToolSelections = [];
      this.toolSearchQuery = '';
    },
    isToolEnabledInModal(toolId) {
      return this.modalToolSelections.includes(toolId);
    },
    toggleToolInModal(toolId) {
      const index = this.modalToolSelections.indexOf(toolId);
      if (index === -1) {
        this.modalToolSelections.push(toolId);
      } else {
        this.modalToolSelections.splice(index, 1);
      }
    },
    saveToolModal() {
      if (!this.selectedCharacter) return;

      // Find or create character config
      let charConfig = this.settings.characterTools.find(
        ct => ct.characterFilename === this.selectedCharacter.filename
      );

      if (!charConfig) {
        charConfig = {
          characterFilename: this.selectedCharacter.filename,
          tools: []
        };
        this.settings.characterTools.push(charConfig);
      }

      // Update tools
      charConfig.tools = [...this.modalToolSelections];

      // Clean up empty configs
      if (charConfig.tools.length === 0) {
        const configIndex = this.settings.characterTools.indexOf(charConfig);
        this.settings.characterTools.splice(configIndex, 1);
      }

      this.closeToolModal();
    },
    getToolCountText() {
      if (!this.selectedCharacter) return '';
      const enabledCount = this.modalToolSelections.length;
      const totalCount = this.availableTools.length;
      return `Configuring ${enabledCount}/${totalCount} tools`;
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

/* Custom styling for CharacterGridPicker in this component */
.tool-settings-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.tool-settings-image {
  height: 200px;
}

.tool-status-badge {
  padding: 8px 12px;
  text-align: center;
  font-size: 0.85em;
  font-weight: 500;
  border-top: 1px solid var(--border-color, #333);
}

.tool-status-badge.status-all {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.tool-status-badge.status-partial {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.tool-status-badge.status-none {
  background: rgba(158, 158, 158, 0.2);
  color: #9e9e9e;
}

/* Tool Modal */
.tool-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.tool-modal {
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tool-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-character-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.modal-character-avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}

.modal-character-info h3 {
  margin: 0;
  color: var(--text-color, #e0e0e0);
  font-size: 1.2em;
}

.tool-count-text {
  margin: 5px 0 0 0;
  color: var(--text-muted, #888);
  font-size: 0.85em;
}

.close-button {
  background: none;
  border: none;
  font-size: 2em;
  color: var(--text-muted, #888);
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--hover-color, #333);
  color: var(--text-color, #e0e0e0);
}

.tool-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.tool-search-input {
  width: 100%;
  padding: 10px;
  background: var(--bg-primary, #0a0a0a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  font-size: 1em;
  margin-bottom: 20px;
}

.tool-search-input::placeholder {
  color: var(--text-muted, #666);
}

.tool-search-input:focus {
  outline: none;
  border-color: var(--accent-color, #4a9eff);
}

/* Tool Cards Grid */
.tool-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 15px;
}

.tool-card {
  background: var(--bg-primary, #0a0a0a);
  border: 2px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}

.tool-card:hover {
  border-color: var(--accent-color, #4a9eff);
  transform: translateY(-2px);
}

.tool-card:focus {
  outline: 2px solid var(--accent-color, #4a9eff);
  outline-offset: 2px;
}

.tool-card-enabled {
  background: rgba(74, 158, 255, 0.1);
  border-color: var(--accent-color, #4a9eff);
}

.tool-card-icon {
  font-size: 2em;
  margin-bottom: 10px;
}

.tool-card-name {
  font-weight: 600;
  color: var(--text-color, #e0e0e0);
  margin-bottom: 8px;
  font-size: 1em;
}

.tool-card-description {
  color: var(--text-muted, #888);
  font-size: 0.85em;
  line-height: 1.4;
  flex: 1;
}

.tool-card-checkmark {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--accent-color, #4a9eff);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9em;
  font-weight: bold;
}

.tool-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid var(--border-color, #333);
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 1em;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-color, #4a9eff);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-color-hover, #3a8eef);
}

.btn-secondary {
  background: var(--bg-tertiary, #2a2a2a);
  color: var(--text-color, #e0e0e0);
  border: 1px solid var(--border-color, #333);
}

.btn-secondary:hover {
  background: var(--hover-color, #333);
}

/* Tools Info Section */
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

.page-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px 0;
  margin-top: 30px;
  border-top: 1px solid var(--border-color, #333);
}

/* Responsive Design */
@media (max-width: 768px) {
  .character-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
  }

  .character-card-avatar {
    height: 150px;
  }

  .tool-cards-grid {
    grid-template-columns: 1fr;
  }

  .tool-modal {
    max-height: 95vh;
  }
}
</style>
