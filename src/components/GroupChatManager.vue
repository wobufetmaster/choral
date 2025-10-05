<template>
  <div class="group-chat-manager">
    <div class="manager-header">
      <h3>Group Chat Settings</h3>
      <button @click="$emit('close')" class="close-button">×</button>
    </div>

    <div class="manager-content">
      <!-- Response Mode -->
      <div class="setting-section">
        <h4>Response Mode</h4>
        <div class="strategy-options">
          <label class="radio-option">
            <input
              type="radio"
              :value="false"
              v-model="localExplicitMode"
              @change="$emit('update:explicit-mode', localExplicitMode)"
            />
            <span>Auto-Select (Random)</span>
            <small>Pressing Enter picks a random character to respond</small>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              :value="true"
              v-model="localExplicitMode"
              @change="$emit('update:explicit-mode', localExplicitMode)"
            />
            <span>Explicit Selection</span>
            <small>Must click a character button to generate response</small>
          </label>
        </div>
      </div>

      <!-- Strategy Selection -->
      <div class="setting-section">
        <h4>Description Strategy</h4>
        <div class="strategy-options">
          <label class="radio-option">
            <input
              type="radio"
              :value="'swap'"
              v-model="localStrategy"
              @change="$emit('update:strategy', localStrategy)"
            />
            <span>Swap per Message</span>
            <small>Use only the speaking character's description</small>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              :value="'join'"
              v-model="localStrategy"
              @change="$emit('update:strategy', localStrategy)"
            />
            <span>Join All</span>
            <small>Include all character descriptions together</small>
          </label>
        </div>
      </div>

      <!-- Character List -->
      <div class="setting-section">
        <h4>Characters in Group ({{ characters.length }})</h4>
        <div class="character-list">
          <div
            v-for="(char, index) in characters"
            :key="char.filename"
            class="character-item"
          >
            <img
              :src="`/api/characters/${char.filename}/image`"
              :alt="char.name"
              class="character-thumb"
            />
            <div class="character-details">
              <span class="character-name">{{ char.name }}</span>
              <span class="character-order">Order: {{ index + 1 }}</span>
            </div>
            <div class="character-actions">
              <button
                @click="$emit('trigger-response', char.filename)"
                class="trigger-btn"
                title="Generate response from this character"
              >
                💬
              </button>
              <button
                v-if="index > 0"
                @click="$emit('move-up', index)"
                class="move-btn"
                title="Move up"
              >
                ↑
              </button>
              <button
                v-if="index < characters.length - 1"
                @click="$emit('move-down', index)"
                class="move-btn"
                title="Move down"
              >
                ↓
              </button>
              <button
                @click="$emit('remove-character', index)"
                class="remove-btn"
                title="Remove from group"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Character -->
      <div class="setting-section">
        <h4>Add Character to Group</h4>
        <div class="add-character">
          <select v-model="selectedCharacterToAdd" class="character-select">
            <option value="">Select a character...</option>
            <option
              v-for="char in availableCharacters"
              :key="char.filename"
              :value="char.filename"
            >
              {{ char.name }}
            </option>
          </select>
          <button
            @click="addCharacter"
            :disabled="!selectedCharacterToAdd"
            class="add-btn"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GroupChatManager',
  props: {
    characters: {
      type: Array,
      required: true
    },
    strategy: {
      type: String,
      default: 'join'
    },
    explicitMode: {
      type: Boolean,
      default: false
    },
    allCharacters: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      localStrategy: this.strategy,
      localExplicitMode: this.explicitMode,
      selectedCharacterToAdd: ''
    };
  },
  computed: {
    availableCharacters() {
      // Filter out characters already in the group
      const existingFilenames = this.characters.map(c => c.filename);
      return this.allCharacters.filter(c => !existingFilenames.includes(c.filename));
    }
  },
  watch: {
    strategy(newVal) {
      this.localStrategy = newVal;
    },
    explicitMode(newVal) {
      this.localExplicitMode = newVal;
    }
  },
  methods: {
    addCharacter() {
      if (this.selectedCharacterToAdd) {
        this.$emit('add-character', this.selectedCharacterToAdd);
        this.selectedCharacterToAdd = '';
      }
    }
  }
};
</script>

<style scoped>
.group-chat-manager {
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 350px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.manager-header h3 {
  margin: 0;
  font-size: 1.125rem;
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
  background: var(--hover-color);
}

.manager-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-section h4 {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.strategy-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-option {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  background: var(--hover-color);
}

.radio-option input {
  margin-right: 0.5rem;
}

.radio-option span {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.radio-option small {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin-left: 1.5rem;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.character-thumb {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.character-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.character-name {
  font-weight: 500;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-order {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.character-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.trigger-btn,
.move-btn,
.remove-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trigger-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.move-btn:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.remove-btn {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.remove-btn:hover {
  background: #b91c1c;
}

.add-character {
  display: flex;
  gap: 0.5rem;
}

.character-select {
  flex: 1;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.add-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
