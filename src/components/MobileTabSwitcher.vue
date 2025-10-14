<template>
  <div class="mobile-tab-switcher">
    <!-- Tab Count Button -->
    <button class="tab-count-button" @click="showModal = true" :title="`${tabs.length} open tabs`">
      <span class="tab-count">{{ tabs.length }}</span>
      <span class="tab-icon">⊞</span>
    </button>

    <!-- Modal Overlay (Teleported to body) -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="showModal" class="mobile-tabs-modal-overlay">
          <div class="mobile-tabs-modal-content">
            <!-- Header -->
            <div class="mobile-tabs-modal-header">
              <h3>{{ tabs.length }} {{ tabs.length === 1 ? 'Tab' : 'Tabs' }}</h3>
              <button class="close-modal-btn" @click="showModal = false">✕</button>
            </div>

            <!-- Tab Cards Grid -->
            <div class="mobile-tabs-grid">
              <div
                v-for="tab in tabs"
                :key="tab.id"
                class="mobile-tab-card"
                :class="{ active: tab.id === activeTabId }"
                @click="selectTab(tab.id)"
              >
                <div class="mobile-tab-card-header">
                  <span class="mobile-tab-card-label">{{ tab.label }}</span>
                  <button
                    class="mobile-tab-card-close"
                    @click.stop="$emit('close-tab', tab.id)"
                    title="Close tab"
                  >
                    ×
                  </button>
                </div>
                <div class="mobile-tab-card-content">
                  <div class="mobile-tab-card-icon">
                    {{ getTabIcon(tab.type) }}
                  </div>
                  <div class="mobile-tab-card-type">{{ getTabTypeName(tab.type) }}</div>
                </div>
              </div>

              <!-- New Tab Card -->
              <div class="mobile-tab-card mobile-new-tab-card" @click="createNewTab">
                <div class="mobile-new-tab-icon">+</div>
                <div class="mobile-new-tab-label">New Tab</div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script>
export default {
  name: 'MobileTabSwitcher',
  props: {
    tabs: {
      type: Array,
      required: true,
    },
    activeTabId: {
      type: String,
      default: null,
    },
  },
  emits: ['switch-tab', 'close-tab', 'new-tab'],
  data() {
    return {
      showModal: false,
    };
  },
  methods: {
    selectTab(tabId) {
      this.$emit('switch-tab', tabId);
      this.showModal = false;
    },
    createNewTab() {
      this.$emit('new-tab');
      this.showModal = false;
    },
    getTabIcon(type) {
      const icons = {
        'character-list': '👥',
        'chat': '💬',
        'group-chat': '👥',
        'character-editor': '✏️',
        'presets': '⚙️',
        'personas': '👤',
        'settings': '⚙️',
        'lorebooks': '📚',
        'bookkeeping-settings': '📊',
        'tool-settings': '🔧',
      };
      return icons[type] || '📄';
    },
    getTabTypeName(type) {
      const names = {
        'character-list': 'Characters',
        'chat': 'Chat',
        'group-chat': 'Group Chat',
        'character-editor': 'Editor',
        'presets': 'Presets',
        'personas': 'Personas',
        'settings': 'Settings',
        'lorebooks': 'Lorebooks',
        'bookkeeping-settings': 'Bookkeeping',
        'tool-settings': 'Tools',
      };
      return names[type] || 'Tab';
    },
  },
};
</script>

<style scoped>
.mobile-tab-switcher {
  display: none;
}

/* Show on mobile/tablet */
@media (max-width: 768px) {
  .mobile-tab-switcher {
    display: flex;
    align-items: center;
    height: 100%;
  }
}

.tab-count-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  height: 32px;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  color: var(--text-primary, #fff);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 600;
  margin: 0 8px;
}

.tab-count-button:hover {
  background: var(--hover-color, #333);
  border-color: var(--accent-color, #4a9eff);
}

.tab-count {
  min-width: 20px;
  text-align: center;
}

.tab-icon {
  font-size: 16px;
}
</style>

<style>
/* Modal styles (not scoped because it's teleported to body) */
.mobile-tabs-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary, #1a1a1a);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-tabs-modal-content {
  width: 100%;
  height: 100%;
  background: var(--bg-primary, #1a1a1a);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-tabs-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #252525);
  flex-shrink: 0;
}

.mobile-tabs-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-modal-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary, #999);
  font-size: 24px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-modal-btn:hover {
  background: var(--hover-color, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, #fff);
}

/* Tab Cards Grid */
.mobile-tabs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  align-content: flex-start;
}

@media (max-width: 480px) {
  .mobile-tabs-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 16px;
  }
}

@media (min-width: 481px) and (max-width: 768px) {
  .mobile-tabs-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.mobile-tab-card {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--bg-secondary, #252525);
  border: 2px solid var(--border-color, #333);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-tab-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent-color, #4a9eff);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

.mobile-tab-card.active {
  border-color: var(--accent-color, #4a9eff);
  background: var(--bg-tertiary, #2a2a2a);
  box-shadow: 0 0 0 2px var(--accent-color, #4a9eff);
}

.mobile-tab-card.active::before {
  content: '✓';
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: var(--accent-color, #4a9eff);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  z-index: 2;
}

.mobile-tab-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-tertiary, #2a2a2a);
  border-bottom: 1px solid var(--border-color, #333);
  gap: 8px;
}

.mobile-tab-card-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}

.mobile-tab-card-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary, #999);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  line-height: 1;
}

.mobile-tab-card-close:hover {
  background: var(--bg-error, #ff4444);
  color: white;
}

.mobile-tab-card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
}

.mobile-tab-card-icon {
  font-size: 48px;
  opacity: 0.8;
}

.mobile-tab-card-type {
  font-size: 12px;
  color: var(--text-secondary, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* New Tab Card */
.mobile-new-tab-card {
  background: var(--bg-secondary, #252525);
  border: 2px dashed var(--border-color, #333);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mobile-new-tab-card:hover {
  border-color: var(--accent-color, #4a9eff);
  background: var(--bg-tertiary, #2a2a2a);
}

.mobile-new-tab-icon {
  font-size: 48px;
  color: var(--text-secondary, #999);
}

.mobile-new-tab-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #999);
}

/* Animations */
.modal-fade-enter-active {
  animation: modal-slide-in 0.25s ease-out;
}

.modal-fade-leave-active {
  animation: modal-slide-out 0.2s ease-in;
}

@keyframes modal-slide-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes modal-slide-out {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}
</style>
