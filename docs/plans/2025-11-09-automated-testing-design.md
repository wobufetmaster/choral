# Automated Testing System Design

**Date:** 2025-11-09
**Status:** Approved Design
**Scope:** Comprehensive headless testing to prevent functionality regression

## Overview

This design establishes a comprehensive automated testing system for Choral using Vitest for unit/integration tests and Playwright for end-to-end tests. The system runs headlessly via npm scripts and pre-commit hooks, with all external API calls mocked for speed and reliability.

## Requirements

- **Coverage Level:** Comprehensive coverage across all system layers
- **Test Focus:** Backend API endpoints, frontend UI components, integration workflows, data integrity
- **Execution Environment:** Manual npm scripts + pre-commit hooks
- **External Dependencies:** Mock all OpenRouter API calls
- **Framework:** Vitest + Playwright

## Architecture

### Testing Stack

- **Vitest** - Unit and integration tests (backend logic, Vue components, utilities)
- **Playwright** - End-to-end tests (full user workflows in headless browser)
- **Mock Service Worker (MSW)** - Mocking OpenRouter API calls
- **Husky** - Pre-commit hooks
- **@vue/test-utils** - Vue component testing utilities
- **supertest** - HTTP assertion library for API integration tests
- **start-server-and-test** - Automate server startup for E2E tests

### Directory Structure

```
choral/
├── tests/
│   ├── unit/                    # Vitest unit tests
│   │   ├── server/              # Backend logic tests
│   │   │   ├── macros.test.js
│   │   │   ├── characterCard.test.js
│   │   │   ├── presets.test.js
│   │   │   └── promptProcessor.test.js
│   │   ├── utils/               # Client utils tests
│   │   │   └── macros.test.js
│   │   └── components/          # Vue component tests
│   │       ├── CharacterList.test.js
│   │       ├── ChatView.test.js
│   │       ├── PresetSelector.test.js
│   │       └── CharacterEditor.test.js
│   ├── integration/             # Vitest API integration tests
│   │   ├── api-characters.test.js
│   │   ├── api-chats.test.js
│   │   └── api-presets.test.js
│   ├── e2e/                     # Playwright E2E tests
│   │   ├── chat-workflow.spec.js
│   │   ├── character-import.spec.js
│   │   ├── preset-management.spec.js
│   │   ├── image-attachment.spec.js
│   │   └── lorebook-persona.spec.js
│   ├── fixtures/                # Test data
│   │   ├── characters/
│   │   │   ├── test-character-v3.png
│   │   │   ├── test-character-v2.png
│   │   │   └── invalid-character.png
│   │   ├── chats/
│   │   │   ├── test-chat-basic.json
│   │   │   ├── test-chat-with-images.json
│   │   │   └── test-chat-with-macros.json
│   │   ├── presets/
│   │   │   ├── test-preset-basic.json
│   │   │   └── test-preset-pixijb.json
│   │   └── images/
│   │       ├── test-image.jpg
│   │       └── test-image.png
│   └── mocks/                   # API mocks
│       └── openrouter.js
├── vitest.config.js
├── playwright.config.js
└── .husky/
    └── pre-commit
```

### Test Execution Flow

1. `npm test` - Runs Vitest unit + integration tests (fast, ~30s)
2. `npm run test:e2e` - Runs Playwright E2E tests (slower, ~2-3min)
3. `npm run test:all` - Runs everything
4. **Pre-commit hook** - Runs unit + integration only (keeps commits fast)

## Backend Testing Strategy

### Unit Tests (Vitest)

#### 1. Macro Processing (`tests/unit/server/macros.test.js`)
- Test all macro types: `{{char}}`, `{{random}}`, `{{pick}}`, `{{roll}}`, `{{reverse}}`, `{{comment}}`, `{{hidden_key}}`
- Test nested macros and edge cases
- Test context injection (character name, user name)
- **~15 test cases**

