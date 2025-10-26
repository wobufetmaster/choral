# Preset Macro Reference & Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add categorized macro reference documentation and validation warnings to the preset editor, ensuring users include essential character card macros.

**Architecture:** Metadata-driven approach where macro definitions with categories, descriptions, and flags are exported from both client (`src/utils/macros.js`) and server (`server/macros.js`) macro modules. PresetSelector.vue consumes this metadata to render a reference modal and validate presets on save and in list view.

**Tech Stack:** Vue 3, JavaScript, CSS (existing stack, no new dependencies)

---

## Task 1: Add Macro Metadata to Client-Side Macros

**Files:**
- Modify: `src/utils/macros.js`

**Step 1: Add macro definitions array**

Add this after the imports and before the existing functions:

```javascript
/**
 * Macro metadata for documentation and validation
 */
export const MACRO_DEFINITIONS = [
  // Character Card Data (Essential - pulled from character cards)
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
    pattern: '{{scenario}}',
    category: 'character_card',
    description: 'Current situation/context for the roleplay from card',
    isCharacterData: true,
    example: 'Scenario: {{scenario}}'
  },
  {
    pattern: '{{dialogue_examples}}',
    category: 'character_card',
    description: 'Example conversations showing character voice from card',
    isCharacterData: true,
    example: '{{dialogue_examples}}'
  },

  // Names & Identifiers
  {
    pattern: '{{char}}',
    category: 'names',
    description: 'Character name or nickname',
    isCharacterData: false,
    example: '{{char}} smiled warmly.'
  },
  {
    pattern: '{{user}}',
    category: 'names',
    description: 'User name or persona name',
    isCharacterData: false,
    example: '{{user}} waved hello.'
  },

  // Date & Time
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
    description: 'Current time in HH:MM format (e.g., "14:30")',
    isCharacterData: false,
    example: 'Current time: {{isotime}}'
  },

  // Randomization
  {
    pattern: '{{random:...}}',
    category: 'randomization',
    description: 'Pick random option from comma-separated list each time',
    isCharacterData: false,
    example: '{{random:happy,sad,excited}}'
  },
  {
    pattern: '{{pick:...}}',
    category: 'randomization',
    description: 'Consistent random choice (cached per session)',
    isCharacterData: false,
    example: '{{pick:coffee,tea,water}}'
  },
  {
    pattern: '{{roll:N}}',
    category: 'randomization',
    description: 'Random number from 1 to N (also supports {{roll:dN}})',
    isCharacterData: false,
    example: 'You rolled a {{roll:20}}'
  },

  // Utilities
  {
    pattern: '{{reverse:...}}',
    category: 'utilities',
    description: 'Reverse the text inside',
    isCharacterData: false,
    example: '{{reverse:hello}} outputs "olleh"'
  },
  {
    pattern: '{{characters_list}}',
    category: 'utilities',
    description: 'List of all available characters with filenames',
    isCharacterData: false,
    example: 'Available: {{characters_list}}'
  },
  {
    pattern: '{{comment:...}}',
    category: 'utilities',
    description: 'Visible comment shown in UI as italics',
    isCharacterData: false,
    example: '{{comment:This is a note for readers}}'
  },
  {
    pattern: '{{//...}}',
    category: 'utilities',
    description: 'Hidden comment (removed from display and AI context)',
    isCharacterData: false,
    example: '{{// This is only visible in the editor}}'
  },
  {
    pattern: '{{hidden_key:...}}',
    category: 'utilities',
    description: 'Hidden lorebook scan key (not shown to AI or user)',
    isCharacterData: false,
    example: '{{hidden_key:secret_trigger}}'
  }
];

/**
 * Macro category metadata for organization
 */
export const MACRO_CATEGORIES = {
  character_card: {
    name: 'Character Card Data',
    order: 1,
    description: 'Essential macros that pull data from character cards'
  },
  names: {
    name: 'Names & Identifiers',
    order: 2,
    description: 'Character and user name substitution'
  },
  datetime: {
    name: 'Date & Time',
    order: 3,
    description: 'Current date and time values'
  },
  randomization: {
    name: 'Randomization',
    order: 4,
    description: 'Random selections and dice rolls'
  },
  utilities: {
    name: 'Utilities',
    order: 5,
    description: 'Text manipulation and special functions'
  }
};
```

