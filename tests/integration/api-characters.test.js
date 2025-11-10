import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir, createTestConfig } from './setup.js';
import { createApp } from '../../server/app.js';

describe('Character API Endpoints', () => {
  let app;
  let testDataDir;
  let ensureDirectories;

  beforeEach(async () => {
    testDataDir = setupTestDataDir();
    const config = createTestConfig(testDataDir);
    const appContext = createApp(config);
    app = appContext.app;
    ensureDirectories = appContext.ensureDirectories;
    await ensureDirectories();
  });

  afterEach(async () => {
    await cleanupTestDataDir();
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
        .attach('file', charPath);

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
