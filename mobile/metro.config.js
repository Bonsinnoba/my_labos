const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for Windows path issue with node:sea
config.resolver.unstable_enablePackageExports = false;

// Fix for watch mode timeout on Windows
config.watchFolders = [];
config.maxWorkers = 2;
config.resetCache = true;

// Increase timeout for file watching
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Increase timeout for slow file systems
      req.setTimeout(120000);
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
