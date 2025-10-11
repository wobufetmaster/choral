<template>
  <div class="lorebook-editor-modal">
    <div class="modal-content large">
      <div class="modal-header">
        <h3>Edit: {{ localLorebook.name }}</h3>
        <button @click="close" class="close-button">×</button>
      </div>
      <div class="lorebook-editor-content">
        <div class="editor-field">
          <label>Lorebook Name:</label>
          <input v-model="localLorebook.name" type="text" class="lorebook-name-input" />
        </div>

        <div class="lorebook-settings">
          <label>
            <input type="checkbox" v-model="localLorebook.autoSelect" />
            Auto-select for characters with matching tags
          </label>
          <label v-if="localLorebook.autoSelect">
            Tags to match:
            <input
              v-model="localLorebook.matchTags"
              type="text"
              placeholder="tag1, tag2, tag3"
              class="tag-input"
            />
          </label>
          <label>
            Scan depth (0 = all messages):
            <input v-model.number="localLorebook.scanDepth" type="number" min="0" class="scan-depth-input" />
          </label>
        </div>

        <div class="entries-section">
          <div class="entries-header">
            <h4>Entries</h4>
            <button @click="addEntry" class="btn-primary">Add Entry</button>
          </div>

          <div
            v-for="(entry, index) in localLorebook.entries"
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
                <label>Keywords (case-insensitive):</label>
                <input
                  v-model="entry.keysInput"
                  @input="updateEntryKeys(entry)"
                  type="text"
                  placeholder="keyword1, keyword2, keyword3"
                  class="keys-input"
                />
              </div>

              <div class="match-section">
                <label>Regex Pattern:</label>
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

          <div v-if="!localLorebook.entries || localLorebook.entries.length === 0" class="no-entries">
            No entries yet. Click "Add Entry" to create one.
          </div>
        </div>

        <div class="editor-actions">
          <button @click="save" class="btn-primary">Save Changes</button>
          <button @click="close" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LorebookEditor',
  props: {
    lorebook: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'save'],
  data() {
    return {
      localLorebook: null
    }
  },
  created() {
    // Deep clone to avoid mutations
    this.localLorebook = JSON.parse(JSON.stringify(this.lorebook));

    // Initialize keysInput for display
    if (this.localLorebook.entries) {
      this.localLorebook.entries.forEach(entry => {
        if (!entry.keysInput && entry.keys) {
          entry.keysInput = entry.keys.join(', ');
        }
        if (entry.enabled === undefined) {
          entry.enabled = true;
        }
      });
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    save() {
      this.$emit('save', this.localLorebook);
    },
    addEntry() {
      if (!this.localLorebook.entries) {
        this.localLorebook.entries = [];
      }

      this.localLorebook.entries.push({
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
      this.localLorebook.entries.splice(index, 1);
    },
    updateEntryKeys(entry) {
      // Convert comma-separated string to array
      entry.keys = entry.keysInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }
  }
}
</script>

<style scoped>
.lorebook-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.modal-content {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content.large {
  max-width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
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

.lorebook-editor-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.lorebook-name-input {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 1rem;
}

.lorebook-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.lorebook-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-primary);
}

.lorebook-settings input[type="checkbox"] {
  width: auto;
}

.tag-input,
.scan-depth-input {
  flex: 1;
  padding: 0.375rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  margin-left: 0.5rem;
}

.entries-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.entries-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.entries-header h4 {
  margin: 0;
  font-size: 1.125rem;
}

.entry-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.entry-name-input {
  flex: 1;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-weight: 500;
}

.entry-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.btn-delete {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-delete:hover {
  background: #b91c1c;
}

.entry-matching {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.match-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.match-section label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.keys-input,
.regex-input {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.entry-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.entry-content label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.content-textarea {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.entry-settings {
  display: flex;
  gap: 1rem;
}

.entry-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.priority-input {
  width: 80px;
  padding: 0.375rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.no-entries {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}

.editor-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn-primary {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.625rem 1.25rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--hover-color);
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
    padding: 1rem;
  }

  .entry-matching {
    grid-template-columns: 1fr;
  }

  .entry-header {
    flex-direction: column;
    align-items: stretch;
  }

  .entry-controls {
    flex-wrap: wrap;
  }
}
</style>
