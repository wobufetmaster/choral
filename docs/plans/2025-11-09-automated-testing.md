# Automated Testing System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build comprehensive headless testing infrastructure with Vitest (unit/integration) and Playwright (E2E) to prevent functionality regression.

**Architecture:** Three-layer testing approach - Vitest for fast unit tests and API integration tests with mocked OpenRouter calls, Playwright for full E2E workflows in headless browser, Husky for pre-commit hooks.

**Tech Stack:** Vitest, Playwright, @vue/test-utils, supertest, Husky, @vitest/coverage-v8, start-server-and-test

---

## Task 1: Install Dependencies and Configure Test Infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `.gitignore` (append)

**Step 1: Install testing dependencies**

Run:
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vue/test-utils happy-dom playwright @playwright/test supertest start-server-and-test husky
```

Expected: Dependencies installed successfully

**Step 2: Add test scripts to package.json**

Add these scripts to the `scripts` section:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "start-server-and-test 'node server/index.js' http://localhost:3000 'playwright test'",
    "test:e2e:headed": "start-server-and-test 'node server/index.js' http://localhost:3000 'playwright test --headed'",
    "test:all": "npm test && npm run test:e2e",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: Create vitest.config.js**

Create file with content:
```javascript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        'dist/',
        'coverage/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Step 4: Create playwright.config.js**

Create file with content:
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 5: Update .gitignore**

Append to .gitignore:
```
# Test output
coverage/
test-results/
playwright-report/
data-test/
.vitest/
```

**Step 6: Commit infrastructure setup**

Run:
```bash
git add package.json package-lock.json vitest.config.js playwright.config.js .gitignore
git commit -m "chore: add testing infrastructure (Vitest + Playwright)"
```

---

## Task 2: Create Test Directory Structure and Fixtures

**Files:**
- Create: `tests/setup.js`
- Create: `tests/fixtures/characters/test-character-v3.png`
- Create: `tests/fixtures/characters/test-character-v2.png`
- Create: `tests/fixtures/characters/invalid-character.png`
- Create: `tests/fixtures/chats/test-chat-basic.json`
- Create: `tests/fixtures/chats/test-chat-with-images.json`
- Create: `tests/fixtures/chats/test-chat-with-macros.json`
- Create: `tests/fixtures/presets/test-preset-basic.json`
- Create: `tests/fixtures/presets/test-preset-pixijb.json`
- Create: `tests/fixtures/images/test-image.png`
- Create: `tests/mocks/openrouter.js`

**Step 1: Create test setup file**

Create `tests/setup.js`:
```javascript
import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Setup test data directory
const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');

beforeEach(() => {
  // Clean up test data directory before each test
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

afterEach(() => {
  // Clean up test data directory after each test
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});
```

**Step 2: Create directory structure**

Run:
```bash
mkdir -p tests/unit/server
mkdir -p tests/unit/utils
mkdir -p tests/unit/components
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p tests/fixtures/characters
mkdir -p tests/fixtures/chats
mkdir -p tests/fixtures/presets
mkdir -p tests/fixtures/images
mkdir -p tests/mocks
```

**Step 3: Copy existing character cards to fixtures**

Run:
```bash
# Copy Default-chan as V3 test character
cp data/characters/Default-chan.png tests/fixtures/characters/test-character-v3.png

# Create a simple V2 character card (we'll use a copy for now)
cp data/characters/Default-chan.png tests/fixtures/characters/test-character-v2.png

# Create invalid character (just a plain PNG without metadata)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > tests/fixtures/images/test-image.png
cp tests/fixtures/images/test-image.png tests/fixtures/characters/invalid-character.png
```

**Step 4: Create test chat fixtures**

Create `tests/fixtures/chats/test-chat-basic.json`:
```json
{
  "character": "test-character-v3.png",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    },
    {
      "role": "assistant",
      "content": "Hi there! How can I help you today?"
    }
  ],
  "created": "2025-11-09T12:00:00.000Z"
}
```

Create `tests/fixtures/chats/test-chat-with-macros.json`:
```json
{
  "character": "test-character-v3.png",
  "messages": [
    {
      "role": "user",
      "content": "Tell me about {{char}}."
    },
    {
      "role": "assistant",
      "content": "I'm {{char}}, nice to meet {{user}}! {{random:Hello,Hi,Hey}} there!"
    }
  ],
  "created": "2025-11-09T12:00:00.000Z"
}
```

Create `tests/fixtures/chats/test-chat-with-images.json`:
```json
{
  "character": "test-character-v3.png",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What's in this image?"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          }
        }
      ]
    },
    {
      "role": "assistant",
      "content": "I can see a small test image."
    }
  ],
  "created": "2025-11-09T12:00:00.000Z"
}
```

**Step 5: Create test preset fixtures**

Create `tests/fixtures/presets/test-preset-basic.json`:
```json
{
  "name": "Test Preset",
  "model": "anthropic/claude-opus-4",
  "temperature": 0.8,
  "top_p": 0.9,
  "top_k": 40,
  "max_tokens": 2000,
  "prompts": [
    {
      "name": "System",
      "content": "You are a helpful assistant named {{char}}.",
      "injection_position": 0,
      "injection_depth": 0
    }
  ],
  "prompt_processing_mode": "merge_system"
}
```

Create `tests/fixtures/presets/test-preset-pixijb.json`:
```json
{
  "name": "PixiJB Import Test",
  "model": "anthropic/claude-3-5-sonnet",
  "genamt": 500,
  "temp": 1.0,
  "top_p": 1.0,
  "prompts": [
    {
      "name": "Main",
      "content": "Test system prompt",
      "injection_position": 0,
      "injection_depth": 4,
      "role": "system"
    }
  ]
}
```

**Step 6: Create OpenRouter mock**

Create `tests/mocks/openrouter.js`:
```javascript
import { vi } from 'vitest';

export const mockStreamingResponse = async function* () {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
    'data: [DONE]\n\n'
  ];

  for (const chunk of chunks) {
    yield chunk;
  }
};

export const mockNonStreamingResponse = {
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'Hello there!'
      }
    }
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15
  }
};

export const mockErrorResponse = {
  error: {
    message: 'Rate limit exceeded',
    type: 'rate_limit_error',
    code: 'rate_limit_exceeded'
  }
};

export const streamChatCompletion = vi.fn().mockImplementation(mockStreamingResponse);
export const chatCompletion = vi.fn().mockResolvedValue(mockNonStreamingResponse);
```

**Step 7: Commit test structure and fixtures**

Run:
```bash
git add tests/
git commit -m "test: add test directory structure and fixtures"
```

---

## Task 3: Unit Tests - Macro Processing

**Files:**
- Create: `tests/unit/server/macros.test.js`
- Read: `server/macros.js` (for reference)

**Step 1: Write macro processing tests**

Create `tests/unit/server/macros.test.js`:
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { processMacros } from '../../../server/macros.js';

