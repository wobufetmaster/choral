<template>
  <div id="app" :class="currentTheme">
    <router-view />
    <Notification ref="notification" />
  </div>
</template>

<script>
import Notification from './components/Notification.vue'

export default {
  name: 'App',
  components: {
    Notification
  },
  data() {
    return {
      currentTheme: 'dark-theme'
    }
  },
  mounted() {
    // Make notification system globally available
    this.$root.$notify = (message, type = 'info', duration = 3000) => {
      this.$refs.notification.show(message, type, duration);
    };
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* Dark Theme */
.dark-theme {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3a3a3a;
  --text-primary: #e0e0e0;
  --text-secondary: #b0b0b0;
  --border-color: #404040;
  --accent-color: #5a9fd4;
  --hover-color: #404040;
}

/* Light Theme */
.light-theme {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e0e0e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #d0d0d0;
  --accent-color: #2563eb;
  --hover-color: #f0f0f0;
}

button {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: var(--hover-color);
}

input, textarea {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent-color);
}
</style>
