<template>
  <div class="settings">
    <div class="settings-header">
      <h2>Settings</h2>
    </div>

    <div class="settings-content">
      <div class="setting-group">
        <h3>API Configuration</h3>
        <div class="form-group">
          <label>OpenRouter API Key</label>
          <input
            v-model="apiKey"
            type="password"
            placeholder="sk-or-..."
            @blur="saveApiKey"
          />
          <small>Stored locally in browser. Not sent to our servers.</small>
        </div>
      </div>

      <div class="setting-group">
        <h3>Active Preset</h3>
        <div class="form-group">
          <label>Default Preset for New Chats</label>
          <select v-model="activePreset" @change="saveActivePreset">
            <option value="">None</option>
            <option v-for="preset in presets" :key="preset.filename || preset" :value="preset.filename || preset">
              {{ (preset.name || preset.filename || preset).replace('.json', '') }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-group">
        <h3>Default Persona</h3>
        <div class="form-group">
          <label>Default Persona for New Chats</label>
          <select v-model="defaultPersona" @change="saveDefaultPersona">
            <option value="">None (use "User")</option>
            <option v-for="persona in personas" :key="persona.name" :value="persona.name + '.json'">
              {{ persona.name }}
            </option>
          </select>
          <small>This persona will be automatically selected when starting new chats</small>
        </div>
      </div>

      <div class="setting-group">
        <h3>Backup</h3>

        <div class="form-group">
          <label>
            <input type="checkbox" v-model="backupEnabled" @change="saveBackupConfig" />
            Enable automatic backups
          </label>
        </div>

        <template v-if="backupEnabled">
          <div class="form-group">
            <label>Backup Interval</label>
            <select v-model="backupInterval" @change="saveBackupConfig">
              <option value="15m">Every 15 minutes</option>
              <option value="1h">Every hour</option>
              <option value="6h">Every 6 hours</option>
              <option value="12h">Every 12 hours</option>
              <option value="24h">Daily</option>
            </select>
          </div>

          <div class="form-group">
            <label>Keep last</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input
                type="number"
                v-model.number="backupRetention"
                @blur="saveBackupConfig"
                min="1"
                max="100"
                style="width: 80px;"
              />
              <span>backups</span>
            </div>
          </div>

          <div class="form-group">
            <label>Backup Directory</label>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                v-model="backupDirectory"
                @blur="validateBackupPath"
                style="flex: 1;"
              />
              <button @click="chooseBackupDirectory" class="choose-btn">Choose...</button>
            </div>
            <small v-if="backupPathStatus === 'valid'" class="status-success">
              ✓ Directory is writable
            </small>
            <small v-else-if="backupPathStatus === 'can-create'" class="status-warning">
              ⚠️ Directory doesn't exist.
              <a href="#" @click.prevent="createBackupDirectory">Create it?</a>
            </small>
            <small v-else-if="backupPathError" class="status-error">
              ❌ {{ backupPathError }}
            </small>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" v-model="backupEncrypt" @change="saveBackupConfig" />
              Encrypt backups
            </label>
          </div>

          <div v-if="backupEncrypt" class="form-group">
            <label>Password</label>
            <input
              type="password"
              v-model="backupPassword"
              @blur="saveBackupConfig"
              placeholder="Minimum 8 characters"
              minlength="8"
            />
            <small class="status-warning">⚠️ Remember this password - it cannot be recovered!</small>
          </div>

          <div class="form-group">
            <button
              @click="triggerBackup"
              :disabled="backupInProgress || !isBackupConfigValid"
              class="backup-btn"
            >
              {{ backupInProgress ? 'Backup in progress...' : 'Backup Now' }}
            </button>
            <small v-if="lastBackupTime">Last backup: {{ lastBackupTime }}</small>
            <small v-if="backupMessage" :class="backupMessageClass">{{ backupMessage }}</small>
          </div>
        </template>
      </div>

      <div class="setting-group">
        <h3>Appearance</h3>

        <div class="form-group">
          <label>Color Theme</label>
          <select v-model="currentTheme" @change="updateTheme">
            <option v-for="theme in themeOptions" :key="theme.key" :value="theme.key">
              {{ theme.name }}
            </option>
          </select>
          <small>{{ themeOptions.find(t => t.key === currentTheme)?.description }}</small>
        </div>

        <div class="form-group">
          <label>Background Type</label>
          <select v-model="backgroundType">
            <option value="none">None</option>
            <option value="pattern">Pattern</option>
            <option value="custom">Custom Image</option>
          </select>
        </div>

        <div v-if="backgroundType === 'pattern'" class="form-group">
          <label>Pattern Style</label>
          <select v-model="backgroundPattern">
            <option v-for="pattern in patternOptions" :key="pattern.key" :value="pattern.key">
              {{ pattern.name }}
            </option>
          </select>
        </div>

        <div v-if="backgroundType !== 'none'" class="form-group">
          <label>Background Opacity</label>
          <input
            type="range"
            v-model.number="backgroundOpacity"
            min="0"
            max="1"
            step="0.05"
            class="opacity-slider"
          />
          <small>{{ Math.round(backgroundOpacity * 100) }}%</small>
        </div>

        <div v-if="backgroundType === 'custom'" class="form-group">
          <label>Custom Image URL</label>
          <input
            type="text"
            v-model="customBackgroundUrl"
            @blur="updateBackground"
            placeholder="https://example.com/image.jpg"
          />
          <small>Enter a URL to an image file</small>
        </div>

        <div class="form-group">
          <button @click="togglePreview" class="preview-toggle-btn">
            {{ showPreview ? 'Hide Preview' : 'Preview Background' }}
          </button>
        </div>

        <BackgroundPreview
          v-if="showPreview"
          :backgroundConfig="{
            type: backgroundType,
            pattern: backgroundPattern,
            opacity: backgroundOpacity,
            url: customBackgroundUrl
          }"
          :currentTheme="currentTheme"
        />
      </div>

      <div class="setting-group">
        <h3>About</h3>
        <p class="about-text">
          <strong>Choral</strong><br />
          A lightweight, drop-in replacement for SillyTavern built with Vue 3 + Vite.
        </p>
        <p class="about-text">
          Version: 1.0.0
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { themes, backgroundPatterns, getStoredTheme, getStoredBackground, saveTheme as saveThemeUtil, saveBackground, applyTheme } from '../utils/themes.js';
import BackgroundPreview from './BackgroundPreview.vue';
import { useApi } from '../composables/useApi.js';

