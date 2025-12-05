<template>
  <div class="bookkeeping-settings">
    <div class="settings-header">
      <h2>Bookkeeping Settings</h2>
      <p class="subtitle">Configure auto-tagging behavior and manage core tags</p>
    </div>

    <div class="settings-content">
      <!-- Enable Bookkeeping Section -->
      <section class="settings-section">
        <h3>Enable Bookkeeping Features</h3>
        <p class="section-description">
          Bookkeeping features use AI to automatically tag characters and rename chats.
          <strong>These features make API calls and will cost money.</strong> Enable them only after reviewing the settings below.
        </p>

        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="settings.enableBookkeeping" />
            <span>Enable Bookkeeping Features</span>
          </label>
          <p class="setting-description">
            When enabled, allows auto-tagging and auto-renaming features to run. Must be enabled for bookkeeping to work.
          </p>
        </div>

        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="settings.autoRenameChats" :disabled="!settings.enableBookkeeping" />
            <span>Auto-Rename Chats</span>
          </label>
          <p class="setting-description">
            <strong>⚠️ Runs automatically:</strong> When enabled, new chats and chats loaded from history will be automatically renamed using the bookkeeping model.
            This happens in the background every time you start or load a chat. Manual renames are preserved.
          </p>
        </div>

        <div class="action-buttons">
          <button @click="saveSettings" class="btn-primary">Save Settings</button>
        </div>
      </section>

      <!-- Bookkeeping Model Section -->
      <section class="settings-section">
        <h3>Bookkeeping Model</h3>
        <p class="section-description">
          This model is used for all bookkeeping tasks: auto-tagging and auto-naming chats.
          Choose a cheap, fast model for best results.
        </p>

        <div class="setting-group">
          <label for="bookkeeping-model-select">Bookkeeping Model:</label>
          <select id="bookkeeping-model-select" v-model="settings.model" class="model-select">
            <option value="deepseek/deepseek-chat-v3.1">DeepSeek Chat v3.1 (very cheap)</option>
            <option value="openai/gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
            <option value="google/gemini-2.0-flash-exp">Gemini 2.0 Flash (fast, cheap)</option>
            <option value="mistralai/mistral-nemo">Mistral Nemo</option>
            <option value="openai/gpt-4o">GPT-4o (balanced)</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (best quality)</option>
            <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
          </select>
        </div>

        <div class="action-buttons">
          <button @click="saveSettings" class="btn-primary">Save Model</button>
        </div>
      </section>

      <!-- Auto-naming Configuration -->
      <section class="settings-section">
        <h3>Auto-Naming Configuration</h3>
        <p class="section-description">
          Customize the prompt used to generate chat titles. The prompt will receive conversation text and should generate a 3-6 word title.
        </p>

        <div class="setting-group">
          <label for="auto-naming-prompt">Auto-Naming Prompt:</label>
          <textarea
            id="auto-naming-prompt"
            v-model="settings.autoNamingPrompt"
            class="prompt-textarea"
            rows="10"
            placeholder="Enter the prompt for auto-naming chats..."
          ></textarea>
          <p class="setting-description" v-pre>
            Use <code>{{conversationText}}</code> as a placeholder for the actual conversation content.
          </p>
        </div>

        <div class="action-buttons">
          <button @click="resetAutoNamingPrompt" class="btn-secondary">Reset to Default</button>
          <button @click="saveSettings" class="btn-primary">Save Prompt</button>
        </div>
      </section>

      <!-- Auto-tagger Configuration -->
      <section class="settings-section">
        <h3>Auto-Tagger Configuration</h3>
        <p class="section-description">
          Customize the prompt used to generate character tags and configure strict mode.
        </p>

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

        <div class="setting-group">
          <label for="auto-tagging-prompt-strict">Auto-Tagging Prompt (Strict Mode):</label>
          <textarea
            id="auto-tagging-prompt-strict"
            v-model="settings.autoTaggingPromptStrict"
            class="prompt-textarea"
            rows="12"
            placeholder="Enter the prompt for auto-tagging in strict mode..."
          ></textarea>
          <p class="setting-description" v-pre>
            Use <code>{{availableTags}}</code> for the tag list and <code>{{characterInfo}}</code> for character details.
          </p>
        </div>

        <div class="setting-group">
          <label for="auto-tagging-prompt-normal">Auto-Tagging Prompt (Normal Mode):</label>
          <textarea
            id="auto-tagging-prompt-normal"
            v-model="settings.autoTaggingPromptNormal"
            class="prompt-textarea"
            rows="12"
            placeholder="Enter the prompt for auto-tagging in normal mode..."
          ></textarea>
          <p class="setting-description" v-pre>
            Use <code>{{existingTagsSection}}</code> for existing tags and <code>{{characterInfo}}</code> for character details.
          </p>
        </div>

        <div class="action-buttons">
          <button @click="resetAutoTaggingPrompts" class="btn-secondary">Reset to Defaults</button>
          <button @click="saveSettings" class="btn-primary">Save Prompts</button>
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
          <button @click="removeNonCoreTags" class="btn-warning-large">
            Remove Non-Core Tags from All Characters
          </button>
          <p class="info-text">
            This will remove all tags except core tags from every character card. Core tags will be preserved.
          </p>

          <button @click="removeAllCharacterTags" class="btn-danger-large">
            Remove All Tags from All Characters
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
import { useApi } from '../composables/useApi';

