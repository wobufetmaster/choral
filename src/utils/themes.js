// Theme system for Choral
// Each theme defines CSS variables and optional background settings

export const themes = {
  'cozy-dark': {
    name: 'Cozy Dark',
    description: 'Warm, comfortable dark theme with subtle transparency',
    variables: {
      // Backgrounds with transparency
      '--bg-primary': 'rgba(26, 24, 30, 0.85)',
      '--bg-secondary': 'rgba(45, 42, 50, 0.90)',
      '--bg-tertiary': 'rgba(60, 56, 66, 0.92)',
      '--bg-overlay': 'rgba(20, 18, 24, 0.75)',

      // Text colors - warmer tones
      '--text-primary': '#e8e3d3',
      '--text-secondary': '#c4b8a0',
      '--text-muted': '#8a8070',

      // Borders - subtle and warm
      '--border-color': 'rgba(100, 90, 80, 0.3)',
      '--border-color-hover': 'rgba(120, 110, 100, 0.5)',

      // Accent - warm amber/gold
      '--accent-color': '#d4a574',
      '--accent-hover': '#e0b585',
      '--accent-muted': 'rgba(212, 165, 116, 0.2)',

      // Interactive elements
      '--hover-color': 'rgba(80, 75, 85, 0.7)',
      '--active-color': 'rgba(100, 95, 105, 0.8)',

      // Special effects
      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.3)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.4)',
      '--shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.5)',
      '--blur-amount': '12px',

      // Message bubbles
      '--user-bubble': 'rgba(212, 165, 116, 0.85)',
      '--assistant-bubble': 'rgba(50, 47, 55, 0.85)',
    },
    background: {
      type: 'pattern',
      value: 'noise',
      opacity: 0.15
    }
  },

  'midnight-library': {
    name: 'Midnight Library',
    description: 'Deep, rich blues with book-lined atmosphere',
    variables: {
      '--bg-primary': 'rgba(18, 22, 35, 0.88)',
      '--bg-secondary': 'rgba(28, 35, 52, 0.92)',
      '--bg-tertiary': 'rgba(38, 47, 66, 0.94)',
      '--bg-overlay': 'rgba(12, 16, 25, 0.80)',

      '--text-primary': '#e1e8f0',
      '--text-secondary': '#a8b8d0',
      '--text-muted': '#6b7a95',

      '--border-color': 'rgba(80, 100, 130, 0.25)',
      '--border-color-hover': 'rgba(100, 120, 150, 0.4)',

      '--accent-color': '#7ba3d4',
      '--accent-hover': '#8fb3e0',
      '--accent-muted': 'rgba(123, 163, 212, 0.2)',

      '--hover-color': 'rgba(48, 60, 82, 0.7)',
      '--active-color': 'rgba(58, 72, 98, 0.85)',

      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.4)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.5)',
      '--shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.6)',
      '--blur-amount': '14px',

      '--user-bubble': 'rgba(123, 163, 212, 0.80)',
      '--assistant-bubble': 'rgba(40, 50, 70, 0.88)',
    },
    background: {
      type: 'pattern',
      value: 'noise',
      opacity: 0.1
    }
  },

  'forest-cabin': {
    name: 'Forest Cabin',
    description: 'Earthy greens and browns, like a woodland retreat',
    variables: {
      '--bg-primary': 'rgba(25, 30, 25, 0.87)',
      '--bg-secondary': 'rgba(35, 42, 35, 0.91)',
      '--bg-tertiary': 'rgba(48, 56, 48, 0.93)',
      '--bg-overlay': 'rgba(18, 22, 18, 0.78)',

      '--text-primary': '#e5e8dd',
      '--text-secondary': '#b8c0a8',
      '--text-muted': '#7a8070',

      '--border-color': 'rgba(90, 100, 80, 0.28)',
      '--border-color-hover': 'rgba(110, 120, 95, 0.45)',

      '--accent-color': '#88a86f',
      '--accent-hover': '#9ab880',
      '--accent-muted': 'rgba(136, 168, 111, 0.22)',

      '--hover-color': 'rgba(55, 65, 55, 0.75)',
      '--active-color': 'rgba(68, 78, 68, 0.85)',

      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.35)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.45)',
      '--shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.55)',
      '--blur-amount': '13px',

      '--user-bubble': 'rgba(136, 168, 111, 0.82)',
      '--assistant-bubble': 'rgba(42, 50, 42, 0.87)',
    },
    background: {
      type: 'pattern',
      value: 'noise',
      opacity: 0.12
    }
  },

  'sunset-lounge': {
    name: 'Sunset Lounge',
    description: 'Warm purples and oranges, cozy evening vibes',
    variables: {
      '--bg-primary': 'rgba(30, 24, 35, 0.86)',
      '--bg-secondary': 'rgba(42, 35, 48, 0.90)',
      '--bg-tertiary': 'rgba(56, 48, 64, 0.93)',
      '--bg-overlay': 'rgba(22, 18, 28, 0.77)',

      '--text-primary': '#f0e8e0',
      '--text-secondary': '#d0b8b0',
      '--text-muted': '#95807a',

      '--border-color': 'rgba(120, 90, 100, 0.27)',
      '--border-color-hover': 'rgba(140, 110, 120, 0.43)',

      '--accent-color': '#d48a74',
      '--accent-hover': '#e09a85',
      '--accent-muted': 'rgba(212, 138, 116, 0.23)',

      '--hover-color': 'rgba(65, 55, 72, 0.72)',
      '--active-color': 'rgba(78, 68, 88, 0.84)',

      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.32)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.42)',
      '--shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.52)',
      '--blur-amount': '11px',

      '--user-bubble': 'rgba(212, 138, 116, 0.83)',
      '--assistant-bubble': 'rgba(48, 40, 55, 0.88)',
    },
    background: {
      type: 'pattern',
      value: 'noise',
      opacity: 0.13
    }
  },

  'classic-dark': {
    name: 'Classic Dark',
    description: 'Clean, minimal dark theme (original style)',
    variables: {
      '--bg-primary': '#1a1a1a',
      '--bg-secondary': '#2d2d2d',
      '--bg-tertiary': '#3a3a3a',
      '--bg-overlay': '#151515',

      '--text-primary': '#e0e0e0',
      '--text-secondary': '#b0b0b0',
      '--text-muted': '#808080',

      '--border-color': '#404040',
      '--border-color-hover': '#505050',

      '--accent-color': '#5a9fd4',
      '--accent-hover': '#6aaae0',
      '--accent-muted': 'rgba(90, 159, 212, 0.2)',

      '--hover-color': '#404040',
      '--active-color': '#505050',

      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.2)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.3)',
      '--shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.4)',
      '--blur-amount': '0px',

      '--user-bubble': '#5a9fd4',
      '--assistant-bubble': '#2d2d2d',
    },
    background: {
      type: 'none'
    }
  }
};