**Step 2: Verify the code doesn't break existing functionality**

Run: `npm run dev:client` in a terminal
Open: `http://localhost:5173`
Expected: App loads normally, no console errors

**Step 3: Commit**

```bash
cd /Users/sean/Desktop/choral/.worktrees/preset-macro-reference
git add src/utils/macros.js
git commit -m "feat: add macro metadata definitions to client-side macros

Add MACRO_DEFINITIONS array with categories, descriptions, and
isCharacterData flags for validation. Add MACRO_CATEGORIES for
organizing the reference UI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Macro Metadata to Server-Side Macros

**Files:**
- Modify: `server/macros.js`

**Step 1: Add macro definitions array**

Add this at the end of the file, before `module.exports`:

```javascript
/**
 * Macro metadata for documentation and validation
 * MUST stay in sync with src/utils/macros.js
 */
const MACRO_DEFINITIONS = [
  // Character Card Data (Essential - pulled from character cards)
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
    pattern: '{{scenario}}',
    category: 'character_card',
    description: 'Current situation/context for the roleplay from card',
    isCharacterData: true,
    example: 'Scenario: {{scenario}}'
  },
  {
    pattern: '{{dialogue_examples}}',
    category: 'character_card',
    description: 'Example conversations showing character voice from card',
    isCharacterData: true,
    example: '{{dialogue_examples}}'
  },

  // Names & Identifiers
  {
    pattern: '{{char}}',
    category: 'names',
    description: 'Character name or nickname',
    isCharacterData: false,
    example: '{{char}} smiled warmly.'
  },
  {
    pattern: '{{user}}',
    category: 'names',
    description: 'User name or persona name',
    isCharacterData: false,
    example: '{{user}} waved hello.'
  },

  // Date & Time
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
    description: 'Current time in HH:MM format (e.g., "14:30")',
    isCharacterData: false,
    example: 'Current time: {{isotime}}'
  },

  // Randomization
  {
    pattern: '{{random:...}}',
    category: 'randomization',
    description: 'Pick random option from comma-separated list each time',
    isCharacterData: false,
    example: '{{random:happy,sad,excited}}'
  },
  {
    pattern: '{{pick:...}}',
    category: 'randomization',
    description: 'Consistent random choice (cached per session)',
    isCharacterData: false,
    example: '{{pick:coffee,tea,water}}'
  },
  {
    pattern: '{{roll:N}}',
    category: 'randomization',
    description: 'Random number from 1 to N (also supports {{roll:dN}})',
    isCharacterData: false,
    example: 'You rolled a {{roll:20}}'
  },

  // Utilities
  {
    pattern: '{{reverse:...}}',
    category: 'utilities',
    description: 'Reverse the text inside',
    isCharacterData: false,
    example: '{{reverse:hello}} outputs "olleh"'
  },
  {
    pattern: '{{characters_list}}',
    category: 'utilities',
    description: 'List of all available characters with filenames',
    isCharacterData: false,
    example: 'Available: {{characters_list}}'
  },
  {
    pattern: '{{comment:...}}',
    category: 'utilities',
    description: 'Visible comment shown in UI as italics',
    isCharacterData: false,
    example: '{{comment:This is a note for readers}}'
  },
  {
    pattern: '{{//...}}',
    category: 'utilities',
    description: 'Hidden comment (removed from display and AI context)',
    isCharacterData: false,
    example: '{{// This is only visible in the editor}}'
  },
  {
    pattern: '{{hidden_key:...}}',
    category: 'utilities',
    description: 'Hidden lorebook scan key (not shown to AI or user)',
    isCharacterData: false,
    example: '{{hidden_key:secret_trigger}}'
  }
];

/**
 * Macro category metadata for organization
 * MUST stay in sync with src/utils/macros.js
 */
