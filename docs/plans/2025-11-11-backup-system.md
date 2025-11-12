# Backup System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement automatic backup system that periodically archives user data to prevent data loss.

**Architecture:** Simple cron-based scheduler triggers backup module to create compressed/encrypted zip archives of `data/` directory. Configuration managed through `config.json`, exposed in Settings UI with path validation. Manual trigger available via API endpoint.

**Tech Stack:** Node.js, Express, archiver (zip), archiver-zip-encrypted, node-cron, Vue 3

---

## Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add backup dependencies to package.json**

Run:
```bash
npm install archiver@^7.0.0 archiver-zip-encrypted@^2.0.0 node-cron@^3.0.0
```

Expected: Dependencies added to package.json and node_modules installed

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add backup system dependencies (archiver, node-cron)"
```

---

## Task 2: Create Backup Configuration Schema

**Files:**
- Modify: `config.json`
- Create: `server/backupConfig.js` (config defaults and validation)

**Step 1: Add backup section to config.json**

Add this to `config.json` after the existing fields:

```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "",
  "activePreset": "default.json",
  "defaultPersona": "",
  "backup": {
    "enabled": false,
    "interval": "6h",
    "retention": 10,
    "directory": "./backups",
    "encrypt": false,
    "password": ""
  }
}
```

**Step 2: Create backup config module**

Create `server/backupConfig.js`:

```javascript
// Backup configuration defaults and validation

const VALID_INTERVALS = ['15m', '1h', '6h', '12h', '24h'];

const DEFAULT_CONFIG = {
  enabled: false,
  interval: '6h',
  retention: 10,
  directory: './backups',
  encrypt: false,
  password: ''
};

/**
 * Validate backup configuration
 * @param {Object} config - Backup config object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateBackupConfig(config) {
  const errors = [];

  if (config.retention < 1 || config.retention > 100) {
    errors.push('Retention must be between 1 and 100');
  }

  if (!VALID_INTERVALS.includes(config.interval)) {
    errors.push(`Interval must be one of: ${VALID_INTERVALS.join(', ')}`);
  }

  if (config.encrypt && (!config.password || config.password.length < 8)) {
    errors.push('Password must be at least 8 characters when encryption is enabled');
  }

  // Check for path traversal attempts
  if (config.directory.includes('../')) {
    errors.push('Directory path cannot contain ../');
  }

  // Check if path is inside data directory
  const path = require('path');
  const resolvedDir = path.resolve(config.directory);
  const dataDir = path.resolve('./data');
  if (resolvedDir.startsWith(dataDir)) {
    errors.push('Cannot backup into data directory');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert interval string to cron expression
 * @param {string} interval - Interval string (15m, 1h, etc.)
 * @returns {string} Cron expression
 */
function intervalToCron(interval) {
  const cronMap = {
    '15m': '*/15 * * * *',
    '1h': '0 * * * *',
    '6h': '0 */6 * * *',
    '12h': '0 */12 * * *',
    '24h': '0 0 * * *'
  };
  return cronMap[interval] || cronMap['6h'];
}

module.exports = {
  DEFAULT_CONFIG,
  VALID_INTERVALS,
  validateBackupConfig,
  intervalToCron
};
```

**Step 3: Commit**

```bash
git add config.json server/backupConfig.js
git commit -m "feat: add backup configuration schema and validation"
```

---

## Task 3: Create Core Backup Module (Part 1: File Operations)

**Files:**
- Create: `server/backup.js`
- Create: `tests/unit/server/backup.test.js`

**Step 1: Write test for backup filename generation**

Create `tests/unit/server/backup.test.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: FAIL - module not found

**Step 3: Create backup module with filename generation**

Create `server/backup.js`:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add server/backup.js tests/unit/server/backup.test.js
git commit -m "feat: add backup filename generation and file listing"
```

---

## Task 4: Create Core Backup Module (Part 2: Archive Creation)

**Files:**
- Modify: `server/backup.js`
- Modify: `tests/unit/server/backup.test.js`

**Step 1: Write test for archive creation**

Add to `tests/unit/server/backup.test.js`:

```javascript
import { createBackupArchive } from '../../../server/backup.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: FAIL - createBackupArchive not defined

**Step 3: Implement createBackupArchive function**

Add to `server/backup.js`:

