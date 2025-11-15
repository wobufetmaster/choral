<template>
  <div class="persona-manager">
    <div class="persona-header">
      <h2>Persona Manager</h2>
    </div>

    <div class="persona-body">
        <!-- Persona List -->
        <div class="persona-list">
          <h3>Your Personas</h3>
          <div
            v-for="persona in personas"
            :key="persona.nickname || persona.name"
            :class="[
              'persona-item',
              {
                active: (selectedPersona?.nickname || selectedPersona?.name) === (persona.nickname || persona.name),
                'in-use': currentPersona?.name === persona.name
              }
            ]"
            @click="selectPersona(persona)"
          >
            <img
              v-if="persona.avatar"
              :src="persona.avatar"
              :alt="persona.name"
              class="persona-avatar"
            />
            <div v-else class="persona-avatar-placeholder">
              {{ (persona.nickname || persona.name)[0] }}
            </div>
            <div class="persona-info">
              <span class="persona-name">{{ persona.nickname || persona.name }}</span>
              <span v-if="persona.nickname" class="persona-actual-name">{{ persona.name }}</span>
              <span v-if="currentPersona?.name === persona.name" class="in-use-badge">IN USE</span>
              <span v-if="isDefaultPersona(persona.nickname || persona.name)" class="default-badge">DEFAULT</span>
            </div>
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
              {{ (selectedPersona.nickname || selectedPersona.name)[0] || '?' }}
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
            <label>Display Name (for organization only)</label>
            <input v-model="selectedPersona.nickname" placeholder="e.g. Forrest - Fantasy" />
            <p class="hint">Optional nickname for organizing personas (e.g. "Character Name - Setting"). Only shown in UI, never sent to AI.</p>
          </div>

          <div class="form-group">
            <label>Persona Name (sent to AI)</label>
            <input v-model="selectedPersona.name" placeholder="Your actual name" />
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

            <!-- Bound Characters Display -->
            <div class="bound-characters-section">
              <div class="bound-characters-header">
                <span class="section-label">Bound Characters ({{ boundCharacters.length }})</span>
              </div>

              <div v-if="boundCharacters.length === 0" class="bound-characters-empty">
                No characters bound. Search and click characters below to bind them.
              </div>

              <div v-else class="bound-characters-grid">
                <div
                  v-for="char in boundCharacters"
                  :key="char.filename"
                  class="bound-character-card"
                >
                  <button
                    @click="unbindCharacter(char.filename)"
                    class="unbind-button"
                    title="Unbind character"
                  >×</button>
                  <img
                    :src="`/api/characters/${char.filename}/image`"
                    :alt="char.name"
                    class="bound-character-avatar"
                  />
                  <div class="bound-character-name">{{ char.name }}</div>
                </div>
              </div>
            </div>

            <!-- Character Selection Area -->
            <div class="character-selection-section">
              <div class="section-label">Available Characters</div>
              <CharacterGridPicker
                :characters="availableCharacters"
                @select="toggleCharacterBinding"
                gridClass="persona-picker-grid"
                cardClass="persona-picker-card"
              >
                <template #card-footer="{ character }">
                  <div v-if="isBound(character.filename)" class="bound-checkmark">✓</div>
                </template>
              </CharacterGridPicker>
            </div>
          </div>

          <div class="actions">
            <button @click="usePersona" class="use-btn">Use This Persona</button>
            <button @click="savePersona" class="save-btn">Save Persona</button>
            <button @click="setAsDefault" class="default-btn" :class="{ active: isDefaultPersona(selectedPersona.nickname || selectedPersona.name) }">
              {{ isDefaultPersona(selectedPersona.nickname || selectedPersona.name) ? '✓ Default' : 'Set as Default' }}
            </button>
            <button @click="deletePersona" class="delete-btn" v-if="personas.length > 1">Delete</button>
          </div>
        </div>
      </div>
  </div>
</template>

<script>
import CharacterGridPicker from './CharacterGridPicker.vue'