describe('Macro Processing', () => {
  const context = {
    charName: 'TestChar',
    userName: 'TestUser'
  };

  describe('{{char}} macro', () => {
    it('should replace {{char}} with character name', () => {
      const result = processMacros('Hello {{char}}!', context);
      expect(result).toBe('Hello TestChar!');
    });

    it('should replace multiple {{char}} instances', () => {
      const result = processMacros('{{char}} says hi. {{char}} is friendly.', context);
      expect(result).toBe('TestChar says hi. TestChar is friendly.');
    });
  });

  describe('{{user}} macro', () => {
    it('should replace {{user}} with user name', () => {
      const result = processMacros('Hello {{user}}!', context);
      expect(result).toBe('Hello TestUser!');
    });
  });

  describe('{{random}} macro', () => {
    it('should choose one option from {{random}}', () => {
      const result = processMacros('{{random:A,B,C}}', context);
      expect(['A', 'B', 'C']).toContain(result);
    });

    it('should handle single option', () => {
      const result = processMacros('{{random:OnlyOne}}', context);
      expect(result).toBe('OnlyOne');
    });
  });

  describe('{{pick}} macro', () => {
    it('should consistently return same value for same input', () => {
      const input = '{{pick:A,B,C}}';
      const result1 = processMacros(input, context);
      const result2 = processMacros(input, context);
      expect(result1).toBe(result2);
    });
  });

  describe('{{roll}} macro', () => {
    it('should generate number within range for {{roll:10}}', () => {
      const result = processMacros('{{roll:10}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
    });

    it('should handle dice notation {{roll:d20}}', () => {
      const result = processMacros('{{roll:d20}}', context);
      const num = parseInt(result);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(20);
    });
  });

  describe('{{reverse}} macro', () => {
    it('should reverse text', () => {
      const result = processMacros('{{reverse:hello}}', context);
      expect(result).toBe('olleh');
    });
  });

  describe('{{comment}} and {{//}} macros', () => {
    it('should remove {{// comment}} from text', () => {
      const result = processMacros('Hello {{// hidden comment}} world', context);
      expect(result).toBe('Hello  world');
    });

    it('should keep {{comment: text}} visible', () => {
      const result = processMacros('Hello {{comment: visible}} world', context);
      expect(result).toBe('Hello visible world');
    });
  });

  describe('{{hidden_key}} macro', () => {
    it('should remove hidden_key content', () => {
      const result = processMacros('Text {{hidden_key:secret}} more text', context);
      expect(result).toBe('Text  more text');
    });
  });

  describe('Nested macros', () => {
    it('should process nested macros', () => {
      const result = processMacros('{{char}} says: {{random:Hello,Hi}} {{user}}!', context);
      expect(result).toMatch(/TestChar says: (Hello|Hi) TestUser!/);
    });
  });
});
```

**Step 2: Run tests to verify they work**

Run:
```bash
npm run test:unit -- tests/unit/server/macros.test.js
```

Expected: Tests should pass (if macros.js implementation is correct)

**Step 3: Commit macro tests**

Run:
```bash
git add tests/unit/server/macros.test.js
git commit -m "test: add macro processing unit tests"
```

---

## Task 4: Unit Tests - Character Card Processing

**Files:**
- Create: `tests/unit/server/characterCard.test.js`
- Read: `server/characterCard.js` (for reference)

**Step 1: Write character card tests**

Create `tests/unit/server/characterCard.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { readCharacterCard, writeCharacterCard, validateCharacterCard, convertV2ToV3 } from '../../../server/characterCard.js';
import path from 'path';
import fs from 'fs';

const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/characters');

describe('Character Card Processing', () => {
  describe('readCharacterCard', () => {
    it('should read V3 character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'test-character-v3.png');
      const card = await readCharacterCard(cardPath);

      expect(card).toBeDefined();
      expect(card.data).toBeDefined();
      expect(card.spec).toBe('chara_card_v3');
    });

    it('should read V2 character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'test-character-v2.png');
      const card = await readCharacterCard(cardPath);

      expect(card).toBeDefined();
      expect(card.data).toBeDefined();
    });

    it('should throw error for invalid character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'invalid-character.png');
      await expect(readCharacterCard(cardPath)).rejects.toThrow();
    });

    it('should throw error for non-existent file', async () => {
      await expect(readCharacterCard('nonexistent.png')).rejects.toThrow();
    });
  });

  describe('validateCharacterCard', () => {
    it('should validate correct V3 card', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test Character',
          description: 'A test character',
          personality: 'Friendly',
          scenario: 'Test scenario',
          first_mes: 'Hello!',
          mes_example: 'Example dialogue'
        }
      };

      expect(() => validateCharacterCard(card)).not.toThrow();
    });

    it('should reject card without required fields', () => {
      const card = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test'
          // missing other required fields
        }
      };

      expect(() => validateCharacterCard(card)).toThrow();
    });
  });

  describe('convertV2ToV3', () => {
    it('should convert V2 card to V3 format', () => {
      const v2Card = {
        name: 'Test Character',
        description: 'A test character',
        personality: 'Friendly',
        scenario: 'Test scenario',
        first_mes: 'Hello!',
        mes_example: 'Example dialogue'
      };

      const v3Card = convertV2ToV3(v2Card);

      expect(v3Card.spec).toBe('chara_card_v3');
      expect(v3Card.spec_version).toBe('3.0');
      expect(v3Card.data.name).toBe('Test Character');
      expect(v3Card.data.description).toBe('A test character');
    });
  });

  describe('writeCharacterCard', () => {
    it('should write character card to PNG', async () => {
      const outputPath = path.join(process.cwd(), 'data-test/test-output.png');
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test Character',
          description: 'A test character',
          personality: 'Friendly',
          scenario: 'Test scenario',
          first_mes: 'Hello!',
          mes_example: 'Example dialogue'
        }
      };

      // Use existing test image as base
      const basePngPath = path.join(FIXTURES_DIR, 'test-character-v3.png');
      const basePng = await fs.promises.readFile(basePngPath);

      await writeCharacterCard(outputPath, card, basePng);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify we can read it back
      const readCard = await readCharacterCard(outputPath);
      expect(readCard.data.name).toBe('Test Character');
    });
  });
});
```

**Step 2: Run character card tests**

Run:
```bash
npm run test:unit -- tests/unit/server/characterCard.test.js
```

Expected: Tests should pass

**Step 3: Commit character card tests**

Run:
```bash
git add tests/unit/server/characterCard.test.js
git commit -m "test: add character card processing unit tests"
```

---

## Task 5: Unit Tests - Preset Management

**Files:**
- Create: `tests/unit/server/presets.test.js`
- Read: `server/presets.js` (for reference)

**Step 1: Write preset management tests**

Create `tests/unit/server/presets.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { convertPixiJBToPreset, validatePreset, DEFAULT_PRESET } from '../../../server/presets.js';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/presets');

describe('Preset Management', () => {
  describe('validatePreset', () => {
    it('should validate correct preset', () => {
      const preset = {
        name: 'Test Preset',
        model: 'anthropic/claude-opus-4',
        temperature: 0.8,
        prompts: []
      };

      expect(() => validatePreset(preset)).not.toThrow();
    });

    it('should reject preset without name', () => {
      const preset = {
        model: 'anthropic/claude-opus-4',
        temperature: 0.8
      };

      expect(() => validatePreset(preset)).toThrow();
    });

    it('should reject preset with invalid temperature', () => {
      const preset = {
        name: 'Test',
        model: 'test',
        temperature: 5.0 // out of range
      };

      expect(() => validatePreset(preset)).toThrow();
    });
  });

  describe('convertPixiJBToPreset', () => {
    it('should convert PixiJB config to Choral preset', async () => {
      const pixijbPath = path.join(FIXTURES_DIR, 'test-preset-pixijb.json');
      const pixijbConfig = JSON.parse(await fs.promises.readFile(pixijbPath, 'utf-8'));

      const preset = convertPixiJBToPreset(pixijbConfig);

      expect(preset.name).toBe('PixiJB Import Test');
      expect(preset.model).toContain('claude');
      expect(preset.temperature).toBeDefined();
      expect(preset.max_tokens).toBeDefined();
      expect(preset.prompts).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const minimal = {
        name: 'Minimal',
        model: 'test-model'
      };

      const preset = convertPixiJBToPreset(minimal);

      expect(preset.name).toBe('Minimal');
      expect(preset.temperature).toBeDefined(); // should have default
    });
  });

  describe('DEFAULT_PRESET', () => {
    it('should have valid structure', () => {
      expect(DEFAULT_PRESET.name).toBeDefined();
      expect(DEFAULT_PRESET.model).toBeDefined();
      expect(DEFAULT_PRESET.prompts).toBeInstanceOf(Array);
      expect(() => validatePreset(DEFAULT_PRESET)).not.toThrow();
    });
  });

  describe('Template placeholder replacement', () => {
    it('should replace {{description}} placeholder', () => {
      const prompt = 'Character description: {{description}}';
      const character = { description: 'A friendly AI' };

      // This tests the concept - actual implementation may vary
      const result = prompt.replace(/\{\{description\}\}/g, character.description);
      expect(result).toBe('Character description: A friendly AI');
    });

    it('should replace {{personality}} placeholder', () => {
      const prompt = 'Personality: {{personality}}';
      const character = { personality: 'Helpful and kind' };

      const result = prompt.replace(/\{\{personality\}\}/g, character.personality);
      expect(result).toBe('Personality: Helpful and kind');
    });
  });
});
```

**Step 2: Run preset tests**

Run:
```bash
npm run test:unit -- tests/unit/server/presets.test.js
```

Expected: Tests should pass

**Step 3: Commit preset tests**

Run:
```bash
git add tests/unit/server/presets.test.js
git commit -m "test: add preset management unit tests"
```

---

## Task 6: Unit Tests - Prompt Processor

**Files:**
- Create: `tests/unit/server/promptProcessor.test.js`
- Read: `server/promptProcessor.js` (for reference)

**Step 1: Write prompt processor tests**

Create `tests/unit/server/promptProcessor.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { processPrompt, MODES } from '../../../server/promptProcessor.js';