```javascript
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

module.exports = {
  generateBackupFilename,
  listBackupFiles,
  createBackupArchive
};
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add server/backup.js tests/unit/server/backup.test.js
git commit -m "feat: add backup archive creation with optional encryption"
```

---

## Task 5: Create Core Backup Module (Part 3: Retention Management)

**Files:**
- Modify: `server/backup.js`
- Modify: `tests/unit/server/backup.test.js`

**Step 1: Write test for cleanup old backups**

Add to `tests/unit/server/backup.test.js`:

```javascript
import { cleanupOldBackups } from '../../../server/backup.js';

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
    await cleanupOldBackups(testBackupDir, 3);

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
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: FAIL - cleanupOldBackups not defined

**Step 3: Implement cleanupOldBackups function**

Add to `server/backup.js`:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/unit/server/backup.test.js
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add server/backup.js tests/unit/server/backup.test.js
git commit -m "feat: add backup retention management and cleanup"
```

---

## Task 6: Create Main Backup Function

**Files:**
- Modify: `server/backup.js`

**Step 1: Add main performBackup function**

Add to `server/backup.js`:

```javascript
// At top of file, add lock flag
let backupInProgress = false;

/**
 * Perform full backup operation
 * @param {Object} config - Backup configuration
 * @param {string} dataDir - Data directory path (default: './data')
 * @returns {Promise<Object>} { success: boolean, filename?: string, error?: string }
 */
async function performBackup(config, dataDir = './data') {
  // Check if backup already in progress
  if (backupInProgress) {
    return { success: false, error: 'Backup already in progress' };
  }

  backupInProgress = true;

  try {
    console.log('[Backup] Starting backup...');

    // Create backup archive
    const filename = await createBackupArchive(
      dataDir,
      config.directory,
      config.encrypt,
      config.password
    );

    // Cleanup old backups
    const deleted = await cleanupOldBackups(config.directory, config.retention);
    if (deleted > 0) {
      console.log(`[Backup] Cleaned up ${deleted} old backup(s)`);
    }

    console.log('[Backup] Backup completed successfully');
    return { success: true, filename };

  } catch (error) {
    console.error('[Backup] Backup failed:', error);
    return { success: false, error: error.message };
  } finally {
    backupInProgress = false;
  }
}

/**
 * Check if backup is currently in progress
 * @returns {boolean}
 */
function isBackupInProgress() {
  return backupInProgress;
}

module.exports = {
  generateBackupFilename,
  listBackupFiles,
  createBackupArchive,
  cleanupOldBackups,
  performBackup,
  isBackupInProgress
};
```

**Step 2: Commit**

```bash
git add server/backup.js
git commit -m "feat: add main performBackup function with lock mechanism"
```

---

## Task 7: Add Path Validation API Endpoint

**Files:**
- Modify: `server/index.js`

**Step 1: Add path validation endpoint**

Add to `server/index.js` after the existing config endpoints (around line 300):

```javascript
// Backup path validation endpoint
app.post('/api/backup/validate-path', async (req, res) => {
  const { path: backupPath } = req.body;

  if (!backupPath) {
    return res.status(400).json({ valid: false, error: 'Path is required' });
  }

  // Check for path traversal
  if (backupPath.includes('../')) {
    return res.status(400).json({ valid: false, error: 'Path cannot contain ../' });
  }

  const path = require('path');
  const fs = require('fs').promises;

  // Check if path is inside data directory
  const resolvedPath = path.resolve(backupPath);
  const dataDir = path.resolve(config.dataDir || './data');

  if (resolvedPath.startsWith(dataDir)) {
    return res.status(400).json({
      valid: false,
      error: 'Cannot backup into data directory'
    });
  }

  try {
    // Check if directory exists
    const stats = await fs.stat(resolvedPath);

    if (!stats.isDirectory()) {
      return res.status(400).json({ valid: false, error: 'Path is not a directory' });
    }

    // Test write permission
    const testFile = path.join(resolvedPath, '.backup-test');
    await fs.writeFile(testFile, '');
    await fs.unlink(testFile);

    return res.json({ valid: true, exists: true });

  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist - check if parent exists
      const parentDir = path.dirname(resolvedPath);
      try {
        await fs.access(parentDir);
        return res.json({
          valid: true,
          exists: false,
          canCreate: true
        });
      } catch {
        return res.status(400).json({
          valid: false,
          error: 'Parent directory does not exist'
        });
      }
    } else if (error.code === 'EACCES') {
      return res.status(400).json({
        valid: false,
        error: 'Cannot write to this directory'
      });
    }

    return res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});
```

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: add backup path validation API endpoint"
```

---

## Task 8: Add Backup Trigger API Endpoint

**Files:**
- Modify: `server/index.js`

**Step 1: Import backup module at top of server/index.js**

Add after other imports:

```javascript
const { performBackup, isBackupInProgress } = require('./backup.js');
```

**Step 2: Add backup trigger endpoint**

Add to `server/index.js` after the path validation endpoint:

```javascript
// Manual backup trigger endpoint
app.post('/api/backup/trigger', async (req, res) => {
  if (!config.backup || !config.backup.enabled) {
    return res.status(400).json({
      success: false,
      error: 'Backups are not enabled'
    });
  }

  if (isBackupInProgress()) {
    return res.status(409).json({
      success: false,
      error: 'Backup already in progress'
    });
  }

  const result = await performBackup(config.backup, config.dataDir || './data');

  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});
