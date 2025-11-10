import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Global test setup (only for unit tests, not integration tests)
// Integration tests manage their own data directories

afterEach(() => {
  // Restore mocks after each test
  vi.restoreAllMocks();
});