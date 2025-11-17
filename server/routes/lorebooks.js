/**
 * Lorebook management routes
 *
 * Handles:
 * - List and fetch lorebooks
 * - Create/update lorebooks
 * - Import SillyTavern lorebooks with auto-conversion
 * - Delete lorebooks
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convert SillyTavern lorebook format to Choral format
 * @param {Object} lorebook - Lorebook data
 * @returns {Object} Choral-formatted lorebook
 */
function convertSillyTavernLorebook(lorebook) {
  // If entries is already an array, it's in Choral format
  if (Array.isArray(lorebook.entries)) {
    return lorebook;
  }

  // Convert SillyTavern format (entries as object) to Choral format (entries as array)
  const entries = [];
  if (lorebook.entries && typeof lorebook.entries === 'object') {
    for (const key in lorebook.entries) {
      const entry = lorebook.entries[key];
      const choralEntry = {
        name: entry.comment || entry.key?.[0] || 'Entry',
        enabled: !entry.disable,
        constant: entry.constant || false,
        keys: Array.isArray(entry.key) ? entry.key : [],
        keysInput: Array.isArray(entry.key) ? entry.key.join(', ') : '',
        regex: entry.regex || '',
        content: entry.content || '',
        priority: entry.order || entry.priority || 0
      };
      entries.push(choralEntry);
    }
  }

  // Extract name and scan depth from various locations
  const name = lorebook.originalData?.name || lorebook.name || 'Unnamed Lorebook';
  const scanDepth = lorebook.originalData?.scan_depth || lorebook.scanDepth || lorebook.scan_depth || 0;

  return {
    name: name,
    autoSelect: lorebook.autoSelect || false,
    matchTags: lorebook.matchTags || '',
    scanDepth: scanDepth,
    entries: entries
  };
}

/**
 * Create lorebook router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.LOREBOOKS_DIR - Path to lorebooks directory
 * @returns {express.Router} Express router
 */
function createLorebookRouter(deps) {
  const router = express.Router();
  const { LOREBOOKS_DIR } = deps;

  // GET /api/lorebooks - List all lorebooks
  router.get('/', async (req, res, next) => {
    try {
      const files = await fs.readdir(LOREBOOKS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const lorebooks = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(LOREBOOKS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            let lorebook = JSON.parse(content);

            // Auto-convert SillyTavern format to Choral format
            lorebook = convertSillyTavernLorebook(lorebook);

            return {
              filename: file,
              ...lorebook
            };
          } catch (err) {
            console.error(`Error loading lorebook ${file}:`, err);
            return null;
          }
        })
      );

      res.json(lorebooks.filter(l => l !== null));
    } catch (error) {
      next(error);
    }
  });

  // GET /api/lorebooks/:filename - Get specific lorebook
  router.get('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(LOREBOOKS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      let lorebook = JSON.parse(content);

      // Auto-convert SillyTavern format to Choral format
      lorebook = convertSillyTavernLorebook(lorebook);

      res.json(lorebook);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Lorebook not found' });
      }
      next(error);
    }
  });

  // POST /api/lorebooks - Create/update lorebook
  router.post('/', async (req, res, next) => {
    try {
      const lorebook = req.body;
      const filename = lorebook.filename || `${lorebook.name || 'lorebook'}.json`;
      const filePath = path.join(LOREBOOKS_DIR, filename);

      // Create a copy without the filename property for storage
      const { filename: _, ...lorebookData } = lorebook;

      await fs.writeFile(filePath, JSON.stringify(lorebookData, null, 2));
      res.json({ success: true, filename });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/lorebooks/:filename - Delete lorebook
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(LOREBOOKS_DIR, req.params.filename);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Lorebook not found' });
      }
      next(error);
    }
  });

  // POST /api/lorebooks/import - Import lorebook
  router.post('/import', async (req, res, next) => {
    try {
      const importedLorebook = req.body;

      // Extract name from various possible locations (prioritize originalData)
      const lorebookName =
        importedLorebook.originalData?.name ||
        importedLorebook.name ||
        'Imported Lorebook';

      // Extract scan depth from various locations
      const scanDepth =
        importedLorebook.originalData?.scan_depth ||
        importedLorebook.scanDepth ||
        importedLorebook.scan_depth ||
        0;

      // Convert entries object to Choral entries array
      const entries = [];
      if (importedLorebook.entries) {
        const entriesObj = importedLorebook.entries;
        for (const key in entriesObj) {
          const entry = entriesObj[key];

          // Map to Choral fields, keep only supported ones
          const choralEntry = {
            name: entry.comment || entry.key?.[0] || 'Entry',
            enabled: !entry.disable,
            constant: entry.constant || false,
            keys: Array.isArray(entry.key) ? entry.key : [],
            keysInput: Array.isArray(entry.key) ? entry.key.join(', ') : '',
            regex: entry.regex || '',
            content: entry.content || '',
            priority: entry.order || entry.priority || 0
          };

          entries.push(choralEntry);
        }
      }

      // Create Choral lorebook format
      const choralLorebook = {
        name: lorebookName,
        autoSelect: importedLorebook.autoSelect || false,
        matchTags: importedLorebook.matchTags || '',
        scanDepth: scanDepth,
        entries: entries
      };

      // Generate unique filename
      let baseFilename = choralLorebook.name.replace(/[^a-zA-Z0-9 ]/g, '_');
      let filename = `${baseFilename}.json`;
      let filePath = path.join(LOREBOOKS_DIR, filename);
      let counter = 1;

      // Check for existing files and add counter if needed
      while (await fs.access(filePath).then(() => true).catch(() => false)) {
        filename = `${baseFilename}_${counter}.json`;
        filePath = path.join(LOREBOOKS_DIR, filename);
        counter++;
      }

      await fs.writeFile(filePath, JSON.stringify(choralLorebook, null, 2));
      res.json({ success: true, filename, lorebook: choralLorebook });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createLorebookRouter;