export const backgroundPatterns = {
  none: {
    name: 'None',
    css: ''
  },
  hexagons: {
    name: 'Hexagons',
    css: `
      background-image:
        linear-gradient(30deg, rgba(255,255,255,0.04) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.04) 87.5%, rgba(255,255,255,0.04)),
        linear-gradient(150deg, rgba(255,255,255,0.04) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.04) 87.5%, rgba(255,255,255,0.04)),
        linear-gradient(30deg, rgba(255,255,255,0.04) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.04) 87.5%, rgba(255,255,255,0.04)),
        linear-gradient(150deg, rgba(255,255,255,0.04) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.04) 87.5%, rgba(255,255,255,0.04));
      background-size: 80px 140px;
      background-position: 0 0, 0 0, 40px 70px, 40px 70px;
    `
  }
};

// Get theme from localStorage or default
export function getStoredTheme() {
  try {
    const stored = localStorage.getItem('choral-theme');
    if (stored && themes[stored]) {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load theme:', e);
  }
  return 'cozy-dark'; // Default theme
}

// Get custom background from localStorage
export function getStoredBackground() {
  try {
    const stored = localStorage.getItem('choral-background');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load background:', e);
  }
  return null;
}

// Save theme preference
export function saveTheme(themeKey) {
  try {
    localStorage.setItem('choral-theme', themeKey);
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

// Save background preference
export function saveBackground(background) {
  try {
    localStorage.setItem('choral-background', JSON.stringify(background));
  } catch (e) {
    console.error('Failed to save background:', e);
  }
}

// Apply theme to document
export function applyTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
