<template>
  <div class="tab-bar">
    <div class="tabs-container" ref="tabsContainer">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{
          active: tab.id === activeTabId,
          editing: editingTabId === tab.id,
          'drag-over': dragOverTabId === tab.id
        }"
        :draggable="editingTabId !== tab.id"
        :title="tab.label"
        @click="editingTabId === tab.id ? null : $emit('switch-tab', tab.id)"
        @dblclick="startEditing(tab.id, tab.label)"
        @dragstart="handleDragStart($event, tab.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
        @dragenter="handleDragEnter($event, tab.id)"
        @dragleave="handleDragLeave($event, tab.id)"
        @drop="handleDrop($event, tab.id)"
      >
        <input
          v-if="editingTabId === tab.id"
          ref="editInput"
          v-model="editingLabel"
          class="tab-edit-input"
          @blur="saveEdit"
          @keydown.enter="saveEdit"
          @keydown.esc="cancelEdit"
          @click.stop
        />
        <span v-else class="tab-label">{{ tab.label }}</span>
        <span
          class="tab-close"
          @click.stop="$emit('close-tab', tab.id)"
          title="Close tab"
        >
          ×
        </span>
      </div>
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
  emits: ['switch-tab', 'close-tab', 'new-tab', 'reorder-tabs', 'rename-tab'],
  data() {
    return {
      editingTabId: null,
      editingLabel: '',
      originalLabel: '',
      draggedTabId: null,
      dragOverTabId: null,
    };
  },
  methods: {
    startEditing(tabId, label) {
      this.editingTabId = tabId;
      this.editingLabel = label;
      this.originalLabel = label;
      this.$nextTick(() => {
        const input = this.$refs.editInput?.[0];
        if (input) {
          input.focus();
          input.select();
        }
      });
    },
    saveEdit() {
      if (this.editingTabId && this.editingLabel.trim()) {
        if (this.editingLabel !== this.originalLabel) {
          this.$emit('rename-tab', this.editingTabId, this.editingLabel.trim());
        }
      }
      this.cancelEdit();
    },
    cancelEdit() {
      this.editingTabId = null;
      this.editingLabel = '';
      this.originalLabel = '';
    },
    handleDragStart(event, tabId) {
      this.draggedTabId = tabId;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tabId);
      // Add a small delay to allow the drag image to be created
      setTimeout(() => {
        event.target.classList.add('dragging');
      }, 0);
    },
    handleDragEnd(event) {
      event.target.classList.remove('dragging');
      this.draggedTabId = null;
      this.dragOverTabId = null;
    },
    handleDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    handleDragEnter(event, tabId) {
      if (this.draggedTabId && this.draggedTabId !== tabId) {
        this.dragOverTabId = tabId;
      }
    },
    handleDragLeave(event, tabId) {
      if (this.dragOverTabId === tabId) {
        this.dragOverTabId = null;
      }
    },
    handleDrop(event, targetTabId) {
      event.preventDefault();

      if (!this.draggedTabId || this.draggedTabId === targetTabId) {
        this.dragOverTabId = null;
        return;
      }

      // Find indices
      const draggedIndex = this.tabs.findIndex(tab => tab.id === this.draggedTabId);
      const targetIndex = this.tabs.findIndex(tab => tab.id === targetTabId);

      if (draggedIndex === -1 || targetIndex === -1) {
        this.dragOverTabId = null;
        return;
      }

      // Create new array with reordered tabs
      const newTabs = [...this.tabs];
      const [draggedTab] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, draggedTab);

      // Emit reorder event
      this.$emit('reorder-tabs', newTabs);

      this.dragOverTabId = null;
    },
  },
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

.tab-edit-input {
  flex: 1;
  background: var(--bg-primary, rgba(13, 13, 13, 0.8));
  border: 1px solid var(--accent-color, #4a9eff);
  border-radius: 3px;
  padding: 2px 6px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: inherit;
  outline: none;
}

.tab.editing {
  cursor: default;
}

/* Drag and drop styles */
.tab[draggable="true"] {
  cursor: grab;
}

.tab[draggable="true"]:active {
  cursor: grabbing;
}

.tab.dragging {
  opacity: 0.4;
}

.tab.drag-over {
  border-left: 3px solid var(--accent-color, #4a9eff);
  padding-left: 9px; /* Compensate for border */
}
</style>
