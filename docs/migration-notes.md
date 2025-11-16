# API Service Layer Migration Notes

## Completed (Phase 1)

### Settings.vue ✅
- **Date:** 2025-11-16
- **fetch() calls eliminated:** 9
- **Methods migrated:**
  - `getConfig()`
  - `setActivePreset()`
  - `setDefaultPersona()`
  - `getPresets()`
  - `getPersonas()`
  - `getBackupConfig()`
  - `saveBackupConfig()`
  - `validateBackupPath()`
  - `createBackup()`
- **Testing:** All 182 tests passing, no regressions
- **Commit:** c0a3d0a

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
- [ ] Add `const api = useApi()` in setup function
- [ ] Replace all fetch() calls with api methods
- [ ] Update error handling (remove duplicate try/catch boilerplate)
- [ ] Test manually in dev server
- [ ] Check browser console for errors
- [ ] Run `npm test`
- [ ] Commit with descriptive message

## Benefits Realized

### Code Reduction
- Settings.vue: Reduced from ~60 lines of fetch boilerplate to ~15 lines of api calls
- 75% reduction in error handling code
- Consistent error logging across all API calls

### Maintainability
- Single source of truth for all API endpoints
- Easy to add new endpoints (just add one method to useApi)
- Easier to mock for testing
- Type-safe API interface (can add TypeScript later)

### Developer Experience
- Autocomplete for all API methods
- Consistent promise-based interface
- No need to remember endpoint URLs or request formats
- Automatic FormData handling

## Implementation Notes

### Edge Cases Handled
1. **FormData uploads** - Automatic Content-Type header removal
2. **Empty DELETE responses** - Returns null instead of throwing
3. **Error response parsing** - Fallback to HTTP status if JSON invalid
4. **Network failures** - Logged with method and endpoint context

### Streaming Exclusion
SSE (Server-Sent Events) for chat streaming (`/api/chat/stream`) intentionally NOT in useApi - it remains in ChatView.vue using direct `fetch()` since it needs EventSource-like handling. The useApi composable is only for standard request/response patterns.

## Next Steps

1. Migrate PresetSelector.vue (estimated 1 hour)
2. Migrate PersonaManager.vue (estimated 1 hour)
3. Migrate LorebookManager.vue (estimated 1 hour)
4. Migrate CharacterList.vue (estimated 2-3 hours, complex)
5. Migrate ChatView.vue (estimated 3-4 hours, most complex)

Total estimated remaining effort: ~8-10 hours