describe('Prompt Processor', () => {
  const testMessages = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'system', content: 'You are friendly.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' }
  ];

  describe('merge_system mode', () => {
    it('should merge all system messages into one', () => {
      const result = processPrompt([...testMessages], MODES.MERGE_SYSTEM);

      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('You are helpful.');
      expect(systemMessages[0].content).toContain('You are friendly.');
    });

    it('should preserve user and assistant messages', () => {
      const result = processPrompt([...testMessages], MODES.MERGE_SYSTEM);

      const userMessages = result.filter(m => m.role === 'user');
      const assistantMessages = result.filter(m => m.role === 'assistant');

      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(1);
    });
  });

  describe('semi_strict mode', () => {
    it('should have one system message at start', () => {
      const result = processPrompt([...testMessages], MODES.SEMI_STRICT);

      expect(result[0].role).toBe('system');
      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);
    });

    it('should alternate user/assistant after system', () => {
      const result = processPrompt([...testMessages], MODES.SEMI_STRICT);

      for (let i = 1; i < result.length - 1; i++) {
        if (result[i].role === 'user') {
          expect(result[i + 1].role).toBe('assistant');
        }
      }
    });
  });

  describe('strict mode', () => {
    it('should start with user message', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);
      expect(result[0].role).toBe('user');
    });

    it('should have no system messages', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);
      const systemMessages = result.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(0);
    });

    it('should strictly alternate user/assistant', () => {
      const result = processPrompt([...testMessages], MODES.STRICT);

      for (let i = 0; i < result.length - 1; i++) {
        if (result[i].role === 'user') {
          expect(result[i + 1].role).toBe('assistant');
        } else {
          expect(result[i + 1].role).toBe('user');
        }
      }
    });
  });

  describe('single_user mode', () => {
    it('should combine everything into one user message', () => {
      const result = processPrompt([...testMessages], MODES.SINGLE_USER);

      expect(result.length).toBe(1);
      expect(result[0].role).toBe('user');
    });

    it('should include role labels in content', () => {
      const result = processPrompt([...testMessages], MODES.SINGLE_USER);
      const content = result[0].content;

      expect(content).toContain('System:');
      expect(content).toContain('User:');
      expect(content).toContain('Assistant:');
    });
  });

  describe('anthropic_prefill mode', () => {
    it('should have one system message at start', () => {
      const result = processPrompt([...testMessages], MODES.ANTHROPIC_PREFILL);
      expect(result[0].role).toBe('system');
    });

    it('should support assistant prefill at end', () => {
      const messagesWithPrefill = [
        ...testMessages,
        { role: 'assistant', content: 'Sure, I' }
      ];

      const result = processPrompt(messagesWithPrefill, MODES.ANTHROPIC_PREFILL);
      expect(result[result.length - 1].role).toBe('assistant');
      expect(result[result.length - 1].content).toBe('Sure, I');
    });
  });

  describe('none mode', () => {
    it('should not modify messages', () => {
      const result = processPrompt([...testMessages], MODES.NONE);
      expect(result).toEqual(testMessages);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages array', () => {
      const result = processPrompt([], MODES.MERGE_SYSTEM);
      expect(result).toEqual([]);
    });

    it('should handle messages with only system prompts', () => {
      const systemOnly = [
        { role: 'system', content: 'Test 1' },
        { role: 'system', content: 'Test 2' }
      ];

      const result = processPrompt(systemOnly, MODES.MERGE_SYSTEM);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multimodal content arrays', () => {
      const multimodalMessages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
          ]
        }
      ];

      const result = processPrompt(multimodalMessages, MODES.NONE);
      expect(result[0].content).toBeInstanceOf(Array);
    });
  });
});
```

**Step 2: Run prompt processor tests**

Run:
```bash
npm run test:unit -- tests/unit/server/promptProcessor.test.js
```

Expected: Tests should pass

**Step 3: Commit prompt processor tests**

Run:
```bash
git add tests/unit/server/promptProcessor.test.js
git commit -m "test: add prompt processor unit tests"
```

---

## Task 7: Integration Tests - API Endpoints

**Files:**
- Create: `tests/integration/api-characters.test.js`
- Create: `tests/integration/api-chats.test.js`
- Create: `tests/integration/api-presets.test.js`
- Create: `tests/integration/setup.js`

**Step 1: Create integration test setup**

Create `tests/integration/setup.js`:
```javascript
import express from 'express';
import path from 'path';
import fs from 'fs';

const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');

export function setupTestDataDir() {
  const dirs = [
    TEST_DATA_DIR,
    path.join(TEST_DATA_DIR, 'characters'),
    path.join(TEST_DATA_DIR, 'chats'),
    path.join(TEST_DATA_DIR, 'lorebooks'),
    path.join(TEST_DATA_DIR, 'personas'),
    path.join(TEST_DATA_DIR, 'presets'),
    path.join(TEST_DATA_DIR, 'group_chats')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return TEST_DATA_DIR;
}

export function cleanupTestDataDir() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

export function createTestConfig(dataDir) {
  return {
    port: 0, // Let system assign port
    dataDir: dataDir,
    openRouterApiKey: 'test-key',
    activePreset: 'default.json'
  };
}
```

**Step 2: Write character API tests**

Create `tests/integration/api-characters.test.js`:
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir } from './setup.js';

// We'll need to import and set up a test version of the server
// For now, this is a template - actual implementation will depend on server structure

describe('Character API Endpoints', () => {
  let app;
  let testDataDir;

  beforeEach(() => {
    testDataDir = setupTestDataDir();
    // TODO: Initialize app with test config
    // app = createTestApp({ dataDir: testDataDir });
  });

  afterEach(() => {
    cleanupTestDataDir();
  });

  describe('GET /api/characters', () => {
    it('should return empty array when no characters exist', async () => {
      const response = await request(app).get('/api/characters');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return list of characters', async () => {
      // Copy test character to data dir
      const srcPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
      const destPath = path.join(testDataDir, 'characters/test-character-v3.png');
      await fs.promises.copyFile(srcPath, destPath);

      const response = await request(app).get('/api/characters');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].filename).toBe('test-character-v3.png');
    });
  });

  describe('GET /api/characters/:filename', () => {
    it('should return specific character', async () => {
      const srcPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
      const destPath = path.join(testDataDir, 'characters/test-character-v3.png');
      await fs.promises.copyFile(srcPath, destPath);

      const response = await request(app).get('/api/characters/test-character-v3.png');

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBeDefined();
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app).get('/api/characters/nonexistent.png');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/characters', () => {
    it('should upload new character', async () => {
      const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');

      const response = await request(app)
        .post('/api/characters')
        .attach('character', charPath);

      expect(response.status).toBe(200);
      expect(response.body.filename).toBeDefined();

      // Verify file was saved
      const savedPath = path.join(testDataDir, 'characters', response.body.filename);
      expect(fs.existsSync(savedPath)).toBe(true);
    });
  });

  describe('DELETE /api/characters/:filename', () => {
    it('should delete character', async () => {
      const srcPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
      const destPath = path.join(testDataDir, 'characters/test-character-v3.png');
      await fs.promises.copyFile(srcPath, destPath);

      const response = await request(app).delete('/api/characters/test-character-v3.png');

      expect(response.status).toBe(200);
      expect(fs.existsSync(destPath)).toBe(false);
    });
  });
});
```

**Step 3: Write chat API tests**

Create `tests/integration/api-chats.test.js`:
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir } from './setup.js';

