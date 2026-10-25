const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const path = require('path');
// Registry JSON is shared with Python/API and lives outside the app directory.
config.watchFolders = [...new Set([...(config.watchFolders || []), path.resolve(__dirname, '../../packages')])];

module.exports = config;
