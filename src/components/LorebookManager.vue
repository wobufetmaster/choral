<template>
  <div class="lorebook-manager">
    <div class="lorebook-header">
      <button @click="$router.push('/')" class="back-button">← Back</button>
      <h2>Lorebook Manager</h2>
      <button @click="createNewLorebook" class="btn-primary">New Lorebook</button>
    </div>

    <div class="lorebook-list">
      <div
        v-for="lorebook in lorebooks"
        :key="lorebook.filename"
        class="lorebook-item"
        :class="{ active: selectedLorebook?.filename === lorebook.filename }"
        @click="selectLorebook(lorebook)"
      >
        <div class="lorebook-info">
          <div class="lorebook-name">{{ lorebook.name }}</div>
          <div class="lorebook-meta">
            {{ lorebook.entries?.length || 0 }} entries
            <span v-if="lorebook.autoSelect" class="auto-badge">AUTO</span>
          </div>
        </div>
        <button @click.stop="deleteLorebook(lorebook.filename)" class="btn-delete">×</button>
      </div>
    </div>

    <div v-if="selectedLorebook" class="lorebook-editor">
      <div class="editor-header">
        <input
          v-model="selectedLorebook.name"
          type="text"
          class="lorebook-name-input"
          placeholder="Lorebook Name"
        />
        <div class="editor-actions">
          <button @click="saveLorebook" class="btn-primary">Save</button>
          <button @click="selectedLorebook = null" class="btn-secondary">Close</button>
        </div>
      </div>

      <div class="lorebook-settings">
        <label>
          <input type="checkbox" v-model="selectedLorebook.autoSelect" />
          Auto-select for characters with matching tags
        </label>
        <label v-if="selectedLorebook.autoSelect">
          Tags to match:
          <input
            v-model="selectedLorebook.matchTags"
            type="text"
            placeholder="tag1, tag2, tag3"
            class="tag-input"
          />
        </label>
        <label>
          Scan depth (0 = all messages):
          <input v-model.number="selectedLorebook.scanDepth" type="number" min="0" class="scan-depth-input" />
        </label>
      </div>

      <div class="entries-section">
        <div class="entries-header">
          <h3>Entries</h3>
          <button @click="addEntry" class="btn-primary">Add Entry</button>
        </div>

        <div
          v-for="(entry, index) in selectedLorebook.entries"
          :key="index"
          class="entry-item"
        >
          <div class="entry-header">
            <input
              v-model="entry.name"
              type="text"
              placeholder="Entry Name"
              class="entry-name-input"
            />
            <div class="entry-controls">
              <label class="checkbox-label">
                <input type="checkbox" v-model="entry.enabled" />
                Enabled
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="entry.constant" />
                Always On
              </label>
              <button @click="removeEntry(index)" class="btn-delete">Delete</button>
            </div>
          </div>

          <div class="entry-matching">
            <div class="match-section">
              <label>Simple Keywords (case-insensitive):</label>
              <input
                v-model="entry.keysInput"
                @input="updateKeys(entry)"
                type="text"
                placeholder="keyword1, keyword2, keyword3"
                class="keys-input"
              />
            </div>

            <div class="match-section">
              <label>Regex Pattern (advanced):</label>
              <input
                v-model="entry.regex"
                type="text"
                placeholder="^pattern.*"
                class="regex-input"
              />
            </div>
          </div>

          <div class="entry-content">
            <label>Content:</label>
            <textarea
              v-model="entry.content"
              placeholder="Information to inject when matched..."
              rows="4"
              class="content-textarea"
            ></textarea>
          </div>

          <div class="entry-settings">
            <label>
              Priority (higher = injected first):
              <input v-model.number="entry.priority" type="number" class="priority-input" />
            </label>
          </div>
        </div>

        <div v-if="!selectedLorebook.entries || selectedLorebook.entries.length === 0" class="no-entries">
          No entries yet. Click "Add Entry" to create one.
        </div>
      </div>
    </div>

    <div v-else class="no-selection">
      Select a lorebook to edit or create a new one
    </div>
  </div>
