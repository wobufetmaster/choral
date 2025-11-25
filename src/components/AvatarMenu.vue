<template>
  <div v-if="show" class="avatar-menu" :style="{ top: y + 'px', left: x + 'px' }" @click.stop>
    <div class="avatar-menu-header">
      <strong>{{ characterName }}</strong>
    </div>
    <button @click="$emit('view-card')" class="avatar-menu-btn">📄 View Card</button>
    <button v-if="canEdit" @click="$emit('edit-character')" class="avatar-menu-btn">✏️ Edit Character</button>
    <button v-if="isGroupChat" @click="$emit('set-next-speaker')" class="avatar-menu-btn">🎤 Set as Next Speaker</button>
    <button @click="$emit('close')" class="avatar-menu-btn cancel">✕ Close</button>
  </div>
</template>

<script>
export default {
  name: 'AvatarMenu',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    },
    characterName: {
      type: String,
      default: ''
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    isGroupChat: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'view-card', 'edit-character', 'set-next-speaker']
};
</script>

<style scoped>
.avatar-menu {
  position: fixed;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 0.5rem;
  z-index: 1000;
  min-width: 150px;
}

.avatar-menu-header {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 0.25rem;
  text-align: center;
}

.avatar-menu-btn {
  display: block;
  width: 100%;
  padding: 0.5rem;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.avatar-menu-btn:hover {
  background: var(--hover-color);
}

.avatar-menu-btn.cancel {
  color: var(--text-secondary);
  margin-top: 0.25rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.5rem;
}
</style>
