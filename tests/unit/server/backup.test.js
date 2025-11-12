import { describe, it, expect } from 'vitest';
import { generateBackupFilename, listBackupFiles, createBackupArchive, cleanupOldBackups } from '../../../server/backup.js';
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

  describe('cleanupOldBackups', () => {
    it('should delete oldest backups when exceeding retention limit', async () => {
      const testBackupDir = path.join(__dirname, 'test-backups-cleanup');
      await fs.promises.mkdir(testBackupDir, { recursive: true });

      // Create 5 backup files
      const files = [
        'choral-backup-2025-11-01-120000.zip',
        'choral-backup-2025-11-02-120000.zip',
        'choral-backup-2025-11-03-120000.zip',
        'choral-backup-2025-11-04-120000.zip',
        'choral-backup-2025-11-05-120000.zip'
      ];

      for (const file of files) {
        await fs.promises.writeFile(path.join(testBackupDir, file), 'test');
      }

      // Keep only 3
      const deleted = await cleanupOldBackups(testBackupDir, 3);

      // Verify return value
      expect(deleted).toBe(2);

      // Check that only 3 newest remain
      const remaining = await fs.promises.readdir(testBackupDir);
      expect(remaining.length).toBe(3);
      expect(remaining).toContain('choral-backup-2025-11-05-120000.zip');
      expect(remaining).toContain('choral-backup-2025-11-04-120000.zip');
      expect(remaining).toContain('choral-backup-2025-11-03-120000.zip');

      // Cleanup
      await fs.promises.rm(testBackupDir, { recursive: true });
    });
  });
});