export default {
  name: 'BookkeepingSettings',
  props: {
    tabData: {
      type: Object,
      default: () => ({})
    }
  },
  setup() {
    const api = useApi();
    return { api };
  },
  data() {
    return {
      settings: {
        enableBookkeeping: false,
        autoRenameChats: false,
        model: 'openai/gpt-4o-mini',
        strictMode: false,
        autoNamingPrompt: this.getDefaultAutoNamingPrompt(),
        autoTaggingPromptStrict: this.getDefaultAutoTaggingPromptStrict(),
        autoTaggingPromptNormal: this.getDefaultAutoTaggingPromptNormal()
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
    getDefaultAutoNamingPrompt() {
      return `Analyze this conversation and generate a short, descriptive title (3-6 words).
The title should capture the main topic, theme, or scenario of the conversation.
Be concise and descriptive. Use title case.

Examples of good titles:
- "Robot Girlfriend Paradox"
- "Coffee Shop Philosophy"
- "Dragon Heist Planning"
- "Late Night Confession"
- "Time Travel Paradox"

Conversation:
{{conversationText}}

Generate a short title (3-6 words) that captures the essence of this conversation.`;
    },
    getDefaultAutoTaggingPromptStrict() {
      return `Analyze this character and select the most relevant tags from the provided list. You MUST ONLY use tags from this list, do not create new tags.

Available tags:
{{availableTags}}

Character Information:
{{characterInfo}}

Select 5-10 relevant tags from the list above. For each tag, provide the tag name and assign a meaningful CSS color (hex code) that relates to the tag's meaning. Examples:
- sci-fi: #4a9eff (blue)
- fantasy: #22c55e (green)
- romance: #ec4899 (pink)
- horror: #dc2626 (red)
- comedy: #f59e0b (orange)`;
    },
    getDefaultAutoTaggingPromptNormal() {
      return `Analyze this character and generate relevant tags with appropriate colors. Tags should be concise, descriptive keywords (e.g., genre, setting, personality traits, themes).

IMPORTANT: If any existing tags are relevant, YOU MUST reuse them exactly as shown. Only create new tags if none of the existing tags fit. Avoid creating similar variations (e.g., don't create "science fiction" if "sci-fi" exists, or "alien encounter" if "alien" exists).{{existingTagsSection}}

Character Information:
{{characterInfo}}

Generate 5-10 relevant tags with colors. For new tags, assign meaningful CSS colors (hex codes) that relate to the tag's meaning. Examples:
- sci-fi: #4a9eff (blue)
- fantasy: #22c55e (green)
- romance: #ec4899 (pink)
- horror: #dc2626 (red)
- comedy: #f59e0b (orange)`;
    },
    resetAutoNamingPrompt() {
      this.settings.autoNamingPrompt = this.getDefaultAutoNamingPrompt();
      this.$root.$notify('Auto-naming prompt reset to default', 'info');
    },
    resetAutoTaggingPrompts() {
      this.settings.autoTaggingPromptStrict = this.getDefaultAutoTaggingPromptStrict();
      this.settings.autoTaggingPromptNormal = this.getDefaultAutoTaggingPromptNormal();
      this.$root.$notify('Auto-tagging prompts reset to defaults', 'info');
    },
    async loadSettings() {
      try {
        const loadedSettings = await this.api.getBookkeepingSettings();
        // Merge with defaults to ensure all fields exist
        this.settings = {
          enableBookkeeping: loadedSettings.enableBookkeeping || false,
          autoRenameChats: loadedSettings.autoRenameChats || false,
          model: loadedSettings.model || 'openai/gpt-4o-mini',
          strictMode: loadedSettings.strictMode || false,
          autoNamingPrompt: loadedSettings.autoNamingPrompt || this.getDefaultAutoNamingPrompt(),
          autoTaggingPromptStrict: loadedSettings.autoTaggingPromptStrict || this.getDefaultAutoTaggingPromptStrict(),
          autoTaggingPromptNormal: loadedSettings.autoTaggingPromptNormal || this.getDefaultAutoTaggingPromptNormal()
        };
      } catch (error) {
        console.error('Failed to load bookkeeping settings:', error);
        this.$root.$notify('Failed to load settings', 'error');
      }
    },
    async saveSettings() {
      try {
        await this.api.saveBookkeepingSettings(this.settings);
        this.$root.$notify('Settings saved successfully', 'success');
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.$root.$notify('Failed to save settings', 'error');
      }
    },
    async loadCoreTags() {
      try {
        const tags = await this.api.getCoreTags();
        // Convert to format with name and color
        this.coreTags = tags.map(tag => {
          if (typeof tag === 'string') {
            return { name: tag, color: '#6b7280' };
          }
          return tag;
        });
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

        await this.api.saveCoreTags(tags);

        // Also update the tag colors in the global tags file
        // Preserve existing tag data (like character associations) while updating colors
        const updatedTags = { ...this.allTags };
        this.coreTags.forEach(tag => {
          if (tag.name.trim()) {
            const normalized = tag.name.toLowerCase().trim();
            const existingData = updatedTags[normalized];

            if (existingData && typeof existingData === 'object') {
              // Update color on existing tag object
              updatedTags[normalized] = { ...existingData, color: tag.color };
            } else {
              // Simple color string format
              updatedTags[normalized] = tag.color;
            }
          }
        });

        await this.api.saveTags(updatedTags);

        this.$root.$notify('Core tags saved successfully', 'success');
        await this.loadAllTags(); // Reload to get updated colors
      } catch (error) {
        console.error('Failed to save core tags:', error);
        this.$root.$notify('Failed to save core tags', 'error');
      }
    },
    async loadAllTags() {
      try {
        this.allTags = await this.api.getTags();
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
    getTagColorFromData(tagData) {
      // Extract color from either string or object format
      if (!tagData) return '#6b7280';
      if (typeof tagData === 'string') return tagData;
      return tagData.color || '#6b7280';
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

      let importedCount = 0;
      existingTagNames.forEach(tagName => {
        if (!coreTagNames.has(tagName)) {
          this.coreTags.push({
            name: tagName,
            color: this.getTagColorFromData(this.allTags[tagName])
          });
          importedCount++;
        }
      });

      this.$root.$notify(`Imported ${importedCount} tags`, 'success');
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
    async removeNonCoreTags() {
      if (this.coreTags.length === 0) {
        this.$root.$notify('No core tags defined. Define core tags first or use "Remove All Tags" instead.', 'warning');
        return;
      }

      const coreTagNames = this.coreTags.map(t => t.name.trim()).filter(Boolean);
      const confirmed = confirm(
        `Are you sure you want to remove all non-core tags from every character card?\n\n` +
        `Core tags that will be preserved (${coreTagNames.length}):\n` +
        `${coreTagNames.slice(0, 10).join(', ')}${coreTagNames.length > 10 ? '...' : ''}\n\n` +
        'This will:\n' +
        '• Remove all tags except core tags from all character cards\n' +
        '• Save the updated cards immediately\n' +
        '• This operation CANNOT be undone\n\n' +
        'Do you want to continue?'
      );

      if (!confirmed) return;

      try {
        const response = await fetch('/api/characters/bulk-remove-non-core-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error('Failed to remove non-core tags from characters');
        }

        const result = await response.json();

        // Build detailed message
        let message = `Processed ${result.totalFiles} character(s): ${result.updatedCount} updated, ${result.skippedCount} skipped`;

        if (result.errors && result.errors.length > 0) {
          message += `, ${result.errors.length} errors`;
          console.error('Errors during bulk non-core tag removal:', result.errors);
          this.$root.$notify(message, 'warning', 5000);
        } else {
          this.$root.$notify(message, 'success', 4000);
        }

        // Trigger a refresh of the character list if we're on that tab
        window.dispatchEvent(new Event('characters-updated'));
      } catch (error) {
        console.error('Failed to remove non-core tags:', error);
        this.$root.$notify('Failed to remove non-core tags from characters', 'error');
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

.info-text {
  font-size: 13px;
  color: #60a5fa;
  line-height: 1.5;
  margin: 0;
  padding: 8px 12px;
  background-color: rgba(96, 165, 250, 0.1);
  border-left: 3px solid #60a5fa;
  border-radius: 4px;
}

.btn-warning-large {
  padding: 12px 24px;
  background-color: #f59e0b;
  color: white;
  border: 2px solid #d97706;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-warning-large:hover {
  background-color: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.prompt-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
}

.prompt-textarea:focus {
  outline: none;
  border-color: var(--accent-color);
}

.setting-description code {
  background-color: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: var(--accent-color);
}
</style>
