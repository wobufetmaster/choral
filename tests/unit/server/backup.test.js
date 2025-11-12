import { describe, it, expect } from 'vitest';
import { generateBackupFilename, listBackupFiles, createBackupArchive } from '../../../server/backup.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Backup Module', () => {
  describe('generateBackupFilename', () => {
    it('should generate filename with timestamp', () => {
      const filename = generateBackupFilename();
      expect(filename).toMatch(/^choral-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/);
    });
  });

  describe('listBackupFiles', () => {
    it('should return empty array for non-existent directory', async () => {
      const files = await listBackupFiles('/nonexistent/path');
      expect(files).toEqual([]);
    });
  });

  describe('createBackupArchive', () => {
    it('should create unencrypted backup archive', async () => {
      const testDataDir = path.join(__dirname, 'test-data');
      const testBackupDir = path.join(__dirname, 'test-backups');

      // Create test data
      await fs.promises.mkdir(testDataDir, { recursive: true });
      await fs.promises.writeFile(path.join(testDataDir, 'test.txt'), 'test content');

      // Create backup
      const filename = await createBackupArchive(testDataDir, testBackupDir, false, '');

      // Verify file exists
      expect(filename).toBeTruthy();
      const backupPath = path.join(testBackupDir, filename);
      const exists = fs.existsSync(backupPath);
      expect(exists).toBe(true);

      // Cleanup
      await fs.promises.rm(testDataDir, { recursive: true });
      await fs.promises.rm(testBackupDir, { recursive: true });
    });
  });
});