</template>

<script>
export default {
  name: 'LorebookManager',
  data() {
    return {
      lorebooks: [],
      selectedLorebook: null
    };
  },
  async mounted() {
    await this.loadLorebooks();
  },
  methods: {
    async loadLorebooks() {
      try {
        const response = await fetch('/api/lorebooks');
        this.lorebooks = await response.json();
      } catch (error) {
        console.error('Failed to load lorebooks:', error);
      }
    },
    createNewLorebook() {
      this.selectedLorebook = {
        filename: null,
        name: 'New Lorebook',
        autoSelect: false,
        matchTags: '',
        scanDepth: 0,
        entries: []
      };
    },
    selectLorebook(lorebook) {
      // Deep clone to avoid mutations
      this.selectedLorebook = JSON.parse(JSON.stringify(lorebook));

      // Initialize keysInput for display
      if (this.selectedLorebook.entries) {
        this.selectedLorebook.entries.forEach(entry => {
          if (!entry.keysInput && entry.keys) {
            entry.keysInput = entry.keys.join(', ');
          }
          if (entry.enabled === undefined) {
            entry.enabled = true;
          }
        });
      }
    },
    async saveLorebook() {
      try {
        const response = await fetch('/api/lorebooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.selectedLorebook)
        });

        const result = await response.json();

        if (result.success) {
          await this.loadLorebooks();
          this.selectedLorebook = null;
        }
      } catch (error) {
        console.error('Failed to save lorebook:', error);
      }
    },
    async deleteLorebook(filename) {
      if (!confirm('Delete this lorebook?')) return;

      try {
        await fetch(`/api/lorebooks/${filename}`, {
          method: 'DELETE'
        });

        await this.loadLorebooks();
        if (this.selectedLorebook?.filename === filename) {
          this.selectedLorebook = null;
        }
      } catch (error) {
        console.error('Failed to delete lorebook:', error);
      }
    },
    addEntry() {
      if (!this.selectedLorebook.entries) {
        this.selectedLorebook.entries = [];
      }

      this.selectedLorebook.entries.push({
        name: 'New Entry',
        enabled: true,
        constant: false,
        keys: [],
        keysInput: '',
        regex: '',
        content: '',
        priority: 0
      });
    },
    removeEntry(index) {
      this.selectedLorebook.entries.splice(index, 1);
    },
    updateKeys(entry) {
      // Convert comma-separated string to array
      entry.keys = entry.keysInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }
  }
};
</script>

<style scoped>
.lorebook-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  gap: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 1rem;
}

.lorebook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  gap: 1rem;
}

.lorebook-header h2 {
  flex: 1;
}

.back-button {
  padding: 0.5rem 1rem;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.back-button:hover {
  background-color: var(--hover-color);
}

.lorebook-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.lorebook-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.lorebook-item:hover {
  background-color: var(--hover-color);
}

.lorebook-item.active {
  background-color: var(--accent-color);
  color: white;
}

.lorebook-info {
  flex: 1;
}

.lorebook-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.lorebook-meta {
  font-size: 0.875rem;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-badge {
  background-color: var(--accent-color);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

.lorebook-editor {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.lorebook-name-input {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.lorebook-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.lorebook-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tag-input,
.scan-depth-input {
  flex: 1;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.entries-section {
  margin-top: 1rem;
}

.entries-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.entry-item {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: var(--bg-secondary);
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.entry-name-input {
  flex: 1;
  font-weight: 600;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.entry-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.entry-matching {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.match-section label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.keys-input,
.regex-input {
  width: 100%;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.entry-content label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.content-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.entry-settings {
  margin-top: 0.75rem;
}

.priority-input {
  width: 80px;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.no-entries {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-style: italic;
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
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: var(--hover-color);
}

.btn-delete {
  padding: 0.25rem 0.5rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}

.btn-delete:hover {
  background-color: #b91c1c;
}
</style>
