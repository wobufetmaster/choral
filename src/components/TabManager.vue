<template>
  <div class="tab-manager">
    <TabBar
      :tabs="tabs"
      :activeTabId="activeTabId"
      @switch-tab="switchTab"
      @close-tab="closeTab"
      @new-tab="newTab"
      @reorder-tabs="reorderTabs"
      @rename-tab="renameTab"
    />
    <div class="tab-content">
      <component
        :is="activeTabComponent"
        v-if="activeTab"
        :key="activeTab.id"
        :tabData="activeTab.data"
        @update-tab="updateTab"
        @open-tab="openTab"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import TabBar from './TabBar.vue';
import CharacterList from './CharacterList.vue';
import ChatView from './ChatView.vue';
import CharacterEditor from './CharacterEditor.vue';
import GroupChatManager from './GroupChatManager.vue';
import PresetSelector from './PresetSelector.vue';
import Settings from './Settings.vue';
import LorebookManager from './LorebookManager.vue';
import BookkeepingSettings from './BookkeepingSettings.vue';
import ToolSettings from './ToolSettings.vue';

export default {
  name: 'TabManager',
  components: {
    TabBar,
    CharacterList,
    ChatView,
    CharacterEditor,
    GroupChatManager,
    PresetSelector,
    Settings,
    LorebookManager,
    BookkeepingSettings,
    ToolSettings,
  },
  setup() {
    const tabs = ref([]);
    const activeTabId = ref(null);

    // Component mapping
    const componentMap = {
      'character-list': CharacterList,
      'chat': ChatView,
      'character-editor': CharacterEditor,
      'group-chat': ChatView, // Group chats use ChatView
      'presets': PresetSelector,
      'settings': Settings,
      'lorebooks': LorebookManager,
      'bookkeeping-settings': BookkeepingSettings,
      'tool-settings': ToolSettings,
    };

    const activeTab = computed(() => {
      return tabs.value.find(tab => tab.id === activeTabId.value);
    });

    const activeTabComponent = computed(() => {
      if (!activeTab.value) return null;
      return componentMap[activeTab.value.type];
    });

    // Generate unique ID for tabs
    const generateTabId = () => {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    // Load tabs from localStorage
    const loadTabs = () => {
      try {
        const savedTabs = localStorage.getItem('choral-tabs');
        const savedActiveTabId = localStorage.getItem('choral-active-tab');

        if (savedTabs) {
          tabs.value = JSON.parse(savedTabs);
          activeTabId.value = savedActiveTabId;
        } else {
          // Default: open character list
          newTab();
        }
      } catch (error) {
        console.error('Failed to load tabs:', error);
        newTab();
      }
    };

    // Save tabs to localStorage
    const saveTabs = () => {
      try {
        localStorage.setItem('choral-tabs', JSON.stringify(tabs.value));
        localStorage.setItem('choral-active-tab', activeTabId.value);
      } catch (error) {
        console.error('Failed to save tabs:', error);
      }
    };

    // Create new tab (defaults to character list)
    const newTab = (type = 'character-list', data = {}, label = null) => {
      const id = generateTabId();
      const defaultLabels = {
        'character-list': 'Characters',
        'chat': 'Chat',
        'character-editor': 'New Character',
        'group-chat': 'Group Chat',
        'presets': 'Presets',
        'settings': 'Settings',
        'bookkeeping-settings': 'Bookkeeping',
        'tool-settings': 'Tool Settings',
      };

      const tab = {
        id,
        type,
        label: label || defaultLabels[type] || 'New Tab',
        data,
      };

      tabs.value.push(tab);
      activeTabId.value = id;
      saveTabs();
    };

    // Open tab or switch to existing
    const openTab = (type, data = {}, label = null, replaceActive = true) => {
      // Don't check for existing tabs - always create new ones or replace current
      // This allows multiple chat tabs with the same character

      if (replaceActive && activeTab.value) {
        // Replace current tab
        const index = tabs.value.findIndex(tab => tab.id === activeTabId.value);
        if (index !== -1) {
          tabs.value[index] = {
            id: activeTab.value.id,
            type,
            label: label || activeTab.value.label,
            data,
          };
        }
      } else {
        // Create new tab
        newTab(type, data, label);
      }
      saveTabs();
    };

    // Switch active tab
    const switchTab = (tabId) => {
      activeTabId.value = tabId;
      saveTabs();
    };

    // Close tab
    const closeTab = (tabId) => {
      const index = tabs.value.findIndex(tab => tab.id === tabId);
      if (index === -1) return;

      tabs.value.splice(index, 1);

      // If closing active tab, switch to another
      if (activeTabId.value === tabId) {
        if (tabs.value.length > 0) {
          // Switch to tab at same index, or previous if last
          const newIndex = Math.min(index, tabs.value.length - 1);
          activeTabId.value = tabs.value[newIndex].id;
        } else {
          // No tabs left, create new one
          newTab();
        }
      }

      saveTabs();
    };

    // Update tab (e.g., change label, chatId)
    const updateTab = (updates) => {
      // If updates include an id, update that specific tab
      const tabId = updates.id || activeTabId.value;
      if (!tabId) return;

      const index = tabs.value.findIndex(tab => tab.id === tabId);
      if (index !== -1) {
        // Remove the id from updates to avoid overwriting the tab's id
        const { id, ...rest } = updates;

        // Update tab data (e.g., label, data.chatFilename)
        if (rest.chatId) {
          tabs.value[index].data = { ...tabs.value[index].data, chatFilename: rest.chatId };
        }
        if (rest.title) {
          tabs.value[index].label = rest.title;
        }

        // Merge any other updates
        tabs.value[index] = { ...tabs.value[index], ...rest };
        saveTabs();
      }
    };

    // Rename tab
    const renameTab = async (tabId, newLabel) => {
      const tab = tabs.value.find(t => t.id === tabId);
      if (!tab) return;

      // Update tab label
      tab.label = newLabel;

      // If it's a chat tab with a chat file, rename the file on server
      if ((tab.type === 'chat' || tab.type === 'group-chat') && tab.data.chatFilename) {
        try {
          const response = await fetch(`/api/chats/${tab.data.chatFilename}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newLabel }),
          });

          if (response.ok) {
            const result = await response.json();
            // Update the chat filename in tab data
            tab.data.chatFilename = result.filename;
          } else {
            console.error('Failed to rename chat on server');
          }
        } catch (error) {
          console.error('Error renaming chat:', error);
        }
      }

      saveTabs();
    };

    // Reorder tabs
    const reorderTabs = (newOrder) => {
      tabs.value = newOrder;
      saveTabs();
    };

    // Watch for tab changes
    watch([tabs, activeTabId], () => {
      saveTabs();
    }, { deep: true });

    onMounted(() => {
      loadTabs();
    });

    return {
      tabs,
      activeTabId,
      activeTab,
      activeTabComponent,
      switchTab,
      closeTab,
      newTab,
      openTab,
      updateTab,
      renameTab,
      reorderTabs,
    };
  },
};
</script>

<style scoped>
.tab-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.tab-content {
  flex: 1;
  overflow: hidden;
}
</style>