const MACRO_CATEGORIES = {
  character_card: {
    name: 'Character Card Data',
    order: 1,
    description: 'Essential macros that pull data from character cards'
  },
  names: {
    name: 'Names & Identifiers',
    order: 2,
    description: 'Character and user name substitution'
  },
  datetime: {
    name: 'Date & Time',
    order: 3,
    description: 'Current date and time values'
  },
  randomization: {
    name: 'Randomization',
    order: 4,
    description: 'Random selections and dice rolls'
  },
  utilities: {
    name: 'Utilities',
    order: 5,
    description: 'Text manipulation and special functions'
  }
};
```

**Step 2: Update module.exports**

Find the existing `module.exports` line and update it to include the new exports:

```javascript
module.exports = {
  processMacros,
  clearPickCache,
  MACRO_DEFINITIONS,
  MACRO_CATEGORIES
};
```

**Step 3: Verify the server doesn't crash**

Run: `node server/index.js` in a terminal
Expected: Server starts without errors
Stop the server: Ctrl+C

**Step 4: Commit**

```bash
git add server/macros.js
git commit -m "feat: add macro metadata definitions to server-side macros

Add MACRO_DEFINITIONS and MACRO_CATEGORIES exports matching client-side.
These must stay in sync for validation to work correctly.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Macro Reference Modal UI

**Files:**
- Modify: `src/components/PresetSelector.vue`

**Step 1: Import macro metadata**

Add this import at the top of the `<script>` section:

```javascript
import { MACRO_DEFINITIONS, MACRO_CATEGORIES } from '../utils/macros.js';
```

**Step 2: Add data properties**

In the `data()` function, add:

```javascript
data() {
  return {
    presets: [],
    selectedPreset: null,
    activePresetFilename: null,
    showMacroReference: false  // NEW: controls modal visibility
  }
},
```

**Step 3: Add computed properties**

After the `data()` section, add a `computed` section if it doesn't exist:

```javascript
computed: {
  sortedCategories() {
    return Object.entries(MACRO_CATEGORIES)
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.order - b.order);
  }
},
```

**Step 4: Add methods**

In the `methods` section, add these new methods:

```javascript
getMacrosForCategory(categoryKey) {
  return MACRO_DEFINITIONS.filter(m => m.category === categoryKey);
},
```

**Step 5: Add macro help button to template**

Find the `.header-actions` div in the template (around line 56) and add the macro button BEFORE the import button:

```vue
<div class="header-actions">
  <button @click="showMacroReference = true" class="help-btn" title="View available macros">📖 Macros</button>
  <button @click="$refs.fileInput.click()" class="import-btn">📥 Import</button>
  <button @click="savePreset" class="save-btn">💾 Save</button>
  <button @click="setAsActive" class="set-active-btn">⭐ Set as Active</button>
</div>
```

**Step 6: Add modal markup to template**

Add this at the very end of the template, just before the closing `</div>` tag (after the preset-body div):

```vue
<!-- Macro Reference Modal -->
<div v-if="showMacroReference" class="modal-overlay" @click="showMacroReference = false">
  <div class="modal-content" @click.stop>
    <div class="modal-header">
      <h3>Available Macros</h3>
      <button @click="showMacroReference = false" class="modal-close-btn">×</button>
    </div>
    <div class="macro-reference">
      <div v-for="category in sortedCategories" :key="category.key" class="macro-category">
        <h4>{{ category.name }}</h4>
        <p class="category-description">{{ category.description }}</p>
        <div class="macro-list">
          <div v-for="macro in getMacrosForCategory(category.key)" :key="macro.pattern" class="macro-item">
            <div class="macro-header">
              <code class="macro-pattern">{{ macro.pattern }}</code>
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
```

**Step 7: Add modal styles**

Add these styles at the end of the `<style scoped>` section:

```css
/* Help button */
.help-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.help-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  max-width: 800px;
  max-height: 80vh;
  width: 90%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: rgba(220, 38, 38, 0.1);
  color: var(--text-primary);
}

/* Macro reference content */
.macro-reference {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.macro-category {
  margin-bottom: 32px;
}

.macro-category:last-child {
  margin-bottom: 0;
}

.macro-category h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.category-description {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.macro-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-item {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.macro-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.macro-pattern {
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--accent-color);
  border: 1px solid var(--border-color);
}

.essential-badge {
  background: var(--accent-color);
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.macro-description {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 1.4;
}

.macro-example {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0 0 0;
  border-top: 1px solid var(--border-color);
  margin-top: 6px;
}

.macro-example em {
  font-style: italic;
  margin-right: 6px;
}

.macro-example code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
```

