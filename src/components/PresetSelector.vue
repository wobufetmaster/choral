<template>
  <div class="preset-manager">
    <div class="preset-header">
      <h2>Preset Manager</h2>
    </div>

    <div class="preset-body">
        <!-- Preset List -->
        <div class="preset-list">
          <h3>Available Presets</h3>
          <div
            v-for="preset in presets"
            :key="preset.filename"
            :class="['preset-item', {
              active: selectedPreset?.filename === preset.filename,
              'is-active-preset': preset.filename === activePresetFilename
            }]"
            @click="selectPreset(preset)"
          >
            <div class="preset-name">
              <span>{{ preset.name }}</span>
              <span v-if="preset.filename === activePresetFilename" class="active-badge">Active</span>
            </div>
            <div class="preset-actions">
              <button
                @click.stop="duplicatePreset(preset)"
                class="duplicate-btn"
                title="Duplicate preset"
              >
                📋
              </button>
              <button
                @click.stop="deletePreset(preset.filename)"
                class="delete-btn"
                v-if="preset.filename !== 'default.json'"
                title="Delete preset"
              >
                🗑️
              </button>
            </div>
          </div>
          <button @click="createNewPreset" class="create-btn">+ New Preset</button>
        </div>

        <!-- Preset Editor -->
        <div class="preset-editor" v-if="selectedPreset">
          <input
            type="file"
            ref="fileInput"
            accept=".json"
            @change="importConfig"
            style="display: none"
          />
          <div class="editor-header">
            <h3>Edit Preset</h3>
            <div class="header-actions">
              <button @click="$refs.fileInput.click()" class="import-btn">📥 Import</button>
              <button @click="savePreset" class="save-btn">💾 Save</button>
              <button @click="setAsActive" class="set-active-btn">⭐ Set as Active</button>
            </div>
          </div>

          <div class="form-group">
            <label>Preset Name</label>
            <input v-model="selectedPreset.name" />
          </div>

          <div class="form-group">
            <label>Model</label>
            <input v-model="selectedPreset.model" placeholder="e.g. anthropic/claude-opus-4" />
          </div>

          <div class="form-group">
            <label>Prompt Processing Mode</label>
            <select v-model="selectedPreset.prompt_processing">
              <option value="merge_system">Merge System (Default - All system messages merged into one)</option>
              <option value="semi_strict">Semi-Strict (One system, then alternating user/assistant)</option>
              <option value="strict">Strict (User first, strict alternation, no system)</option>
              <option value="single_user">Single User (Everything in one user message)</option>
              <option value="anthropic_prefill">Anthropic Prefill (Semi-strict with assistant prefill)</option>
              <option value="none">None (No processing)</option>
            </select>
          </div>

          <div class="param-grid">
            <div class="form-group">
              <label>Temperature</label>
              <input v-model.number="selectedPreset.temperature" type="number" step="0.1" />
            </div>
            <div class="form-group">
              <label>Top P</label>
              <input v-model.number="selectedPreset.top_p" type="number" step="0.01" />
            </div>
            <div class="form-group">
              <label>Top K</label>
              <input v-model.number="selectedPreset.top_k" type="number" />
            </div>
            <div class="form-group">
              <label>Max Tokens</label>
              <input v-model.number="selectedPreset.max_tokens" type="number" />
            </div>
          </div>

          <h4>System Prompts</h4>
          <div class="prompts-list">
            <div v-for="(prompt, index) in selectedPreset.prompts" :key="index" class="prompt-item">
              <div class="prompt-header">
                <input type="checkbox" v-model="prompt.enabled" />
                <input v-model="prompt.name" class="prompt-name" />
                <input v-model.number="prompt.injection_order" type="number" class="prompt-order" placeholder="Order" />
                <button @click="removePrompt(index)" class="remove-btn">×</button>
              </div>
              <textarea v-model="prompt.content" rows="3" placeholder="Prompt content..."></textarea>
            </div>
          </div>

          <button @click="addPrompt" class="add-prompt-btn">+ Add Prompt</button>
        </div>
      </div>
  </div>
</template>

