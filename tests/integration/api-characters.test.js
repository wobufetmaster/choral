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
