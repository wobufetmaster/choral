# Testing Guide

This document describes how to run and write tests for Choral.

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests Only
```bash
npm test
# or
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### E2E Tests (Headed Browser)
```bash
npm run test:e2e:headed
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Structure

- `tests/unit/` - Unit tests for individual functions and components
- `tests/integration/` - API integration tests
- `tests/e2e/` - End-to-end browser tests
- `tests/fixtures/` - Test data (characters, chats, presets, images)
- `tests/mocks/` - Mock implementations (OpenRouter API)

## Writing Tests

### Unit Tests (Vitest)

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule.js';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Component Tests (Vue Test Utils)

```javascript
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
```

### E2E Tests (Playwright)

```javascript
import { test, expect } from '@playwright/test';

test('should navigate to page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Choral');
});
```

## Pre-commit Hooks

Tests automatically run before each commit via Husky. To skip (not recommended):
```bash
git commit --no-verify
```

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
```bash
npm run test:coverage
open coverage/index.html
```
