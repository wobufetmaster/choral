# Auto-Fix Missing Macros Design

**Date:** 2025-10-26
**Status:** Approved for Implementation

## Problem Statement

Users creating or editing presets receive a warning when saving presets that are missing essential character card macros ({{description}}, {{personality}}, {{scenario}}, {{dialogue_examples}}). However, the current implementation only offers two options:
1. Cancel the save
2. Save anyway (ignoring the warning)

This creates friction in the user experience - users know what's wrong but must manually create the prompts themselves. We can improve this by offering to automatically add the missing macros with sensible defaults.

## Requirements

### Functional
- Replace browser `confirm()` dialog with a custom modal offering three actions:
  - **Cancel**: Abort the save operation
  - **Add Missing Macros**: Automatically create prompts for missing macros, then save
  - **Save Anyway**: Proceed with save without adding macros (current behavior)
- Auto-generated prompts should:
  - Only add macros that are actually missing
  - Use simple, clear templates (e.g., "Character: {{description}}")
  - Be inserted after existing character-related prompts when possible
  - Use standard injection_order values (100, 200, 300, 400)
  - Be enabled by default

### Non-Functional
- Maintain consistency with existing modal patterns (macro reference modal)
- No breaking changes to validation logic
- Preserve existing save flow for users who choose "Save Anyway"
- Modal should be reusable and maintainable

## Design

### Architecture

**Component: MacroWarningDialog.vue**

A new Vue 3 Single File Component (SFC) that displays missing macro warnings and provides three action options.

**Props:**
```javascript
{
  missingMacros: Array,  // Array of macro objects from checkMissingEssentialMacros()
  preset: Object         // The preset being saved (for reference/modification)
}
```

**Emits:**
```javascript
{
  'cancel',          // User clicked Cancel
  'add-and-save',    // User wants to auto-add macros
  'save-anyway'      // User wants to save without adding
}
```

**Integration Point:**

In `PresetSelector.vue`, replace the current validation confirm dialog:

```javascript
// Current (Task 4):
async savePreset() {
  const missingMacros = this.checkMissingEssentialMacros();
  if (missingMacros.length > 0) {
    const confirmed = confirm(...);
    if (!confirmed) return;
  }
  // ... save logic
}

// New (with auto-fix):
async savePreset() {
  const missingMacros = this.checkMissingEssentialMacros();
  if (missingMacros.length > 0) {
    this.showMacroWarningDialog = true;
    this.pendingMissingMacros = missingMacros;
    return; // Wait for user choice
  }
  // ... save logic
}

// Event handlers:
handleAddAndSave() {
  this.addMissingMacroPrompts(this.pendingMissingMacros);
  this.showMacroWarningDialog = false;
  this.proceedWithSave();
}

handleSaveAnyway() {
  this.showMacroWarningDialog = false;
  this.proceedWithSave();
}

handleCancel() {
  this.showMacroWarningDialog = false;
  // Save is aborted
}
```

### Auto-Add Logic

**Method: `addMissingMacroPrompts(missingMacros)`**

Location: `PresetSelector.vue` methods section

**Macro-to-Template Mapping:**
```javascript
const MACRO_TEMPLATES = {
  '{{description}}': {
    name: 'Character Description',
    content: 'Character: {{description}}',
    injection_order: 100
  },
  '{{personality}}': {
    name: 'Character Personality',
    content: 'Personality: {{personality}}',
    injection_order: 200
  },
  '{{scenario}}': {
    name: 'Scenario',
    content: 'Scenario: {{scenario}}',
    injection_order: 300
  },
  '{{dialogue_examples}}': {
    name: 'Example Dialogue',
    content: 'Here are some examples of dialogue: {{dialogue_examples}}',
    injection_order: 400
  }
};
```

**Insertion Algorithm:**

1. **Find insertion point:**
   - Scan existing prompts for any that contain character macros ({{description}}, {{personality}}, etc.)
   - If found: Insert after the last character-related prompt
   - If not found: Append to end of prompts array

2. **Create new prompts:**
   - For each missing macro:
     - Generate unique identifier: `auto_${macroName}_${Date.now()}`
     - Use template from MACRO_TEMPLATES
     - Set enabled: true
     - Set role: 'system'

3. **Insert at calculated position:**
   - Use array.splice() to insert at the correct index
   - Maintain order by injection_order (100, 200, 300, 400)

**Example:**
```javascript
addMissingMacroPrompts(missingMacros) {
  // Find insertion point
  let insertIndex = this.selectedPreset.prompts.length; // Default: append

  for (let i = this.selectedPreset.prompts.length - 1; i >= 0; i--) {
    const content = this.selectedPreset.prompts[i].content || '';
    const hasCharMacro = ['{{description}}', '{{personality}}', '{{scenario}}', '{{dialogue_examples}}']
      .some(macro => content.includes(macro));

    if (hasCharMacro) {
      insertIndex = i + 1; // Insert after this prompt
      break;
    }
  }

  // Create new prompts
  const newPrompts = missingMacros.map(macro => {
    const template = MACRO_TEMPLATES[macro.pattern];
    return {
      identifier: `auto_${macro.pattern.replace(/[{}]/g, '')}_${Date.now()}`,
      name: `Auto: ${template.name}`,
      role: 'system',
      content: template.content,
      enabled: true,
      injection_order: template.injection_order
    };
  });

  // Sort by injection_order
  newPrompts.sort((a, b) => a.injection_order - b.injection_order);

  // Insert all at once
  this.selectedPreset.prompts.splice(insertIndex, 0, ...newPrompts);
}
```

