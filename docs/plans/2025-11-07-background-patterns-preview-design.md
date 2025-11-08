# Background Patterns and Live Preview - Design Document

**Date:** 2025-11-07
**Status:** Approved for implementation

## Overview

Replace existing background patterns (dots, noise, grid) with curated patterns from css-pattern.com and add a live preview feature in the Settings page to help users visualize background changes before applying them.

## Goals

1. Replace basic patterns with more visually appealing CSS gradient patterns
2. Keep hexagons pattern (user preference)
3. Add live preview feature showing how backgrounds look with actual chat UI
4. Maintain existing theme system and opacity controls

## Design Decisions

### Pattern Selection

Selected 5 new patterns from css-pattern.com based on variety and subtlety:

1. **Waves** - Organic, flowing curves
2. **Diagonal Stripes** - Clean, minimal lines
3. **Triangles** - Geometric tessellation
4. **Overlapping Circles** - Soft, organic shapes
5. **Geometric Flowers** - Artistic, decorative

**Final pattern list:**
- None
- Hexagons (existing, kept)
- Waves (new)
- Diagonal Stripes (new)
- Triangles (new)
- Overlapping Circles (new)
- Geometric Flowers (new)

**Removed patterns:**
- Dots
- Noise
- Grid

### Live Preview Component

**Approach:** Expandable preview panel

**Behavior:**
- **Collapsed (default):** Shows "Preview Background" button
- **Expanded:** Shows preview panel with sample chat messages
- **Real-time updates:** Changes reflect immediately as user adjusts settings

**Preview contents:**
- Background pattern at current opacity
- 2-3 sample chat messages (user and assistant bubbles)
- Current theme colors applied
- Size: 300-400px tall when expanded

**User control:** Manual toggle (not auto-expand) to avoid jarring UX

## Implementation Components

### 1. themes.js Changes

**Remove from `backgroundPatterns`:**
```javascript
noise: { ... }
dots: { ... }
grid: { ... }
```

**Keep:**
```javascript
none: { ... }
hexagons: { ... }
```

**Add 5 new patterns** with CSS gradient definitions from css-pattern.com:
```javascript
waves: { name: 'Waves', css: '...' }
diagonalStripes: { name: 'Diagonal Stripes', css: '...' }
triangles: { name: 'Triangles', css: '...' }
overlappingCircles: { name: 'Overlapping Circles', css: '...' }
geometricFlowers: { name: 'Geometric Flowers', css: '...' }
```

### 2. Settings.vue Changes

**New state:**
- `showPreview` (boolean, default: false)

**New UI elements:**
- Toggle button: "Preview Background" / "Hide Preview"
- Conditionally rendered `<BackgroundPreview>` component

**Props passed to preview:**
- `backgroundConfig` (type, pattern, opacity, url)
- `currentTheme` (theme key string)

### 3. BackgroundPreview.vue (New Component)

**Props:**
- `backgroundConfig` (Object)
- `currentTheme` (String)

**Template structure:**
```
<div class="preview-container">
  <div class="preview-background" :style="backgroundStyle">
    <div class="preview-content">
      <div class="sample-message user">Sample user message</div>
      <div class="sample-message assistant">Sample assistant response</div>
    </div>
  </div>
</div>
```

**Features:**
- Reactive updates using Vue watch
- Reuses theme CSS variables
- Matches actual chat bubble styling
- Applies same background pattern parsing as App.vue

## Technical Considerations

### Pattern CSS Format

All patterns from css-pattern.com use CSS gradient syntax. They need:
- Color values adjusted to white/light for visibility at low opacity
- Opacity applied via parent container (not in gradient itself)
- `background-size` and `background-position` preserved from source

### CSS Variable Reuse

Preview component uses existing theme variables:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- `--text-primary`, `--text-secondary`
- `--user-bubble`, `--assistant-bubble`
- `--border-color`

This ensures preview matches actual appearance.

### Migration Path

Users with old patterns (dots/noise/grid) selected:
- Settings will continue to work (pattern definitions exist until user changes)
- Old patterns simply won't appear in dropdown
- Natural migration as users explore new options
- No data loss or breaking changes

## Success Criteria

1. ✅ Dots, noise, and grid patterns removed from UI
2. ✅ Hexagons pattern retained
3. ✅ 5 new patterns from css-pattern.com added
4. ✅ Preview shows accurate representation of background + theme
5. ✅ Preview updates in real-time when settings change
6. ✅ Existing functionality (opacity, custom images) unchanged
7. ✅ No breaking changes to saved user preferences

## Files Modified

- `/src/utils/themes.js` - Pattern definitions
- `/src/components/Settings.vue` - Preview toggle and integration
- `/src/components/BackgroundPreview.vue` - New component (created)

## Files Unchanged

- `/src/App.vue` - Background rendering logic stays same
- All theme definitions - No changes to color schemes
