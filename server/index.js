const { createApp } = require('./app');
const path = require('path');

// Load config safely, creating if it doesn't exist
function loadConfig() {
  const configPath = path.join(__dirname, '../config.json');
  const examplePath = path.join(__dirname, '../config.example.json');

  try {
    if (require('fs').existsSync(configPath)) {
      return require(configPath);
    } else if (require('fs').existsSync(examplePath)) {
      // Copy example config to config.json
      const exampleConfig = require('fs').readFileSync(examplePath, 'utf-8');
      require('fs').writeFileSync(configPath, exampleConfig);
      console.log('Created config.json from config.example.json');
      return JSON.parse(exampleConfig);
    } else {
      // Create minimal default config
      const defaultConfig = {
        port: 3000,
        dataDir: './data',
        openRouterApiKey: '',
        activePreset: 'default.json'
      };
      require('fs').writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('Created default config.json');
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error);
    // Return defaults if all else fails
    return {
      port: 3000,
      dataDir: './data',
      openRouterApiKey: '',
      activePreset: 'default.json'
    };
  }
}

const config = loadConfig();
const { app, ensureDirectories } = createApp(config);

// Start server
const PORT = config.port || process.env.PORT || 3000;
ensureDirectories().then(() => {
  app.listen(PORT, () => {
    console.log(`Choral server running on port ${PORT}`);
    if (!config.openRouterApiKey && !process.env.OPENROUTER_API_KEY) {
      console.warn('\nWARNING: No OpenRouter API key configured!');
      console.warn('Set OPENROUTER_API_KEY environment variable or add it to config.json\n');
    }
  });
});