### Modal UI Design

**MacroWarningDialog.vue Template:**

```vue
<template>
  <div class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content warning-dialog" @click.stop>
      <div class="modal-header">
        <div class="header-with-icon">
          <span class="warning-icon">⚠️</span>
          <h3>Missing Essential Macros</h3>
        </div>
        <button @click="$emit('cancel')" class="modal-close-btn" aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <p class="warning-message">
          This preset is missing essential character macros. Character cards won't be properly loaded without these:
        </p>

        <div class="missing-macros-list">
          <code
            v-for="macro in missingMacros"
            :key="macro.pattern"
            class="macro-tag"
          >
            {{ macro.pattern }}
          </code>
        </div>

        <p class="help-text">
          You can automatically add simple prompts for these macros, save without them, or cancel.
        </p>
      </div>

      <div class="modal-actions">
        <button @click="$emit('cancel')" class="btn-secondary">
          Cancel
        </button>
        <button @click="$emit('save-anyway')" class="btn-secondary">
          Save Anyway
        </button>
        <button @click="$emit('add-and-save')" class="btn-primary">
          Add Missing Macros
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MacroWarningDialog',
  props: {
    missingMacros: {
      type: Array,
      required: true
    },
    preset: {
      type: Object,
      required: true
    }
  },
  emits: ['cancel', 'add-and-save', 'save-anyway']
};
</script>
```

**Styling:**

Uses existing CSS variables for consistency. Key styles:

- `.warning-dialog`: max-width: 500px (smaller than macro reference modal)
- `.warning-icon`: Large emoji, yellow-orange color
- `.missing-macros-list`: Flex wrap of code-formatted macro tags
- `.btn-primary`: Accent color (recommended action)
- `.btn-secondary`: Neutral gray (alternative actions)
- Button order: Cancel (left), Save Anyway (middle), Add Missing Macros (right)

**Accessibility:**
- ESC key triggers cancel event
- Focus trap within modal
- Proper ARIA labels on buttons
- Keyboard navigation between buttons

### Data Flow

**Save Flow with Auto-Fix:**

```
User clicks Save
    ↓
checkMissingEssentialMacros()
    ↓
Missing macros found?
    ↓ (Yes)
Show MacroWarningDialog
    ↓
User chooses action:
    ├─ Cancel → Close modal, abort save
    ├─ Save Anyway → Close modal, proceed with save (unchanged preset)
    └─ Add Missing Macros → addMissingMacroPrompts() → proceed with save (modified preset)
```

### Edge Cases

1. **No missing macros:**
   - Skip dialog entirely, proceed directly to save
   - Current behavior, no changes

2. **All macros missing:**
   - Add all 4 prompts (description, personality, scenario, dialogue_examples)
   - Insert at end if no existing character prompts found

3. **Some macros present, some missing:**
   - Only add the missing ones
   - Insert after last existing character prompt

4. **Disabled prompts with macros:**
   - Don't count as present (validation already handles this)
   - May result in duplicate macros (one disabled, one auto-added enabled)
   - This is acceptable - user can clean up if needed

5. **User edits preset after auto-add:**
   - Auto-added prompts appear in editor like any other prompt
   - Can be edited, disabled, or deleted
   - Prefixed with "Auto:" in name for easy identification

## Component Files

### New Files
- `src/components/MacroWarningDialog.vue` - The warning modal component

### Modified Files
- `src/components/PresetSelector.vue` - Integration of modal, auto-add logic

## Implementation Notes

### Macro Templates

The templates are intentionally simple:
- `"Character: {{description}}"` - Clear label, minimal formatting
- `"Personality: {{personality}}"` - Matches common convention
- `"Scenario: {{scenario}}"` - Short and direct
- `"Here are some examples of dialogue: {{dialogue_examples}}"` - Slightly longer, natural language

Users can edit these after auto-add if they want different formatting.

### Injection Order

Using standard values (100, 200, 300, 400) ensures:
- Consistency with default.json
- Proper ordering in context assembly
- Easy to understand for users familiar with the system

### Component Reusability

The MacroWarningDialog is designed to be reusable:
- Could potentially be used elsewhere (e.g., when loading a preset)
- Clean prop/emit interface
- No tight coupling to PresetSelector internals

### Testing Considerations

Manual test scenarios:
1. Save preset with no macros → Dialog shows all 4
2. Save preset with 2 macros → Dialog shows missing 2
3. Click "Add Missing Macros" → Prompts appear in editor
4. Click "Save Anyway" → No changes to preset
5. Click "Cancel" → Save aborted, no changes
6. ESC key → Same as Cancel
7. Verify prompts appear after existing character prompts
8. Verify injection_order values are correct

## Future Enhancements

Not in scope for initial implementation, but potential improvements:

1. **Customizable templates:**
   - Allow users to configure default templates in settings
   - Store templates in config.json

2. **Batch auto-fix:**
   - "Fix All" button in preset list to auto-add to multiple presets

3. **Template preview:**
   - Show what will be added before user confirms

4. **Smart insertion:**
   - Analyze existing prompt names to find better insertion points
   - Group by semantic similarity, not just macro presence

5. **Undo support:**
   - Add "Undo Auto-Add" button after operation completes