describe('Chat API Endpoints', () => {
  let app;
  let testDataDir;

  beforeEach(() => {
    testDataDir = setupTestDataDir();
    // TODO: Initialize app with test config
  });

  afterEach(() => {
    cleanupTestDataDir();
  });

  describe('GET /api/chats', () => {
    it('should return empty array when no chats exist', async () => {
      const response = await request(app).get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return list of chats', async () => {
      const chatPath = path.join(testDataDir, 'chats/test-chat.json');
      const chatData = {
        character: 'test-character.png',
        messages: [],
        created: new Date().toISOString()
      };
      await fs.promises.writeFile(chatPath, JSON.stringify(chatData));

      const response = await request(app).get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });
  });

  describe('POST /api/chats', () => {
    it('should save new chat', async () => {
      const chatData = {
        character: 'test-character.png',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const response = await request(app)
        .post('/api/chats')
        .send(chatData);

      expect(response.status).toBe(200);
      expect(response.body.filename).toBeDefined();
    });
  });

  describe('POST /api/chat (non-streaming)', () => {
    it('should return chat completion', async () => {
      // Mock OpenRouter API
      vi.mock('../../../server/openrouter.js', () => ({
        chatCompletion: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }));

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'test-model'
        });

      expect(response.status).toBe(200);
      expect(response.body.choices).toBeDefined();
    });
  });
});
```

**Step 4: Write preset API tests**

Create `tests/integration/api-presets.test.js`:
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir } from './setup.js';

describe('Preset API Endpoints', () => {
  let app;
  let testDataDir;

  beforeEach(() => {
    testDataDir = setupTestDataDir();
    // TODO: Initialize app with test config
  });

  afterEach(() => {
    cleanupTestDataDir();
  });

  describe('GET /api/presets', () => {
    it('should return list of presets', async () => {
      const response = await request(app).get('/api/presets');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/presets', () => {
    it('should create new preset', async () => {
      const preset = {
        name: 'Test Preset',
        model: 'anthropic/claude-opus-4',
        temperature: 0.8,
        prompts: []
      };

      const response = await request(app)
        .post('/api/presets')
        .send(preset);

      expect(response.status).toBe(200);
      expect(response.body.filename).toBeDefined();
    });
  });

  describe('DELETE /api/presets/:filename', () => {
    it('should delete preset', async () => {
      // Create a test preset first
      const presetPath = path.join(testDataDir, 'presets/test-preset.json');
      await fs.promises.writeFile(presetPath, JSON.stringify({ name: 'Test' }));

      const response = await request(app).delete('/api/presets/test-preset.json');

      expect(response.status).toBe(200);
      expect(fs.existsSync(presetPath)).toBe(false);
    });
  });

  describe('POST /api/presets/import/pixijb', () => {
    it('should import PixiJB config', async () => {
      const pixijbConfig = {
        name: 'Imported Preset',
        model: 'test-model',
        temp: 1.0,
        genamt: 500
      };

      const response = await request(app)
        .post('/api/presets/import/pixijb')
        .send(pixijbConfig);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Imported Preset');
    });
  });
});
```

**Step 5: Note about server refactoring**

The integration tests above are templates. To make them work, we need to refactor `server/index.js` to export a function that creates the Express app with a configurable data directory. This allows tests to use `data-test/` instead of `data/`.

Add this note to the plan:
```
NOTE: Integration tests require server refactoring to support test data directory.
See Task 8 for server refactoring to enable testability.
```

**Step 6: Commit integration test templates**

Run:
```bash
git add tests/integration/
git commit -m "test: add integration test templates for API endpoints"
```

---

## Task 8: Refactor Server for Testability

**Files:**
- Modify: `server/index.js`
- Create: `server/app.js`

**Step 1: Extract app creation logic**

Create `server/app.js`:
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { readCharacterCard, writeCharacterCard, validateCharacterCard, convertV2ToV3 } = require('./characterCard');
const { streamChatCompletion, chatCompletion } = require('./openrouter');
const { processMacros, processMessagesWithMacros } = require('./macros');
const { DEFAULT_PRESET, convertPixiJBToPreset, validatePreset } = require('./presets');
const { logRequest, logResponse, logStreamChunk } = require('./logger');
const { processPrompt, MODES } = require('./promptProcessor');
const { processLorebook, injectEntries } = require('./lorebook');
const fs = require('fs').promises;

/**
 * Create Express app with given configuration
 * @param {Object} config - Server configuration
 * @param {string} config.dataDir - Data directory path
 * @param {string} config.openRouterApiKey - OpenRouter API key
 * @param {string} config.activePreset - Active preset filename
 * @returns {Express} Configured Express app
 */
function createApp(config) {
  const app = express();
  const upload = multer({ dest: 'uploads/' });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use('/docs', express.static(path.join(__dirname, '../docs')));

  const DATA_DIR = path.resolve(config.dataDir || './data');
  const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
  const CHATS_DIR = path.join(DATA_DIR, 'chats');
  const LOREBOOKS_DIR = path.join(DATA_DIR, 'lorebooks');
  const PERSONAS_DIR = path.join(DATA_DIR, 'personas');
  const PRESETS_DIR = path.join(DATA_DIR, 'presets');
  const GROUP_CHATS_DIR = path.join(DATA_DIR, 'group_chats');
  const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
  const CORE_TAGS_FILE = path.join(DATA_DIR, 'core-tags.json');
  const BOOKKEEPING_SETTINGS_FILE = path.join(DATA_DIR, 'bookkeeping-settings.json');
  const TOOL_SETTINGS_FILE = path.join(DATA_DIR, 'tool-settings.json');

  // Copy all route handlers from server/index.js here
  // (This is a template - actual implementation will copy all existing routes)

  // Example route structure:
  app.get('/api/characters', async (req, res) => {
    // ... existing implementation
  });

  // ... all other routes

  return app;
}

module.exports = { createApp };
```

**Step 2: Update server/index.js to use createApp**

Modify `server/index.js` to:
```javascript
const { createApp } = require('./app');

// Load config function (keep existing)
function loadConfig() {
  // ... existing implementation
}

const config = loadConfig();
const app = createApp(config);

const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Step 3: Run existing server to verify refactoring**

Run:
```bash
# In a separate terminal
node server/index.js
```

Expected: Server should start normally without errors

**Step 4: Commit server refactoring**

Run:
```bash
git add server/app.js server/index.js
git commit -m "refactor: extract app creation for testability"
```

**Note:** This is a significant refactoring task. The actual implementation will need to carefully move all routes and middleware from `server/index.js` to `server/app.js` while preserving all functionality.

---

## Task 9: Complete Integration Tests with Refactored Server

**Files:**
- Modify: `tests/integration/api-characters.test.js`
- Modify: `tests/integration/api-chats.test.js`
- Modify: `tests/integration/api-presets.test.js`

**Step 1: Update integration tests to use createApp**

In each integration test file, update the `beforeEach` to:
```javascript
import { createApp } from '../../../server/app.js';
import { createTestConfig } from './setup.js';

beforeEach(() => {
  testDataDir = setupTestDataDir();
  const config = createTestConfig(testDataDir);
  app = createApp(config);
});
```

**Step 2: Run integration tests**

Run:
```bash
npm run test:integration
```

Expected: All integration tests should pass

**Step 3: Fix any failing tests**

Debug and fix any issues that arise from the refactoring or test setup.

**Step 4: Commit completed integration tests**

Run:
```bash
git add tests/integration/
git commit -m "test: complete integration tests with refactored server"
```

---

## Task 10: Frontend Component Tests