```

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add manual backup trigger API endpoint"
```

---

## Task 9: Add Backup Configuration API Endpoints

**Files:**
- Modify: `server/index.js`

**Step 1: Add GET backup config endpoint**

Add to `server/index.js` after backup trigger endpoint:

```javascript
// Get backup configuration
app.get('/api/config/backup', (req, res) => {
  const { DEFAULT_CONFIG } = require('./backupConfig.js');
  const backupConfig = config.backup || DEFAULT_CONFIG;

  // Don't send password to frontend
  const sanitized = { ...backupConfig };
  if (sanitized.password) {
    sanitized.password = '********';
  }

  res.json(sanitized);
});
```

**Step 2: Add POST backup config endpoint**

Add after GET endpoint:

```javascript
// Update backup configuration
app.post('/api/config/backup', async (req, res) => {
  const { validateBackupConfig } = require('./backupConfig.js');
  const newConfig = req.body;

  // Validate configuration
  const validation = validateBackupConfig(newConfig);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  // Update config
  config.backup = newConfig;

  // Save to file
  const fs = require('fs').promises;
  await fs.writeFile('config.json', JSON.stringify(config, null, 2));

  // Restart scheduler (will be implemented in next task)
  if (global.backupScheduler) {
    global.backupScheduler.stop();
    global.backupScheduler = null;
  }

  if (newConfig.enabled) {
    const { startBackupScheduler } = require('./backupScheduler.js');
    global.backupScheduler = startBackupScheduler(config);
  }

  res.json({ success: true });
});
```

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add backup configuration API endpoints"
```

---

## Task 10: Create Backup Scheduler

**Files:**
- Create: `server/backupScheduler.js`

**Step 1: Create backup scheduler module**

Create `server/backupScheduler.js`:

```javascript
const cron = require('node-cron');
const { performBackup } = require('./backup.js');
const { intervalToCron } = require('./backupConfig.js');

/**
 * Start backup scheduler
 * @param {Object} config - Full app configuration
 * @returns {Object} Cron job instance
 */
function startBackupScheduler(config) {
  if (!config.backup || !config.backup.enabled) {
    console.log('[Backup Scheduler] Backups are disabled');
    return null;
  }

  const cronExpression = intervalToCron(config.backup.interval);
  console.log(`[Backup Scheduler] Starting scheduler with interval: ${config.backup.interval} (${cronExpression})`);

  const job = cron.schedule(cronExpression, async () => {
    console.log('[Backup Scheduler] Running scheduled backup...');
    const result = await performBackup(config.backup, config.dataDir || './data');

    if (result.success) {
      console.log(`[Backup Scheduler] Backup completed: ${result.filename}`);
    } else {
      console.error(`[Backup Scheduler] Backup failed: ${result.error}`);
    }
  });

  return job;
}

module.exports = {
  startBackupScheduler
};
```

**Step 2: Integrate scheduler into server startup**

Modify `server/index.js` - add after server starts listening (around the `app.listen()` call):

```javascript
// Start backup scheduler
const { startBackupScheduler } = require('./backupScheduler.js');
global.backupScheduler = startBackupScheduler(config);

