<template>
  <div class="tab-bar">
    <div class="tabs-container" ref="tabsContainer">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === activeTabId }"
        @click="$emit('switch-tab', tab.id)"
        :title="tab.label"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <button
          class="tab-close"
          @click.stop="$emit('close-tab', tab.id)"
          title="Close tab"
        >
          ×
        </button>
      </button>
    </div>
    <button class="new-tab-btn" @click="$emit('new-tab')" title="New tab">
      +
    </button>
  </div>
</template>

<script>
export default {
  name: 'TabBar',
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
  emits: ['switch-tab', 'close-tab', 'new-tab', 'reorder-tabs'],
};
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-overlay, rgba(26, 26, 26, 0.85));
  backdrop-filter: blur(var(--blur-amount, 12px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 12px));
  border-bottom: 1px solid var(--border-color, #333);
  height: 40px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.tabs-container {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  height: 100%;
  scrollbar-width: thin;
}

.tabs-container::-webkit-scrollbar {
  height: 4px;
}

.tabs-container::-webkit-scrollbar-thumb {
  background: var(--border-color, #333);
  border-radius: 2px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 100%;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color, #333);
  color: var(--text-secondary, #999);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  flex-shrink: 1;
  white-space: nowrap;
  font-size: 14px;
  position: relative;
}

.tab:hover {
  background: var(--hover-color, rgba(255, 255, 255, 0.05));
  color: var(--text-primary, #fff);
}

.tab.active {
  background: var(--bg-primary, rgba(13, 13, 13, 0.5));
  color: var(--text-primary, #fff);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-color, #4a9eff);
}

.tab-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: var(--text-secondary, #999);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tab-close:hover {
  background: var(--bg-error, #ff4444);
  color: white;
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 100%;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color, #333);
  color: var(--text-secondary, #999);
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.new-tab-btn:hover {
  background: var(--bg-hover, #252525);
  color: var(--text-primary, #fff);
}

/* Tab shrinking when many tabs */
.tabs-container:has(.tab:nth-child(10)) .tab {
  min-width: 100px;
}

.tabs-container:has(.tab:nth-child(15)) .tab {
  min-width: 80px;
}

.tabs-container:has(.tab:nth-child(20)) .tab {
  min-width: 60px;
}
</style>
