<template>
  <div class="lorebook-manager">
    <div class="lorebook-header">
      <button @click="$router.push('/')" class="back-button">← Back</button>
      <h2>Lorebook Manager</h2>
      <div class="header-actions">
        <button @click="refreshLorebooks" class="btn-secondary">🔄 Refresh</button>
        <button @click="triggerImport" class="btn-secondary">Import Lorebook</button>
        <button @click="createNewLorebook" class="btn-primary">New Lorebook</button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        @change="handleFileImport"
        style="display: none"
      />
    </div>

    <div class="lorebook-list-container" :class="{ expanded: !selectedLorebook }">
      <div class="search-section">
        <input
          v-model="lorebookSearch"
          type="text"
          placeholder="Search lorebooks..."
          class="search-input"
        />
      </div>
      <div class="lorebook-list">
        <div
          v-for="lorebook in filteredLorebooks"
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
        <div v-if="selectedLorebook.autoSelect" class="tag-bindings-section">
          <label>Tags to match:</label>
          <p class="hint">Auto-select this lorebook for characters with these tags</p>
          <div class="tag-bindings">
            <div class="current-tags">
              <span
                v-for="tag in (selectedLorebook.matchTags || '').split(',').map(t => t.trim()).filter(t => t)"
                :key="tag"
                class="tag"
              >
                {{ tag }}
                <button @click="removeTag(tag)" class="remove-tag">×</button>
              </span>
            </div>
            <input
              v-model="newTagInput"
              @keydown.enter="addTag"
              @input="updateTagSuggestions"
              placeholder="Add tag (press Enter)"
              class="tag-input-field"
            />
            <div v-if="tagSuggestions.length > 0" class="tag-suggestions">
              <div
                v-for="suggestion in tagSuggestions"
                :key="suggestion"
                @click="addSuggestedTag(suggestion)"
                class="tag-suggestion"
              >
                {{ suggestion }}
              </div>
            </div>
          </div>
        </div>
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
              rows="3"
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
import { useApi } from '../composables/useApi.js';

