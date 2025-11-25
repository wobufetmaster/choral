<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content memory-modal" @click.stop>
      <div class="modal-header">
        <h3>Add Memory</h3>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>
      <div class="memory-options">
        <p>Create a diary entry summary of this conversation for {{ targetName }}?</p>

        <div class="memory-size-buttons">
          <button @click="$emit('create', 'small')" :disabled="isCreating" class="memory-size-btn">
            <strong>Small</strong>
            <span>2-4 sentences</span>
          </button>
          <button @click="$emit('create', 'medium')" :disabled="isCreating" class="memory-size-btn">
            <strong>Medium</strong>
            <span>1-2 paragraphs</span>
          </button>
          <button @click="$emit('create', 'large')" :disabled="isCreating" class="memory-size-btn">
            <strong>Large</strong>
            <span>2-4 paragraphs</span>
          </button>
        </div>

        <div v-if="isCreating" class="loading-indicator">
          Generating memory...
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MemoryModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    targetName: {
      type: String,
      default: 'the character'
    },
    isCreating: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'create']
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
  max-width: 400px;
  width: 90%;
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

.memory-options p {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.memory-size-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.memory-size-btn {
  flex: 1;
  min-width: 100px;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-tertiary);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.memory-size-btn:hover:not(:disabled) {
  background: var(--hover-color);
  border-color: var(--accent-color);
}

.memory-size-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.memory-size-btn strong {
  display: block;
  margin-bottom: 0.25rem;
}

.memory-size-btn span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.loading-indicator {
  margin-top: 1rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
