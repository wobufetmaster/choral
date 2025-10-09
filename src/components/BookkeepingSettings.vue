<template>
  <div class="bookkeeping-settings">
    <div class="settings-header">
      <h2>Bookkeeping Settings</h2>
      <p class="subtitle">Configure auto-tagging behavior and manage core tags</p>
    </div>

    <div class="settings-content">
      <!-- Auto-tagger Settings Section -->
      <section class="settings-section">
        <h3>Auto-Tagger Configuration</h3>

        <div class="setting-group">
          <label for="model-select">Model:</label>
          <select id="model-select" v-model="settings.model" class="model-select">
            <option value="deepseek/deepseek-chat-v3.1">DeepSeek Chat v3.1 (very cheap)</option>
            <option value="openai/gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
            <option value="google/gemini-2.0-flash-exp">Gemini 2.0 Flash (fast, cheap)</option>
            <option value="mistralai/mistral-nemo">Mistral Nemo</option>
            <option value="openai/gpt-4o">GPT-4o (balanced)</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (best quality)</option>
            <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="settings.strictMode" />
            <span>Strict Mode</span>
          </label>
          <p class="setting-description">
            When enabled, the auto-tagger will only use tags from the core tags list below.
            It cannot create new tags. This helps maintain a consistent tagging system.
          </p>
        </div>

        <div class="action-buttons">
          <button @click="saveSettings" class="btn-primary">Save Settings</button>
        </div>
      </section>

      <!-- Core Tags Section -->
      <section class="settings-section">
        <h3>Core Tags</h3>
        <p class="section-description">
          Core tags are a global list of tags that the auto-tagger can use.
          In strict mode, only these tags will be used for auto-tagging.
        </p>

        <div class="core-tags-editor">
          <div class="tag-list">
            <div
              v-for="(tag, index) in coreTags"
              :key="index"
              class="tag-item"
              :style="{ borderColor: tag.color }"
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
          </div>

          <div class="add-tag-section">
            <button @click="addTag" class="add-tag-btn">+ Add Core Tag</button>
            <button @click="importFromExisting" class="btn-secondary">Import All Existing Tags</button>
            <button @click="deleteAllTags" class="btn-danger">Delete All Core Tags</button>
          </div>

          <div class="action-buttons">
            <button @click="saveCoreTags" class="btn-primary">Save Core Tags</button>
          </div>
        </div>
      </section>

      <!-- Bulk Character Tag Operations -->
      <section class="settings-section">
        <h3>Bulk Character Operations</h3>
        <p class="section-description">
          Perform bulk operations on all character cards. These operations cannot be undone.
        </p>

        <div class="bulk-operations">
          <button @click="removeAllCharacterTags" class="btn-danger-large">
            Remove Tags from All Characters
          </button>
          <p class="warning-text">
            ⚠️ This will remove all tags from every character card. This operation cannot be undone.
          </p>
        </div>
      </section>

    </div>
  </div>
</template>

