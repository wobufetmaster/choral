# Preset Macro Reference & Validation Design

**Date:** 2025-10-26
**Status:** Approved for Implementation

## Problem Statement

Users creating or editing presets need:
1. Reference documentation for all available macros
2. Guidance on which macros are essential for character roleplay
3. Validation to prevent creating broken presets missing critical character data

Currently, users must remember macro syntax and there's no indication when essential macros (like `{{description}}`, `{{personality}}`) are missing from presets.

## Requirements

### Functional
- Display categorized macro reference in preset editor (via help button → modal)
- Dynamically pull macro definitions from macro module (auto-updates when new macros added)
- Warn on save when essential character card macros are missing
- Show visual indicator (⚠️) in preset list for presets missing essential macros
- Essential macros = all macros that pull data from character cards (`{{description}}`, `{{personality}}`, `{{scenario}}`, `{{dialogue_examples}}`, etc.)

### Non-Functional
- Changes must be kept in sync between client (`src/utils/macros.js`) and server (`server/macros.js`)
- No breaking changes to existing macro processing
- Validation should be non-blocking (warning, not error)

## Design

### 1. Macro Metadata Structure

Add structured metadata to both macro files (`src/utils/macros.js` and `server/macros.js`):

```javascript
export const MACRO_DEFINITIONS = [
  {
    pattern: '{{description}}',
    category: 'character_card',
    description: 'Physical appearance and basic character info from card',
    isCharacterData: true,
    example: 'Character: {{description}}'
  },
  {
    pattern: '{{personality}}',
    category: 'character_card',
    description: 'Personality traits and behaviors from card',
    isCharacterData: true,
    example: 'Personality: {{personality}}'
  },
  {
    pattern: '{{char}}',
    category: 'names',
    description: 'Character name or nickname',
    isCharacterData: false,
    example: '{{char}} smiled.'
  },
  {
    pattern: '{{user}}',
    category: 'names',
    description: 'User name',
    isCharacterData: false,
    example: '{{user}} waved.'
  },
  {
    pattern: '{{date}}',
    category: 'datetime',
    description: 'Current date (e.g., "October 26, 2025")',
    isCharacterData: false,
    example: 'Today is {{date}}'
  },
  {
    pattern: '{{isotime}}',
    category: 'datetime',
    description: 'Current time in HH:MM format',
    isCharacterData: false,
    example: 'Current time: {{isotime}}'
  },
  {
    pattern: '{{random:...}}',
    category: 'randomization',
    description: 'Pick random option from comma-separated list',
    isCharacterData: false,
    example: '{{random:happy,sad,excited}}'
  },
  {
    pattern: '{{pick:...}}',
    category: 'randomization',
    description: 'Consistent random choice (cached per session)',
    isCharacterData: false,
    example: '{{pick:coffee,tea}}'
  },
  {
    pattern: '{{roll:N}}',
    category: 'randomization',
    description: 'Random number from 1 to N',
    isCharacterData: false,
    example: '{{roll:20}}'
  },
  {
    pattern: '{{comment:...}}',
    category: 'utilities',
    description: 'Visible comment (shown in UI as italics)',
    isCharacterData: false,
    example: '{{comment:This is a note}}'
  },
  {
    pattern: '{{//...}}',
    category: 'utilities',
    description: 'Hidden comment (removed from display and AI context)',
    isCharacterData: false,
    example: '{{// Hidden note}}'
  },
  {
    pattern: '{{reverse:...}}',
    category: 'utilities',
    description: 'Reverse text',
    isCharacterData: false,
    example: '{{reverse:hello}}'
  },
  {
    pattern: '{{characters_list}}',
    category: 'utilities',
    description: 'List of all available characters',
    isCharacterData: false,
    example: 'Available: {{characters_list}}'
  }
  // ... add more as needed
];

export const MACRO_CATEGORIES = {
  character_card: { name: 'Character Card Data', order: 1 },
  names: { name: 'Names & Identifiers', order: 2 },
  datetime: { name: 'Date & Time', order: 3 },
  randomization: { name: 'Randomization', order: 4 },
  utilities: { name: 'Utilities', order: 5 }
};
```

**Key Properties:**
- `pattern`: The macro syntax (e.g., `{{description}}`)
- `category`: Which category it belongs to
- `description`: Human-readable explanation
- `isCharacterData`: `true` if it pulls from character card (makes it essential)
- `example`: Usage example

### 2. Macro Reference Modal (PresetSelector.vue)

Add a help button in the preset editor header that opens a modal:

```vue
<template>
  <div class="editor-header">
    <h3>Edit Preset</h3>
    <div class="header-actions">
      <button @click="showMacroReference = true" class="help-btn">📖 Macros</button>
      <!-- existing buttons... -->
    </div>
  </div>

  <!-- Macro Reference Modal -->
  <div v-if="showMacroReference" class="modal-overlay" @click="showMacroReference = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Available Macros</h3>
        <button @click="showMacroReference = false">×</button>
      </div>
      <div class="macro-reference">
        <div v-for="category in sortedCategories" :key="category.key" class="macro-category">
          <h4>{{ category.name }}</h4>
          <div class="macro-list">
            <div v-for="macro in getMacrosForCategory(category.key)" :key="macro.pattern" class="macro-item">
              <div class="macro-pattern">
                <code>{{ macro.pattern }}</code>
                <span v-if="macro.isCharacterData" class="essential-badge">Essential</span>
              </div>
              <div class="macro-description">{{ macro.description }}</div>
              <div class="macro-example"><em>Example:</em> <code>{{ macro.example }}</code></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

**Behavior:**
- Click "📖 Macros" button to open modal
- Macros displayed in categorized sections
- Essential macros (character card data) have "Essential" badge
- Each macro shows pattern, description, and example

### 3. Save-Time Validation

Modify `savePreset()` method in PresetSelector.vue:

```javascript
async savePreset() {
  // Validate for missing essential macros
  const missingMacros = this.checkMissingEssentialMacros();

  if (missingMacros.length > 0) {
    const macroList = missingMacros.map(m => m.pattern).join(', ');
    const confirmed = confirm(
      `Warning: This preset is missing essential character macros:\n\n${macroList}\n\n` +
      `Character cards won't be properly loaded without these macros.\n\n` +
      `Save anyway?`
    );
    if (!confirmed) return;
  }

  // Existing save logic...
}

checkMissingEssentialMacros() {
  // Combine all enabled prompt content
  const allPromptContent = (this.selectedPreset.prompts || [])
    .filter(p => p.enabled)
    .map(p => p.content || '')
    .join('\n');

  // Get all essential macros
  const essentialMacros = MACRO_DEFINITIONS.filter(m => m.isCharacterData);

  // Find which ones are missing
  return essentialMacros.filter(macro => {
    return !allPromptContent.includes(macro.pattern);
  });
}
```

**Behavior:**
- Before saving, scan all enabled prompt content
- Check if essential macros are present
- If missing, show confirm dialog with list of missing macros
- User can cancel save or proceed anyway

### 4. Preset List Visual Indicator

Update preset list item template:

```vue
<div class="preset-item" @click="selectPreset(preset)">
  <div class="preset-name">
    <span>{{ preset.name }}</span>
    <span v-if="preset.filename === activePresetFilename" class="active-badge">Active</span>
    <span
      v-if="hasMissingEssentialMacros(preset)"
      class="warning-badge"
      title="Missing essential character macros"
    >
      ⚠️
    </span>
  </div>
  <!-- existing actions... -->
</div>
```

Add method:
```javascript
hasMissingEssentialMacros(preset) {
  const allPromptContent = (preset.prompts || [])
    .filter(p => p.enabled)
    .map(p => p.content || '')
    .join('\n');

  const essentialMacros = MACRO_DEFINITIONS.filter(m => m.isCharacterData);

  return essentialMacros.some(macro => !allPromptContent.includes(macro.pattern));
}
```

**Behavior:**
- Yellow ⚠️ badge shown next to preset name if any essential macros missing
- Hover shows tooltip: "Missing essential character macros"

## Component Changes

### Files to Modify
1. `src/utils/macros.js` - Add MACRO_DEFINITIONS and MACRO_CATEGORIES exports
2. `server/macros.js` - Add MACRO_DEFINITIONS and MACRO_CATEGORIES exports (keep in sync)
3. `src/components/PresetSelector.vue` - Add modal, validation, and indicators

### Files to Create
- None (all changes to existing files)

## Implementation Notes

### Sync Requirements
- Both `src/utils/macros.js` and `server/macros.js` must export identical MACRO_DEFINITIONS
- Server-side macros process before sending to LLM (strips `{{//...}}`)
- Client-side macros process for display (shows `{{comment:...}}`)
- Only the metadata needs to be identical, not the processing logic

### Extensibility
- Adding new macros: just add to MACRO_DEFINITIONS array in both files
- Adding new categories: add to MACRO_CATEGORIES object
- UI automatically updates (no hardcoded macro lists)

### Edge Cases
- Disabled prompts are excluded from validation
- Empty/null prompt content handled gracefully
- Macros nested in other macros (like `{{random:{{char}},{{user}}}`) - simple string search is sufficient since we're just checking presence

## Testing Checklist

- [ ] Macro reference modal opens and displays all macros
- [ ] Macros grouped by category in correct order
- [ ] Essential macros show "Essential" badge
- [ ] Save warning appears when essential macros missing
- [ ] Warning shows correct list of missing macros
- [ ] Can save anyway after confirming warning
- [ ] ⚠️ appears in preset list for presets missing essential macros
- [ ] ⚠️ disappears after adding missing macros
- [ ] Adding new macro to MACRO_DEFINITIONS shows up in UI
- [ ] Server and client macro metadata stay in sync

## Future Enhancements (Not in Scope)

- Click-to-copy macro pattern from reference modal
- Search/filter in macro reference modal
- Macro syntax highlighting in prompt textarea
- Auto-complete for macros while typing
- Preset templates with common macro patterns pre-filled
