<template>
  <div class="character-list">
    <div class="header">
      <h1>Choral</h1>
      <div class="actions">
        <input
          type="file"
          ref="fileInput"
          accept=".png"
          @change="uploadCharacter"
          style="display: none"
        />
        <button @click="$refs.fileInput.click()">Import Character</button>
      </div>
    </div>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        placeholder="Search characters..."
        type="text"
      />
    </div>

    <div class="characters-grid">
      <div
        v-for="char in filteredCharacters"
        :key="char.filename"
        class="character-card"
        @click="startChat(char)"
      >
        <img
          :src="`/api/characters/${char.filename}/image`"
          :alt="char.name"
          class="character-avatar"
        />
        <div class="character-info">
          <h3>{{ char.name }}</h3>
          <div class="tags">
            <span v-for="tag in char.tags.slice(0, 3)" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredCharacters.length === 0" class="empty-state">
      <p>No characters found. Import a character card to get started.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CharacterList',
  data() {
    return {
      characters: [],
      searchQuery: ''
    }
  },
  computed: {
    filteredCharacters() {
      if (!this.searchQuery) return this.characters;

      const query = this.searchQuery.toLowerCase();
      return this.characters.filter(char =>
        char.name.toLowerCase().includes(query) ||
        char.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
  },
  mounted() {
    this.loadCharacters();
  },
  methods: {
    async loadCharacters() {
      try {
        const response = await fetch('/api/characters');
        this.characters = await response.json();
      } catch (error) {
        console.error('Failed to load characters:', error);
      }
    },
    async uploadCharacter(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        await fetch('/api/characters', {
          method: 'POST',
          body: formData
        });

        this.loadCharacters();
        event.target.value = '';
        this.$root.$notify('Character imported successfully', 'success');
      } catch (error) {
        console.error('Failed to upload character:', error);
        this.$root.$notify('Failed to upload character', 'error');
      }
    },
    startChat(character) {
      this.$router.push({
        name: 'chat',
        params: { id: 'new' },
        query: { character: character.filename }
      });
    }
  }
}
</script>

<style scoped>
.character-list {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
}

.search-bar {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.search-bar input {
  width: 100%;
  max-width: 600px;
}

.characters-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-content: start;
}

.character-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.character-card:hover {
  background: var(--bg-tertiary);
  transform: translateY(-2px);
}

.character-avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.character-info {
  flex: 1;
  min-width: 0;
}

.character-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  color: var(--text-secondary);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}
</style>
