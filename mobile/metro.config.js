const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for Windows path issue with node:sea
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
