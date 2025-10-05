<template>
  <div class="persona-modal" @click.self="$emit('close')">
    <div class="persona-content">
      <div class="persona-header">
        <h2>Persona Manager</h2>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>

      <div class="persona-body">
        <!-- Persona List -->
        <div class="persona-list">
          <h3>Your Personas</h3>
          <div
            v-for="persona in personas"
            :key="persona.name"
            :class="['persona-item', { active: selectedPersona?.name === persona.name }]"
            @click="selectPersona(persona)"
          >
            <img
              v-if="persona.avatar"
              :src="persona.avatar"
              :alt="persona.name"
              class="persona-avatar"
            />
            <div v-else class="persona-avatar-placeholder">
              {{ persona.name[0] }}
            </div>
            <span class="persona-name">{{ persona.name }}</span>
          </div>
          <button @click="createNewPersona" class="create-btn">+ New Persona</button>
        </div>

        <!-- Persona Editor -->
        <div class="persona-editor" v-if="selectedPersona">
          <h3>Edit Persona</h3>

          <div class="avatar-section">
            <img
              v-if="selectedPersona.avatar"
              :src="selectedPersona.avatar"
              :alt="selectedPersona.name"
              class="avatar-preview"
            />
            <div v-else class="avatar-preview-placeholder">
              {{ selectedPersona.name[0] || '?' }}
            </div>
            <div class="avatar-actions">
              <input
                type="file"
                ref="avatarInput"
                accept="image/*"
                @change="uploadAvatar"
                style="display: none"
              />
              <button @click="$refs.avatarInput.click()">Upload Avatar</button>
              <button v-if="selectedPersona.avatar" @click="removeAvatar">Remove Avatar</button>
            </div>
          </div>

          <div class="form-group">
            <label>Persona Name</label>
            <input v-model="selectedPersona.name" placeholder="Your name" />
          </div>

          <div class="form-group">
            <label>Description (sent to AI)</label>
            <textarea
              v-model="selectedPersona.description"
              rows="4"
              placeholder="Describe yourself, your personality, background, etc..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>Tag Bindings</label>
            <p class="hint">Auto-select this persona for characters with specific tags</p>
            <div class="tag-bindings">
              <div class="current-tags">
                <span v-for="(tag, index) in selectedPersona.tagBindings" :key="index" class="tag">
                  {{ tag }}
                  <button @click="removeTagBinding(index)" class="remove-tag">×</button>
                </span>
              </div>
              <input
                v-model="newTagBinding"
                @keydown.enter="addTagBinding"
                @input="updateTagBindingSuggestions"
                placeholder="Add tag binding (press Enter)"
                class="tag-input"
              />
              <div v-if="tagBindingSuggestions.length > 0" class="tag-suggestions">
                <div
                  v-for="suggestion in tagBindingSuggestions"
                  :key="suggestion"
                  @click="addSuggestedTagBinding(suggestion)"
                  class="tag-suggestion"
                >
                  {{ suggestion }}
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Character Bindings</label>
            <p class="hint">Auto-select this persona for specific characters (overrides tag bindings)</p>
            <div class="bindings-list">
              <div
                v-for="char in availableCharacters"
                :key="char.filename"
                :class="['binding-item', { bound: isCharacterBound(char.filename) }]"
                @click="toggleBinding(char.filename)"
              >
                <img
                  :src="`/api/characters/${char.filename}/image`"
                  :alt="char.name"
                  class="binding-avatar"
                />
                <span class="binding-name">{{ char.name }}</span>
                <span v-if="isCharacterBound(char.filename)" class="binding-check">✓</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <button @click="savePersona" class="save-btn">Save Persona</button>
            <button @click="deletePersona" class="delete-btn" v-if="personas.length > 1">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PersonaManager',
  props: {
    currentPersona: Object
  },
  data() {
    return {
      personas: [],
      selectedPersona: null,
      availableCharacters: [],
      newTagBinding: '',
      tagBindingSuggestions: []
    }
  },
  computed: {
    allCharacterTags() {
      const tags = new Set();
      this.availableCharacters.forEach(char => {
        char.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
    }
  },
  async mounted() {
    await this.loadPersonas();
    await this.loadCharacters();
  },
  methods: {
    async loadPersonas() {
      try {
        const response = await fetch('/api/personas');
        this.personas = await response.json();
        if (this.personas.length > 0) {
          // Select current persona or first one
          const current = this.personas.find(p => p.name === this.currentPersona?.name);
          this.selectedPersona = { ...(current || this.personas[0]) };

          // Ensure all personas have required fields
          if (!this.selectedPersona.description) this.selectedPersona.description = '';
          if (!this.selectedPersona.characterBindings) this.selectedPersona.characterBindings = [];
          if (!this.selectedPersona.tagBindings) this.selectedPersona.tagBindings = [];
        }
      } catch (error) {
        console.error('Failed to load personas:', error);
      }
    },
    async loadCharacters() {
      try {
        const response = await fetch('/api/characters');
        this.availableCharacters = await response.json();
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    selectPersona(persona) {
      this.selectedPersona = { ...persona };
    },
    createNewPersona() {
      this.selectedPersona = {
        name: 'New Persona',
        avatar: null,
        description: '',
        characterBindings: [],
        tagBindings: []
      };
    },
    isCharacterBound(filename) {
      return this.selectedPersona?.characterBindings?.includes(filename);
    },
    toggleBinding(filename) {
      if (!this.selectedPersona.characterBindings) {
        this.selectedPersona.characterBindings = [];
      }

      const index = this.selectedPersona.characterBindings.indexOf(filename);
      if (index > -1) {
        this.selectedPersona.characterBindings.splice(index, 1);
      } else {
        this.selectedPersona.characterBindings.push(filename);
      }
    },
    async uploadAvatar(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedPersona.avatar = e.target.result;
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    removeAvatar() {
      this.selectedPersona.avatar = null;
    },
    addTagBinding() {
      const tag = this.newTagBinding.trim();
      if (tag && !this.selectedPersona.tagBindings.includes(tag)) {
        this.selectedPersona.tagBindings.push(tag);
        this.newTagBinding = '';
        this.tagBindingSuggestions = [];
      }
    },
    addSuggestedTagBinding(tag) {
      if (!this.selectedPersona.tagBindings.includes(tag)) {
        this.selectedPersona.tagBindings.push(tag);
        this.newTagBinding = '';
        this.tagBindingSuggestions = [];
      }
    },
    removeTagBinding(index) {
      this.selectedPersona.tagBindings.splice(index, 1);
    },
    updateTagBindingSuggestions() {
      if (!this.newTagBinding.trim()) {
        this.tagBindingSuggestions = [];
        return;
      }

      const query = this.newTagBinding.toLowerCase();
      this.tagBindingSuggestions = this.allCharacterTags
        .filter(tag =>
          tag.toLowerCase().includes(query) &&
          !this.selectedPersona.tagBindings.includes(tag)
        )
        .slice(0, 5);
    },
    async savePersona() {
      try {
        if (!this.selectedPersona.name.trim()) {
          this.$root.$notify('Persona name cannot be empty', 'warning');
          return;
        }

        const response = await fetch('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.selectedPersona)
        });

        if (!response.ok) {
          throw new Error('Failed to save persona');
        }

        await this.loadPersonas();
        this.$root.$notify('Persona saved successfully', 'success');
        this.$emit('persona-saved', this.selectedPersona);
      } catch (error) {
        console.error('Failed to save persona:', error);
        this.$root.$notify('Failed to save persona', 'error');
      }
    },
    async deletePersona() {
      if (!confirm(`Delete persona "${this.selectedPersona.name}"?`)) return;

      try {
        // Delete via filename
        const filename = `${this.selectedPersona.name}.json`;
        await fetch(`/api/personas/${filename}`, { method: 'DELETE' });

        await this.loadPersonas();
        this.$root.$notify('Persona deleted', 'success');
      } catch (error) {
        console.error('Failed to delete persona:', error);
        this.$root.$notify('Failed to delete persona', 'error');
      }
    }
  }
}
</script>

<style scoped>
.persona-modal {
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
}

.persona-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.persona-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.close-btn {
  font-size: 24px;
  padding: 4px 12px;
  background: transparent;
  border: none;
}

.persona-body {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.persona-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.persona-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.persona-item.active {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.persona-avatar,
.persona-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.persona-avatar-placeholder {
  background: var(--accent-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.persona-name {
  flex: 1;
  font-weight: 500;
}

.create-btn {
  margin-top: 8px;
}

.persona-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.avatar-preview,
.avatar-preview-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-preview-placeholder {
  background: var(--accent-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 600;
}

.avatar-actions {
  display: flex;
  gap: 8px;
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

.form-group input {
  width: 100%;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.save-btn {
  flex: 1;
  background: var(--accent-color);
  color: white;
}

.delete-btn {
  background: #f44336;
  color: white;
  border-color: #f44336;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  margin-bottom: 8px;
}

.bindings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.binding-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.binding-item:hover {
  background: var(--bg-tertiary);
}

.binding-item.bound {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.binding-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.binding-name {
  flex: 1;
  font-size: 14px;
}

.binding-check {
  color: var(--accent-color);
  font-weight: 600;
  font-size: 18px;
}

.tag-bindings {
  position: relative;
}

.current-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  font-size: 12px;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
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

.tag-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.tag-suggestion {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-suggestion:hover {
  background: var(--hover-color);
}

@media (max-width: 768px) {
  .persona-body {
    grid-template-columns: 1fr;
  }
}
</style>
