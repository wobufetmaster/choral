/**
 * Character management routes
 *
 * Handles:
 * - List characters with tag filtering
 * - Get character details
 * - Upload/update character cards
 * - Manage character tags
 * - Delete characters
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { readCharacterCard, writeCharacterCard, validateCharacterCard } = require('../characterCard');

/**
 * Create character router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.CHARACTERS_DIR - Path to characters directory
 * @param {Object} deps.upload - Multer upload middleware
 * @param {Function} deps.loadTags - Function to load tags
 * @param {Function} deps.saveTags - Function to save tags
 * @param {Function} deps.loadCoreTags - Function to load core tags
 * @param {Function} deps.normalizeTag - Function to normalize tags
 * @returns {express.Router} Express router
 */
function createCharacterRouter(deps) {
  const router = express.Router();
  const { CHARACTERS_DIR, upload, loadTags, saveTags, loadCoreTags, normalizeTag } = deps;

  // GET /api/characters - List all characters with optional tag filtering
  router.get('/', async (req, res, next) => {
    try {
      const files = await fs.readdir(CHARACTERS_DIR);
      const pngFiles = files.filter(f => f.endsWith('.png'));

      const characters = [];
      for (const file of pngFiles) {
        try {
          const filePath = path.join(CHARACTERS_DIR, file);
          const card = await readCharacterCard(filePath);

          if (card && card.data) {
            characters.push({
              filename: file,
              name: card.data.name || 'Unknown',
              description: card.data.description || '',
              tags: card.data.tags || [],
              createdAt: card.data.createdAt,
              creator: card.data.creator
            });
          }
        } catch (error) {
          console.error(`Error reading character ${file}:`, error.message);
        }
      }

      console.log(`[Characters API] Loaded ${characters.length} valid characters out of ${pngFiles.length} files`);
      res.json(characters);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/characters/:filename - Get specific character
  router.get('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(CHARACTERS_DIR, req.params.filename);
      const card = await readCharacterCard(filePath);
      res.json(card);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Character not found' });
      }
      next(error);
    }
  });

  // GET /api/characters/:filename/image - Get character image
  router.get('/:filename/image', async (req, res, next) => {
    try {
      const filePath = path.join(CHARACTERS_DIR, req.params.filename);

      // Check if file exists
      await fs.access(filePath);

      // Set headers for PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Stream the file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('Error streaming image:', error);
        if (!res.headersSent) {
          next(error);
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Character image not found' });
      }
      next(error);
    }
  });

  // POST /api/characters - Upload/create character
  router.post('/', upload.single('file'), async (req, res, next) => {
    try {
      let card;

      // Handle file upload
      if (req.file) {
        const tempPath = req.file.path;
        card = await readCharacterCard(tempPath);

        // Validate character card
        if (!validateCharacterCard(card)) {
          await fs.unlink(tempPath);
          return res.status(400).json({ error: 'Invalid character card' });
        }

        // Generate unique filename
        let filename = req.file.originalname;
        let targetPath = path.join(CHARACTERS_DIR, filename);
        let counter = 1;

        while (await fs.access(targetPath).then(() => true).catch(() => false)) {
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          filename = `${base} (${counter})${ext}`;
          targetPath = path.join(CHARACTERS_DIR, filename);
          counter++;
        }

        await fs.rename(tempPath, targetPath);
        res.json({ filename, card });
      }
      // Handle JSON upload
      else if (req.body) {
        if (!validateCharacterCard(req.body)) {
          return res.status(400).json({ error: 'Invalid character card' });
        }

        card = req.body;

        // Generate filename from character name
        let filename = `${card.data.name || 'character'}.png`;
        let targetPath = path.join(CHARACTERS_DIR, filename);
        let counter = 1;

        while (await fs.access(targetPath).then(() => true).catch(() => false)) {
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          filename = `${base} (${counter})${ext}`;
          targetPath = path.join(CHARACTERS_DIR, filename);
          counter++;
        }

        await writeCharacterCard(targetPath, card);
        res.json({ filename, card });
      } else {
        res.status(400).json({ error: 'No file or data provided' });
      }
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/characters/:filename - Update character
  router.put('/:filename', upload.single('file'), async (req, res, next) => {
    try {
      const targetPath = path.join(CHARACTERS_DIR, req.params.filename);

      // Check if character exists
      await fs.access(targetPath);

      let card;

      if (req.file) {
        const tempPath = req.file.path;
        card = await readCharacterCard(tempPath);

        const validation = validateCharacterCard(card);
        if (!validation.valid) {
          await fs.unlink(tempPath);
          return res.status(400).json({ error: 'Invalid character card', details: validation.errors });
        }

        await fs.unlink(targetPath);
        await fs.rename(tempPath, targetPath);
      } else if (req.body) {
        if (!validateCharacterCard(req.body)) {
          return res.status(400).json({ error: 'Invalid character card' });
        }

        card = req.body;
        await writeCharacterCard(targetPath, card);
      } else {
        return res.status(400).json({ error: 'No file or data provided' });
      }

      res.json({ filename: req.params.filename, card });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Character not found' });
      }
      throw error;
    }
  });

  // PUT /api/characters/:filename/tags - Update character tags
  router.put('/:filename/tags', async (req, res, next) => {
    try {
      const filePath = path.join(CHARACTERS_DIR, req.params.filename);
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
      }

      const card = await readCharacterCard(filePath);
      const normalizedTags = tags.map(normalizeTag);

      // Load core tags
      const coreTags = await loadCoreTags();
      const normalizedCoreTags = coreTags.map(normalizeTag);

      // Ensure core tags are always included
      const finalTags = [...new Set([...normalizedCoreTags, ...normalizedTags])];

      card.data.tags = finalTags;

      await writeCharacterCard(filePath, card);

      // Update global tag registry
      const allTags = await loadTags();
      finalTags.forEach(tag => {
        if (!allTags[tag]) {
          allTags[tag] = { characters: [] };
        }
        if (!allTags[tag].characters.includes(req.params.filename)) {
          allTags[tag].characters.push(req.params.filename);
        }
      });

      // Remove character from tags it no longer has
      for (const [tag, data] of Object.entries(allTags)) {
        if (!finalTags.includes(tag) && data.characters.includes(req.params.filename)) {
          data.characters = data.characters.filter(f => f !== req.params.filename);
          if (data.characters.length === 0 && !normalizedCoreTags.includes(tag)) {
            delete allTags[tag];
          }
        }
      }

      await saveTags(allTags);

      res.json({ filename: req.params.filename, tags: finalTags });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/characters/:filename/auto-tag - Auto-generate tags using AI
  router.post('/:filename/auto-tag', async (req, res, next) => {
    try {
      const filePath = path.join(CHARACTERS_DIR, req.params.filename);
      const card = await readCharacterCard(filePath);

      // Build prompt for tag generation
      const prompt = `Analyze this character and suggest 5-10 relevant tags. Focus on key traits, setting, role, and themes.

Character Name: ${card.data.name}
Description: ${card.data.description || 'N/A'}
Personality: ${card.data.personality || 'N/A'}

Return ONLY a comma-separated list of lowercase tags, nothing else.`;

      const { chatCompletion } = require('../openrouter');
      const response = await chatCompletion({
        messages: [
          { role: 'user', content: prompt }
        ],
        model: req.body.model || 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        max_tokens: 200
      });

      // Parse tags from response
      // chatCompletion returns just the content string, not the full response object
      const content = response || '';
      const suggestedTags = content
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t.length < 30);

      // Get existing tags and core tags
      const existingTags = card.data.tags || [];
      const coreTags = await loadCoreTags();
      const normalizedCoreTags = coreTags.map(normalizeTag);

      // Merge: core tags + existing tags + suggested tags (deduplicated)
      const mergedTags = [...new Set([
        ...normalizedCoreTags,
        ...existingTags.map(normalizeTag),
        ...suggestedTags
      ])];

      // Update character card
      card.data.tags = mergedTags;
      await writeCharacterCard(filePath, card);

      // Update global tag registry
      const allTags = await loadTags();
      mergedTags.forEach(tag => {
        if (!allTags[tag]) {
          allTags[tag] = { characters: [] };
        }
        if (!allTags[tag].characters.includes(req.params.filename)) {
          allTags[tag].characters.push(req.params.filename);
        }
      });
      await saveTags(allTags);

      res.json({
        filename: req.params.filename,
        tags: mergedTags,
        suggested: suggestedTags
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/characters/bulk-remove-tags - Remove tags from multiple characters
  router.post('/bulk-remove-tags', async (req, res, next) => {
    try {
      const { characterFilenames, tagsToRemove } = req.body;

      if (!Array.isArray(characterFilenames) || !Array.isArray(tagsToRemove)) {
        return res.status(400).json({
          error: 'characterFilenames and tagsToRemove must be arrays'
        });
      }

      const normalizedTagsToRemove = tagsToRemove.map(normalizeTag);
      const coreTags = await loadCoreTags();
      const normalizedCoreTags = coreTags.map(normalizeTag);

      // Check if trying to remove core tags
      const coreTagsToRemove = normalizedTagsToRemove.filter(tag =>
        normalizedCoreTags.includes(tag)
      );

      if (coreTagsToRemove.length > 0) {
        return res.status(400).json({
          error: 'Cannot remove core tags',
          coreTags: coreTagsToRemove
        });
      }

      const results = [];

      for (const filename of characterFilenames) {
        try {
          const filePath = path.join(CHARACTERS_DIR, filename);
          const card = await readCharacterCard(filePath);

          const currentTags = card.data.tags || [];
          const updatedTags = currentTags.filter(tag =>
            !normalizedTagsToRemove.includes(normalizeTag(tag))
          );

          card.data.tags = updatedTags;
          await writeCharacterCard(filePath, card);

          results.push({
            filename,
            success: true,
            removedTags: currentTags.filter(tag =>
              normalizedTagsToRemove.includes(normalizeTag(tag))
            ),
            remainingTags: updatedTags
          });
        } catch (error) {
          results.push({
            filename,
            success: false,
            error: error.message
          });
        }
      }

      // Update global tag registry
      const allTags = await loadTags();
      for (const tag of normalizedTagsToRemove) {
        if (allTags[tag]) {
          allTags[tag].characters = allTags[tag].characters.filter(
            filename => !characterFilenames.includes(filename)
          );
          if (allTags[tag].characters.length === 0) {
            delete allTags[tag];
          }
        }
      }
      await saveTags(allTags);

      res.json({ results });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/characters/:filename - Delete character
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(CHARACTERS_DIR, req.params.filename);
      await fs.unlink(filePath);

      // Update global tag registry
      const allTags = await loadTags();
      for (const [tag, data] of Object.entries(allTags)) {
        data.characters = data.characters.filter(f => f !== req.params.filename);
        if (data.characters.length === 0) {
          const coreTags = await loadCoreTags();
          if (!coreTags.map(normalizeTag).includes(tag)) {
            delete allTags[tag];
          }
        }
      }
      await saveTags(allTags);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createCharacterRouter;
