const fs = require('fs');
const { PNG } = require('pngjs');

/**
 * Extract tEXt chunks from PNG buffer
 * @param {Buffer} buffer - PNG file buffer
 * @returns {Object} - Object with text chunk key-value pairs
 */
function extractTextChunks(buffer) {
  const texts = {};
  let offset = 8; // Skip PNG signature

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);

    if (type === 'tEXt') {
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      const chunkData = buffer.slice(dataStart, dataEnd);

      // Find null separator
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = chunkData.toString('latin1', 0, nullIndex);
        const text = chunkData.toString('latin1', nullIndex + 1);
        texts[keyword] = text;
      }
    }

    offset += 12 + length; // length + type + data + CRC
  }

  return texts;
}

/**
 * Reads a Character Card V3 from a PNG file
 * @param {string} filePath - Path to the PNG file
 * @returns {Promise<Object>} - The character card data
 */
async function readCharacterCard(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const textChunks = extractTextChunks(buffer);

        // Try ccv3 first
        if (textChunks.ccv3) {
          const decoded = Buffer.from(textChunks.ccv3, 'base64').toString('utf-8');
          const cardData = JSON.parse(decoded);
          resolve(cardData);
          return;
        }

        // Fall back to chara (V2)
        if (textChunks.chara) {
          const decoded = Buffer.from(textChunks.chara, 'base64').toString('utf-8');
          const cardData = JSON.parse(decoded);
          console.warn('Loaded Character Card V2, consider upgrading to V3');
          resolve(cardData);
          return;
        }

        reject(new Error('No character card data found in PNG'));
      } catch (error) {
        reject(new Error(`Failed to read character card: ${error.message}`));
      }
    });
  });
}

/**
 * Add a tEXt chunk to PNG buffer
 * @param {Buffer} pngBuffer - Original PNG buffer
 * @param {string} keyword - Text chunk keyword
 * @param {string} text - Text chunk content
 * @returns {Buffer} - Modified PNG buffer
 */
function addTextChunk(pngBuffer, keyword, text) {
  const chunks = [];
  let offset = 8; // Skip PNG signature

  // Copy signature
  chunks.push(pngBuffer.slice(0, 8));

  // Parse and copy existing chunks, insert text chunks before IEND
  while (offset < pngBuffer.length) {
    const length = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;

    if (type === 'IEND') {
      // Insert our text chunk before IEND
      const keywordBuf = Buffer.from(keyword, 'latin1');
      const textBuf = Buffer.from(text, 'latin1');
      const dataBuf = Buffer.concat([keywordBuf, Buffer.from([0]), textBuf]);

      const chunkLength = Buffer.alloc(4);
      chunkLength.writeUInt32BE(dataBuf.length);

      const chunkType = Buffer.from('tEXt', 'ascii');

      // Calculate CRC
      const crcData = Buffer.concat([chunkType, dataBuf]);
      const crc = require('zlib').crc32(crcData);
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc >>> 0);

      chunks.push(chunkLength, chunkType, dataBuf, crcBuf);

      // Then add IEND
      chunks.push(pngBuffer.slice(offset, chunkEnd));
      break;
    } else if (type !== 'tEXt' || !keyword) {
      // Copy other chunks as-is (skip existing tEXt with same keyword)
      chunks.push(pngBuffer.slice(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  return Buffer.concat(chunks);
}

/**
 * Writes a Character Card V3 to a PNG file
 * @param {string} filePath - Path to save the PNG file
 * @param {Object} cardData - The character card V3 data
 * @param {Buffer} [imageBuffer] - Optional PNG image buffer (if not provided, creates a blank image)
 * @returns {Promise<void>}
 */
async function writeCharacterCard(filePath, cardData, imageBuffer = null) {
  return new Promise((resolve, reject) => {
    // Validate that it's a V3 card
    if (cardData.spec !== 'chara_card_v3') {
      return reject(new Error('Card must be Character Card V3 format'));
    }

    const cardJson = JSON.stringify(cardData);
    const encoded = Buffer.from(cardJson, 'utf-8').toString('base64');

    if (imageBuffer) {
      // Add ccv3 chunk to existing PNG
      const modified = addTextChunk(imageBuffer, 'ccv3', encoded);
      fs.writeFile(filePath, modified, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      // Create a new blank PNG
      const png = new PNG({
        width: 400,
        height: 600,
        filterType: -1
      });

      // Fill with a simple solid color
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const idx = (png.width * y + x) << 2;
          png.data[idx] = 60;     // R
          png.data[idx + 1] = 60; // G
          png.data[idx + 2] = 60; // B
          png.data[idx + 3] = 255; // A
        }
      }

      const buffer = PNG.sync.write(png);
      const modified = addTextChunk(buffer, 'ccv3', encoded);

      fs.writeFile(filePath, modified, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

/**
 * Validates a Character Card V3 object
 * @param {Object} cardData
 * @returns {boolean}
 */
function validateCharacterCard(cardData) {
  if (!cardData || typeof cardData !== 'object') return false;
  if (cardData.spec !== 'chara_card_v3') return false;
  if (!cardData.spec_version) return false;
  if (!cardData.data || typeof cardData.data !== 'object') return false;

  const data = cardData.data;
  if (!data.name || typeof data.name !== 'string') return false;

  return true;
}

/**
 * Converts a Character Card V2 to V3 format
 * @param {Object} v2Card - V2 card data
 * @returns {Object} - V3 card data
 */
function convertV2ToV3(v2Card) {
  // If it's already V3, return as-is
  if (v2Card.spec === 'chara_card_v3') {
    return v2Card;
  }

  // Convert V2 to V3 format
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: v2Card.name || v2Card.data?.name || 'Unknown',
      description: v2Card.description || v2Card.data?.description || '',
      personality: v2Card.personality || v2Card.data?.personality || '',
      scenario: v2Card.scenario || v2Card.data?.scenario || '',
      first_mes: v2Card.first_mes || v2Card.data?.first_mes || '',
      mes_example: v2Card.mes_example || v2Card.data?.mes_example || '',
      creator_notes: v2Card.creator_notes || v2Card.data?.creator_notes || '',
      system_prompt: v2Card.system_prompt || v2Card.data?.system_prompt || '',
      post_history_instructions: v2Card.post_history_instructions || v2Card.data?.post_history_instructions || '',
      tags: v2Card.tags || v2Card.data?.tags || [],
      creator: v2Card.creator || v2Card.data?.creator || '',
      character_version: v2Card.character_version || v2Card.data?.character_version || '1.0',
      alternate_greetings: v2Card.alternate_greetings || v2Card.data?.alternate_greetings || [],
      extensions: v2Card.extensions || v2Card.data?.extensions || {}
    }
  };
}

module.exports = {
  readCharacterCard,
  writeCharacterCard,
  validateCharacterCard,
  convertV2ToV3
};