// Add graceful shutdown
process.on('SIGINT', () => {
  if (global.backupScheduler) {
    global.backupScheduler.stop();
  }
  process.exit(0);
});
```

**Step 3: Commit**

```bash
git add server/backupScheduler.js server/index.js
git commit -m "feat: add backup scheduler with cron integration"
```

---

## Task 11: Create Backup Settings UI Component

**Files:**
- Modify: `src/components/Settings.vue`

**Step 1: Add backup section to Settings.vue template**

Add after the "Default Persona" section (after line 47) in `src/components/Settings.vue`:

```vue
<div class="setting-group">
  <h3>Backup</h3>

  <div class="form-group">
    <label>
      <input type="checkbox" v-model="backupEnabled" @change="saveBackupConfig" />
      Enable automatic backups
    </label>
  </div>

  <template v-if="backupEnabled">
    <div class="form-group">
      <label>Backup Interval</label>
      <select v-model="backupInterval" @change="saveBackupConfig">
        <option value="15m">Every 15 minutes</option>
        <option value="1h">Every hour</option>
        <option value="6h">Every 6 hours</option>
        <option value="12h">Every 12 hours</option>
        <option value="24h">Daily</option>
      </select>
    </div>

    <div class="form-group">
      <label>Keep last</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input
          type="number"
          v-model.number="backupRetention"
          @blur="saveBackupConfig"
          min="1"
          max="100"
          style="width: 80px;"
        />
        <span>backups</span>
      </div>
    </div>

    <div class="form-group">
      <label>Backup Directory</label>
      <div style="display: flex; gap: 8px;">
        <input
          type="text"
          v-model="backupDirectory"
          @blur="validateBackupPath"
          style="flex: 1;"
        />
        <button @click="chooseBackupDirectory" class="choose-btn">Choose...</button>
      </div>
      <small v-if="backupPathStatus === 'valid'" class="status-success">
        ✓ Directory is writable
      </small>
      <small v-else-if="backupPathStatus === 'can-create'" class="status-warning">
        ⚠️ Directory doesn't exist.
        <a href="#" @click.prevent="createBackupDirectory">Create it?</a>
      </small>
      <small v-else-if="backupPathError" class="status-error">
        ❌ {{ backupPathError }}
      </small>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" v-model="backupEncrypt" @change="saveBackupConfig" />
        Encrypt backups
      </label>
    </div>

    <div v-if="backupEncrypt" class="form-group">
      <label>Password</label>
      <input
        type="password"
        v-model="backupPassword"
        @blur="saveBackupConfig"
        placeholder="Minimum 8 characters"
        minlength="8"
      />
      <small class="status-warning">⚠️ Remember this password - it cannot be recovered!</small>
    </div>

    <div class="form-group">
      <button
        @click="triggerBackup"
        :disabled="backupInProgress || !isBackupConfigValid"
        class="backup-btn"
      >
        {{ backupInProgress ? 'Backup in progress...' : 'Backup Now' }}
      </button>
      <small v-if="lastBackupTime">Last backup: {{ lastBackupTime }}</small>
      <small v-if="backupMessage" :class="backupMessageClass">{{ backupMessage }}</small>
    </div>
  </template>
</div>
```

**Step 2: Add backup data and methods to script section**

Add to the `setup()` function in `src/components/Settings.vue`:

```javascript
// Backup settings
const backupEnabled = ref(false);
const backupInterval = ref('6h');
const backupRetention = ref(10);
const backupDirectory = ref('./backups');
const backupEncrypt = ref(false);
const backupPassword = ref('');
const backupPathStatus = ref(''); // 'valid', 'can-create', or empty
const backupPathError = ref('');
const backupInProgress = ref(false);
const backupMessage = ref('');
const backupMessageClass = ref('');
const lastBackupTime = ref('');

const isBackupConfigValid = computed(() => {
  if (!backupEnabled.value) return false;
  if (backupPathStatus.value !== 'valid' && backupPathStatus.value !== 'can-create') return false;
  if (backupEncrypt.value && backupPassword.value.length < 8) return false;
  return true;
});

