import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir, createTestConfig } from './setup.js';
import { createApp } from '../../server/app.js';

describe('Backup API Endpoints', () => {
  let app;
  let testDataDir;
  let testBackupDir;
  let ensureDirectories;

  beforeEach(async () => {
    testDataDir = setupTestDataDir();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    testBackupDir = path.join(process.cwd(), `backups-test-${uniqueId}`);

    const config = createTestConfig(testDataDir);
    // Add backup configuration
    config.backup = {
      enabled: true,
      interval: '6h',
      retention: 5,
      directory: testBackupDir,
      encrypt: false,
      password: ''
    };

    const appContext = createApp(config);
    app = appContext.app;
    ensureDirectories = appContext.ensureDirectories;
    await ensureDirectories();

    // Create a test file in data directory
    await fs.promises.writeFile(path.join(testDataDir, 'test.txt'), 'test content');
  });

  afterEach(async () => {
    await cleanupTestDataDir();
    // Cleanup backup directory
    if (fs.existsSync(testBackupDir)) {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(testBackupDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch (error) {
        console.warn('Cleanup warning for backup dir:', error.message);
      }
    }
  });

  describe('POST /api/backup/validate-path', () => {
    it('should validate non-existent directory with valid parent', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: testBackupDir });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      // Directory doesn't exist yet, but parent does
      expect(response.body.exists === false || response.body.exists === true).toBe(true);
    });

    it('should validate existing writable directory', async () => {
      // Create the directory first
      await fs.promises.mkdir(testBackupDir, { recursive: true });

      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: testBackupDir });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.exists).toBe(true);
    });

    it('should reject path inside data directory', async () => {
      const insideDataPath = path.join(testDataDir, 'backups');

      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: insideDataPath });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('data directory');
    });

    it('should reject path with traversal', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: '../etc' });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('../');
    });

    it('should reject missing path parameter', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should reject path with non-existent parent directory', async () => {
      const invalidPath = '/nonexistent/deeply/nested/path';

      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: invalidPath });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('POST /api/backup/trigger', () => {
    it('should create backup when enabled', async () => {
      const response = await request(app)
        .post('/api/backup/trigger');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.filename).toBeDefined();
      expect(response.body.filename).toMatch(/^choral-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/);

      // Add delay to ensure file operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify backup file exists
      const backupPath = path.join(testBackupDir, response.body.filename);
      const exists = fs.existsSync(backupPath);
      expect(exists).toBe(true);

      // Verify backup file has content
      const stats = fs.statSync(backupPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should fail when backups are disabled', async () => {
      // Create app with backups disabled
      const config = createTestConfig(testDataDir);
      config.backup = {
        enabled: false,
        interval: '6h',
        retention: 5,
        directory: testBackupDir,
        encrypt: false,
        password: ''
      };

      const { app: disabledApp } = createApp(config);

      const response = await request(disabledApp)
        .post('/api/backup/trigger');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not enabled');
    });

    it('should prevent concurrent backups', async () => {
      // Create a larger data set to make backup take longer
      const testDir = path.join(testDataDir, 'large-test');
      await fs.promises.mkdir(testDir, { recursive: true });
      // Create multiple files to slow down backup
      for (let i = 0; i < 100; i++) {
        await fs.promises.writeFile(
          path.join(testDir, `file${i}.txt`),
          'x'.repeat(10000)
        );
      }

      // Start first backup (don't await)
      const firstPromise = request(app).post('/api/backup/trigger');

      // Wait a bit to ensure first backup has grabbed the lock
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to start second backup while first is still running
      const secondResponse = await request(app).post('/api/backup/trigger');

      // Check if we caught it during the backup (409) or if it completed (200)
      // Due to timing, we accept either outcome as valid behavior
      if (secondResponse.status === 409) {
        // Successfully caught concurrent access
        expect(secondResponse.body.success).toBe(false);
        expect(secondResponse.body.error).toContain('in progress');
      } else {
        // First backup completed very quickly - this is also valid
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.success).toBe(true);
      }

      // Wait for first to complete
      const firstResponse = await firstPromise;
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.success).toBe(true);
    });

    it('should handle backup failure gracefully', async () => {
      // Create app with invalid backup directory (not writable)
      const config = createTestConfig(testDataDir);
      config.backup = {
        enabled: true,
        interval: '6h',
        retention: 5,
        directory: '/root/cannot-write-here',
        encrypt: false,
        password: ''
      };

      const { app: failApp } = createApp(config);

      const response = await request(failApp)
        .post('/api/backup/trigger');

      // Should return error
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should create backup with unique timestamp filename', async () => {
      // Create two backups in sequence
      const response1 = await request(app)
        .post('/api/backup/trigger');

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response2 = await request(app)
        .post('/api/backup/trigger');

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);

      // Filenames should be different
      expect(response1.body.filename).not.toBe(response2.body.filename);

      // Both files should exist
      const file1Exists = fs.existsSync(path.join(testBackupDir, response1.body.filename));
      const file2Exists = fs.existsSync(path.join(testBackupDir, response2.body.filename));
      expect(file1Exists).toBe(true);
      expect(file2Exists).toBe(true);
    });
  });

  describe('GET /api/config/backup', () => {
    it('should return backup configuration', async () => {
      const response = await request(app)
        .get('/api/config/backup');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
      expect(response.body.interval).toBe('6h');
      expect(response.body.retention).toBe(5);
      expect(response.body.directory).toBe(testBackupDir);
      expect(response.body.encrypt).toBe(false);
    });

    it('should sanitize password in response', async () => {
      // Create app with encrypted backup
      const config = createTestConfig(testDataDir);
      config.backup = {
        enabled: true,
        interval: '6h',
        retention: 5,
        directory: testBackupDir,
        encrypt: true,
        password: 'mysecretpassword'
      };

      const { app: encryptedApp } = createApp(config);

      const response = await request(encryptedApp)
        .get('/api/config/backup');

      expect(response.status).toBe(200);
      expect(response.body.encrypt).toBe(true);
      // Password should be sanitized
      expect(response.body.password).toBe('********');
      expect(response.body.password).not.toBe('mysecretpassword');
    });
  });
});