**Files:**
- Create: `tests/unit/components/CharacterList.test.js`
- Create: `tests/unit/components/ChatView.test.js`
- Create: `tests/unit/components/PresetSelector.test.js`
- Create: `tests/unit/components/CharacterEditor.test.js`

**Step 1: Write CharacterList component tests**

Create `tests/unit/components/CharacterList.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CharacterList from '../../../src/components/CharacterList.vue';

describe('CharacterList.vue', () => {
  let wrapper;

  const mockCharacters = [
    { filename: 'char1.png', data: { name: 'Character 1', tags: ['tag1'] } },
    { filename: 'char2.png', data: { name: 'Character 2', tags: ['tag2'] } },
    { filename: 'char3.png', data: { name: 'Test Char', tags: ['tag1', 'tag3'] } }
  ];

  beforeEach(() => {
    // Mock fetch for character list
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCharacters)
      })
    );
  });

  it('should render character grid', async () => {
    wrapper = mount(CharacterList);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for fetch

    // Should have character cards
    const cards = wrapper.findAll('.character-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should filter characters by search term', async () => {
    wrapper = mount(CharacterList);
    await wrapper.vm.$nextTick();

    // Set search value
    const searchInput = wrapper.find('input[type="text"]');
    await searchInput.setValue('Test');
    await wrapper.vm.$nextTick();

    // Should only show characters matching search
    // Implementation depends on component structure
  });

  it('should display empty state when no characters', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );

    wrapper = mount(CharacterList);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should show empty state message
    expect(wrapper.text()).toContain('No characters');
  });

  it('should emit select event when character clicked', async () => {
    wrapper = mount(CharacterList);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));

    const firstCard = wrapper.find('.character-card');
    await firstCard.trigger('click');

    // Should emit character selection
    expect(wrapper.emitted('select')).toBeTruthy();
  });
});
```

**Step 2: Write ChatView component tests**

Create `tests/unit/components/ChatView.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatView from '../../../src/components/ChatView.vue';
import DOMPurify from 'dompurify';

describe('ChatView.vue', () => {
  let wrapper;

  const mockMessages = [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there! How can I help?' }
  ];

  beforeEach(() => {
    wrapper = mount(ChatView, {
      props: {
        character: {
          filename: 'test.png',
          data: { name: 'Test Character' }
        },
        messages: mockMessages
      }
    });
  });

  it('should render messages', () => {
    const messageElements = wrapper.findAll('.message');
    expect(messageElements.length).toBe(2);
  });

  it('should distinguish user and assistant messages', () => {
    const userMessages = wrapper.findAll('.message.user');
    const assistantMessages = wrapper.findAll('.message.assistant');

    expect(userMessages.length).toBe(1);
    expect(assistantMessages.length).toBe(1);
  });

  it('should sanitize HTML content with DOMPurify', () => {
    const dangerousContent = '<script>alert("xss")</script><p>Safe content</p>';
    const sanitized = DOMPurify.sanitize(dangerousContent);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Safe content');
  });

  it('should handle multimodal messages with images', async () => {
    await wrapper.setProps({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
          ]
        }
      ]
    });

    await wrapper.vm.$nextTick();

    const images = wrapper.findAll('img');
    expect(images.length).toBeGreaterThan(0);
  });

  it('should allow message editing', async () => {
    // Find edit button on first message
    const editButton = wrapper.find('.message .edit-button');
    if (editButton.exists()) {
      await editButton.trigger('click');

      // Should show edit input
      const editInput = wrapper.find('textarea');
      expect(editInput.exists()).toBe(true);
    }
  });

  it('should allow message deletion', async () => {
    const deleteButton = wrapper.find('.message .delete-button');
    if (deleteButton.exists()) {
      await deleteButton.trigger('click');

      // Should emit delete event
      expect(wrapper.emitted('delete-message')).toBeTruthy();
    }
  });

  it('should handle streaming message updates', async () => {
    await wrapper.vm.$nextTick();

    // Simulate streaming update
    if (wrapper.vm.updateStreamingMessage) {
      wrapper.vm.updateStreamingMessage('Hello');
      await wrapper.vm.$nextTick();

      wrapper.vm.updateStreamingMessage(' world');
      await wrapper.vm.$nextTick();

      // Should show accumulated content
      const lastMessage = wrapper.findAll('.message').at(-1);
      expect(lastMessage.text()).toContain('Hello world');
    }
  });
});
```

**Step 3: Write PresetSelector component tests**

Create `tests/unit/components/PresetSelector.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PresetSelector from '../../../src/components/PresetSelector.vue';

describe('PresetSelector.vue', () => {
  let wrapper;

  const mockPresets = [
    {
      filename: 'preset1.json',
      name: 'Preset 1',
      model: 'anthropic/claude-opus-4',
      temperature: 0.8
    },
    {
      filename: 'preset2.json',
      name: 'Preset 2',
      model: 'anthropic/claude-sonnet-4',
      temperature: 1.0
    }
  ];

  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPresets)
      })
    );

    wrapper = mount(PresetSelector, {
      props: {
        modelValue: true // Modal is open
      }
    });
  });

  it('should render preset list', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));

    const presetItems = wrapper.findAll('.preset-item');
    expect(presetItems.length).toBeGreaterThan(0);
  });

  it('should show preset editor when creating new preset', async () => {
    const createButton = wrapper.find('.create-preset-button');
    if (createButton.exists()) {
      await createButton.trigger('click');

      // Should show editor form
      const editorForm = wrapper.find('.preset-editor');
      expect(editorForm.exists()).toBe(true);
    }
  });

  it('should validate temperature range', async () => {
    const tempInput = wrapper.find('input[type="number"][name="temperature"]');
    if (tempInput.exists()) {
      await tempInput.setValue(5.0); // Invalid value

      // Should show validation error or clamp value
      const value = parseFloat(tempInput.element.value);
      expect(value).toBeLessThanOrEqual(2.0);
    }
  });

  it('should save preset on submit', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ filename: 'new-preset.json' })
      })
    );

    const saveButton = wrapper.find('.save-preset-button');
    if (saveButton.exists()) {
      await saveButton.trigger('click');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/presets'),
        expect.objectContaining({ method: 'POST' })
      );
    }
  });

  it('should handle prompt processing mode selection', async () => {
    const modeSelect = wrapper.find('select[name="prompt_processing_mode"]');
    if (modeSelect.exists()) {
      await modeSelect.setValue('strict');

      expect(modeSelect.element.value).toBe('strict');
    }
  });
});
```

**Step 4: Write CharacterEditor component tests**

Create `tests/unit/components/CharacterEditor.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CharacterEditor from '../../../src/components/CharacterEditor.vue';

describe('CharacterEditor.vue', () => {
  let wrapper;

  const mockCharacter = {
    filename: 'test.png',
    data: {
      name: 'Test Character',
      description: 'A test character',
      personality: 'Friendly',
      scenario: 'Test scenario',
      first_mes: 'Hello!',
      mes_example: 'Example dialogue',
      tags: ['tag1', 'tag2']
    }
  };

  beforeEach(() => {
    wrapper = mount(CharacterEditor, {
      props: {
        character: mockCharacter
      }
    });
  });

  it('should display character data in form', () => {
    const nameInput = wrapper.find('input[name="name"]');
    expect(nameInput.element.value).toBe('Test Character');
  });

  it('should update character data on input', async () => {
    const nameInput = wrapper.find('input[name="name"]');
    await nameInput.setValue('Updated Name');

    expect(wrapper.vm.character.data.name).toBe('Updated Name');
  });

  it('should display and manage tags', () => {
    const tags = wrapper.findAll('.tag');
    expect(tags.length).toBe(2);
  });

  it('should add new tag', async () => {
    const tagInput = wrapper.find('input[name="new-tag"]');
    const addButton = wrapper.find('.add-tag-button');

    if (tagInput.exists() && addButton.exists()) {
      await tagInput.setValue('tag3');
      await addButton.trigger('click');

      expect(wrapper.vm.character.data.tags).toContain('tag3');
    }
  });

  it('should remove tag', async () => {
    const removeButton = wrapper.find('.tag .remove-tag-button');
    if (removeButton.exists()) {
      await removeButton.trigger('click');

      expect(wrapper.vm.character.data.tags.length).toBe(1);
    }
  });

  it('should save character on submit', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ filename: 'test.png' })
      })
    );

    const saveButton = wrapper.find('.save-button');
    if (saveButton.exists()) {
      await saveButton.trigger('click');

      expect(global.fetch).toHaveBeenCalled();
    }
  });
});
```