#### 2. Character Card Reading/Writing (`tests/unit/server/characterCard.test.js`)
- Test PNG chunk parsing (V3 `ccv3` and V2 `chara`)
- Test base64 encoding/decoding
- Test V2 → V3 conversion
- Test invalid file handling
- Use fixture PNG files in `tests/fixtures/characters/`
- **~12 test cases**

#### 3. Preset Management (`tests/unit/server/presets.test.js`)
- Test preset validation
- Test PixiJB import conversion
- Test template placeholder replacement
- Test default preset loading
- **~10 test cases**

#### 4. Prompt Processor (`tests/unit/server/promptProcessor.test.js`)
- Test all 6 processing modes: `merge_system`, `semi_strict`, `strict`, `single_user`, `anthropic_prefill`, `none`
- Test message array transformations
- Test edge cases (empty messages, malformed content)
- **~18 test cases** (3 per mode)

### Integration Tests (Vitest + supertest)

Test actual HTTP endpoints with in-memory Express app:
- `POST /api/characters` - Upload character
- `GET /api/characters` - List characters
- `POST /api/chats` - Save chat
- `GET /api/chats/:filename` - Load chat
- `POST /api/presets` - Create preset
- `POST /api/chat` - Mock OpenRouter response
- Use temporary test data directory (`data-test/`)
- Clean up after each test
- **~20 test cases**

**Total Backend Tests:** ~75 test cases

## Frontend Testing Strategy

### Vue Component Tests (Vitest + @vue/test-utils)

#### 1. CharacterList.vue
- Test character grid rendering
- Test search functionality (filter by name/tags)
- Test character selection
- Test empty state
- Mock API responses for character list
- **~8 test cases**

#### 2. ChatView.vue
- Test message rendering (user vs assistant)
- Test HTML sanitization (DOMPurify)
- Test message editing/deletion
- Test streaming message updates
- Test image display in messages
- Test input handling
- **~12 test cases**

#### 3. PresetSelector.vue
- Test preset list rendering
- Test preset creation/editing
- Test parameter controls (temperature, top_p, etc.)
- Test system prompt management
- Test processing mode selection
- Test preset activation
- **~10 test cases**

#### 4. CharacterEditor.vue
- Test character data binding
- Test tag management
- Test save functionality
- Test file upload
- **~8 test cases**

### Client Utils Tests
- Test client-side macro processing (`src/utils/macros.js`)
- Test any other utility functions
- **~6 test cases**

**Total Frontend Tests:** ~44 test cases

## End-to-End Testing Strategy

### Playwright E2E Tests (Headless Browser)

#### 1. Character Import Workflow (`tests/e2e/character-import.spec.js`)
- Navigate to character list
- Upload character PNG file
- Verify character appears in grid
- Click character to open chat
- Verify character name displays correctly
- **~5 test cases** covering drag-drop and file picker

#### 2. Chat Workflow (`tests/e2e/chat-workflow.spec.js`)
- Load character
- Type message and send
- Verify streaming response displays (mocked)
- Test message editing
- Test message deletion
- Save chat and reload
- Verify chat persists correctly
- Test macro rendering in UI
- **~10 test cases**

#### 3. Preset Management (`tests/e2e/preset-management.spec.js`)
- Open preset selector
- Create new preset
- Edit parameters and system prompts
- Activate preset
- Verify preset applies to new chat
- Delete preset
- Import PixiJB config
- **~8 test cases**

#### 4. Image Attachment (`tests/e2e/image-attachment.spec.js`)
- Open image attachment modal
- Upload image
- Verify preview
- Send message with image
- Verify image displays in chat
- **~5 test cases**

#### 5. Lorebook & Persona (`tests/e2e/lorebook-persona.spec.js`)
- Test lorebook creation/editing
- Test persona management
- Test integration with chat
- **~6 test cases**

### E2E Configuration
- Run against `http://localhost:3000` (test server)
- Use test data directory (separate from dev data)
- Mock OpenRouter API at network level
- Screenshots on failure
- Parallel execution for speed

**Total E2E Tests:** ~34 test cases

