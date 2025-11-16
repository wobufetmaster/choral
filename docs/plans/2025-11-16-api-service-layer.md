# API Service Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a centralized API service layer using Vue 3 composables to eliminate 60+ duplicate `fetch()` calls and provide consistent error handling.

**Architecture:** Single `useApi()` composable providing promise-based methods for all 15 resource types. Stateless design (no reactive state), methods return promises, components handle loading/error UI. Incremental migration starting with Settings.vue.

**Tech Stack:** Vue 3, Vitest, happy-dom

---

## Task 1: Create useApi Composable Tests

**Files:**
- Create: `tests/unit/composables/useApi.test.js`

**Step 1: Write the failing test file structure**

Create `tests/unit/composables/useApi.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApi } from '../../../src/composables/useApi.js';

describe('useApi', () => {
  let api;
  let fetchMock;

  beforeEach(() => {
    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    api = useApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character API', () => {
    it('should fetch characters list with GET /api/characters', async () => {
      const mockCharacters = [{ filename: 'test.png', name: 'Test' }];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCharacters)
      });

      const result = await api.getCharacters();

      expect(fetchMock).toHaveBeenCalledWith('/api/characters', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET'
      });
      expect(result).toEqual(mockCharacters);
    });

    it('should save character with POST /api/characters and FormData', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.png');

      const mockCharacter = { filename: 'test.png', name: 'Test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCharacter)
      });

      const result = await api.saveCharacter(formData);

      // Should NOT have Content-Type header (browser sets it)
      expect(fetchMock).toHaveBeenCalledWith('/api/characters', {
        headers: {},
        method: 'POST',
        body: formData
      });
      expect(result).toEqual(mockCharacter);
    });

    it('should delete character with DELETE /api/characters/:filename', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => ''  // DELETE returns empty response
      });

      const result = await api.deleteCharacter('test.png');

      expect(fetchMock).toHaveBeenCalledWith('/api/characters/test.png', {
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE'
      });
      expect(result).toBeNull();
    });
  });

  describe('Config API', () => {
    it('should fetch config with GET /api/config', async () => {
      const mockConfig = { port: 3000 };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockConfig)
      });

      const result = await api.getConfig();

      expect(fetchMock).toHaveBeenCalledWith('/api/config', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET'
      });
      expect(result).toEqual(mockConfig);
    });

    it('should set active preset with POST /api/config/active-preset', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      });

      const result = await api.setActivePreset('default.json');

      expect(fetchMock).toHaveBeenCalledWith('/api/config/active-preset', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ filename: 'default.json' })
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should throw on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getCharacters()).rejects.toThrow('Network error');
    });

    it('should parse error response JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Character not found' })
      });

      await expect(api.getCharacter('missing.png')).rejects.toThrow('Character not found');
    });

    it('should fallback to HTTP status on malformed error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(api.getCharacters()).rejects.toThrow('HTTP 500');
    });

    it('should log errors with context', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getCharacters()).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Error [GET /api/characters]'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON responses', async () => {
      const mockData = { test: 'data' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockData)
      });

      const result = await api.getCharacters();
      expect(result).toEqual(mockData);
    });

    it('should handle empty responses (DELETE endpoints)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => ''
      });

      const result = await api.deleteCharacter('test.png');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test tests/unit/composables/useApi.test.js
```

Expected: FAIL with "Cannot find module '../../../src/composables/useApi.js'"

**Step 3: Commit the failing tests**

```bash
git add tests/unit/composables/useApi.test.js
git commit -m "test: add failing tests for useApi composable

Red phase of TDD - tests define expected API interface.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Implement useApi Composable (Core)

**Files:**
- Create: `src/composables/useApi.js`

**Step 1: Create composable directory**

Run:
```bash
mkdir -p src/composables
```

**Step 2: Write minimal implementation**

Create `src/composables/useApi.js`:

```javascript
/**
 * API Service Composable
 *
 * Centralized API layer for all HTTP requests. Provides promise-based
 * methods for all resource types with consistent error handling.
 *
 * Usage:
 *   const api = useApi();
 *   const characters = await api.getCharacters();
 */
