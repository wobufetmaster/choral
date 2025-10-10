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
import { ref, onMounted, watch } from 'vue';
import { themes, backgroundPatterns, getStoredTheme, getStoredBackground, saveTheme as saveThemeUtil, saveBackground, applyTheme } from '../utils/themes.js';

export default {
  name: 'Settings',
  props: {
    tabData: {
      type: Object,
      default: () => ({}),
    },
  },
  setup() {
    const apiKey = ref('');
    const activePreset = ref('');
    const presets = ref([]);
    const defaultPersona = ref('');
    const personas = ref([]);
    const currentTheme = ref('cozy-dark');
    const backgroundType = ref('pattern');
    const backgroundPattern = ref('noise');
    const backgroundOpacity = ref(0.15);
    const customBackgroundUrl = ref('');
    const isLoading = ref(true);

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
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        activePreset.value = config.activePreset || '';
        defaultPersona.value = config.defaultPersona || '';
      } catch (error) {
        console.error('Failed to load config:', error);
      }

      // Load presets list
      try {
        const presetsResponse = await fetch('/api/presets');
        presets.value = await presetsResponse.json();
      } catch (error) {
        console.error('Failed to load presets:', error);
      }

      // Load personas list
      try {
        const personasResponse = await fetch('/api/personas');
        personas.value = await personasResponse.json();
      } catch (error) {
        console.error('Failed to load personas:', error);
      }

      // Load theme
      currentTheme.value = getStoredTheme();

      // Load background settings
      const storedBg = getStoredBackground();
      if (storedBg) {
        backgroundType.value = storedBg.type || 'pattern';
        backgroundPattern.value = storedBg.pattern || 'noise';
        backgroundOpacity.value = storedBg.opacity || 0.15;
        customBackgroundUrl.value = storedBg.url || '';
      } else {
        // Use theme defaults
        const theme = themes[currentTheme.value];
        if (theme?.background) {
          backgroundType.value = theme.background.type || 'none';
          backgroundPattern.value = theme.background.value || 'noise';
          backgroundOpacity.value = theme.background.opacity || 0.15;
        }
      }
    };

    const saveApiKey = () => {
      localStorage.setItem('openrouter-api-key', apiKey.value);
    };

    const saveActivePreset = async () => {
      try {
        await fetch('/api/config/active-preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: activePreset.value }),
        });
      } catch (error) {
        console.error('Failed to save active preset:', error);
      }
    };

    const saveDefaultPersona = async () => {
      try {
        await fetch('/api/config/default-persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: defaultPersona.value }),
        });
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

    // Watch for background changes
    watch([backgroundType, backgroundPattern, backgroundOpacity, customBackgroundUrl], () => {
      updateBackground();
    });

    onMounted(async () => {
      await loadSettings();
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
      saveApiKey,
      saveActivePreset,
      saveDefaultPersona,
      updateTheme,
      updateBackground,
    };
  },
};
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #0d0d0d);
  color: var(--text-primary, #fff);
}

.settings-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color, #333);
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
</style>
