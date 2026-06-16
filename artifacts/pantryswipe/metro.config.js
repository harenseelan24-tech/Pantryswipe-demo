const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch the monorepo root (where pnpm stores packages)
config.watchFolders = [workspaceRoot];

// Resolve modules from both the artifact's own node_modules and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Enable symlink resolution so pnpm's linked packages are found
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
