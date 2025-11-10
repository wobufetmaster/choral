import express from 'express';
import path from 'path';
import fs from 'fs';

// Track the current test directory for cleanup
let currentTestDataDir = null;

export function setupTestDataDir() {
  // Create a unique test directory for each test run to avoid race conditions
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const TEST_DATA_DIR = path.join(process.cwd(), `data-test-${uniqueId}`);

  currentTestDataDir = TEST_DATA_DIR;

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

export async function cleanupTestDataDir() {
  if (!currentTestDataDir) {
    return;
  }

  if (fs.existsSync(currentTestDataDir)) {
    try {
      // Increase delay to ensure all file operations complete
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.rmSync(currentTestDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      // Ignore cleanup errors but log them for debugging
      console.warn('Cleanup warning for', currentTestDataDir, ':', error.message);
    }
  }

  currentTestDataDir = null;
}

export function createTestConfig(dataDir) {
  return {
    port: 0, // Let system assign port
    dataDir: dataDir,
    openRouterApiKey: 'test-key',
    activePreset: 'default.json'
  };
}
