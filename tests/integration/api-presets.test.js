import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir, createTestConfig } from './setup.js';
import { createApp } from '../../server/app.js';

describe('Preset API Endpoints', () => {
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
      expect(response.body.success).toBe(true);
      expect(response.body.preset.name).toBe('Imported PixiJB Preset');
      expect(response.body.filename).toBe('imported_pixijb.json');
    });
  });
});
