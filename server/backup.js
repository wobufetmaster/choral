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

/**
 * Create backup archive of data directory
 * @param {string} sourceDir - Directory to backup (e.g., './data')
 * @param {string} destDir - Destination directory for backup file
 * @param {boolean} encrypt - Whether to encrypt the archive
 * @param {string} password - Password for encryption (if encrypt=true)
 * @returns {Promise<string>} Created backup filename
 */
async function createBackupArchive(sourceDir, destDir, encrypt, password) {
  // Ensure destination directory exists
  await fs.mkdir(destDir, { recursive: true });

  const filename = generateBackupFilename();
  const outputPath = path.join(destDir, filename);

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(outputPath);

    // Create archive with appropriate format
    const archive = encrypt
      ? archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password })
      : archiver('zip', { zlib: { level: 8 } });

    output.on('close', () => {
      console.log(`[Backup] Created ${filename} (${archive.pointer()} bytes)`);
      resolve(filename);
    });

    archive.on('error', (err) => {
      console.error('[Backup] Archive error:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add entire directory to archive, preserving structure
    archive.directory(sourceDir, 'data');

    archive.finalize();
  });
}

/**
 * Delete old backups to maintain retention limit
 * @param {string} directory - Backup directory
 * @param {number} retention - Number of backups to keep
 * @returns {Promise<number>} Number of backups deleted
 */
async function cleanupOldBackups(directory, retention) {
  const backupFiles = await listBackupFiles(directory);

  if (backupFiles.length <= retention) {
    return 0;
  }

  const toDelete = backupFiles.slice(0, backupFiles.length - retention);

  for (const file of toDelete) {
    const filePath = path.join(directory, file);
    await fs.unlink(filePath);
    console.log(`[Backup] Deleted old backup: ${file}`);
  }

  return toDelete.length;
}

module.exports = {
  generateBackupFilename,
  listBackupFiles,
  createBackupArchive,
  cleanupOldBackups
};