export default {
  name: 'Settings',
  components: {
    BackgroundPreview
  },
  props: {
    tabData: {
      type: Object,
      default: () => ({}),
    },
  },
  setup() {
    const api = useApi();

    const apiKey = ref('');
    const activePreset = ref('');
    const presets = ref([]);
    const defaultPersona = ref('');
    const personas = ref([]);
    const currentTheme = ref('cozy-dark');
    const backgroundType = ref('pattern');
    const backgroundPattern = ref('hexagons');
    const backgroundOpacity = ref(0.15);
    const customBackgroundUrl = ref('');
    const isLoading = ref(true);
    const showPreview = ref(false);

    // Backup settings
    const backupEnabled = ref(false);
    const backupInterval = ref('6h');
    const backupRetention = ref(10);
    const backupDirectory = ref('./backups');
    const backupEncrypt = ref(false);
    const backupPassword = ref('');
    const backupPathStatus = ref(''); // 'valid', 'can-create', or empty
    const backupPathError = ref('');
    const backupInProgress = ref(false);
    const backupMessage = ref('');
    const backupMessageClass = ref('');
    const lastBackupTime = ref('');

    const isBackupConfigValid = computed(() => {
      if (!backupEnabled.value) return false;
      if (backupPathStatus.value !== 'valid' && backupPathStatus.value !== 'can-create') return false;
      if (backupEncrypt.value && backupPassword.value.length < 8) return false;
      return true;
    });

    const themeOptions = Object.entries(themes).map(([key, theme]) => ({
      key,
      name: theme.name,
      description: theme.description
    }));

    const patternOptions = Object.entries(backgroundPatterns).map(([key, pattern]) => ({
      key,
      name: pattern.name
    }));

    const loadSettings = async () => {
      // Load API key from localStorage
      apiKey.value = localStorage.getItem('openrouter-api-key') || '';

      // Load config (active preset and default persona)
      try {
        const config = await api.getConfig();
        activePreset.value = config.activePreset || '';
        defaultPersona.value = config.defaultPersona || '';
      } catch (error) {
        console.error('Failed to load config:', error);
      }

      // Load presets list
      try {
        presets.value = await api.getPresets();
      } catch (error) {
        console.error('Failed to load presets:', error);
      }

      // Load personas list
      try {
        personas.value = await api.getPersonas();
      } catch (error) {
        console.error('Failed to load personas:', error);
      }

      // Load theme
      currentTheme.value = getStoredTheme();

      // Load background settings
      const storedBg = getStoredBackground();
      if (storedBg) {
        backgroundType.value = storedBg.type || 'pattern';
        backgroundPattern.value = storedBg.pattern || 'hexagons';
        backgroundOpacity.value = storedBg.opacity || 0.15;
        customBackgroundUrl.value = storedBg.url || '';
      } else {
        // Use theme defaults
        const theme = themes[currentTheme.value];
        if (theme?.background) {
          backgroundType.value = theme.background.type || 'none';
          backgroundPattern.value = theme.background.value || 'hexagons';
          backgroundOpacity.value = theme.background.opacity || 0.15;
        }
      }
    };

    const saveApiKey = () => {
      localStorage.setItem('openrouter-api-key', apiKey.value);
    };

    const saveActivePreset = async () => {
      try {
        await api.setActivePreset(activePreset.value);
      } catch (error) {
        console.error('Failed to save active preset:', error);
      }
    };

    const saveDefaultPersona = async () => {
      try {
        await api.setDefaultPersona(defaultPersona.value);
      } catch (error) {
        console.error('Failed to save default persona:', error);
      }
    };

    const updateTheme = () => {
      saveThemeUtil(currentTheme.value);
      applyTheme(currentTheme.value);

      // Don't override user's background choices when switching themes
      // Background settings now persist across theme changes

      window.dispatchEvent(new CustomEvent('theme-changed', {
        detail: { theme: currentTheme.value }
      }));
    };

    const updateBackground = () => {
      if (isLoading.value) return; // Don't save during initial load

      const bgConfig = {
        type: backgroundType.value,
        pattern: backgroundPattern.value,
        opacity: backgroundOpacity.value,
        url: customBackgroundUrl.value
      };

      console.log('Settings: Saving background config:', bgConfig);
      saveBackground(bgConfig);
      window.dispatchEvent(new CustomEvent('background-changed', {
        detail: bgConfig
      }));
    };

    const togglePreview = () => {
      showPreview.value = !showPreview.value;
    };

    const loadBackupConfig = async () => {
      try {
        const config = await api.getBackupConfig();
        backupEnabled.value = config.enabled || false;
        backupInterval.value = config.interval || '6h';
        backupRetention.value = config.retention || 10;
        backupDirectory.value = config.directory || './backups';
        backupEncrypt.value = config.encrypt || false;
        // Don't load password (it's sanitized from server)
      } catch (error) {
        console.error('Failed to load backup config:', error);
      }
    };

    const saveBackupConfig = async () => {
      try {
        const config = {
          enabled: backupEnabled.value,
          interval: backupInterval.value,
          retention: backupRetention.value,
          directory: backupDirectory.value,
          encrypt: backupEncrypt.value,
          password: backupPassword.value
        };

        const result = await api.saveBackupConfig(config);
        if (!result.success) {
          console.error('Failed to save backup config:', result.errors);
        }
      } catch (error) {
        console.error('Failed to save backup config:', error);
      }
    };

    const validateBackupPath = async () => {
      if (!backupDirectory.value) return;

      try {
        const result = await api.validateBackupPath(backupDirectory.value);

        if (result.valid) {
          if (result.exists) {
            backupPathStatus.value = 'valid';
            backupPathError.value = '';
          } else if (result.canCreate) {
            backupPathStatus.value = 'can-create';
            backupPathError.value = '';
          }
        } else {
          backupPathStatus.value = '';
          backupPathError.value = result.error;
        }
      } catch (error) {
        backupPathStatus.value = '';
        backupPathError.value = 'Failed to validate path';
      }
    };

    const chooseBackupDirectory = () => {
      // Create hidden file input for directory selection
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          // Get directory path from first file
          const path = files[0].path || files[0].webkitRelativePath;
          if (path) {
            const dirPath = path.substring(0, path.lastIndexOf('/'));
            backupDirectory.value = dirPath;
            validateBackupPath();
          }
        }
      };
      input.click();
    };

    const createBackupDirectory = async () => {
      await saveBackupConfig(); // This will create the directory via the backend
      await validateBackupPath();
    };

    const triggerBackup = async () => {
      backupInProgress.value = true;
      backupMessage.value = '';

      try {
        const result = await api.createBackup(backupEncrypt.value);

        if (result.success) {
          backupMessage.value = `Backup completed: ${result.filename}`;
          backupMessageClass.value = 'status-success';
          lastBackupTime.value = 'Just now';
        } else {
          backupMessage.value = `Backup failed: ${result.error}`;
          backupMessageClass.value = 'status-error';
        }
      } catch (error) {
        backupMessage.value = `Backup failed: ${error.message}`;
        backupMessageClass.value = 'status-error';
      } finally {
        backupInProgress.value = false;

        // Clear message after 5 seconds
        setTimeout(() => {
          backupMessage.value = '';
        }, 5000);
      }
    };

    // Watch for background changes
    watch([backgroundType, backgroundPattern, backgroundOpacity, customBackgroundUrl], () => {
      updateBackground();
    });

    onMounted(async () => {
      await loadSettings();
      await loadBackupConfig();
      // Allow saves after initial load completes
      setTimeout(() => {
        isLoading.value = false;
        console.log('Settings: Initial load complete, enabling saves');
      }, 100);
    });

    return {
      apiKey,
      activePreset,
      presets,
      defaultPersona,
      personas,
      currentTheme,
      themeOptions,
      backgroundType,
      backgroundPattern,
      backgroundOpacity,
      customBackgroundUrl,
      patternOptions,
      showPreview,
      saveApiKey,
      saveActivePreset,
      saveDefaultPersona,
      updateTheme,
      updateBackground,
      togglePreview,
      // Backup settings
      backupEnabled,
      backupInterval,
      backupRetention,
      backupDirectory,
      backupEncrypt,
      backupPassword,
      backupPathStatus,
      backupPathError,
      backupInProgress,
      backupMessage,
      backupMessageClass,
      lastBackupTime,
      isBackupConfigValid,
      saveBackupConfig,
      validateBackupPath,
      chooseBackupDirectory,
      createBackupDirectory,
      triggerBackup,
    };
  },
};
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--text-primary, #fff);
}

