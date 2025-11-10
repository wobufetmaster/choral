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
