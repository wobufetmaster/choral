import { describe, it, expect } from 'vitest';
import { generateBackupFilename, listBackupFiles } from '../../../server/backup.js';

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
});
