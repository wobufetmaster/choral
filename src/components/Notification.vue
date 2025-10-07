<template>
  <div class="notifications-container">
    <transition-group name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', notification.type]"
      >
        <span class="notification-icon">
          {{ getIcon(notification.type) }}
        </span>
        <span class="notification-message">{{ notification.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script>
export default {
  name: 'Notification',
  data() {
    return {
      notifications: []
    }
  },
  methods: {
    show(message, type = 'info', duration = 3000) {
      const id = Date.now();
      this.notifications.push({ id, message, type });

      setTimeout(() => {
        this.notifications = this.notifications.filter(n => n.id !== id);
      }, duration);
    },
    getIcon(type) {
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };
      return icons[type] || icons.info;
    }
  }
}
</script>

<style scoped>
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: 12px;
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  min-width: 300px;
  max-width: 400px;
  pointer-events: auto;
}

.notification-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.notification-message {
  flex: 1;
  color: var(--text-primary);
}

.notification.success {
  border-color: #4caf50;
}

.notification.success .notification-icon {
  color: #4caf50;
}

.notification.error {
  border-color: #f44336;
}

.notification.error .notification-icon {
  color: #f44336;
}

.notification.warning {
  border-color: #ff9800;
}

.notification.warning .notification-icon {
  color: #ff9800;
}

.notification.info {
  border-color: #2196f3;
}

.notification.info .notification-icon {
  color: #2196f3;
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.8);
}
</style>