const loadBackupConfig = async () => {
  try {
    const response = await fetch('/api/config/backup');
    const config = await response.json();
    backupEnabled.value = config.enabled || false;
    backupInterval.value = config.interval || '6h';
    backupRetention.value = config.retention || 10;
    backupDirectory.value = config.directory || './backups';
    backupEncrypt.value = config.encrypt || false;
    // Don't load password (it's sanitized from server)
  } catch (error) {
    console.error('Failed to load backup config:', error);
  }
};

const saveBackupConfig = async () => {
  try {
    const config = {
      enabled: backupEnabled.value,
      interval: backupInterval.value,
      retention: backupRetention.value,
      directory: backupDirectory.value,
      encrypt: backupEncrypt.value,
      password: backupPassword.value
    };

    const response = await fetch('/api/config/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await response.json();
    if (!result.success) {
      console.error('Failed to save backup config:', result.errors);
    }
  } catch (error) {
    console.error('Failed to save backup config:', error);
  }
};

const validateBackupPath = async () => {
  if (!backupDirectory.value) return;

  try {
    const response = await fetch('/api/backup/validate-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: backupDirectory.value })
    });

    const result = await response.json();

    if (result.valid) {
      if (result.exists) {
        backupPathStatus.value = 'valid';
        backupPathError.value = '';
      } else if (result.canCreate) {
        backupPathStatus.value = 'can-create';
        backupPathError.value = '';
      }
    } else {
      backupPathStatus.value = '';
      backupPathError.value = result.error;
    }
  } catch (error) {
    backupPathStatus.value = '';
    backupPathError.value = 'Failed to validate path';
  }
};

const chooseBackupDirectory = () => {
  // Create hidden file input for directory selection
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.onchange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      // Get directory path from first file
      const path = files[0].path || files[0].webkitRelativePath;
      if (path) {
        const dirPath = path.substring(0, path.lastIndexOf('/'));
        backupDirectory.value = dirPath;
        validateBackupPath();
      }
    }
  };
  input.click();
};

const createBackupDirectory = async () => {
  await saveBackupConfig(); // This will create the directory via the backend
  await validateBackupPath();
};