export function useApi() {
  const baseURL = '';  // Vite proxies /api/* to backend

  /**
   * Core request wrapper with error handling
   * @param {string} endpoint - API endpoint (e.g., '/api/characters')
   * @param {object} options - Fetch options
   * @returns {Promise} - Parsed response or null for empty responses
   */
  async function request(endpoint, options = {}) {
    const url = `${baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Remove Content-Type for FormData (browser sets it with boundary)
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}`
        }));
        throw new Error(error.error || error.message);
      }

      // Handle empty responses (DELETE endpoints)
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  }

  // Helper methods
  const get = (endpoint) => request(endpoint, { method: 'GET' });
  const post = (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  });
  const del = (endpoint) => request(endpoint, { method: 'DELETE' });

  // Return API interface
  return {
    // Characters
    getCharacters: () => get('/api/characters'),
    getCharacter: (filename) => get(`/api/characters/${filename}`),
    saveCharacter: (formData) => post('/api/characters', formData),
    deleteCharacter: (filename) => del(`/api/characters/${filename}`),

    // Config
    getConfig: () => get('/api/config'),
    setActivePreset: (filename) => post('/api/config/active-preset', { filename }),
  };
}
```

**Step 3: Run tests to verify they pass**

Run:
```bash
npm test tests/unit/composables/useApi.test.js
```

Expected: PASS (all 10 tests)

**Step 4: Commit the implementation**

```bash
git add src/composables/useApi.js
git commit -m "feat: implement useApi composable core functionality

Green phase of TDD - minimal implementation to pass tests.

Implements:
- Core request wrapper with error handling
- GET/POST/DELETE helper methods
- Character API methods
- Config API methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Remaining API Methods

**Files:**
- Modify: `src/composables/useApi.js:58-60` (add methods to return object)
- Modify: `tests/unit/composables/useApi.test.js:88` (add test cases)

**Step 1: Add tests for remaining endpoints**

Add to `tests/unit/composables/useApi.test.js` after the Config API tests (around line 88):

```javascript
  describe('Preset API', () => {
    it('should fetch presets with GET /api/presets', async () => {
      const mockPresets = [{ filename: 'default.json', name: 'Default' }];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockPresets)
      });

      const result = await api.getPresets();
      expect(result).toEqual(mockPresets);
    });

    it('should save preset with POST /api/presets', async () => {
      const preset = { name: 'Test', temperature: 0.7 };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(preset)
      });

      const result = await api.savePreset(preset);
      expect(result).toEqual(preset);
    });
  });

  describe('Backup API', () => {
    it('should create backup with POST /api/backup/trigger', async () => {
      const mockResponse = { filename: 'backup.zip', message: 'Success' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await api.createBackup(false);

      expect(fetchMock).toHaveBeenCalledWith('/api/backup/trigger', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ encrypted: false })
      });
      expect(result).toEqual(mockResponse);
    });
  });
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test tests/unit/composables/useApi.test.js
```

Expected: FAIL with "api.getPresets is not a function"

**Step 3: Add implementations**

Update the return object in `src/composables/useApi.js` (around line 58):

```javascript
  return {
    // Characters
    getCharacters: () => get('/api/characters'),
    getCharacter: (filename) => get(`/api/characters/${filename}`),
    saveCharacter: (formData) => post('/api/characters', formData),
    deleteCharacter: (filename) => del(`/api/characters/${filename}`),

    // Chats
    getChats: () => get('/api/chats'),
    getChat: (filename) => get(`/api/chats/${filename}`),
    saveChat: (data) => post('/api/chats', data),
    deleteChat: (filename) => del(`/api/chats/${filename}`),

    // Group Chats
    getGroupChats: () => get('/api/group-chats'),
    getGroupChat: (filename) => get(`/api/group-chats/${filename}`),
    saveGroupChat: (data) => post('/api/group-chats', data),
    deleteGroupChat: (filename) => del(`/api/group-chats/${filename}`),
    getGroupChatHistory: (filename) => get(`/api/group-chats/${filename}/history`),

    // Personas
    getPersonas: () => get('/api/personas'),
    savePersona: (data) => post('/api/personas', data),

    // Lorebooks
    getLorebooks: () => get('/api/lorebooks'),
    getLorebook: (filename) => get(`/api/lorebooks/${filename}`),
    saveLorebook: (data) => post('/api/lorebooks', data),
    deleteLorebook: (filename) => del(`/api/lorebooks/${filename}`),
    importLorebook: (formData) => post('/api/lorebooks/import', formData),

    // Presets
    getPresets: () => get('/api/presets'),
    getPreset: (filename) => get(`/api/presets/${filename}`),
    savePreset: (data) => post('/api/presets', data),
    deletePreset: (filename) => del(`/api/presets/${filename}`),
    importPixiJB: (data) => post('/api/presets/import/pixijb', data),

    // Tags
    getTags: () => get('/api/tags'),
    saveTags: (tags) => post('/api/tags', { tags }),
    getCoreTags: () => get('/api/tags/core'),
    saveCoreTags: (tags) => post('/api/tags/core', { tags }),

    // Config
    getConfig: () => get('/api/config'),
    setActivePreset: (filename) => post('/api/config/active-preset', { filename }),
    getBookkeepingSettings: () => get('/api/bookkeeping-settings'),
    saveBookkeepingSettings: (data) => post('/api/bookkeeping-settings', data),
    getToolSettings: () => get('/api/tool-settings'),
    saveToolSettings: (data) => post('/api/tool-settings', data),

    // Backup
    createBackup: (encrypted) => post('/api/backup/trigger', { encrypted }),
    getBackupConfig: () => get('/api/backup/config'),
    saveBackupConfig: (data) => post('/api/backup/config', data),
    testBackupPath: (path) => post('/api/backup/test-path', { path }),
    chooseBackupDirectory: () => get('/api/backup/choose-directory'),

    // Auto-functions
    autoNameChat: (messages) => post('/api/chat/auto-name', { messages }),
    autoTagCharacter: (character) => post('/api/characters/auto-tag', { character }),

    // Tools
    getCharacterTools: (filename) => get(`/api/tools/character/${filename}`),
    callTool: (toolName, args) => post('/api/tools/call', { toolName, args }),
  };
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npm test tests/unit/composables/useApi.test.js
```