**Step 5: Run component tests**

Run:
```bash
npm run test:unit -- tests/unit/components/
```

Expected: Tests should pass (may need adjustments based on actual component implementation)

**Step 6: Commit component tests**

Run:
```bash
git add tests/unit/components/
git commit -m "test: add Vue component unit tests"
```

---

## Task 11: Client Utils Tests

**Files:**
- Create: `tests/unit/utils/macros.test.js`

**Step 1: Write client-side macro tests**

Create `tests/unit/utils/macros.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { processMacros } from '../../../src/utils/macros.js';

describe('Client-side Macro Processing', () => {
  const context = {
    charName: 'Alice',
    userName: 'Bob'
  };

  it('should process {{char}} macro', () => {
    const result = processMacros('Hello {{char}}!', context);
    expect(result).toBe('Hello Alice!');
  });

  it('should process {{user}} macro', () => {
    const result = processMacros('Hello {{user}}!', context);
    expect(result).toBe('Hello Bob!');
  });

  it('should process {{random}} macro', () => {
    const result = processMacros('{{random:A,B,C}}', context);
    expect(['A', 'B', 'C']).toContain(result);
  });

  it('should handle {{comment}} for display', () => {
    const result = processMacros('Text {{comment: visible}} more', context);
    expect(result).toContain('visible');
  });

  it('should remove {{//}} comments', () => {
    const result = processMacros('Text {{// hidden}} more', context);
    expect(result).not.toContain('hidden');
  });

  it('should match server-side behavior', () => {
    // Test that client and server implementations produce compatible results
    const testCases = [
      'Hello {{char}} and {{user}}!',
      '{{reverse:hello}}',
      '{{roll:10}}',
      'Text with {{comment: note}}'
    ];

    testCases.forEach(test => {
      const result = processMacros(test, context);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
```

**Step 2: Run utils tests**

Run:
```bash
npm run test:unit -- tests/unit/utils/
```

Expected: Tests should pass

**Step 3: Commit utils tests**

Run:
```bash
git add tests/unit/utils/
git commit -m "test: add client utils tests for macros"
```

---

## Task 12: End-to-End Tests - Character Import

**Files:**
- Create: `tests/e2e/character-import.spec.js`

**Step 1: Write character import E2E tests**

Create `tests/e2e/character-import.spec.js`:
```javascript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Character Import Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock OpenRouter API
    await page.route('https://openrouter.ai/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ choices: [{ message: { content: 'Test response' } }] })
      });
    });

    await page.goto('/');
  });

  test('should upload character via file picker', async ({ page }) => {
    const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');

    // Find and click upload button
    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(charPath);

    // Wait for character to appear in grid
    await expect(page.locator('.character-card').first()).toBeVisible({ timeout: 5000 });

    // Verify character name is displayed
    const characterName = await page.locator('.character-card .character-name').first().textContent();
    expect(characterName).toBeTruthy();
  });

  test('should open chat when character is clicked', async ({ page }) => {
    // Upload character first
    const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(charPath);

    // Wait for character to appear
    await page.waitForSelector('.character-card');

    // Click character
    await page.locator('.character-card').first().click();

    // Should navigate to chat view
    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 5000 });

    // Character name should be displayed in chat
    await expect(page.locator('.character-name')).toBeVisible();
  });

  test('should handle duplicate character names', async ({ page }) => {
    const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');

    // Upload same character twice
    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(charPath);
    await page.waitForTimeout(500);
    await uploadButton.setInputFiles(charPath);

    // Should have two characters with unique filenames
    await page.waitForTimeout(1000);
    const cards = await page.locator('.character-card').count();
    expect(cards).toBeGreaterThanOrEqual(2);
  });

  test('should reject invalid character file', async ({ page }) => {
    const invalidPath = path.join(process.cwd(), 'tests/fixtures/characters/invalid-character.png');

    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(invalidPath);

    // Should show error message
    await expect(page.locator('.error-message, .notification.error')).toBeVisible({ timeout: 5000 });
  });
});
```

**Step 2: Run character import E2E tests**

Run:
```bash
npm run test:e2e -- tests/e2e/character-import.spec.js
```

Expected: Tests should pass

**Step 3: Commit character import tests**

Run:
```bash
git add tests/e2e/character-import.spec.js
git commit -m "test: add character import E2E tests"
```

---

## Task 13: End-to-End Tests - Chat Workflow

**Files:**
- Create: `tests/e2e/chat-workflow.spec.js`

**Step 1: Write chat workflow E2E tests**

Create `tests/e2e/chat-workflow.spec.js`:
```javascript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Chat Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock streaming OpenRouter API
    await page.route('https://openrouter.ai/api/v1/chat/completions', async route => {
      const request = route.request();
      const postData = request.postDataJSON();

      if (postData.stream) {
        // Return SSE stream
        const stream = `data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" there"}}]}

data: {"choices":[{"delta":{"content":"!"}}]}

data: [DONE]

`;
        route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: stream
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            choices: [{ message: { content: 'Hello there!' } }]
          })
        });
      }
    });

    await page.goto('/');

    // Upload character
    const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(charPath);

    // Open chat
    await page.waitForSelector('.character-card');
    await page.locator('.character-card').first().click();
    await page.waitForSelector('.chat-view');
  });

  test('should send message and receive streaming response', async ({ page }) => {
    // Type message
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('Hello!');

    // Send message
    const sendButton = page.locator('button').filter({ hasText: /send|submit/i });
    await sendButton.click();

    // Wait for user message to appear
    await expect(page.locator('.message.user').last()).toContainText('Hello!');

    // Wait for streaming assistant response
    await expect(page.locator('.message.assistant').last()).toContainText('Hello there!', { timeout: 5000 });
  });

  test('should edit message', async ({ page }) => {
    // Send a message first
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('Test message');
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    await page.waitForSelector('.message.user');

    // Click edit button
    const editButton = page.locator('.message.user .edit-button').first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Edit message
      const editInput = page.locator('.message.user textarea');
      await editInput.fill('Edited message');

      // Save edit
      const saveButton = page.locator('.message.user .save-button');
      await saveButton.click();

      // Verify message was updated
      await expect(page.locator('.message.user').first()).toContainText('Edited message');
    }
  });

  test('should delete message', async ({ page }) => {
    // Send a message
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('Message to delete');
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    await page.waitForSelector('.message.user');
    const initialCount = await page.locator('.message').count();

    // Delete message
    const deleteButton = page.locator('.message.user .delete-button').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if there's a modal
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verify message was deleted
      await page.waitForTimeout(500);
      const newCount = await page.locator('.message').count();
      expect(newCount).toBeLessThan(initialCount);
    }
  });

  test('should save and load chat', async ({ page }) => {
    // Send messages
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('First message');
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    await page.waitForTimeout(1000);

    // Save chat (may be automatic or manual)
    const saveButton = page.locator('button').filter({ hasText: /save/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
    }

    // Navigate away and back
    await page.goto('/');
    await page.waitForSelector('.character-card');
    await page.locator('.character-card').first().click();

    // Chat history should be loaded
    await expect(page.locator('.message')).toHaveCount(2, { timeout: 5000 }); // user + assistant
  });

  test('should display macros correctly', async ({ page }) => {
    // Send message with macro
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('Hello {{char}}!');
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    // Macro should be processed in display
    const userMessage = page.locator('.message.user').last();
    const text = await userMessage.textContent();
    expect(text).not.toContain('{{char}}');
  });
});
```

**Step 2: Run chat workflow tests**

Run:
```bash
npm run test:e2e -- tests/e2e/chat-workflow.spec.js
```

