const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Exclude backend API build folder, NextJS build files, and environment files from watcher
const customExclusions = [
  /[\\/]services[\\/]api[\\/]dist[\\/]/,
  /[\\/]services[\\/]api[\\/]\.env.*/,
  /[\\/]apps[\\/]admin[\\/]\.next[\\/]/,
];

if (config.resolver.blockList) {
  if (Array.isArray(config.resolver.blockList)) {
    config.resolver.blockList = config.resolver.blockList.concat(customExclusions);
  } else {
    config.resolver.blockList = [config.resolver.blockList, ...customExclusions];
  }
} else {
  config.resolver.blockList = customExclusions;
}

module.exports = config;
