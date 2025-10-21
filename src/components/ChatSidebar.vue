<template>
  <div class="chat-sidebar" :class="{ collapsed: !localSidebarOpen }">
    <button @click="toggleSidebar" class="sidebar-toggle" :title="localSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'">
      {{ localSidebarOpen ? '◀' : '▶' }}
    </button>

    <div v-if="localSidebarOpen" class="sidebar-content">
      <div class="sidebar-header">
        <h3>Chat Controls</h3>
      </div>

      <!-- Model/Preset Info -->
      <div class="sidebar-info">
        <div class="info-row">
          <span class="info-label">Model:</span>
          <span class="info-value" :title="settings.model">{{ displayModelName }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Preset:</span>
          <span class="info-value">{{ currentPresetName || 'None' }}</span>
        </div>
        <div class="context-window">
          <div class="context-header">
            <span class="info-label">Context:</span>
            <span class="context-stats">{{ estimatedTokens.toLocaleString() }} / {{ settings.max_tokens.toLocaleString() }}</span>
          </div>
          <div class="context-bar">
            <div class="context-fill" :style="{ width: contextPercentage + '%' }"></div>
          </div>
          <div class="context-percentage">{{ contextPercentage }}%</div>
        </div>
      </div>

      <!-- Persona & Preset Selectors -->
      <div class="sidebar-selectors">
        <!-- Persona Selector -->
        <div class="selector-container">
          <div class="selector-header">
            <span class="selector-icon">👤</span>
            <span class="selector-label">Persona:</span>
            <button @click="$emit('open-tab', 'personas', {}, 'Personas', false)" class="selector-edit-btn-header" title="Edit Personas">✏️</button>
          </div>
          <div class="selector-controls">
            <select :value="personaName" @change="$emit('persona-change', $event.target.value)" class="selector-dropdown">
              <option v-for="p in availablePersonas" :key="p._filename" :value="p._filename">{{ p.nickname || p.name }}</option>
            </select>
          </div>
        </div>

        <!-- Preset Selector -->
        <div class="selector-container">
          <div class="selector-header">
            <span class="selector-icon">⚙️</span>
            <span class="selector-label">Preset:</span>
            <button @click="$emit('open-tab', 'presets', {}, 'Presets', false)" class="selector-edit-btn-header" title="Edit Presets">✏️</button>
          </div>
          <div class="selector-controls">
            <select :value="currentPresetFilename" @change="$emit('preset-change', $event.target.value)" class="selector-dropdown">
              <option v-for="preset in availablePresets" :key="preset.filename" :value="preset.filename">{{ preset.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Sidebar Actions -->
      <div class="sidebar-actions">
        <button @click="$emit('new-chat')" class="sidebar-btn">📝 New Chat</button>
        <button @click="$emit('new-chat-from-summary')" v-if="hasMessages" class="sidebar-btn">📖 New Chat from Summary</button>
        <button v-if="showConvertToGroup" @click="$emit('convert-to-group')" class="sidebar-btn">👥 Convert to Group</button>
        <button @click="$emit('toggle-history')" :class="{ 'active': showHistory }" class="sidebar-btn">📜 History</button>
        <button @click="$emit('show-lorebooks')" class="sidebar-btn">📚 Lorebook</button>
        <button @click="$emit('toggle-debug')" :class="{ 'active': showDebug }" class="sidebar-btn">🐛 Debug</button>
        <button v-if="isGroupChat" @click="$emit('toggle-group-manager')" :class="{ 'active': showGroupManager }" class="sidebar-btn sidebar-btn-special">👥 Group Manager</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatSidebar',
  props: {
    sidebarOpen: {
      type: Boolean,
      default: true
    },
    settings: {
      type: Object,
      required: true
    },
    currentPresetName: {
      type: String,
      default: null
    },
    currentPresetFilename: {
      type: String,
      default: null
    },
    estimatedTokens: {
      type: Number,
      default: 0
    },
    hasMessages: {
      type: Boolean,
      default: false
    },
    showConvertToGroup: {
      type: Boolean,
      default: false
    },
    showHistory: {
      type: Boolean,
      default: false
    },
    showDebug: {
      type: Boolean,
      default: false
    },
    personaName: {
      type: String,
      default: 'User'
    },
    availablePersonas: {
      type: Array,
      default: () => []
    },
    availablePresets: {
      type: Array,
      default: () => []
    },
    isGroupChat: {
      type: Boolean,
      default: false
    },
    showGroupManager: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update:sidebarOpen',
    'new-chat',
    'new-chat-from-summary',
    'convert-to-group',
    'toggle-history',
    'persona-change',
    'preset-change',
    'show-lorebooks',
    'toggle-debug',
    'toggle-group-manager',
    'open-tab'
  ],
  data() {
    return {
      localSidebarOpen: this.sidebarOpen
    }
  },
  computed: {
    displayModelName() {
      if (!this.settings.model) return 'Not set';
      const parts = this.settings.model.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : this.settings.model;
    },
    contextPercentage() {
      if (!this.settings.max_tokens || this.settings.max_tokens === 0) return 0;
      const percentage = (this.estimatedTokens / this.settings.max_tokens) * 100;
      return Math.min(100, Math.round(percentage));
    }
  },
  watch: {
    sidebarOpen(newVal) {
      this.localSidebarOpen = newVal;
    }
  },
  methods: {
    toggleSidebar() {
      this.localSidebarOpen = !this.localSidebarOpen;
      this.$emit('update:sidebarOpen', this.localSidebarOpen);
    }
  }
}
</script>

<style scoped>
.chat-sidebar {
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 280px;
  background-color: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-right: 1px solid var(--border-color);
  transition: transform 0.3s ease;
  z-index: 99;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.chat-sidebar.collapsed {
  transform: translateX(-280px);
}

.sidebar-toggle {
  position: absolute;
  right: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 40px;
  min-width: 30px;
  min-height: 40px;
  padding: 0;
  margin: 0;
  background-color: var(--bg-overlay);
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  font-size: 12px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  z-index: 1;
  box-sizing: border-box;
}

.sidebar-toggle:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-color);
  transform: translateY(-50%);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.sidebar-header {
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.context-window {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.context-stats {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.context-bar {
  height: 8px;
  background-color: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.context-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #fbbf24 70%, #ef4444 100%);
  transition: width 0.3s ease;
  border-radius: 3px;
}

.context-percentage {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.sidebar-selectors {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-btn {
  width: 100%;
  padding: 0.625rem 1rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-btn:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--border-color-hover, var(--border-color));
  transform: translateY(-1px);
}

.sidebar-btn.active {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.sidebar-btn-special {
  border: 2px solid var(--accent-color);
  border-style: dashed;
  margin-top: 0.5rem;
}

.sidebar-btn-special:hover {
  border-style: solid;
}

.selector-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.625rem;
  transition: all 0.2s ease;
}

.selector-container:hover {
  border-color: var(--border-color-hover, var(--border-color));
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.selector-icon {
  font-size: 1rem;
  line-height: 1;
}

.selector-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

.selector-edit-btn-header {
  width: 28px;
  height: 24px;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.875rem;
  border-radius: 3px;
  transition: background-color 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.selector-edit-btn-header:hover {
  background-color: var(--hover-color);
  color: var(--accent-color);
}

.selector-controls {
  width: 100%;
}

.selector-dropdown {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  transition: border-color 0.2s ease;
}

.selector-dropdown:hover {
  border-color: var(--accent-color);
}

.selector-dropdown:focus {
  outline: none;
  border-color: var(--accent-color);
}

@media (max-width: 768px) {
  .chat-sidebar {
    width: 240px;
  }

  .chat-sidebar.collapsed {
    transform: translateX(-240px);
  }

  .sidebar-content {
    padding: 0.75rem;
  }

  .info-value {
    max-width: 120px;
  }
}
</style>
