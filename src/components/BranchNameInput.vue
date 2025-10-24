<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="cancel">
    <div class="modal-content">
      <h3>Create Branch</h3>
      <p>Enter a name for this branch (or leave blank for "{{ defaultName }}"):</p>
      <input
        ref="inputRef"
        v-model="branchName"
        type="text"
        :placeholder="defaultName"
        @keyup.enter="confirm"
        @keyup.esc="cancel"
      />
      <div class="modal-actions">
        <button @click="cancel" class="cancel-btn">Cancel</button>
        <button @click="confirm" class="confirm-btn">Create</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  branchCount: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['confirm', 'cancel']);

const branchName = ref('');
const inputRef = ref(null);

const defaultName = computed(() => {
  return `Branch ${props.branchCount}`;
});

// Focus input when modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    branchName.value = '';
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});

function confirm() {
  const finalName = branchName.value.trim() || defaultName.value;
  emit('confirm', finalName);
  branchName.value = '';
}

function cancel() {
  emit('cancel');
  branchName.value = '';
}
</script>

<style scoped>
.modal-overlay {
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

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.modal-content p {
  margin: 0 0 16px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.modal-content input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 20px;
}

.modal-content input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--hover-color);
}

.confirm-btn {
  background: var(--accent-color);
  border: 1px solid var(--accent-color);
  color: white;
}

.confirm-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
