const fs = require('fs').promises;
const path = require('path');

/**
 * Default preset template
 */
const DEFAULT_PRESET = {
  name: 'Default',
  model: 'anthropic/claude-opus-4',
  temperature: 1.0,
  top_p: 0.92,
  top_k: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  max_tokens: 4096,
  max_context: 24000,
  prompt_processing: 'merge_system',
  stopping_strings: ['[User]'],
  prompts: [
    {
      identifier: 'main',
      name: 'Main System Prompt',
      role: 'system',
      content: '',
      enabled: true,
      injection_order: 0
    },
    {
      identifier: 'charDescription',
      name: 'Character Description',
      role: 'system',
      content: '{{description}}',
      enabled: true,
      injection_order: 100
    },
    {
      identifier: 'charPersonality',
      name: 'Character Personality',
      role: 'system',
      content: '{{personality}}',
      enabled: true,
      injection_order: 200
    },
    {
      identifier: 'scenario',
      name: 'Scenario',
      role: 'system',
      content: '{{scenario}}',
      enabled: true,
      injection_order: 300
    },
    {
      identifier: 'jailbreak',
      name: 'Post-History Instructions',
      role: 'system',
      content: '',
      enabled: false,
      injection_order: 1000
    }
  ]
};

/**
 * Import a PixiJB preset and convert to Choral format
 * @param {Object} pixijbConfig - PixiJB configuration object
 * @returns {Object} - Choral preset
 */
function convertPixiJBToPreset(pixijbConfig) {
  const preset = {
    name: 'Imported PixiJB Preset',
    model: pixijbConfig.openrouter_model || pixijbConfig.claude_model || pixijbConfig.openai_model || 'anthropic/claude-opus-4',
    temperature: pixijbConfig.temperature ?? 1.0,
    top_p: pixijbConfig.top_p ?? 0.92,
    top_k: pixijbConfig.top_k ?? 0,
    frequency_penalty: pixijbConfig.frequency_penalty ?? 0,
    presence_penalty: pixijbConfig.presence_penalty ?? 0,
    repetition_penalty: pixijbConfig.repetition_penalty ?? 1,
    max_tokens: pixijbConfig.openai_max_tokens ?? 4096,
    max_context: pixijbConfig.openai_max_context ?? 24000,
    prompt_processing: 'merge_system',
    stopping_strings: pixijbConfig.stopping_strings || ['[User]'],
    prompts: []
  };

  // Convert prompts if they exist
  if (pixijbConfig.prompts && Array.isArray(pixijbConfig.prompts)) {
    preset.prompts = pixijbConfig.prompts
      .filter(p => !p.marker) // Skip marker prompts
      .map(p => ({
        identifier: p.identifier || p.name?.toLowerCase().replace(/\s+/g, '_'),
        name: p.name || p.identifier,
        role: p.role || 'system',
        content: p.content || '',
        enabled: p.enabled !== false,
        injection_order: p.injection_order ?? 0
      }));
  }

  return preset;
}

/**
 * Validate a preset
 * @param {Object} preset
 * @returns {boolean}
 */
function validatePreset(preset) {
  if (!preset || typeof preset !== 'object') return false;
  if (!preset.name || typeof preset.name !== 'string') return false;
  // Prompts is optional, but if present must be an array
  if (preset.prompts && !Array.isArray(preset.prompts)) return false;
  return true;
}

module.exports = {
  DEFAULT_PRESET,
  convertPixiJBToPreset,
  validatePreset
};