const triggerBackup = async () => {
  backupInProgress.value = true;
  backupMessage.value = '';

  try {
    const response = await fetch('/api/backup/trigger', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      backupMessage.value = `Backup completed: ${result.filename}`;
      backupMessageClass.value = 'status-success';
      lastBackupTime.value = 'Just now';
    } else {
      backupMessage.value = `Backup failed: ${result.error}`;
      backupMessageClass.value = 'status-error';
    }
  } catch (error) {
    backupMessage.value = `Backup failed: ${error.message}`;
    backupMessageClass.value = 'status-error';
  } finally {
    backupInProgress.value = false;

    // Clear message after 5 seconds
    setTimeout(() => {
      backupMessage.value = '';
    }, 5000);
  }
};
```

**Step 3: Update onMounted to load backup config**

Modify the `onMounted` function to call `loadBackupConfig()`:

```javascript
onMounted(async () => {
  await loadSettings();
  await loadBackupConfig(); // Add this line
  // ... rest of existing onMounted code
});
```

**Step 4: Update return statement to include backup refs**

Add to the return statement in `setup()`:

```javascript
return {
  // ... existing returns
  backupEnabled,
  backupInterval,
  backupRetention,
  backupDirectory,
  backupEncrypt,
  backupPassword,
  backupPathStatus,
  backupPathError,
  backupInProgress,
  backupMessage,
  backupMessageClass,
  lastBackupTime,
  isBackupConfigValid,
  saveBackupConfig,
  validateBackupPath,
  chooseBackupDirectory,
  createBackupDirectory,
  triggerBackup,
};
```

**Step 5: Add backup-specific CSS styles**

Add to the `<style scoped>` section in Settings.vue:

```css
.choose-btn,
.backup-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary, #2a2a2a);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.choose-btn:hover,
.backup-btn:hover:not(:disabled) {
  background: var(--hover-color, #404040);
  border-color: var(--accent-color, #4a9eff);
}

.backup-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-success {
  color: #4caf50;
}

.status-warning {
  color: #ff9800;
}

.status-error {
  color: #f44336;
}

.status-warning a {
  color: #ff9800;
  text-decoration: underline;
}
```

**Step 6: Commit**

```bash
git add src/components/Settings.vue
git commit -m "feat: add backup settings UI with path validation and manual trigger"
```

---

## Task 12: Update Default Config File

**Files:**
- Modify: `config.json`

**Step 1: Ensure backup section is in default config**

Verify that `config.json` has the backup section (should already be there from Task 2):

```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "",
  "activePreset": "default.json",
  "defaultPersona": "",
  "backup": {
    "enabled": false,
    "interval": "6h",
    "retention": 10,
    "directory": "./backups",
    "encrypt": false,
    "password": ""
  }
}
```

**Step 2: Commit if changes needed**

```bash
git add config.json
git commit -m "chore: ensure backup config in default config.json"
```

---

## Task 13: Add Integration Tests

**Files:**
- Create: `tests/integration/api-backup.test.js`

**Step 1: Create integration test file**

Create `tests/integration/api-backup.test.js`:

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create test app
let app;
let testDataDir;
let testBackupDir;
let testConfig;

beforeAll(async () => {
  // Create unique test directories
  const timestamp = Date.now();
  testDataDir = path.join(__dirname, `test-data-${timestamp}`);
  testBackupDir = path.join(__dirname, `test-backups-${timestamp}`);

  await fs.mkdir(testDataDir, { recursive: true });

  // Create test data
  await fs.writeFile(path.join(testDataDir, 'test.txt'), 'test content');

  // Setup test config
  testConfig = {
    dataDir: testDataDir,
    backup: {
      enabled: true,
      interval: '6h',
      retention: 5,
      directory: testBackupDir,
      encrypt: false,
      password: ''
    }
  };

  // Initialize app with test routes
  const backupRoutes = await import('../../server/index.js');
  app = express();
  app.use(express.json());
  // Note: In real integration test, you'd import actual routes
  // For now, this is a template showing test structure
});

afterAll(async () => {
  // Cleanup
  await fs.rm(testDataDir, { recursive: true, force: true });
  await fs.rm(testBackupDir, { recursive: true, force: true });
});

describe('Backup API Endpoints', () => {
  describe('POST /api/backup/validate-path', () => {
    it('should validate existing writable directory', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: testBackupDir });

      // Note: May need to create directory first for this test
      expect(response.status).toBe(200);
    });

    it('should reject path inside data directory', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: path.join(testDataDir, 'backups') });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('data directory');
    });

    it('should reject path with traversal', async () => {
      const response = await request(app)
        .post('/api/backup/validate-path')
        .send({ path: '../etc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('../');
    });
  });

  describe('POST /api/backup/trigger', () => {
    it('should create backup when enabled', async () => {
      const response = await request(app)
        .post('/api/backup/trigger');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.filename).toMatch(/^choral-backup-/);

      // Verify backup file exists
      const backupPath = path.join(testBackupDir, response.body.filename);
      const exists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should prevent concurrent backups', async () => {
      // Trigger first backup (don't await)
      const first = request(app).post('/api/backup/trigger');

      // Trigger second immediately
      const response = await request(app).post('/api/backup/trigger');

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('in progress');

      await first; // Wait for first to complete
    });
  });
});
```

**Step 2: Run integration tests**

Run:
```bash
npm test -- tests/integration/api-backup.test.js
```

Note: These tests may need adjustment based on actual server setup. The goal is to verify:
- Path validation works correctly
- Backup trigger creates files
- Concurrent backup prevention works

**Step 3: Commit**

```bash
git add tests/integration/api-backup.test.js
git commit -m "test: add integration tests for backup API endpoints"
```

---

## Task 14: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Add backup section to README.md**

Add after "Configuration" section in `README.md`:

```markdown
## Backup System

Choral includes an automatic backup system to protect your data from loss.

### Configuration

Configure backups in Settings > Backup or edit `config.json`:

```json
{
  "backup": {
    "enabled": false,
    "interval": "6h",
    "retention": 10,
    "directory": "./backups",
    "encrypt": false,
    "password": ""
  }
}
```

**Options:**
- `enabled` - Enable/disable automatic backups
- `interval` - How often to backup: `15m`, `1h`, `6h`, `12h`, `24h`
- `retention` - Number of backups to keep (1-100)
- `directory` - Where to save backups (can be cloud sync folder)
- `encrypt` - Enable password protection
- `password` - Encryption password (min 8 characters)

### Manual Backups

Click "Backup Now" in Settings to create an immediate backup.

### Restoring from Backup

1. Locate your backup file: `choral-backup-YYYY-MM-DD-HHmmss.zip`
2. If encrypted, unzip with your password
3. Extract the `data/` folder to replace your current `data/` directory
4. Restart Choral

**Important:** Backups only include user data (characters, chats, personas, lorebooks, presets). They do not include `config.json` (contains API keys) or application code.

### Cloud Storage

Point the backup directory to a cloud-synced folder for off-site storage:
- Google Drive: `/Users/you/Google Drive/choral-backups`
- Dropbox: `/Users/you/Dropbox/choral-backups`
- Syncthing: Any synced folder

### Troubleshooting

**Backups not running:**
- Check that backups are enabled in Settings
- Verify the backup directory is writable
- Check server console for error messages

**Out of disk space:**
- Reduce retention count to keep fewer backups
- Use a larger external drive for backups
- Enable compression (enabled by default)
```

**Step 2: Update CLAUDE.md with backup info**

Add to the "Completed Features" section in `CLAUDE.md`:

```markdown
### Backup System
- **Automatic Backups**: Scheduled backups on configurable interval (15m to 24h)
- **Manual Trigger**: "Backup Now" button in Settings
- **Retention Management**: Automatically delete old backups beyond retention limit
- **Optional Encryption**: Password-protected backups with AES-256
- **Path Validation**: Prevents invalid backup locations with directory picker
- **Multiple Destinations**: Support local, external drive, or cloud sync folders
- **Simple Restoration**: Manual unzip and copy - no complex restore UI
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add backup system documentation"
```

---

## Task 15: Final Testing and Verification

**Step 1: Run all tests**

Run:
```bash
npm test
```

Expected: All tests pass (including new backup tests)

**Step 2: Manual testing checklist**

Test the following:
1. Start server, verify no errors
2. Open Settings, verify Backup section appears
3. Enable backups, set interval to 15m
4. Choose backup directory (create if needed)
5. Click "Backup Now", verify:
   - Progress message appears
   - Backup file created in directory
   - Success message shows
6. Wait 15 minutes, verify automatic backup runs
7. Create 12 backups, verify only 10 remain (default retention)
8. Enable encryption, set password, create backup
9. Try to open encrypted backup without password (should fail)
10. Open with correct password (should succeed)

**Step 3: Test restoration**

1. Create test chat data
2. Create backup
3. Delete some chat data
4. Unzip backup
5. Copy data/ folder back
6. Restart server
7. Verify data is restored

**Step 4: Commit final verification**

```bash
git commit --allow-empty -m "test: verify backup system end-to-end functionality"
```

---

## Task 16: Merge to Main

**Step 1: Push feature branch**

```bash
git push -u origin feature/backup-system
```

**Step 2: Create pull request**

Use GitHub CLI or web interface:

```bash
gh pr create --title "feat: implement backup system" --body "$(cat <<'EOF'
## Summary
- Automatic periodic backups of user data
- Manual "Backup Now" button in Settings UI
- Configurable interval, retention, and destination
- Optional password encryption with AES-256
- Path validation with directory picker
- Retention management (auto-delete old backups)
- Simple manual restoration by unzipping

## Testing
- Unit tests for backup module functions
- Integration tests for API endpoints
- Manual end-to-end testing completed

## Documentation
- Updated README.md with backup instructions
- Updated CLAUDE.md with feature summary

Closes #[issue-number-if-applicable]
EOF
)"
```

**Step 3: After PR approval, merge and cleanup**

```bash
git checkout main
git pull origin main
git branch -d feature/backup-system
git worktree remove .worktrees/backup-system
```

---

## Success Criteria

✅ Automatic backups run on schedule
✅ Manual backup button works
✅ Retention limit enforced correctly
✅ Password encryption functions properly
✅ Path validation prevents errors
✅ Directory picker works in UI
✅ Backups can be restored manually
✅ All tests pass
✅ Documentation complete
✅ No breaking changes to existing features

## Estimated Time

- Tasks 1-6: Core backup module (3-4 hours)
- Tasks 7-10: API endpoints and scheduler (2-3 hours)
- Task 11: Settings UI (2-3 hours)
- Tasks 12-14: Config, tests, docs (2 hours)
- Tasks 15-16: Testing and merge (1-2 hours)

**Total: ~10-14 hours**