**Step 8: Test the modal**

1. Run: `npm run dev` (or just `npm run dev:client` if server is already running)
2. Open: `http://localhost:5173`
3. Navigate to Preset Manager
4. Click "📖 Macros" button
5. Expected: Modal opens with categorized macros
6. Verify: Essential macros have "Essential" badge
7. Verify: Categories appear in order
8. Click outside modal or X button
9. Expected: Modal closes

**Step 9: Commit**

```bash
git add src/components/PresetSelector.vue
git commit -m "feat: add macro reference modal to preset editor

Add categorized macro reference accessible via help button. Shows
all available macros with descriptions, examples, and essential
badges for character card data macros.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add Save-Time Validation

**Files:**
- Modify: `src/components/PresetSelector.vue`

**Step 1: Add validation method**

In the `methods` section, add this method:

```javascript
checkMissingEssentialMacros() {
  // Combine all enabled prompt content
  const allPromptContent = (this.selectedPreset.prompts || [])
    .filter(p => p.enabled)
    .map(p => p.content || '')
    .join('\n');

  // Get all essential macros (character card data)
  const essentialMacros = MACRO_DEFINITIONS.filter(m => m.isCharacterData);

  // Find which ones are missing
  return essentialMacros.filter(macro => {
    return !allPromptContent.includes(macro.pattern);
  });
},
```

**Step 2: Update savePreset method**

Find the `savePreset()` method and add validation at the very beginning:

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

  // Existing save logic continues...
  try {
    // Ensure prompts array exists
    if (!this.selectedPreset.prompts) {
      this.selectedPreset.prompts = [];
    }

    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.selectedPreset)
    });

    // ... rest of existing save logic
```

**Step 3: Test validation**

1. Run: `npm run dev`
2. Open: `http://localhost:5173`
3. Go to Preset Manager
4. Click "+ New Preset"
5. Enter a name: "Test Preset"
6. Add a prompt but DON'T include any {{description}}, {{personality}}, etc.
7. Click "💾 Save"
8. Expected: Confirm dialog appears listing missing macros
9. Click "Cancel"
10. Expected: Save is cancelled
11. Add {{description}} to a prompt
12. Click "💾 Save"
13. Expected: Still shows warning for other missing macros
14. Add all essential macros
15. Click "💾 Save"
16. Expected: Saves without warning

**Step 4: Commit**

```bash
git add src/components/PresetSelector.vue
git commit -m "feat: add save-time validation for missing essential macros

Warn users before saving presets that are missing character card
macros. Users can still save after confirmation, but are informed
about potential issues.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add Visual Indicator in Preset List

**Files:**
- Modify: `src/components/PresetSelector.vue`

**Step 1: Add helper method**

In the `methods` section, add:

```javascript
hasMissingEssentialMacros(preset) {
  const allPromptContent = (preset.prompts || [])
    .filter(p => p.enabled)
    .map(p => p.content || '')
    .join('\n');

  const essentialMacros = MACRO_DEFINITIONS.filter(m => m.isCharacterData);

  return essentialMacros.some(macro => !allPromptContent.includes(macro.pattern));
},
```

**Step 2: Update preset list template**

Find the `.preset-name` div in the template (around line 20) and add the warning badge:

```vue
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
```

**Step 3: Add warning badge styles**

Add this to the `<style scoped>` section:

```css
.warning-badge {
  font-size: 14px;
  margin-left: 4px;
  cursor: help;
}
```

**Step 4: Test visual indicator**

1. Run: `npm run dev`
2. Open: `http://localhost:5173`
3. Go to Preset Manager
4. Expected: Presets missing essential macros show ⚠️ badge
5. Hover over ⚠️
6. Expected: Tooltip shows "Missing essential character macros"
7. Select a preset with ⚠️
8. Add the missing essential macros
9. Save the preset
10. Expected: ⚠️ badge disappears from the list

**Step 5: Commit**