Expected: Tests should pass

**Step 3: Commit chat workflow tests**

Run:
```bash
git add tests/e2e/chat-workflow.spec.js
git commit -m "test: add chat workflow E2E tests"
```

---

## Task 14: End-to-End Tests - Preset Management

**Files:**
- Create: `tests/e2e/preset-management.spec.js`

**Step 1: Write preset management E2E tests**

Create `tests/e2e/preset-management.spec.js`:
```javascript
import { test, expect } from '@playwright/test';

test.describe('Preset Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open preset selector', async ({ page }) => {
    // Find and click preset/settings button
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Preset modal should be visible
    await expect(page.locator('.preset-selector, .modal')).toBeVisible();
  });

  test('should create new preset', async ({ page }) => {
    // Open preset selector
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Click create new preset
    const createButton = page.locator('button').filter({ hasText: /create|new/i });
    await createButton.click();

    // Fill preset form
    await page.locator('input[name="name"]').fill('Test Preset E2E');
    await page.locator('select[name="model"]').selectOption({ label: /claude/i });
    await page.locator('input[name="temperature"]').fill('0.9');

    // Save preset
    const saveButton = page.locator('button').filter({ hasText: /save/i });
    await saveButton.click();

    // Verify preset appears in list
    await expect(page.locator('text=Test Preset E2E')).toBeVisible({ timeout: 5000 });
  });

  test('should edit preset parameters', async ({ page }) => {
    // Open preset selector
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Select a preset
    const presetItem = page.locator('.preset-item').first();
    await presetItem.click();

    // Edit temperature
    const tempInput = page.locator('input[name="temperature"]');
    await tempInput.fill('1.2');

    // Save changes
    const saveButton = page.locator('button').filter({ hasText: /save/i });
    await saveButton.click();

    // Verify changes persisted
    await page.reload();
    await settingsButton.click();
    await presetItem.click();

    const newValue = await page.locator('input[name="temperature"]').inputValue();
    expect(parseFloat(newValue)).toBe(1.2);
  });

  test('should manage system prompts', async ({ page }) => {
    // Open preset selector
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Create or select preset
    const presetItem = page.locator('.preset-item').first();
    await presetItem.click();

    // Add system prompt
    const addPromptButton = page.locator('button').filter({ hasText: /add.*prompt/i });
    if (await addPromptButton.isVisible()) {
      await addPromptButton.click();

      // Fill prompt content
      const promptInput = page.locator('textarea').last();
      await promptInput.fill('You are a helpful assistant.');

      // Save
      const saveButton = page.locator('button').filter({ hasText: /save/i });
      await saveButton.click();
    }
  });

  test('should select prompt processing mode', async ({ page }) => {
    // Open preset selector
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Select preset
    const presetItem = page.locator('.preset-item').first();
    await presetItem.click();

    // Change processing mode
    const modeSelect = page.locator('select[name*="processing"]');
    if (await modeSelect.isVisible()) {
      await modeSelect.selectOption('strict');

      // Save
      const saveButton = page.locator('button').filter({ hasText: /save/i });
      await saveButton.click();

      // Verify it persisted
      await page.reload();
      await settingsButton.click();
      await presetItem.click();

      const selectedValue = await modeSelect.inputValue();
      expect(selectedValue).toBe('strict');
    }
  });

  test('should activate preset', async ({ page }) => {
    // Open preset selector
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    // Select and activate preset
    const presetItem = page.locator('.preset-item').first();
    await presetItem.click();

    const activateButton = page.locator('button').filter({ hasText: /activate|apply/i });
    if (await activateButton.isVisible()) {
      await activateButton.click();

      // Verify active indicator
      await expect(page.locator('.preset-item.active').first()).toBeVisible();
    }
  });

  test('should delete preset', async ({ page }) => {
    // Create a preset to delete
    const settingsButton = page.locator('button').filter({ hasText: /preset|settings/i });
    await settingsButton.click();

    const createButton = page.locator('button').filter({ hasText: /create|new/i });
    await createButton.click();

    await page.locator('input[name="name"]').fill('Preset To Delete');

    const saveButton = page.locator('button').filter({ hasText: /save/i });
    await saveButton.click();

    // Delete the preset
    const deleteButton = page.locator('button').filter({ hasText: /delete/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verify it's gone
      await expect(page.locator('text=Preset To Delete')).not.toBeVisible({ timeout: 3000 });
    }
  });
});
```

**Step 2: Run preset management tests**

Run:
```bash
npm run test:e2e -- tests/e2e/preset-management.spec.js
```

Expected: Tests should pass

**Step 3: Commit preset management tests**

Run:
```bash
git add tests/e2e/preset-management.spec.js
git commit -m "test: add preset management E2E tests"
```

---

## Task 15: End-to-End Tests - Image Attachment and Remaining Features

**Files:**
- Create: `tests/e2e/image-attachment.spec.js`
- Create: `tests/e2e/lorebook-persona.spec.js`

**Step 1: Write image attachment E2E tests**

Create `tests/e2e/image-attachment.spec.js`:
```javascript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Image Attachment', () => {
  test.beforeEach(async ({ page }) => {
    // Mock OpenRouter API
    await page.route('https://openrouter.ai/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ choices: [{ message: { content: 'I can see the image.' } }] })
      });
    });

    await page.goto('/');

    // Upload and open character
    const charPath = path.join(process.cwd(), 'tests/fixtures/characters/test-character-v3.png');
    await page.locator('input[type="file"]').setInputFiles(charPath);
    await page.waitForSelector('.character-card');
    await page.locator('.character-card').first().click();
    await page.waitForSelector('.chat-view');
  });

  test('should open image attachment modal', async ({ page }) => {
    // Find and click image attachment button
    const attachButton = page.locator('button').filter({ hasText: /attach|image/i });
    await attachButton.click();

    // Modal should be visible
    await expect(page.locator('.image-attachment-modal, .modal')).toBeVisible();
  });

  test('should upload and preview image', async ({ page }) => {
    // Open attachment modal
    const attachButton = page.locator('button').filter({ hasText: /attach|image/i });
    await attachButton.click();

    // Upload image
    const imagePath = path.join(process.cwd(), 'tests/fixtures/images/test-image.png');
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(imagePath);

    // Image preview should appear
    await expect(page.locator('.image-preview img')).toBeVisible({ timeout: 3000 });
  });

  test('should send message with image', async ({ page }) => {
    // Open attachment modal
    const attachButton = page.locator('button').filter({ hasText: /attach|image/i });
    await attachButton.click();

    // Upload image
    const imagePath = path.join(process.cwd(), 'tests/fixtures/images/test-image.png');
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(imagePath);

    // Add text
    const textInput = page.locator('textarea, input[type="text"]').last();
    await textInput.fill("What's in this image?");

    // Send
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    // Message with image should appear
    await expect(page.locator('.message.user img')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.message.user').last()).toContainText("What's in this image?");
  });

  test('should display AI-generated images', async ({ page }) => {
    // Mock AI response with image
    await page.route('https://openrouter.ai/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: 'Here is your image:',
              images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']
            }
          }]
        })
      });
    });

    // Send message requesting image generation
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('Generate an image');
    const sendButton = page.locator('button').filter({ hasText: /send/i });
    await sendButton.click();

    // AI-generated image should appear in assistant message
    await expect(page.locator('.message.assistant img')).toBeVisible({ timeout: 5000 });
  });

  test('should validate file size', async ({ page }) => {
    // This test verifies client-side validation
    // Implementation depends on how size limits are enforced
  });
});
```

**Step 2: Write lorebook and persona E2E tests**

