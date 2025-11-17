/**
 * Preset management routes
 *
 * Handles:
 * - List and fetch presets
 * - Create/update presets
 * - Delete presets
 * - Import PixiJB configs
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create preset router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.PRESETS_DIR - Path to presets directory
 * @param {Function} deps.validatePreset - Preset validation function
 * @param {Function} deps.convertPixiJBToPreset - PixiJB conversion function
 * @returns {express.Router} Express router
 */
function createPresetRouter(deps) {
  const router = express.Router();
  const { PRESETS_DIR, validatePreset, convertPixiJBToPreset } = deps;

  // GET /api/presets - List all presets
  router.get('/', async (req, res, next) => {
    try {
      const files = await fs.readdir(PRESETS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const presets = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(PRESETS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const preset = JSON.parse(content);
            return {
              filename: file,
              ...preset
            };
          } catch (err) {
            return null;
          }
        })
      );

      res.json(presets.filter(p => p !== null));
    } catch (error) {
      next(error);
    }
  });

  // GET /api/presets/:filename - Get specific preset
  router.get('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(PRESETS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const preset = JSON.parse(content);
      res.json(preset);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Preset not found' });
      }
      next(error);
    }
  });

  // POST /api/presets - Create/update preset
  router.post('/', async (req, res, next) => {
    try {
      const preset = req.body;

      if (!validatePreset(preset)) {
        return res.status(400).json({ error: 'Invalid preset' });
      }

      const filename = preset.filename || `${preset.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      const filePath = path.join(PRESETS_DIR, filename);

      await fs.writeFile(filePath, JSON.stringify(preset, null, 2));
      res.json({ success: true, filename });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/presets/:filename - Delete preset
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(PRESETS_DIR, req.params.filename);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Preset not found' });
      }
      next(error);
    }
  });

  // POST /api/presets/import/pixijb - Import PixiJB config as preset
  router.post('/import/pixijb', async (req, res, next) => {
    try {
      const pixijbConfig = req.body;
      const preset = convertPixiJBToPreset(pixijbConfig);

      const filename = 'imported_pixijb.json';
      const filePath = path.join(PRESETS_DIR, filename);

      await fs.writeFile(filePath, JSON.stringify(preset, null, 2));
      res.json({ success: true, filename, preset });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createPresetRouter;