```bash
git add src/components/PresetSelector.vue
git commit -m "feat: add warning indicator for presets missing essential macros

Display ⚠️ badge in preset list for presets that are missing
character card macros. Helps users identify incomplete presets
at a glance.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final Integration Testing

**Files:**
- None (manual testing)

**Step 1: Test complete workflow**

1. Start the dev server: `npm run dev`
2. Navigate to: `http://localhost:5173`
3. Open Preset Manager
4. Test macro reference:
   - Click "📖 Macros" button
   - Verify all categories display correctly
   - Verify essential badges appear on character card macros
   - Verify examples are readable
   - Close modal
5. Test validation on new preset:
   - Create new preset
   - Try to save without essential macros
   - Verify warning appears
   - Cancel and add macros
   - Save successfully
6. Test validation on existing preset:
   - Select default.json
   - Verify no ⚠️ (it has all essential macros)
   - Edit and remove {{description}}
   - Save
   - Verify warning appears
   - Check list view for ⚠️ badge
7. Test with disabled prompts:
   - Create preset
   - Add prompt with all essential macros
   - Disable the prompt
   - Try to save
   - Verify warning appears (disabled prompts shouldn't count)

**Step 2: Test browser console**

1. Open browser console (F12)
2. Perform all actions above
3. Expected: No JavaScript errors

**Step 3: Test responsive behavior**

1. Resize browser window to mobile size
2. Open macro reference modal
3. Expected: Modal is readable and scrollable
4. Close modal
5. Expected: Works correctly

**Step 4: Document any issues found**

If any bugs found, create a note in `docs/plans/2025-10-26-preset-macro-reference-issues.md`

---

## Task 7: Merge to Main

**Files:**
- None (git operations)

**Step 1: Switch to main branch**

```bash
cd /Users/sean/Desktop/choral
git status
```

Expected: Clean working directory (we've been working in worktree)

**Step 2: Merge feature branch**

```bash
git merge --no-ff feature/preset-macro-reference -m "feat: add preset macro reference and validation system

Adds categorized macro documentation and validation to preset editor:
- Macro reference modal with categories and examples
- Save-time warnings for missing essential character macros
- Visual indicators in preset list for incomplete presets
- Metadata-driven approach for easy maintenance

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 3: Clean up worktree**

```bash
git worktree remove .worktrees/preset-macro-reference
```

**Step 4: Verify main branch**

```bash
git log --oneline -5
```

Expected: Shows merge commit and feature commits

**Step 5: Test on main branch**

```bash
npm run dev
```

Open: `http://localhost:5173`
Verify: All features work correctly on main branch

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Macro reference modal opens and displays all macros
- [ ] Macros are grouped by category in correct order
- [ ] Essential macros show "Essential" badge
- [ ] Save warning appears when essential macros missing
- [ ] Warning shows correct list of missing macros
- [ ] Can save anyway after confirming warning
- [ ] ⚠️ appears in preset list for incomplete presets
- [ ] ⚠️ disappears after adding missing macros
- [ ] Disabled prompts are excluded from validation
- [ ] No console errors during normal operation
- [ ] Modal is responsive on mobile sizes
- [ ] All commits have proper messages
- [ ] Feature branch merged to main
- [ ] Worktree cleaned up

---

## Notes for Engineer

### Project Context
- This is a Vue 3 + Express chat application for AI roleplay
- Uses OpenRouter API for LLM completions
- Character Card V3 format for character data
- Macro system processes template variables

### Sync Requirements
**CRITICAL:** The macro metadata in `src/utils/macros.js` and `server/macros.js` MUST stay identical. If you add a new macro in the future:
1. Add processing logic to both files
2. Add metadata entry to MACRO_DEFINITIONS in both files
3. Test in both client and server contexts

### Testing Notes
- No automated test suite exists yet
- All testing is manual via browser
- Use browser console to catch JavaScript errors
- Test in multiple browsers if possible

### Style Guide
- Use existing CSS variables (--accent-color, --bg-primary, etc.)
- Match existing button styles
- Keep modal consistent with app theme
- Use existing spacing/padding patterns

### Common Pitfalls
1. Forgetting to filter out disabled prompts in validation
2. Not handling null/undefined prompt content gracefully
3. Case sensitivity in macro pattern matching (use includes, not regex)
4. Modal z-index conflicts (we use 1000)
5. Forgetting to update both macro files when adding new macros
