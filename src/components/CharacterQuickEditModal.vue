<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content quick-edit-modal" @click.stop>
      <!-- Header with name and close button -->
      <div class="modal-header">
        <h3>{{ localCharacter?.data?.name || 'Character' }}</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="quick-edit-content" v-if="localCharacter">
        <!-- Large portrait at top -->
        <div class="portrait-section">
          <img
            :src="characterImage"
            :alt="localCharacter.data.name"
            class="character-portrait"
            @error="setFallbackAvatar($event)"
          />
        </div>

        <!-- Editable fields -->
        <div class="fields-section">
          <div class="field-group">
            <label>Description</label>
            <textarea
              v-model="localCharacter.data.description"
              @input="handleChange"
              rows="4"
              placeholder="Character description..."
            ></textarea>
          </div>

          <div class="field-group">
            <label>Personality</label>
            <textarea
              v-model="localCharacter.data.personality"
              @input="handleChange"
              rows="3"
              placeholder="Character personality traits..."
            ></textarea>
          </div>

          <div class="field-group">
            <label>Scenario</label>
            <textarea
              v-model="localCharacter.data.scenario"
              @input="handleChange"
              rows="3"
              placeholder="The setting or situation..."
            ></textarea>
          </div>

          <div class="field-group">
            <label>First Message</label>
            <textarea
              v-model="localCharacter.data.first_mes"
              @input="handleChange"
              rows="4"
              placeholder="Character's opening message..."
            ></textarea>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="actions-section">
          <div class="save-status">
            <span v-if="saving" class="status-saving">Saving...</span>
            <span v-else-if="lastSaved" class="status-saved">Saved</span>
          </div>
          <button @click="openFullEditor" class="full-editor-btn">
            Open Full Editor
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useApi } from '../composables/useApi.js';

export default {
  name: 'CharacterQuickEditModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    character: {
      type: Object,
      default: null
    },
    characterFilename: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'open-full-editor', 'character-updated'],
  setup() {
    const api = useApi();
    return { api };
  },
  data() {
    return {
      localCharacter: null,
      saving: false,
      lastSaved: false,
      saveTimeout: null
    };
  },
  computed: {
    characterImage() {
      if (this.characterFilename) {
        return `/api/characters/${this.characterFilename}/image`;
      }
      return this.localCharacter?.avatar || '';
    }
  },
  watch: {
    character: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          // Deep clone to avoid mutating prop
          this.localCharacter = JSON.parse(JSON.stringify(newVal));
          this.lastSaved = false;
        }
      }
    },
    show(newVal) {
      if (!newVal) {
        // Clear any pending saves when modal closes
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
          this.saveTimeout = null;
        }
      }
    }
  },
  methods: {
    setFallbackAvatar(event) {
      const svgQuestionMark = `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
          <rect width="48" height="48" fill="#3a3f4b" rx="12"/>
          <text x="24" y="32" font-family="Arial, sans-serif" font-size="28" fill="#8b92a8" text-anchor="middle" font-weight="bold">?</text>
        </svg>
      `)}`;
      event.target.src = svgQuestionMark;
    },
    handleChange() {
      // Debounced autosave
      this.lastSaved = false;
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.saveCharacter();
      }, 1000); // Save 1 second after user stops typing
    },
    async saveCharacter() {
      if (!this.characterFilename || !this.localCharacter) return;

      this.saving = true;
      try {
        await this.api.updateCharacter(this.characterFilename, this.localCharacter);
        this.lastSaved = true;
        this.$emit('character-updated', this.localCharacter);
      } catch (error) {
        console.error('Failed to save character:', error);
        this.$root?.$notify?.('Failed to save character', 'error');
      } finally {
        this.saving = false;
      }
    },
    openFullEditor() {
      // Save any pending changes first
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveCharacter();
      }
      this.$emit('open-full-editor');
    }
  },
  beforeUnmount() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
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
  max-width: 550px;
  width: 90%;
  max-height: 85vh;
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

.quick-edit-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.portrait-section {
  display: flex;
  justify-content: center;
}

.character-portrait {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.fields-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-group textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.4;
  resize: vertical;
  font-family: inherit;
}

.field-group textarea:focus {
  outline: none;
  border-color: var(--accent-color);
}

.field-group textarea::placeholder {
  color: var(--text-tertiary);
}

.actions-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.save-status {
  font-size: 0.85rem;
  min-width: 60px;
}

.status-saving {
  color: var(--text-secondary);
}

.status-saved {
  color: var(--text-success, #22c55e);
}

.full-editor-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.full-editor-btn:hover {
  background: var(--hover-color);
}
</style>
