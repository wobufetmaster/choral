<template>
  <div class="tab-manager">
    <div class="tab-bar-container">
      <TabBar
        :tabs="tabs"
        :activeTabId="activeTabId"
        @switch-tab="switchTab"
        @close-tab="closeTab"
        @new-tab="newTab"
        @reorder-tabs="reorderTabs"
        @rename-tab="renameTab"
      />
      <MobileTabSwitcher
        :tabs="tabs"
        :activeTabId="activeTabId"
        @switch-tab="switchTab"
        @close-tab="closeTab"
        @new-tab="newTab"
      />
    </div>
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
import MobileTabSwitcher from './MobileTabSwitcher.vue';
import CharacterList from './CharacterList.vue';
import ChatView from './ChatView.vue';
import CharacterEditor from './CharacterEditor.vue';
import GroupChatManager from './GroupChatManager.vue';
import PresetSelector from './PresetSelector.vue';
import Settings from './Settings.vue';
import LorebookManager from './LorebookManager.vue';
import BookkeepingSettings from './BookkeepingSettings.vue';
import ToolSettings from './ToolSettings.vue';
import PersonaManager from './PersonaManager.vue';

export default {
  name: 'TabManager',
  components: {
    TabBar,
    MobileTabSwitcher,
    CharacterList,
    ChatView,
    CharacterEditor,
    GroupChatManager,
    PresetSelector,
    Settings,
    LorebookManager,
    BookkeepingSettings,
    ToolSettings,
    PersonaManager,
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
      'personas': PersonaManager,
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
          const parsedTabs = JSON.parse(savedTabs);

          // Validate and clean up corrupted tabs
          tabs.value = parsedTabs.filter(tab => {
            // Remove character-editor tabs with missing character data (corrupted)
            if (tab.type === 'character-editor') {
              const hasValidData = tab.data && (tab.data.character || tab.data.draftCard);
              if (!hasValidData) {
                console.warn('[TabManager] Removing corrupted character-editor tab:', tab.id);
                return false;  // Filter out this corrupted tab
              }
            }
            return true;  // Keep valid tabs
          });

          // Validate that the saved active tab ID exists in the loaded tabs
          const activeTabExists = tabs.value.some(tab => tab.id === savedActiveTabId);

          if (activeTabExists) {
            activeTabId.value = savedActiveTabId;
          } else if (tabs.value.length > 0) {
            // If saved active tab doesn't exist, use the first tab
            activeTabId.value = tabs.value[0].id;
          } else {
            // No valid tabs, create a new one
            newTab();
          }
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
        // Filter out large data that shouldn't be persisted to localStorage
        // (images as base64, File objects, etc.) to avoid quota errors
        const tabsToSave = tabs.value.map(tab => {
          // Clone the tab to avoid modifying the original
          const cleanTab = { ...tab };

          if (cleanTab.data) {
            cleanTab.data = { ...cleanTab.data };

            // Remove draft data that can be very large (base64 images, File objects)
            // These are kept in memory but not persisted to localStorage
            delete cleanTab.data.draftImagePreview;
            delete cleanTab.data.draftImageFile;

            // Also remove the full draftCard if it exists
            // (users will lose unsaved changes on refresh, but that's better than crashes)
            delete cleanTab.data.draftCard;
          }

          return cleanTab;
        });

        localStorage.setItem('choral-tabs', JSON.stringify(tabsToSave));
        localStorage.setItem('choral-active-tab', activeTabId.value);
      } catch (error) {
        console.error('Failed to save tabs:', error);
        // If we still hit quota errors, log more details
        if (error.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded. Tab count:', tabs.value.length);
        }
      }
    };

    // Create new tab (defaults to character list)
    const newTab = (type = 'character-list', data = {}, label = null) => {
      // Check if this is a singleton type that should be de-duplicated
      const singletonTypes = ['character-list', 'settings', 'bookkeeping-settings', 'tool-settings', 'presets', 'personas', 'lorebooks'];
      if (singletonTypes.includes(type)) {
        const existingTab = tabs.value.find(tab => tab.type === type);
        if (existingTab) {
          // Switch to existing tab instead of creating new one
          switchTab(existingTab.id);
          return;
        }
      }

      const id = generateTabId();
      const defaultLabels = {
        'character-list': 'Characters',
        'chat': 'Chat',
        'character-editor': 'New Character',
        'group-chat': 'Group Chat',
        'presets': 'Presets',
        'personas': 'Personas',
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
      // For settings pages and manager pages, check if one already exists and switch to it
      const singletonTypes = ['character-list', 'settings', 'bookkeeping-settings', 'tool-settings', 'presets', 'personas', 'lorebooks'];
      if (singletonTypes.includes(type)) {
        const existingTab = tabs.value.find(tab => tab.type === type);
        if (existingTab) {
          // Switch to existing tab instead of creating new one
          switchTab(existingTab.id);
          return;
        }
      }

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
        // Handle both direct chatId (legacy) and nested data.chatId
        if (rest.data?.chatId) {
          // Store chatId as both chatId and chatFilename for compatibility
          rest.data = {
            ...rest.data,
            chatFilename: rest.data.chatId
          };
        } else if (rest.chatId) {
          // Legacy direct chatId format
          tabs.value[index].data = {
            ...tabs.value[index].data,
            chatId: rest.chatId,
            chatFilename: rest.chatId
          };
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

      // Note: Chat file renaming on server would require reading the chat,
      // updating the name field, and saving it back. Currently just updates
      // the tab label in localStorage.
      // TODO: Implement proper chat file name updates via GET + POST pattern

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

.tab-bar-container {
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

.tab-content {
  flex: 1;
  overflow: hidden;
}

/* Hide TabBar on mobile, show MobileTabSwitcher */
@media (max-width: 768px) {
  .tab-bar-container :deep(.tab-bar) {
    display: none;
  }
}

/* Hide MobileTabSwitcher on desktop, show TabBar */
@media (min-width: 769px) {
  .tab-bar-container :deep(.mobile-tab-switcher) {
    display: none;
  }
}
</style>
