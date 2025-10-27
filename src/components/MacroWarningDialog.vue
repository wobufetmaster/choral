<template>
  <div class="modal-overlay" @click="$emit('cancel')" @keydown.esc="$emit('cancel')">
    <div class="modal-content warning-dialog" @click.stop>
      <div class="modal-header">
        <div class="header-with-icon">
          <span class="warning-icon">⚠️</span>
          <h3>Missing Essential Macros</h3>
        </div>
        <button @click="$emit('cancel')" class="modal-close-btn" aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <p class="warning-message">
          This preset is missing essential character macros. Character cards won't be properly loaded without these:
        </p>

        <div class="missing-macros-list">
          <code
            v-for="macro in missingMacros"
            :key="macro.pattern"
            class="macro-tag"
          >
            {{ macro.pattern }}
          </code>
        </div>

        <p class="help-text">
          You can automatically add simple prompts for these macros, save without them, or cancel.
        </p>
      </div>

      <div class="modal-actions">
        <button @click="$emit('cancel')" class="btn-secondary">
          Cancel
        </button>
        <button @click="$emit('save-anyway')" class="btn-secondary">
          Save Anyway
        </button>
        <button @click="$emit('add-and-save')" class="btn-primary">
          Add Missing Macros
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MacroWarningDialog',
  props: {
    missingMacros: {
      type: Array,
      required: true
    }
  },
  emits: ['cancel', 'add-and-save', 'save-anyway']
};
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
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.warning-dialog {
  max-width: 500px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid var(--border-color);
}

.header-with-icon {
  display: flex;
  align-items: center;
  gap: 12px;
}

.warning-icon {
  font-size: 28px;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: rgba(220, 38, 38, 0.1);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.warning-message {
  margin: 0 0 16px 0;
  color: var(--text-primary);
  line-height: 1.5;
}

.missing-macros-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.macro-tag {
  background: var(--bg-tertiary);
  color: var(--accent-color);
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  border: 1px solid var(--border-color);
  white-space: nowrap;
}

.help-text {
  margin: 16px 0 0 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}
</style>
