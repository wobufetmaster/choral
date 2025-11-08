<template>
  <div class="preview-container">
    <div class="preview-background" :style="combinedStyle">
      <div class="preview-content">
        <div class="sample-message user-message">
          <div class="message-bubble user-bubble">
            This is a sample user message to show how the background looks
          </div>
        </div>
        <div class="sample-message assistant-message">
          <div class="message-bubble assistant-bubble">
            And this is how an assistant response appears with the selected background and theme
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { backgroundPatterns } from '../utils/themes.js';

export default {
  name: 'BackgroundPreview',
  props: {
    backgroundConfig: {
      type: Object,
      required: true
    },
    currentTheme: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const combinedStyle = computed(() => {
      const styles = {
        background: 'var(--bg-primary, #1a1a1a)'
      };

      if (!props.backgroundConfig) return styles;

      // Handle custom image background
      if (props.backgroundConfig.type === 'custom' && props.backgroundConfig.url) {
        return {
          ...styles,
          backgroundImage: `url(${props.backgroundConfig.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };
      }

      // For pattern backgrounds, we don't apply styles directly
      // The pattern will be applied to the ::before pseudo-element
      return styles;
    });

    // Separate computed property for pattern layer styles
    const patternLayerStyle = computed(() => {
      if (!props.backgroundConfig || props.backgroundConfig.type !== 'pattern') {
        return null;
      }

      const pattern = backgroundPatterns[props.backgroundConfig.pattern];
      if (!pattern || !pattern.css) {
        return null;
      }

      const patternStyles = parseCss(pattern.css);
      return {
        ...patternStyles,
        opacity: props.backgroundConfig.opacity || 0.15
      };
    });

    const parseCss = (cssString) => {
      const style = {};
      const normalized = cssString.trim()
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      normalized.forEach(declaration => {
        const colonIndex = declaration.indexOf(':');
        if (colonIndex > 0) {
          const prop = declaration.substring(0, colonIndex).trim();
          const value = declaration.substring(colonIndex + 1).trim();
          const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          style[camelProp] = value;
        }
      });
      return style;
    };

    return {
      combinedStyle,
      patternLayerStyle
    };
  }
};
</script>

<style scoped>
.preview-container {
  margin-top: 15px;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  overflow: hidden;
}

.preview-background {
  position: relative;
  min-height: 300px;
  padding: 20px;
}

/* Pattern layer - separate from content to allow independent opacity */
.preview-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;

  /* Dynamic pattern styles applied via v-bind */
  background-image: v-bind('patternLayerStyle?.backgroundImage');
  background-size: v-bind('patternLayerStyle?.backgroundSize');
  background-position: v-bind('patternLayerStyle?.backgroundPosition');
  background-repeat: v-bind('patternLayerStyle?.backgroundRepeat');
  opacity: v-bind('patternLayerStyle?.opacity');
}

.preview-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 600px;
}

.sample-message {
  display: flex;
}

.user-message {
  justify-content: flex-end;
}

.assistant-message {
  justify-content: flex-start;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.5;
}

.user-bubble {
  background: var(--user-bubble, #5a9fd4);
  color: #ffffff;
}

.assistant-bubble {
  background: var(--assistant-bubble, #2d2d2d);
  color: var(--text-primary, #e0e0e0);
}
</style>
