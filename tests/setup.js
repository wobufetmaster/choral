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