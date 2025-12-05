/**
 * Configuration and settings routes
 *
 * Handles:
 * - Tags and core tags
 * - Bookkeeping settings
 * - Tool settings
 * - General config (active preset, default persona)
 * - Backup configuration
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create config router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {Function} deps.loadTags - Load tags function
 * @param {Function} deps.saveTags - Save tags function
 * @param {Function} deps.loadCoreTags - Load core tags function
 * @param {Function} deps.saveCoreTags - Save core tags function
 * @param {Function} deps.loadBookkeepingSettings - Load bookkeeping settings function
 * @param {Function} deps.saveBookkeepingSettings - Save bookkeeping settings function
 * @param {Function} deps.loadToolSettings - Load tool settings function
 * @param {Function} deps.saveToolSettings - Save tool settings function
 * @param {Object} deps.config - Server configuration object
 * @param {string} deps.configPath - Path to config file
 * @param {Function} deps.performBackup - Backup execution function
 * @param {Function} deps.isBackupInProgress - Check backup status function
 * @returns {express.Router} Express router
 */
function createConfigRouter(deps) {
  const router = express.Router();
  const {
    loadTags,
    saveTags,
    loadCoreTags,
    saveCoreTags,
    loadBookkeepingSettings,
    saveBookkeepingSettings,
    loadToolSettings,
    saveToolSettings,
    config,
    configPath,
    performBackup,
    isBackupInProgress
  } = deps;

  // ===== Tag Routes =====

  // GET /api/tags - Get all tag colors
  router.get('/tags', async (req, res, next) => {
    try {
      const tags = await loadTags();
      res.json(tags);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tags - Save tag colors
  router.post('/tags', async (req, res, next) => {
    try {
      const tags = req.body;
      await saveTags(tags);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Core Tags Routes =====

  // GET /api/core-tags - Get core tags
  router.get('/core-tags', async (req, res, next) => {
    try {
      const coreTags = await loadCoreTags();
      res.json(coreTags);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/core-tags - Save core tags
  router.post('/core-tags', async (req, res, next) => {
    try {
      // Handle both { tags: [...] } and direct array formats
      const coreTags = Array.isArray(req.body) ? req.body : (req.body.tags || []);
      await saveCoreTags(coreTags);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Bookkeeping Settings Routes =====

  // GET /api/bookkeeping-settings - Get bookkeeping settings
  router.get('/bookkeeping-settings', async (req, res, next) => {
    try {
      const settings = await loadBookkeepingSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/bookkeeping-settings - Save bookkeeping settings
  router.post('/bookkeeping-settings', async (req, res, next) => {
    try {
      const settings = req.body;
      await saveBookkeepingSettings(settings);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Tool Settings Routes =====

  // GET /api/tool-settings - Get tool settings
  router.get('/tool-settings', async (req, res, next) => {
    try {
      const settings = await loadToolSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tool-settings - Save tool settings
  router.post('/tool-settings', async (req, res, next) => {
    try {
      const settings = req.body;
      await saveToolSettings(settings);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Config Routes =====

  // GET /api/config - Get config (without sensitive data)
  router.get('/config', (req, res) => {
    res.json({
      port: config.port || 3000,
      hasApiKey: !!(config.openRouterApiKey || process.env.OPENROUTER_API_KEY),
      activePreset: config.activePreset || 'default.json',
      defaultPersona: config.defaultPersona || null
    });
  });

  // POST /api/config/active-preset - Set active preset
  router.post('/config/active-preset', async (req, res, next) => {
    try {
      const { preset } = req.body;

      // Update config
      config.activePreset = preset;

      // Save config to disk
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({ success: true, activePreset: preset });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/config/default-persona - Set default persona
  router.post('/config/default-persona', async (req, res, next) => {
    try {
      const { persona } = req.body;

      // Update config
      config.defaultPersona = persona;

      // Save config to disk
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({ success: true, defaultPersona: persona });
    } catch (error) {
      next(error);
    }
  });

  // ===== Backup Routes =====

  // POST /api/backup/validate-path - Validate backup path
  router.post('/backup/validate-path', async (req, res) => {
    const { path: backupPath } = req.body;

    if (!backupPath) {
      return res.status(400).json({ valid: false, error: 'Path is required' });
    }

    // Check for path traversal
    if (backupPath.includes('../')) {
      return res.status(400).json({ valid: false, error: 'Path cannot contain ../' });
    }

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

  // POST /api/backup/trigger - Manual backup trigger
  router.post('/backup/trigger', async (req, res) => {
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

  // GET /api/config/backup - Get backup configuration
  router.get('/config/backup', (req, res) => {
    const { DEFAULT_CONFIG } = require('../backupConfig.js');
    const backupConfig = config.backup || DEFAULT_CONFIG;

    // Don't send password to frontend
    const sanitized = { ...backupConfig };
    if (sanitized.password) {
      sanitized.password = '********';
    }

    res.json(sanitized);
  });

  // POST /api/config/backup - Update backup configuration
  router.post('/config/backup', async (req, res) => {
    const { validateBackupConfig } = require('../backupConfig.js');
    const newConfig = req.body;

    // Validate configuration
    const validation = validateBackupConfig(newConfig, config.dataDir || './data');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Update config
    config.backup = newConfig;

    // Save to file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Restart scheduler
    if (global.backupScheduler) {
      global.backupScheduler.stop();
      global.backupScheduler = null;
    }

    if (newConfig.enabled) {
      const { startBackupScheduler } = require('../backupScheduler.js');
      global.backupScheduler = startBackupScheduler(config);
    }

    res.json({ success: true });
  });

  return router;
}

module.exports = createConfigRouter;