<script>
export default {
  name: 'PresetSelector',
  props: {
    currentSettings: Object,
    tabData: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['apply', 'close', 'update-tab'],
  data() {
    return {
      presets: [],
      selectedPreset: null,
      activePresetFilename: null
    }
  },
  async mounted() {
    await this.loadConfig();
    await this.loadPresets();
  },
  methods: {
    async loadConfig() {
      try {
        const response = await fetch('/api/config');
        const config = await response.json();
        this.activePresetFilename = config.activePreset || 'default.json';
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    },
    async loadPresets() {
      try {
        const response = await fetch('/api/presets');
        this.presets = await response.json();
        if (this.presets.length > 0) {
          // Select the active preset by default
          const activePreset = this.presets.find(p => p.filename === this.activePresetFilename);
          this.selectedPreset = activePreset ? { ...activePreset } : { ...this.presets[0] };
        }
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    },
    selectPreset(preset) {
      this.selectedPreset = { ...preset };
    },
    createNewPreset() {
      this.selectedPreset = {
        name: 'New Preset',
        model: 'anthropic/claude-opus-4',
        temperature: 1.0,
        top_p: 0.92,
        top_k: 0,
        max_tokens: 4096,
        prompt_processing: 'merge_system',
        prompts: []
      };
    },
    duplicatePreset(preset) {
      // Create a deep copy of the preset
      const duplicated = JSON.parse(JSON.stringify(preset));

      // Remove the filename so it will be saved as a new preset
      delete duplicated.filename;

      // Update the name to indicate it's a copy
      duplicated.name = `${preset.name} (Copy)`;

      // Select the duplicated preset for editing
      this.selectedPreset = duplicated;

      this.$root.$notify(`Duplicated "${preset.name}". Edit and save to create the new preset.`, 'success');
    },
    addPrompt() {
      if (!this.selectedPreset.prompts) {
        this.selectedPreset.prompts = [];
      }
      this.selectedPreset.prompts.push({
        identifier: `prompt_${Date.now()}`,
        name: 'New Prompt',
        role: 'system',
        content: '',
        enabled: true,
        injection_order: this.selectedPreset.prompts.length * 100
      });
    },
    removePrompt(index) {
      this.selectedPreset.prompts.splice(index, 1);
    },
    async savePreset() {
      try {
        // Ensure prompts array exists
        if (!this.selectedPreset.prompts) {
          this.selectedPreset.prompts = [];
        }

        const response = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.selectedPreset)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save preset');
        }

        const result = await response.json();
        this.selectedPreset.filename = result.filename;
        await this.loadPresets();

        // Auto-apply the saved preset to the current chat
        this.$emit('apply', this.selectedPreset);

        this.$root.$notify('Preset saved and applied to chat', 'success');
      } catch (error) {
        console.error('Failed to save preset:', error);
        this.$root.$notify(`Failed to save preset: ${error.message}`, 'error');
      }
    },
    async deletePreset(filename) {
      if (!confirm('Delete this preset?')) return;

      try {
        await fetch(`/api/presets/${filename}`, { method: 'DELETE' });
        await this.loadPresets();
        this.$root.$notify('Preset deleted', 'success');
      } catch (error) {
        console.error('Failed to delete preset:', error);
        this.$root.$notify('Failed to delete preset', 'error');
      }
    },
    async setAsActive() {
      if (!this.selectedPreset?.filename) {
        this.$root.$notify('Please save the preset first', 'warning');
        return;
      }

      try {
        const response = await fetch('/api/config/active-preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: this.selectedPreset.filename })
        });

        if (!response.ok) {
          throw new Error('Failed to set active preset');
        }

        this.activePresetFilename = this.selectedPreset.filename;
        this.$root.$notify(`"${this.selectedPreset.name}" is now the active preset`, 'success');
      } catch (error) {
        console.error('Failed to set active preset:', error);
        this.$root.$notify('Failed to set active preset', 'error');
      }
    },
    async importConfig(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);

        const response = await fetch('/api/presets/import/pixijb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to import config');
        }

        const result = await response.json();
        await this.loadPresets();
        this.selectedPreset = result.preset;
        this.$root.$notify('Config imported successfully', 'success');
        event.target.value = '';
      } catch (error) {
        console.error('Failed to import config:', error);
        this.$root.$notify(`Failed to import config: ${error.message}`, 'error');
      }
    }
  }
}
</script>

<style scoped>
.preset-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
}

.preset-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.preset-body {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.preset-item.active {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.preset-item.is-active-preset {
  border-left: 3px solid var(--accent-color);
}

.preset-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.active-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--accent-color);
  color: white;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 600;
}

.preset-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.duplicate-btn, .delete-btn, .remove-btn {
  padding: 4px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  border-radius: 4px;
}

.duplicate-btn:hover {
  background: var(--bg-primary);
  transform: scale(1.1);
}

.delete-btn:hover, .remove-btn:hover {
  background: rgba(220, 38, 38, 0.1);
  transform: scale(1.1);
}

.create-btn {
  margin-top: 8px;
}

.preset-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 12px;
  color: var(--text-secondary);
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-item {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.prompt-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.prompt-name {
  flex: 1;
}

.prompt-order {
  width: 60px;
}

.add-prompt-btn {
  align-self: flex-start;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
}

.editor-header h3 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  background: var(--accent-color);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.set-active-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 8px 16px;
  border: 2px solid var(--accent-color);
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.set-active-btn:hover {
  background: var(--accent-color);
  color: white;
  transform: translateY(-1px);
}

.import-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .preset-body {
    grid-template-columns: 1fr;
  }
}
</style>