.settings-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #2d2d2d);
}

.settings-header h2 {
  margin: 0;
  font-size: 20px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.setting-group {
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--border-color, #333);
}

.setting-group:last-child {
  border-bottom: none;
}

.setting-group h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: var(--text-primary, #fff);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 500px;
}

.form-group label {
  font-size: 14px;
  color: var(--text-secondary, #999);
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 10px;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color, #4a9eff);
}

.form-group small {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.about-text {
  margin: 10px 0;
  font-size: 14px;
  color: var(--text-secondary, #999);
  line-height: 1.6;
}

.about-text strong {
  color: var(--text-primary, #fff);
  font-size: 16px;
}

.opacity-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary, #2a2a2a);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #4a9eff);
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d0d0d);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #4a9eff);
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d0d0d);
}

.preview-toggle-btn {
  width: 100%;
  padding: 12px;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-toggle-btn:hover {
  background: var(--hover-color, #404040);
  border-color: var(--accent-color, #4a9eff);
}

.choose-btn,
.backup-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.choose-btn:hover,
.backup-btn:hover:not(:disabled) {
  background: var(--hover-color, #404040);
  border-color: var(--accent-color, #4a9eff);
}

.backup-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-success {
  color: #4caf50;
}

.status-warning {
  color: #ff9800;
}

.status-error {
  color: #f44336;
}

.status-warning a {
  color: #ff9800;
  text-decoration: underline;
}
</style>
