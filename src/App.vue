<template>
  <div id="app" :style="backgroundStyle">
    <div class="app-background" :style="patternStyle"></div>
    <div class="app-content">
      <TabManager />
      <Notification ref="notification" />
    </div>
  </div>
</template>

<script>
import TabManager from './components/TabManager.vue'
import Notification from './components/Notification.vue'
import { themes, getStoredTheme, getStoredBackground, applyTheme, backgroundPatterns } from './utils/themes.js'

export default {
  name: 'App',
  components: {
    TabManager,
    Notification
  },
  data() {
    return {
      backgroundConfig: null
    }
  },
  computed: {
    backgroundStyle() {
      if (!this.backgroundConfig) return {}

      if (this.backgroundConfig.type === 'custom' && this.backgroundConfig.url) {
        return {
          backgroundImage: `url(${this.backgroundConfig.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }
      }

      return {}
    },
    patternStyle() {
      if (!this.backgroundConfig) return { opacity: 0 }

      if (this.backgroundConfig.type === 'pattern' && this.backgroundConfig.pattern) {
        const pattern = backgroundPatterns[this.backgroundConfig.pattern]
        if (pattern && pattern.css) {
          return {
            opacity: this.backgroundConfig.opacity || 0.15,
            ...this.parseCss(pattern.css)
          }
        }
      }

      return { opacity: 0 }
    }
  },
  methods: {
    parseCss(cssString) {
      const style = {}
      // First normalize the CSS string by removing extra whitespace and newlines within property values
      const normalized = cssString.trim()
        // Split by semicolons to get individual properties
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      normalized.forEach(declaration => {
        const colonIndex = declaration.indexOf(':')
        if (colonIndex > 0) {
          const prop = declaration.substring(0, colonIndex).trim()
          const value = declaration.substring(colonIndex + 1).trim()
          // Convert kebab-case to camelCase
          const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          style[camelProp] = value
        }
      })
      return style
    },
    updateBackground() {
      const stored = getStoredBackground()
      console.log('App: Loading background config:', stored)
      if (stored) {
        this.backgroundConfig = stored
      } else {
        // Use theme defaults if no stored background
        const themeName = getStoredTheme()
        const theme = themes[themeName]
        if (theme && theme.background) {
          this.backgroundConfig = {
            type: theme.background.type,
            pattern: theme.background.value,
            opacity: theme.background.opacity || 0.15
          }
        }
      }
      console.log('App: Applied background config:', this.backgroundConfig)
    }
  },
  mounted() {
    // Make notification system globally available
    this.$root.$notify = (message, type = 'info', duration = 3000) => {
      this.$refs.notification.show(message, type, duration);
    };

    // Apply stored theme
    const theme = getStoredTheme()
    applyTheme(theme)

    // Load background
    this.updateBackground()

    // Listen for theme/background changes
    const self = this
    window.addEventListener('theme-changed', function() {
      const theme = getStoredTheme()
      applyTheme(theme)
    })

    window.addEventListener('background-changed', function() {
      self.updateBackground()
    })
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
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: var(--bg-primary, #1a1a1a);
}

.app-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.3s ease;
}

.app-content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Global form elements styling */
button {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

button:hover:not(:disabled) {
  background: var(--hover-color);
  border-color: var(--border-color-hover, var(--border-color));
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input, textarea, select {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  transition: all 0.2s ease;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-muted, rgba(90, 159, 212, 0.2));
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 5px;
  border: 2px solid var(--bg-secondary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--hover-color);
}

/* Selection styling */
::selection {
  background: var(--accent-muted, rgba(90, 159, 212, 0.3));
  color: var(--text-primary);
}
</style>
