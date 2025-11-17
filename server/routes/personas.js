/**
 * Persona management routes
 *
 * Handles:
 * - List all personas
 * - Create/update personas
 * - Delete personas
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create persona router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.PERSONAS_DIR - Path to personas directory
 * @returns {express.Router} Express router
 */
function createPersonaRouter(deps) {
  const router = express.Router();
  const { PERSONAS_DIR } = deps;

  // GET /api/personas - List all personas
  router.get('/', async (req, res, next) => {
    try {
      const files = await fs.readdir(PERSONAS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const personas = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(PERSONAS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const persona = JSON.parse(content);
            // Return persona data along with the actual filename
            return {
              ...persona,
              _filename: file
            };
          } catch (err) {
            return null;
          }
        })
      );

      res.json(personas.filter(p => p !== null));
    } catch (error) {
      next(error);
    }
  });

  // POST /api/personas - Create/update persona
  router.post('/', async (req, res, next) => {
    try {
      const persona = req.body;

      // Use nickname as the unique identifier for filenames
      // If no nickname, fall back to name for backward compatibility
      const identifier = persona.nickname || persona.name;

      if (!identifier || !identifier.trim()) {
        return res.status(400).json({ error: 'Persona must have a nickname or name' });
      }

      const filename = `${identifier}.json`;
      const filePath = path.join(PERSONAS_DIR, filename);

      await fs.writeFile(filePath, JSON.stringify(persona, null, 2));
      res.json({ success: true, filename });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/personas/:filename - Delete persona
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(PERSONAS_DIR, req.params.filename);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Persona not found' });
      }
      next(error);
    }
  });

  return router;
}

module.exports = createPersonaRouter;