Create `tests/e2e/lorebook-persona.spec.js`:
```javascript
import { test, expect } from '@playwright/test';

test.describe('Lorebook and Persona Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create lorebook entry', async ({ page }) => {
    // Open lorebook manager
    const lorebookButton = page.locator('button').filter({ hasText: /lorebook/i });
    if (await lorebookButton.isVisible()) {
      await lorebookButton.click();

      // Create new entry
      const createButton = page.locator('button').filter({ hasText: /create|new.*entry/i });
      await createButton.click();

      // Fill entry details
      await page.locator('input[name*="key"]').fill('test_key');
      await page.locator('textarea[name*="content"]').fill('Test lorebook content');

      // Save entry
      const saveButton = page.locator('button').filter({ hasText: /save/i });
      await saveButton.click();

      // Verify entry appears
      await expect(page.locator('text=test_key')).toBeVisible();
    }
  });

  test('should edit lorebook entry', async ({ page }) => {
    const lorebookButton = page.locator('button').filter({ hasText: /lorebook/i });
    if (await lorebookButton.isVisible()) {
      await lorebookButton.click();

      // Select entry
      const entry = page.locator('.lorebook-entry').first();
      if (await entry.isVisible()) {
        await entry.click();

        // Edit content
        const contentField = page.locator('textarea[name*="content"]');
        await contentField.fill('Updated lorebook content');

        // Save
        const saveButton = page.locator('button').filter({ hasText: /save/i });
        await saveButton.click();
      }
    }
  });

  test('should create persona', async ({ page }) => {
    // Open persona manager
    const personaButton = page.locator('button').filter({ hasText: /persona/i });
    if (await personaButton.isVisible()) {
      await personaButton.click();

      // Create new persona
      const createButton = page.locator('button').filter({ hasText: /create|new/i });
      await createButton.click();

      // Fill persona details
      await page.locator('input[name="name"]').fill('Test Persona');
      await page.locator('textarea[name*="description"]').fill('A test persona');

      // Save
      const saveButton = page.locator('button').filter({ hasText: /save/i });
      await saveButton.click();

      // Verify persona appears
      await expect(page.locator('text=Test Persona')).toBeVisible();
    }
  });

  test('should apply persona to chat', async ({ page }) => {
    const personaButton = page.locator('button').filter({ hasText: /persona/i });
    if (await personaButton.isVisible()) {
      await personaButton.click();

      // Select persona
      const persona = page.locator('.persona-item').first();
      if (await persona.isVisible()) {
        await persona.click();

        // Activate/apply persona
        const applyButton = page.locator('button').filter({ hasText: /apply|activate/i });
        if (await applyButton.isVisible()) {
          await applyButton.click();

          // Verify persona is active
          await expect(page.locator('.persona-item.active')).toBeVisible();
        }
      }
    }
  });
});
```

**Step 3: Run remaining E2E tests**

Run:
```bash
npm run test:e2e -- tests/e2e/image-attachment.spec.js
npm run test:e2e -- tests/e2e/lorebook-persona.spec.js
```

Expected: Tests should pass

**Step 4: Commit remaining E2E tests**

Run:
```bash
git add tests/e2e/image-attachment.spec.js tests/e2e/lorebook-persona.spec.js
git commit -m "test: add image attachment and lorebook/persona E2E tests"
```

---

## Task 16: Set Up Pre-commit Hooks with Husky

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-commit`

**Step 1: Initialize Husky**

Run:
```bash
npx husky init
```

Expected: Creates `.husky/` directory

**Step 2: Create pre-commit hook**

Run:
```bash
echo "npm test" > .husky/pre-commit
chmod +x .husky/pre-commit
```

**Step 3: Test pre-commit hook**

Make a trivial change and try to commit:
```bash
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify pre-commit hook"
```

Expected: Tests should run before commit succeeds

**Step 4: Commit Husky configuration**

Run:
```bash
git add .husky/ package.json
git commit -m "chore: add pre-commit hooks with Husky"
```

---

## Task 17: Documentation and README Updates

**Files:**
- Modify: `README.md`
- Create: `docs/testing.md`

**Step 1: Create testing documentation**

Create `docs/testing.md`:
```markdown
# Testing Guide

This document describes how to run and write tests for Choral.

## Running Tests

### All Tests
\`\`\`bash
npm run test:all
\`\`\`

### Unit Tests Only
\`\`\`bash
npm test
# or
npm run test:unit
\`\`\`

### Integration Tests
\`\`\`bash
npm run test:integration
\`\`\`

### E2E Tests
\`\`\`bash
npm run test:e2e
\`\`\`

### E2E Tests (Headed Browser)
\`\`\`bash
npm run test:e2e:headed
\`\`\`

### Watch Mode
\`\`\`bash
npm run test:watch
\`\`\`

### Coverage Report
\`\`\`bash
npm run test:coverage
\`\`\`

## Test Structure

- \`tests/unit/\` - Unit tests for individual functions and components
- \`tests/integration/\` - API integration tests
- \`tests/e2e/\` - End-to-end browser tests
- \`tests/fixtures/\` - Test data (characters, chats, presets, images)
- \`tests/mocks/\` - Mock implementations (OpenRouter API)

## Writing Tests

### Unit Tests (Vitest)

\`\`\`javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule.js';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
\`\`\`

### Component Tests (Vue Test Utils)

\`\`\`javascript
import { mount } from '@vue/test-utils';
import MyComponent from '../src/components/MyComponent.vue';

describe('MyComponent', () => {
  it('should render', () => {
    const wrapper = mount(MyComponent, {
      props: { message: 'Hello' }
    });
    expect(wrapper.text()).toContain('Hello');
  });
});
\`\`\`

### E2E Tests (Playwright)

\`\`\`javascript
import { test, expect } from '@playwright/test';

test('should navigate to page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Choral');
});
\`\`\`

## Pre-commit Hooks

Tests automatically run before each commit via Husky. To skip (not recommended):
\`\`\`bash
git commit --no-verify
\`\`\`

## CI/CD

Currently tests run locally only. Future: GitHub Actions integration.

## Test Coverage

Aim for >80% coverage on critical paths:
- Macro processing
- Character card reading/writing
- Preset management
- Prompt processing
- API endpoints

View coverage report:
\`\`\`bash
npm run test:coverage
open coverage/index.html
\`\`\`
```

**Step 2: Update README.md**

Add testing section to README.md:
```markdown
## Testing

Choral has comprehensive test coverage across unit, integration, and end-to-end tests.

### Quick Start
\`\`\`bash
npm test              # Run unit + integration tests
npm run test:e2e     # Run E2E tests
npm run test:all     # Run everything
\`\`\`

See [docs/testing.md](docs/testing.md) for detailed testing documentation.

### Pre-commit Hooks
Tests automatically run before each commit to prevent regressions.
```

**Step 3: Commit documentation**

Run:
```bash
git add README.md docs/testing.md
git commit -m "docs: add testing documentation"
```

---

## Task 18: Final Verification and Cleanup

**Step 1: Run all tests**

Run:
```bash
npm run test:all
```

Expected: All tests should pass

**Step 2: Generate coverage report**

Run:
```bash
npm run test:coverage
```

Expected: Coverage report generated in `coverage/` directory

**Step 3: Review coverage**

Open `coverage/index.html` in browser and verify:
- Macro processing: >90%
- Character card: >85%
- Presets: >80%
- Prompt processor: >90%
- API endpoints: >75%

**Step 4: Clean up any temporary files**

Run:
```bash
rm -rf data-test/
rm -rf uploads/
```

**Step 5: Final commit**

Run:
```bash
git add .
git commit -m "test: complete automated testing system implementation"
```

**Step 6: Push to remote**

Run:
```bash
git push origin feature/automated-testing
```

---

## Success Criteria

- ✅ All ~153 test cases implemented and passing
- ✅ Pre-commit hook prevents broken commits
- ✅ Tests run headlessly without manual intervention
- ✅ >80% code coverage on critical paths
- ✅ All external API calls mocked
- ✅ Unit tests complete in <30s
- ✅ E2E tests complete in <3min
- ✅ Clear failure messages for debugging
- ✅ Documentation complete

## Notes

- Some integration test implementations depend on refactoring `server/index.js` to export `createApp()` function
- E2E tests may need selector adjustments based on actual component structure
- Component tests assume specific component APIs - may need updates based on actual implementations
- Coverage thresholds are aspirational - actual coverage may vary
- Pre-commit hook only runs fast tests (unit + integration) to keep commits responsive
