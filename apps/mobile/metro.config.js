const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const path = require('path');
// Registry JSON is shared with Python/API and lives outside the app directory.
config.watchFolders = [...new Set([...(config.watchFolders || []), path.resolve(__dirname, '../../packages')])];

// Metro/Jest process workers do not inherit windowsHide from the CLI launcher.
// A single worker runs both transformation and file processing in-process on Windows.
if (process.platform === 'win32') config.maxWorkers = 1;

module.exports = config;
