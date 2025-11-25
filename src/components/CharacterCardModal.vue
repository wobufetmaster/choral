<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content character-card-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ character?.data?.name || 'Character Card' }}</h3>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>
      <div class="character-card-content" v-if="character">
        <img v-if="character.avatar" :src="character.avatar" :alt="character.data.name" class="card-avatar" @error="setFallbackAvatar($event)" />
        <div class="card-field" v-if="character.data.description">
          <strong>Description:</strong>
          <p>{{ character.data.description }}</p>
        </div>
        <div class="card-field" v-if="character.data.personality">
          <strong>Personality:</strong>
          <p>{{ character.data.personality }}</p>
        </div>
        <div class="card-field" v-if="character.data.scenario">
          <strong>Scenario:</strong>
          <p>{{ character.data.scenario }}</p>
        </div>
        <div class="card-field" v-if="character.data.first_mes">
          <strong>First Message:</strong>
          <p>{{ character.data.first_mes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CharacterCardModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    character: {
      type: Object,
      default: null
    }
  },
  emits: ['close'],
  methods: {
    setFallbackAvatar(event) {
      const svgQuestionMark = `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
          <rect width="48" height="48" fill="#3a3f4b" rx="12"/>
          <text x="24" y="32" font-family="Arial, sans-serif" font-size="28" fill="#8b92a8" text-anchor="middle" font-weight="bold">?</text>
        </svg>
      `)}`;
      event.target.src = svgQuestionMark;
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
  max-width: 600px;
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

.character-card-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-avatar {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  object-fit: cover;
  align-self: center;
}

.card-field {
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.card-field strong {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-field p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>
