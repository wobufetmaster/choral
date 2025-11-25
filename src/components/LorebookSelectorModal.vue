<template>
  <div v-if="show" class="lorebook-selector-modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Lorebooks</h3>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>
      <div class="lorebook-list">
        <!-- Active Lorebooks Section -->
        <div v-if="activeLorebooksForDisplay.length > 0" class="lorebook-section">
          <div class="lorebook-section-header">
            <h4>Active ({{ activeLorebooksForDisplay.length }})</h4>
          </div>
          <div
            v-for="lorebook in activeLorebooksForDisplay"
            :key="lorebook.filename"
            class="lorebook-option active"
            :class="{ 'auto-selected': isAutoSelected(lorebook.filename) }"
          >
            <input
              type="checkbox"
              :id="'lorebook-' + lorebook.filename"
              :value="lorebook.filename"
              :checked="selectedLorebookFilenames.includes(lorebook.filename)"
              @change="toggleLorebook(lorebook.filename, $event.target.checked)"
              class="lorebook-checkbox"
            />
            <label :for="'lorebook-' + lorebook.filename" class="lorebook-checkbox-label">
              <div class="lorebook-info-wrapper">
                <div class="lorebook-name">
                  {{ lorebook.name }}
                  <span v-if="isAutoSelected(lorebook.filename)" class="auto-tag">AUTO</span>
                </div>
                <div class="lorebook-meta">{{ lorebook.entries?.length || 0 }} entries</div>
              </div>
            </label>
            <button @click="$emit('edit-lorebook', lorebook)" class="edit-button" title="Edit">✏️</button>
          </div>
        </div>

        <!-- Inactive Lorebooks Section -->
        <div v-if="inactiveLorebooksForDisplay.length > 0" class="lorebook-section">
          <div class="lorebook-section-header">
            <h4>Available ({{ inactiveLorebooksForDisplay.length }})</h4>
          </div>
          <div
            v-for="lorebook in inactiveLorebooksForDisplay"
            :key="lorebook.filename"
            class="lorebook-option"
          >
            <input
              type="checkbox"
              :id="'lorebook-' + lorebook.filename"
              :value="lorebook.filename"
              :checked="selectedLorebookFilenames.includes(lorebook.filename)"
              @change="toggleLorebook(lorebook.filename, $event.target.checked)"
              class="lorebook-checkbox"
            />
            <label :for="'lorebook-' + lorebook.filename" class="lorebook-checkbox-label">
              <div class="lorebook-info-wrapper">
                <div class="lorebook-name">
                  {{ lorebook.name }}
                </div>
                <div class="lorebook-meta">{{ lorebook.entries?.length || 0 }} entries</div>
              </div>
            </label>
            <button @click="$emit('edit-lorebook', lorebook)" class="edit-button" title="Edit">✏️</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LorebookSelectorModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    activeLorebooksForDisplay: {
      type: Array,
      default: () => []
    },
    inactiveLorebooksForDisplay: {
      type: Array,
      default: () => []
    },
    selectedLorebookFilenames: {
      type: Array,
      default: () => []
    },
    autoSelectedLorebookFilenames: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'update:selectedLorebookFilenames', 'edit-lorebook'],
  methods: {
    isAutoSelected(filename) {
      return this.autoSelectedLorebookFilenames.includes(filename);
    },
    toggleLorebook(filename, checked) {
      const newSelection = checked
        ? [...this.selectedLorebookFilenames, filename]
        : this.selectedLorebookFilenames.filter(f => f !== filename);
      this.$emit('update:selectedLorebookFilenames', newSelection);
    }
  }
};
</script>

<style scoped>
.lorebook-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-header h3 {
  margin: 0;
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

.lorebook-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lorebook-section {
  margin-bottom: 1rem;
}

.lorebook-section-header {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 0.5rem;
  border-radius: 4px 4px 0 0;
}

.lorebook-section-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lorebook-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  transition: all 0.2s;
}

.lorebook-option:hover {
  background-color: var(--hover-color);
}

.lorebook-option.active {
  background-color: rgba(90, 159, 212, 0.08);
  border-left: 3px solid var(--accent-color);
}

.lorebook-option.auto-selected {
  background-color: rgba(90, 159, 212, 0.15);
  border-color: var(--accent-color);
}

.lorebook-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  flex: 1;
  margin: 0;
}

.lorebook-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.lorebook-info-wrapper {
  flex: 1;
}

.lorebook-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-tag {
  background-color: var(--accent-color);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
}

.lorebook-meta {
  font-size: 0.875rem;
  opacity: 0.7;
}

.edit-button {
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-button:hover {
  background: var(--hover-color);
}
</style>