Expected: PASS (all tests including new ones)

**Step 5: Commit**

```bash
git add src/composables/useApi.js tests/unit/composables/useApi.test.js
git commit -m "feat: add all API methods to useApi composable

Complete API surface covering all 15 resource types:
- Characters, Chats, Group Chats
- Personas, Lorebooks, Presets
- Tags, Config, Backup
- Auto-functions, Tools

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Migrate Settings.vue to useApi

**Files:**
- Modify: `src/components/Settings.vue`

**Step 1: Add useApi import**

At the top of `src/components/Settings.vue` script section (around line 5):

```javascript
import { useApi } from '../composables/useApi.js';
```

**Step 2: Initialize useApi in component**

Inside the component's setup or data section (around line 10):

```javascript
const api = useApi();
```

**Step 3: Find and replace all fetch calls**

Search for all `fetch('/api/` patterns in Settings.vue and replace with api calls.

Example replacements:

**Before:**
```javascript
async loadConfig() {
  try {
    const response = await fetch('/api/config');
    this.config = await response.json();
  } catch (error) {
    console.error('Error loading config:', error);
  }
}
```

**After:**
```javascript
async loadConfig() {
  try {
    this.config = await api.getConfig();
  } catch (error) {
    console.error('Error loading config:', error);
  }
}
```

**Before:**
```javascript
async saveActivePreset() {
  try {
    const response = await fetch('/api/config/active-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: this.selectedPreset })
    });
    await response.json();
  } catch (error) {
    console.error('Error saving preset:', error);
  }
}
```

**After:**
```javascript
async saveActivePreset() {
  try {
    await api.setActivePreset(this.selectedPreset);
  } catch (error) {
    console.error('Error saving preset:', error);
  }
}
```

Repeat for all fetch calls in Settings.vue (approximately 5-6 occurrences).

**Step 4: Test manually in dev server**

Run:
```bash
npm run dev:client
```

Then in browser:
1. Navigate to Settings page
2. Verify all settings load correctly
3. Try changing active preset
4. Try modifying backup settings
5. Check browser console for errors

Expected: No console errors, all functionality works

**Step 5: Verify with browser MCP tools**

Use MCP browser tools to check for errors:

Run browser console check to ensure no errors during Settings interaction.

**Step 6: Run full test suite**

Run:
```bash
npm test
```

Expected: All tests pass (no regressions)

**Step 7: Commit**

```bash
git add src/components/Settings.vue
git commit -m "refactor: migrate Settings.vue to useApi composable

Replaced 6 direct fetch() calls with api.* methods:
- api.getConfig()
- api.setActivePreset()
- api.getBackupConfig()
- api.saveBackupConfig()
- api.testBackupPath()
- api.createBackup()

Benefits:
- Eliminates duplicate error handling
- Consistent API interface
- Easier to test/mock

Manual testing confirmed no regressions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Verification and Documentation

**Files:**
- Modify: `docs/plans/2025-11-16-api-service-layer-design.md:282` (update status)
- Create: `docs/migration-notes.md`

**Step 1: Run full test suite**

Run:
```bash
npm test
```

Expected: All tests pass

**Step 2: Manual verification checklist**

1. Start dev server: `npm run dev`
2. Test Settings.vue:
   - Load settings page
   - Change active preset
   - Modify backup settings
   - Trigger manual backup
   - Test path validation
3. Check browser console for errors
4. Verify network requests in DevTools

Expected: All functionality works, no console errors

**Step 3: Create migration notes**

Create `docs/migration-notes.md`:

```markdown
# API Service Layer Migration Notes

## Completed (Phase 1)

### Settings.vue ✅
- **Date:** 2025-11-16
- **fetch() calls eliminated:** 6
- **Methods migrated:**
  - `getConfig()`
  - `setActivePreset()`
  - `getBackupConfig()`
  - `saveBackupConfig()`
  - `testBackupPath()`
  - `createBackup()`
- **Testing:** Manual testing passed, no regressions
- **Commit:** [hash]

## Remaining Components

### High Priority
- [ ] PresetSelector.vue (~5-6 fetch calls)
- [ ] PersonaManager.vue (~4-5 fetch calls)
- [ ] LorebookManager.vue (~5-6 fetch calls)

### Critical (Complex)
- [ ] CharacterList.vue (23 fetch calls)
- [ ] ChatView.vue (38 fetch calls)

### Low Priority
- [ ] CharacterEditor.vue (~3-4 fetch calls)
- [ ] Other smaller components

## Migration Pattern

```javascript
// Before
const response = await fetch('/api/endpoint');
const data = await response.json();

// After
const api = useApi();
const data = await api.methodName();
```

## Testing Checklist (Per Component)
- [ ] Add `import { useApi } from '../composables/useApi.js'`
- [ ] Replace all fetch() calls
- [ ] Manual testing in dev server
- [ ] Check browser console
- [ ] Run `npm test`
- [ ] Commit with descriptive message
```

**Step 4: Update design document status**

In `docs/plans/2025-11-16-api-service-layer-design.md`, update the Success Criteria section (around line 282):

```markdown
## Success Criteria

1. ✅ All tests pass (useApi unit tests + existing integration tests)
2. ✅ Zero duplicate `fetch()` calls in Settings.vue
3. ✅ Consistent error handling across API calls
4. ✅ Settings.vue successfully migrated with no regressions
5. ✅ No console errors in browser during manual testing

**Status:** Phase 1 complete. Settings.vue migration successful.
```

**Step 5: Final commit**

```bash
git add docs/migration-notes.md docs/plans/2025-11-16-api-service-layer-design.md
git commit -m "docs: add migration notes and update design status

Phase 1 complete:
- useApi composable implemented and tested
- Settings.vue successfully migrated
- All tests passing
- No regressions detected

Next: Migrate remaining components incrementally.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verification Commands

Run these commands to verify implementation:

```bash
# Unit tests for useApi
npm test tests/unit/composables/useApi.test.js

# Full test suite
npm test

# Dev server
npm run dev

# Lint check (if configured)
npm run lint
```

## Expected Outcomes

1. **Test Coverage:**
   - useApi unit tests: 10+ tests, all passing
   - No regressions in existing tests
   - Total test count increases by ~10

2. **Code Quality:**
   - Settings.vue reduced by ~30 lines (removed boilerplate)
   - Zero duplicate fetch() calls in Settings.vue
   - Consistent error logging

3. **Manual Testing:**
   - Settings page loads without errors
   - All settings operations work correctly
   - Browser console shows no errors
   - Network requests use correct endpoints

4. **Documentation:**
   - Design document updated with completion status
   - Migration notes created for future reference
   - All commits follow conventional commit format

## Notes for Engineer

- **TDD Discipline:** Write test first, watch it fail, then implement. No exceptions.
- **Commit Frequency:** Commit after each task (5-7 commits total for this plan).
- **Error Handling:** The composable logs errors automatically; components just need try/catch for UI updates.
- **FormData Detection:** The composable automatically detects FormData and removes Content-Type header.
- **Empty Responses:** DELETE endpoints return null, not undefined.
- **Streaming Excluded:** SSE streaming (`/api/chat/stream`) intentionally NOT in useApi - it stays in ChatView.vue.

## Troubleshooting

**If tests fail with "fetch is not defined":**
- Check `beforeEach` properly mocks global.fetch
- Ensure `vi.restoreAllMocks()` in `afterEach`

**If Settings.vue doesn't work after migration:**
- Check browser console for errors
- Verify api is initialized before use
- Ensure import path is correct: `'../composables/useApi.js'`

**If tests pass but manual testing fails:**
- Check Vite proxy configuration in `vite.config.js`
- Verify backend server is running
- Check network tab in DevTools for actual requests

## Success Metrics

- ✅ All unit tests pass (168+ existing + 10+ new)
- ✅ Zero `fetch('/api/` patterns in Settings.vue
- ✅ Browser console shows no errors during Settings interaction
- ✅ Total lines of code reduced (less boilerplate)
- ✅ All functionality works identically to before migration

---

**Implementation Time Estimate:** 2-3 hours

**Next Phase:** Migrate PresetSelector.vue, PersonaManager.vue, LorebookManager.vue incrementally, then tackle CharacterList.vue and ChatView.vue.
