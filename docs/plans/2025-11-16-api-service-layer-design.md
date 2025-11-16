# API Service Layer Design

**Date:** 2025-11-16
**Status:** Approved
**Part of:** Phase 1 Refactoring (Foundation)

## Overview

Introduce a centralized API service layer using Vue 3 composables to eliminate duplicate `fetch()` calls across components and provide consistent error handling.

**Current Problem:**
- 60+ duplicate `fetch()` calls scattered across 6+ Vue components
- API endpoints hardcoded as strings throughout frontend
- Inconsistent error handling patterns
- No centralized request/response logging
- Difficult to mock API calls for testing

**Solution:**
Single `useApi()` composable providing promise-based methods for all 15 resource types.

## Design Decisions

### Architecture: Vue 3 Composable Pattern
- **Chosen:** Vue 3 composable (`useApi()`)
- **Rejected alternatives:**
  - Class-based service: More boilerplate, less Vue-native
  - Functional modules: No framework integration
- **Rationale:** Aligns with Vue 3 best practices, easy to use in components

### Organization: Single Composable
- **Chosen:** One `useApi()` composable with all methods
- **Rejected alternatives:**
  - Resource-specific composables: More imports, fragmentation
  - Layered base + resource: Over-engineered for current scale
- **Rationale:** ~300-400 lines total, simple single import

### State Management: Stateless (Promise-based)
- **Chosen:** Methods return promises, components handle loading/error state
- **Rejected alternatives:**
  - Stateful with reactive refs: Mixes API + state concerns
  - Hybrid optional state: Complex API surface
- **Rationale:** Simpler, more explicit, easier to test

## File Structure

```
src/composables/
└── useApi.js                    (~300-400 lines)

tests/unit/composables/
└── useApi.test.js              (~200-300 lines)
```

## API Interface

### Core Methods

```javascript
const api = useApi();

// Characters (4 methods)
await api.getCharacters()              → Character[]
await api.getCharacter(filename)       → Character
await api.saveCharacter(formData)      → Character
await api.deleteCharacter(filename)    → void

// Chats (3 methods)
await api.getChats()                   → Chat[]
await api.saveChat(data)               → Chat
await api.deleteChat(filename)         → void

// Group Chats (5 methods)
await api.getGroupChats()              → GroupChat[]
await api.getGroupChat(filename)       → GroupChat
await api.saveGroupChat(data)          → GroupChat
await api.deleteGroupChat(filename)    → void
await api.getGroupChatHistory(filename)→ Message[]

// Personas (2 methods)
await api.getPersonas()                → Persona[]
await api.savePersona(data)            → Persona

// Lorebooks (5 methods)
await api.getLorebooks()               → Lorebook[]
await api.getLorebook(filename)        → Lorebook
await api.saveLorebook(data)           → Lorebook
await api.deleteLorebook(filename)     → void
await api.importLorebook(formData)     → Lorebook

// Presets (5 methods)
await api.getPresets()                 → Preset[]
await api.getPreset(filename)          → Preset
await api.savePreset(data)             → Preset
await api.deletePreset(filename)       → void
await api.importPixiJB(data)           → Preset

// Tags (4 methods)
await api.getTags()                    → string[]
await api.saveTags(tags)               → void
await api.getCoreTags()                → string[]
await api.saveCoreTags(tags)           → void

// Settings (6 methods)
await api.getConfig()                  → Config
await api.setActivePreset(filename)    → void
await api.getBookkeepingSettings()     → BookkeepingSettings
await api.saveBookkeepingSettings(data)→ void
await api.getToolSettings()            → ToolSettings
await api.saveToolSettings(data)       → void

// Backup (5 methods)
await api.createBackup(encrypted)      → { filename, message }
await api.getBackupConfig()            → BackupConfig
await api.saveBackupConfig(data)       → void
await api.testBackupPath(path)         → { valid, message }
await api.chooseBackupDirectory()      → { path }

// Auto-functions (2 methods)
await api.autoNameChat(messages)       → { suggestedName }
await api.autoTagCharacter(character)  → { suggestedTags }

// Tools (2 methods)
await api.getCharacterTools(filename)  → Tool[]
await api.callTool(toolName, args)     → any

// Note: Streaming chat (POST /api/chat/stream) uses direct fetch() with SSE
// and is NOT included in useApi - it remains in ChatView.vue
```

## Implementation Details

### Core Fetch Wrapper

```javascript
export function useApi() {
  const baseURL = '';  // Vite proxies /api/* to backend

  async function request(endpoint, options = {}) {
    const url = `${baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Remove Content-Type for FormData (browser sets with boundary)
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

  // Resource methods (thin wrappers)
  return {
    // Characters
    getCharacters: () => get('/api/characters'),
    getCharacter: (filename) => get(`/api/characters/${filename}`),
    saveCharacter: (formData) => post('/api/characters', formData),
    deleteCharacter: (filename) => del(`/api/characters/${filename}`),

    // ... (similar pattern for all resources)
  };
}
```

### Error Handling

**Before (duplicated in every component):**
```javascript
try {
  const response = await fetch('/api/characters');
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
} catch (error) {
  console.error('Error:', error);
}
```

**After (centralized in useApi):**
```javascript
const api = useApi();
try {
  const characters = await api.getCharacters();
} catch (error) {
  // Error already logged with context, just handle UI
  this.showError(error.message);
}
```

### Edge Cases Handled

1. **Network failures** - Caught and logged with method/endpoint context
2. **Non-JSON responses** - Graceful fallback for empty DELETE responses
3. **Malformed error responses** - Default to "HTTP {status}" if parsing fails
4. **FormData boundary** - Auto-detected, Content-Type removed for browser to set
5. **SSE streaming** - Explicitly excluded, remains direct `fetch()` in components

## Testing Strategy (TDD)

### Test File Structure

```javascript
// tests/unit/composables/useApi.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApi } from '../../../src/composables/useApi.js';