<script>
export default {
  name: 'BookkeepingSettings',
  props: {
    tabData: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      settings: {
        model: 'openai/gpt-4o-mini',
        strictMode: false
      },
      coreTags: [],
      allTags: {} // Map of existing tags for import
    };
  },
  async mounted() {
    await this.loadSettings();
    await this.loadCoreTags();
    await this.loadAllTags();
  },
  methods: {
    async loadSettings() {
      try {
        const response = await fetch('/api/bookkeeping-settings');
        if (response.ok) {
          this.settings = await response.json();
        }
      } catch (error) {
        console.error('Failed to load bookkeeping settings:', error);
        this.$root.$notify('Failed to load settings', 'error');
      }
    },
    async saveSettings() {
      try {
        const response = await fetch('/api/bookkeeping-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.settings)
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        this.$root.$notify('Settings saved successfully', 'success');
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.$root.$notify('Failed to save settings', 'error');
      }
    },
    async loadCoreTags() {
      try {
        const response = await fetch('/api/core-tags');
        if (response.ok) {
          const tags = await response.json();
          // Convert to format with name and color
          this.coreTags = tags.map(tag => {
            if (typeof tag === 'string') {
              return { name: tag, color: '#6b7280' };
            }
            return tag;
          });
        }
      } catch (error) {
        console.error('Failed to load core tags:', error);
        this.$root.$notify('Failed to load core tags', 'error');
      }
    },
    async saveCoreTags() {
      try {
        // Filter out empty tags and get unique tag names
        const tags = this.coreTags
          .filter(t => t.name.trim())
          .map(t => t.name.trim());

        const response = await fetch('/api/core-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tags)
        });

        if (!response.ok) {
          throw new Error('Failed to save core tags');
        }

        // Also update the tag colors in the global tags file
        const tagColors = {};
        this.coreTags.forEach(tag => {
          if (tag.name.trim()) {
            const normalized = tag.name.toLowerCase().trim();
            tagColors[normalized] = tag.color;
          }
        });

        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...this.allTags, ...tagColors })
        });

        this.$root.$notify('Core tags saved successfully', 'success');
        await this.loadAllTags(); // Reload to get updated colors
      } catch (error) {
        console.error('Failed to save core tags:', error);
        this.$root.$notify('Failed to save core tags', 'error');
      }
    },
    async loadAllTags() {
      try {
        const response = await fetch('/api/tags');
        if (response.ok) {
          this.allTags = await response.json();
        }
      } catch (error) {
        console.error('Failed to load all tags:', error);
      }
    },
    addTag() {
      this.coreTags.push({ name: '', color: '#6b7280' });
    },
    removeTag(index) {
      this.coreTags.splice(index, 1);
    },
    async importFromExisting() {
      // Import all existing tags from the global tags list
      const existingTagNames = Object.keys(this.allTags);

      if (existingTagNames.length === 0) {
        this.$root.$notify('No existing tags to import', 'info');
        return;
      }

      // Add tags that aren't already in core tags
      const coreTagNames = new Set(this.coreTags.map(t => t.name.toLowerCase().trim()));

      existingTagNames.forEach(tagName => {
        if (!coreTagNames.has(tagName)) {
          this.coreTags.push({
            name: tagName,
            color: this.allTags[tagName] || '#6b7280'
          });
        }
      });

      this.$root.$notify(`Imported ${existingTagNames.length} tags`, 'success');
    },
    deleteAllTags() {
      if (this.coreTags.length === 0) {
        this.$root.$notify('No tags to delete', 'info');
        return;
      }

      if (confirm(`Are you sure you want to delete all ${this.coreTags.length} core tags? This action cannot be undone.`)) {
        this.coreTags = [];
        this.$root.$notify('All tags deleted', 'success');
      }
    },
    async removeAllCharacterTags() {
      const confirmed = confirm(
        'Are you sure you want to remove all tags from every character card?\n\n' +
        'This will:\n' +
        '• Remove tags from all character cards\n' +
        '• Save the updated cards immediately\n' +
        '• This operation CANNOT be undone\n\n' +
        'Do you want to continue?'
      );

      if (!confirmed) return;

      try {
        const response = await fetch('/api/characters/bulk-remove-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error('Failed to remove tags from characters');
        }

        const result = await response.json();

        // Build detailed message
        let message = `Processed ${result.totalFiles} character(s): ${result.updatedCount} updated, ${result.skippedCount} skipped`;

        if (result.errors && result.errors.length > 0) {
          message += `, ${result.errors.length} errors`;
          console.error('Errors during bulk tag removal:', result.errors);
          this.$root.$notify(message, 'warning', 5000);
        } else {
          this.$root.$notify(message, 'success', 4000);
        }

        // Trigger a refresh of the character list if we're on that tab
        window.dispatchEvent(new Event('characters-updated'));
      } catch (error) {
        console.error('Failed to remove character tags:', error);
        this.$root.$notify('Failed to remove tags from characters', 'error');
      }
    }
  }
};
</script>

<style scoped>
.bookkeeping-settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  overflow-y: auto;
  color: var(--text-primary);
  padding: 20px;
}

.settings-header {
  margin-bottom: 24px;
}

.settings-header h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 800px;
}

.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.settings-section h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.section-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label span {
  font-size: 14px;
  font-weight: 500;
}

.setting-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  margin-left: 26px;
  line-height: 1.4;
}

.model-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.model-select:hover {
  border-color: var(--accent-color);
}

.core-tags-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-tertiary);
}

.tag-input {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.color-picker {
  width: 50px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.remove-tag-btn {
  padding: 4px 8px;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-tag-btn:hover {
  background-color: #b91c1c;
}

.add-tag-section {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.add-tag-btn {
  padding: 10px 16px;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
}

.add-tag-btn:hover {
  opacity: 0.9;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  margin-top: 8px;
}

.btn-primary {
  padding: 10px 20px;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 10px 20px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background-color: var(--hover-color);
}

.btn-danger {
  padding: 10px 20px;
  background-color: #dc2626;
  color: white;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-danger:hover {
  background-color: #b91c1c;
}

.bulk-operations {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.btn-danger-large {
  padding: 12px 24px;
  background-color: #dc2626;
  color: white;
  border: 2px solid #b91c1c;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-danger-large:hover {
  background-color: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.warning-text {
  font-size: 13px;
  color: #fbbf24;
  line-height: 1.5;
  margin: 0;
  padding: 8px 12px;
  background-color: rgba(251, 191, 36, 0.1);
  border-left: 3px solid #fbbf24;
  border-radius: 4px;
}
</style>