**Grand Total:** ~153 test cases

## Mocking & Test Data Strategy

### OpenRouter API Mocking

Create `tests/mocks/openrouter.js` with mock responses:
- Streaming chat completion (SSE format)
- Non-streaming chat completion
- Error responses (rate limit, invalid key, timeout)
- Image generation responses

**For Vitest tests:**
- Use `vi.mock()` to intercept `require('./openrouter')`
- Return mock functions with predefined responses
- Test different scenarios (success, failure, timeout)

**For Playwright tests:**
- Use Playwright's `page.route()` to intercept network requests
- Mock `POST https://openrouter.ai/api/v1/chat/completions`
- Return streaming or non-streaming responses
- Simulate latency for realistic testing

### Test Fixtures

`tests/fixtures/` contains sample data files for repeatable testing:

- **characters/**: Sample character PNGs (V2 and V3 format, plus invalid for error testing)
- **chats/**: Sample chat JSON files (basic, with images, with macros)
- **presets/**: Sample preset JSON files (basic, PixiJB format)
- **images/**: Sample images for attachment testing (JPG, PNG)

### Test Data Isolation

- Integration and E2E tests use `data-test/` directory
- Automatically created before tests
- Automatically cleaned after tests
- Never touches actual `data/` directory

## Test Execution & CI/CD Integration

### NPM Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "npm test && npm run test:e2e",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Pre-commit Hook (Husky)

- Install husky: `npm install --save-dev husky`
- `.husky/pre-commit` runs: `npm test`
- Only runs Vitest tests (unit + integration)
- Skips E2E to keep commits fast (<30s)
- Fails commit if tests fail

### Test Server Setup

- Integration tests spawn Express server on random port
- E2E tests expect server running on `localhost:3000`
- Use `start-server-and-test` package to automate:
  ```json
  "test:e2e": "start-server-and-test 'node server/index.js' http://localhost:3000 'playwright test'"
  ```

### Coverage Reporting

- Vitest built-in coverage with `@vitest/coverage-v8`
- Generate HTML reports in `coverage/` directory
- Aim for >80% coverage on critical paths
- Coverage shown in terminal output

### Failure Handling

- Playwright screenshots saved to `test-results/`
- Vitest shows diffs for failed assertions
- Clear error messages for debugging
- Retries for flaky E2E tests (max 2 retries)

## Implementation Phases

### Phase 1: Foundation Setup
1. Install dependencies (vitest, playwright, husky, etc.)
2. Create directory structure
3. Configure vitest.config.js and playwright.config.js
4. Set up test fixtures directory
5. Create OpenRouter API mocks

### Phase 2: Backend Tests
1. Unit tests for macros.js
2. Unit tests for characterCard.js
3. Unit tests for presets.js
4. Unit tests for promptProcessor.js
5. Integration tests for API endpoints

### Phase 3: Frontend Tests
1. Component tests for CharacterList.vue
2. Component tests for ChatView.vue
3. Component tests for PresetSelector.vue
4. Component tests for CharacterEditor.vue
5. Utils tests for client-side macros

### Phase 4: E2E Tests
1. Character import workflow
2. Chat workflow
3. Preset management
4. Image attachment
5. Lorebook and persona

### Phase 5: Automation & CI
1. Set up Husky pre-commit hook
2. Configure test coverage reporting
3. Document testing practices in README
4. Create sample test fixtures

## Success Criteria

- ✅ All ~153 test cases implemented
- ✅ Pre-commit hook prevents broken commits
- ✅ Tests run headlessly without manual intervention
- ✅ >80% code coverage on critical paths
- ✅ All external API calls mocked
- ✅ Tests complete in <30s (unit/integration), <3min (E2E)
- ✅ Clear failure messages for easy debugging
- ✅ Documentation for running and writing tests

## Future Enhancements

- GitHub Actions CI/CD pipeline
- Visual regression testing for UI components
- Performance benchmarking tests
- Mutation testing for test quality verification
- Test result dashboard