describe('useApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character API', () => {
    it('should fetch characters list with GET /api/characters')
    it('should save character with POST /api/characters')
    it('should handle FormData correctly (no Content-Type header)')
    it('should delete character with DELETE /api/characters/:filename')
    it('should handle 404 errors with meaningful message')
  });

  describe('Error Handling', () => {
    it('should throw on network failure')
    it('should parse error response JSON')
    it('should fallback to HTTP status on malformed error')
    it('should log errors with context (method + endpoint)')
  });

  describe('Response Parsing', () => {
    it('should parse JSON responses')
    it('should handle empty responses (DELETE endpoints)')
    it('should handle non-JSON error responses')
  });
});
```

### What We'll Test

1. ✅ Correct HTTP method (GET/POST/DELETE)
2. ✅ Correct endpoint URL construction
3. ✅ Proper JSON parsing and error handling
4. ✅ FormData handling (header removal)
5. ✅ Network error handling
6. ✅ HTTP status error handling (404, 500)
7. ✅ Empty response handling (DELETE endpoints)
8. ✅ Error logging with context

## Migration Plan (Incremental Rollout)

### Phase 1: Simple Component (Proof of Concept)
**Target:** Settings.vue (1,054 lines, ~5-6 API calls)
**Estimate:** 30 minutes
**Why first:** Lowest complexity, easiest to verify

### Phase 2: Medium Complexity
**Targets:**
- PresetSelector.vue (1,004 lines)
- PersonaManager.vue (1,035 lines)
- LorebookManager.vue (926 lines)

**Estimate:** ~1 hour each
**Why next:** Moderate API usage, self-contained functionality

### Phase 3: High Complexity (Highest Impact)
**Targets:**
- CharacterList.vue (2,585 lines, 23 fetch calls)
- ChatView.vue (4,948 lines, 38 fetch calls)

**Estimate:** 2-3 hours each
**Why last:** Most API calls, most critical functionality, highest risk

### Migration Checklist (Per Component)

```
- [ ] Add `const api = useApi()` to component setup
- [ ] Replace all `fetch()` calls with api.* methods
- [ ] Update error handling (remove duplicate try/catch boilerplate)
- [ ] Test manually in dev server (verify all functionality works)
- [ ] Run browser MCP tools to check console errors
- [ ] Run `npm test` to ensure no regressions
- [ ] Commit: "refactor: migrate [Component] to useApi composable"
```

**Between each migration:**
- Manual testing of migrated component
- Full test suite run
- Only proceed if all tests pass

## Success Criteria

1. ✅ All tests pass (useApi unit tests + existing integration tests)
2. ✅ Zero duplicate `fetch()` calls in Settings.vue (9 fetch calls eliminated)
3. ✅ Consistent error handling across all API calls
4. ✅ Settings.vue successfully migrated with no regressions
5. ✅ No console errors in browser during manual testing

**Status:** Phase 1 complete. Settings.vue migration successful.
- useApi composable: 130 lines, 40+ API methods
- Tests: 14 unit tests, all passing
- Total test suite: 182 tests passing, 1 skipped
- Settings.vue: Reduced by ~45 lines of boilerplate
- Next: Migrate remaining components incrementally

## Implementation Order (TDD)

1. **Write tests** - `tests/unit/composables/useApi.test.js`
2. **Watch tests fail** - Confirm RED state
3. **Implement useApi** - `src/composables/useApi.js`
4. **Watch tests pass** - Confirm GREEN state
5. **Migrate Settings.vue** - First component migration
6. **Manual testing** - Verify Settings.vue functionality
7. **Integration test** - Add test for Settings.vue with useApi
8. **Refactor if needed** - Clean up any rough edges

## Future Enhancements (Out of Scope)

- TypeScript type definitions for API responses
- Request/response interceptors for logging
- Automatic retry logic for failed requests
- Request caching/deduplication
- Request cancellation (AbortController)

These can be added incrementally as needs arise.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental migration with testing between each step |
| Missing edge cases in fetch wrapper | Comprehensive unit tests covering all code paths |
| Streaming chat compatibility | Explicitly excluded from useApi, remains direct fetch() |
| Component-specific error handling | Components retain try/catch, just with cleaner API |

## Timeline Estimate

- Write tests: 30 minutes
- Implement useApi: 1 hour
- Migrate Settings.vue: 30 minutes
- Test and validate: 30 minutes
- **Total:** ~2.5-3 hours

---

**Next Steps:**
1. Set up git worktree for isolated development
2. Create implementation plan with detailed tasks
3. Begin TDD implementation
