const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const ArchiverZipEncrypted = require('archiver-zip-encrypted');

// Register encrypted zip format
archiver.registerFormat('zip-encrypted', ArchiverZipEncrypted);

/**
 * Generate backup filename with timestamp
 * @returns {string} Filename like "choral-backup-2025-11-11-143052.zip"
 */
function generateBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `choral-backup-${year}-${month}-${day}-${hours}${minutes}${seconds}.zip`;
}

/**
 * List all backup files in directory, sorted by name (oldest first)
 * @param {string} directory - Backup directory path
 * @returns {Promise<string[]>} Array of backup filenames
 */
async function listBackupFiles(directory) {
  try {
    const files = await fs.readdir(directory);
    const backupFiles = files
      .filter(f => f.startsWith('choral-backup-') && f.endsWith('.zip'))
      .sort(); // Timestamp in filename ensures chronological sort
    return backupFiles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

module.exports = {
  generateBackupFilename,
  listBackupFiles
};