export default {
  name: 'PersonaManager',
  components: {
    CharacterGridPicker
  },
  props: {
    currentPersona: Object
  },
  data() {
    return {
      personas: [],
      selectedPersona: null,
      availableCharacters: [],
      newTagBinding: '',
      tagBindingSuggestions: [],
      defaultPersona: '',
      autoSavePersonaTimeout: null
    }
  },
  computed: {
    allCharacterTags() {
      const tags = new Set();
      this.availableCharacters.forEach(char => {
        // Handle both char.tags and char.data.tags for flexibility
        const characterTags = char.tags || char.data?.tags || [];
        characterTags.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
    },
    boundCharacters() {
      // Filter available characters by binding array
      if (!this.selectedPersona?.characterBindings || !this.availableCharacters) {
        return [];
      }
      return this.availableCharacters.filter(char =>
        this.selectedPersona.characterBindings.includes(char.filename)
      );
    }
  },
  async mounted() {
    await this.loadPersonas();
    await this.loadCharacters();
    await this.loadConfig();
  },
  methods: {
    async loadPersonas(preserveSelection = false) {
      try {
        const response = await fetch('/api/personas');
        const data = await response.json();

        // Store personas with their actual filenames from the API
        // The API now includes _filename which is the real filename on disk
        this.personas = data;

        // If preserveSelection is true and we have a selected persona, try to keep it selected
        if (preserveSelection && this.selectedPersona && this.selectedPersona._filename) {
          const preserved = this.personas.find(p => p._filename === this.selectedPersona._filename);
          if (preserved) {
            // Update the selected persona with fresh data but keep the selection
            this.selectedPersona = {
              ...preserved,
              _filename: preserved._filename // Keep tracking the source file
            };
            return;
          }
        }

        // Default behavior: select current persona or first one
        if (this.personas.length > 0) {
          const current = this.personas.find(p => p.name === this.currentPersona?.name);
          const persona = current || this.personas[0];

          // Create a copy with filename tracking
          this.selectedPersona = {
            ...persona,
            _filename: persona._filename // Track which file this came from
          };
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
      // Create a copy with filename tracking
      this.selectedPersona = {
        ...persona,
        _filename: persona._filename // Track which file this came from
      };
    },
    async createNewPersona() {
      try {
        // Default name sent to AI
        const defaultName = 'User';

        // Generate a unique nickname - start with the name field value
        let baseNickname = defaultName;
        let uniqueNickname = baseNickname;
        let counter = 1;

        // Check if nickname already exists
        while (this.personas.some(p => (p.nickname || p.name) === uniqueNickname)) {
          uniqueNickname = `${baseNickname} ${counter}`;
          counter++;
        }

        // Create the new persona object with default values
        // Nickname defaults to name field value (but made unique if needed)
        const newPersona = {
          nickname: uniqueNickname,
          name: defaultName,
          avatar: null,
          description: '',
          characterBindings: [],
          tagBindings: []
        };

        // Immediately save it to disk
        const response = await fetch('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPersona)
        });

        if (!response.ok) {
          throw new Error('Failed to create persona');
        }

        // Reload personas and select the new one
        await this.loadPersonas();

        // Find and select the newly created persona
        const created = this.personas.find(p => (p.nickname || p.name) === uniqueNickname);
        if (created) {
          this.selectPersona(created); // This will have _filename set from loadPersonas
        }

        this.$root.$notify('New persona created', 'success');
      } catch (error) {
        console.error('Failed to create persona:', error);
        this.$root.$notify('Failed to create persona', 'error');
      }
    },
    async uploadAvatar(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        this.selectedPersona.avatar = e.target.result;
        // Auto-save after uploading avatar
        await this.savePersona();
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    removeAvatar() {
      this.selectedPersona.avatar = null;
    },
    addTagBinding() {
      const tag = this.newTagBinding.trim();
      if (!this.selectedPersona.tagBindings) {
        this.selectedPersona.tagBindings = [];
      }
      if (tag && !this.selectedPersona.tagBindings.includes(tag)) {
        this.selectedPersona.tagBindings = [...this.selectedPersona.tagBindings, tag];
        this.newTagBinding = '';
        this.tagBindingSuggestions = [];
      }
    },
    addSuggestedTagBinding(tag) {
      if (!this.selectedPersona.tagBindings) {
        this.selectedPersona.tagBindings = [];
      }
      if (!this.selectedPersona.tagBindings.includes(tag)) {
        this.selectedPersona.tagBindings = [...this.selectedPersona.tagBindings, tag];
        this.newTagBinding = '';
        this.tagBindingSuggestions = [];
      }
    },
    removeTagBinding(index) {
      this.selectedPersona.tagBindings = this.selectedPersona.tagBindings.filter((_, i) => i !== index);
    },
    updateTagBindingSuggestions() {
      if (!this.newTagBinding.trim()) {
        this.tagBindingSuggestions = [];
        return;
      }

      const query = this.newTagBinding.toLowerCase();
      const currentBindings = this.selectedPersona.tagBindings || [];
      this.tagBindingSuggestions = this.allCharacterTags
        .filter(tag =>
          tag.toLowerCase().includes(query) &&
          !currentBindings.includes(tag)
        )
        .slice(0, 5);
    },
    usePersona() {
      // Emit the persona immediately without saving
      this.$emit('persona-saved', JSON.parse(JSON.stringify(this.selectedPersona)));
      this.$root.$notify(`Switched to persona: ${this.selectedPersona.name}`, 'success');
    },
    async savePersona() {
      try {
        // Nickname is now required as the unique identifier
        if (!this.selectedPersona.nickname || !this.selectedPersona.nickname.trim()) {
          this.$root.$notify('Display name (nickname) cannot be empty', 'warning');
          return;
        }

        // Name is also required (what gets sent to AI)
        if (!this.selectedPersona.name || !this.selectedPersona.name.trim()) {
          this.$root.$notify('Persona name cannot be empty', 'warning');
          return;
        }

        const newFilename = `${this.selectedPersona.nickname}.json`;
        const oldFilename = this.selectedPersona._filename;

        // Check for conflicts: if the new filename is different from the old one,
        // make sure no other persona already has that filename
        if (newFilename !== oldFilename) {
          const conflict = this.personas.some(p =>
            p._filename === newFilename && p._filename !== oldFilename
          );

          if (conflict) {
            this.$root.$notify(`A persona with display name "${this.selectedPersona.nickname}" already exists. Please choose a different display name.`, 'error');
            return;
          }
        }

        // If this persona came from a file and the nickname changed, delete the old file
        if (oldFilename && newFilename !== oldFilename) {
          try {
            await fetch(`/api/personas/${oldFilename}`, { method: 'DELETE' });
          } catch (err) {
            console.error('Failed to delete old persona file:', err);
            // Continue with save even if delete fails
          }
        }

        // Save the persona (without the internal _filename field)
        const { _filename, ...personaData } = this.selectedPersona;
        const response = await fetch('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(personaData)
        });

        if (!response.ok) {
          throw new Error('Failed to save persona');
        }

        // Update the filename tracking to the new filename
        this.selectedPersona._filename = newFilename;

        await this.loadPersonas(true); // Preserve selection after save
        this.$root.$notify('Persona saved successfully', 'success');
        this.$emit('persona-saved', JSON.parse(JSON.stringify(personaData)));
      } catch (error) {
        console.error('Failed to save persona:', error);
        this.$root.$notify('Failed to save persona', 'error');
      }
    },
    async deletePersona() {
      if (!confirm(`Delete persona "${this.selectedPersona.nickname || this.selectedPersona.name}"?`)) return;

      try {
        // Delete via the tracked filename
        if (!this.selectedPersona._filename) {
          this.$root.$notify('Cannot delete: persona has no associated file', 'error');
          return;
        }

        await fetch(`/api/personas/${this.selectedPersona._filename}`, { method: 'DELETE' });

        await this.loadPersonas();
        this.$root.$notify('Persona deleted', 'success');
      } catch (error) {
        console.error('Failed to delete persona:', error);
        this.$root.$notify('Failed to delete persona', 'error');
      }
    },
    async loadConfig() {
      try {
        const response = await fetch('/api/config');
        const config = await response.json();
        this.defaultPersona = config.defaultPersona || '';
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    },
    isBound(filename) {
      return this.selectedPersona?.characterBindings?.includes(filename);
    },
    bindCharacter(filename) {
      if (!this.selectedPersona.characterBindings) {
        this.selectedPersona.characterBindings = [];
      }
      if (!this.selectedPersona.characterBindings.includes(filename)) {
        this.selectedPersona.characterBindings.push(filename);
        this.autoSavePersonaChanges();
      }
    },
    unbindCharacter(filename) {
      if (!this.selectedPersona?.characterBindings) return;

      const index = this.selectedPersona.characterBindings.indexOf(filename);
      if (index > -1) {
        this.selectedPersona.characterBindings.splice(index, 1);
        this.autoSavePersonaChanges();
      }
    },
    toggleCharacterBinding(character) {
      if (this.isBound(character.filename)) {
        this.unbindCharacter(character.filename);
      } else {
        this.bindCharacter(character.filename);
      }
    },
    autoSavePersonaChanges() {
      // Debounce auto-save (similar to tag editing pattern)
      if (this.autoSavePersonaTimeout) {
        clearTimeout(this.autoSavePersonaTimeout);
      }

      this.autoSavePersonaTimeout = setTimeout(async () => {
        try {
          const { _filename, ...personaData } = this.selectedPersona;
          await fetch('/api/personas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personaData)
          });
          console.log('Persona bindings auto-saved');
        } catch (error) {
          console.error('Failed to auto-save persona:', error);
        }
      }, 1000); // 1 second debounce
    },
    isDefaultPersona(identifier) {
      const filename = `${identifier}.json`;
      return this.defaultPersona === filename;
    },
    async setAsDefault() {
      try {
        const identifier = this.selectedPersona.nickname || this.selectedPersona.name;
        const filename = `${identifier}.json`;
        await fetch('/api/config/default-persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: filename })
        });
        this.defaultPersona = filename;
        this.$root.$notify(`${this.selectedPersona.nickname || this.selectedPersona.name} set as default persona`, 'success');
      } catch (error) {
        console.error('Failed to set default persona:', error);
        this.$root.$notify('Failed to set default persona', 'error');
      }
    }
  }
}
</script>

<style scoped>
.persona-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.persona-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
}

.persona-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.persona-body {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.persona-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
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

.persona-item.in-use {
  border-color: #4caf50;
  border-width: 2px;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
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

.persona-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.persona-name {
  font-weight: 500;
}

.persona-actual-name {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.in-use-badge,
.default-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  width: fit-content;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.in-use-badge {
  background: #4caf50;
  color: white;
}

.default-badge {
  background: var(--accent-color);
  color: white;
}

.create-btn {
  margin-top: 8px;
}

.persona-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 20px;
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

.use-btn {
  flex: 1;
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.save-btn {
  flex: 1;
  background: var(--accent-color);
  color: white;
}

.default-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.default-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
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

/* Bound Characters Section */
.bound-characters-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.bound-characters-header {
  margin-bottom: 12px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.bound-characters-empty {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

.bound-characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}

.bound-character-card {
  position: relative;
  background: var(--bg-tertiary);
  border: 2px solid var(--accent-color);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.bound-character-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.unbind-button {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
  line-height: 1;
}

.unbind-button:hover {
  background: #b91c1c;
  transform: scale(1.1);
}

.bound-character-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.bound-character-name {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Character Selection Section */
.character-selection-section {
  margin-top: 16px;
}

.character-selection-section .section-label {
  display: block;
  margin-bottom: 12px;
}

/* Checkmark badge for bound characters in picker */
.bound-checkmark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  font-weight: bold;
}

/* Persona picker customization */
.persona-picker-grid {
  max-height: 400px;
  overflow-y: auto;
}

.persona-picker-card {
  position: relative;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .bound-characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  .bound-character-avatar {
    width: 28px;
    height: 28px;
  }

  .bound-character-name {
    font-size: 11px;
  }

  .unbind-button {
    width: 16px;
    height: 16px;
    font-size: 11px;
  }
}
</style>
