import { inject } from 'vue'

export function useNotification() {
  // Use Vue 3's inject to get the notify function provided by App.vue
  const notify = inject('notify', (message, type = 'info') => {
    // Fallback if inject fails (shouldn't happen)
    console.warn('[Notification] Could not display notification:', type, message)
  })

  return {
    notify
  }
}