export default {
  name: 'LorebookManager',
  setup() {
    const api = useApi();
    return { api };
  },
  data() {
    return {
      lorebooks: [],
      selectedLorebook: null,
      lorebookSearch: '',
      availableCharacters: [],
      newTagInput: '',
      tagSuggestions: []
    };
  },
  computed: {
    filteredLorebooks() {
      if (!this.lorebookSearch.trim()) {
        return this.lorebooks;
      }
      const query = this.lorebookSearch.toLowerCase();
      return this.lorebooks.filter(lorebook =>
        lorebook.name?.toLowerCase().includes(query)
      );
    },
    allCharacterTags() {
      const tags = new Set();
      this.availableCharacters.forEach(char => {
        const characterTags = char.tags || char.data?.tags || [];
        characterTags.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
    }
  },
  async mounted() {
    await this.loadLorebooks();
    await this.loadCharacters();
  },
  methods: {
    async loadLorebooks() {
      try {
        this.lorebooks = await this.api.getLorebooks();
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

      // Initialize missing required fields
      if (!this.selectedLorebook.name) {
        this.selectedLorebook.name = 'Unnamed Lorebook';
      }
      if (this.selectedLorebook.autoSelect === undefined) {
        this.selectedLorebook.autoSelect = false;
      }
      if (!this.selectedLorebook.matchTags) {
        this.selectedLorebook.matchTags = '';
      }
      if (this.selectedLorebook.scanDepth === undefined) {
        this.selectedLorebook.scanDepth = 0;
      }
      if (!this.selectedLorebook.entries) {
        this.selectedLorebook.entries = [];
      }

      // Initialize entries (ensure entries is an array)
      if (Array.isArray(this.selectedLorebook.entries)) {
        this.selectedLorebook.entries.forEach(entry => {
        // Initialize missing entry fields
        if (entry.enabled === undefined) {
          entry.enabled = true;
        }
        if (entry.constant === undefined) {
          entry.constant = false;
        }
        if (!entry.name) {
          entry.name = 'Unnamed Entry';
        }
        if (!entry.keys) {
          entry.keys = [];
        }
        if (!entry.content) {
          entry.content = '';
        }
        if (entry.priority === undefined) {
          entry.priority = 0;
        }
        if (!entry.regex) {
          entry.regex = '';
        }

        // Initialize keysInput for display
        if (!entry.keysInput && entry.keys) {
          entry.keysInput = entry.keys.join(', ');
        }
        if (!entry.keysInput) {
          entry.keysInput = '';
        }
      });
      }
    },
    async refreshLorebooks() {
      this.selectedLorebook = null; // Close any open editor
      await this.loadLorebooks();
      this.$root.$notify?.('Lorebooks refreshed', 'success');
    },
    async saveLorebook() {
      try {
        const result = await this.api.saveLorebook(this.selectedLorebook);

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
        await this.api.deleteLorebook(filename);

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
    },
    triggerImport() {
      this.$refs.fileInput.click();
    },
    async handleFileImport(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const lorebookData = JSON.parse(text);

        // Send to import endpoint
        const result = await this.api.importLorebook(lorebookData);

        if (result.success) {
          await this.loadLorebooks();
          alert(`Imported "${result.lorebook.name}" with ${result.lorebook.entries.length} entries`);
        } else {
          alert('Import failed: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Failed to import lorebook: ' + error.message);
        console.error('Import error:', error);
      } finally {
        // Reset file input
        event.target.value = '';
      }
    },
    async loadCharacters() {
      try {
        this.availableCharacters = await this.api.getCharacters();
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    updateTagSuggestions() {
      if (!this.newTagInput.trim()) {
        this.tagSuggestions = [];
        return;
      }

      const query = this.newTagInput.toLowerCase();
      const currentTags = this.selectedLorebook.matchTags
        ? this.selectedLorebook.matchTags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      this.tagSuggestions = this.allCharacterTags
        .filter(tag =>
          tag.toLowerCase().includes(query) &&
          !currentTags.includes(tag)
        )
        .slice(0, 5);
    },
    addTag() {
      const tag = this.newTagInput.trim();
      if (!tag) return;

      const currentTags = this.selectedLorebook.matchTags
        ? this.selectedLorebook.matchTags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        this.selectedLorebook.matchTags = currentTags.join(', ');
        this.newTagInput = '';
        this.tagSuggestions = [];
      }
    },
    addSuggestedTag(tag) {
      const currentTags = this.selectedLorebook.matchTags
        ? this.selectedLorebook.matchTags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        this.selectedLorebook.matchTags = currentTags.join(', ');
        this.newTagInput = '';
        this.tagSuggestions = [];
      }
    },
    removeTag(tagToRemove) {
      const currentTags = this.selectedLorebook.matchTags
        ? this.selectedLorebook.matchTags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      const filtered = currentTags.filter(tag => tag !== tagToRemove);
      this.selectedLorebook.matchTags = filtered.join(', ');
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

.header-actions {
  display: flex;
  gap: 0.5rem;
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

.lorebook-list-container {
  display: flex;
  flex-direction: column;
  max-height: 250px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.lorebook-list-container.expanded {
  flex: 1;
  max-height: none;
}

.search-section {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.lorebook-list {
  flex: 1;
  overflow-y: auto;
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

.tag-bindings-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  margin-top: 0.5rem;
}

.tag-bindings-section label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0;
}

.tag-bindings-section .hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.tag-bindings {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.current-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-tag:hover {
  opacity: 0.8;
}

.tag-input-field {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.tag-input-field:focus {
  outline: none;
  border-color: var(--accent-color);
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.tag-suggestion {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.875rem;
}

.tag-suggestion:hover {
  background: var(--hover-color);
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
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background-color: var(--bg-secondary);
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
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
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.match-section label {
  display: block;
  margin-bottom: 0.125rem;
  font-size: 0.8rem;
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
  margin-bottom: 0.125rem;
  font-size: 0.8rem;
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
  margin-top: 0.5rem;
}

.entry-settings label {
  font-size: 0.8rem;
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
