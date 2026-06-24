const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch the monorepo root (where pnpm stores packages)
config.watchFolders = [workspaceRoot];

// Resolve modules from both the artifact's own node_modules and the workspace root.
// projectRoot/node_modules is listed FIRST so the pantryswipe-local symlinks win.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Enable symlink resolution so pnpm's linked packages are found
config.resolver.unstable_enableSymlinks = true;

// Pin expo-router to the single instance that artifacts/pantryswipe depends on.
// Without this, pnpm can create multiple expo-router instances (differing by peer-dep
// hash) and @expo/cli may load a different one than the app code resolves, causing
// separate React context trees and a "useLinkPreviewContext" runtime crash.
const expoRouterPath = path.resolve(projectRoot, "node_modules", "expo-router");
config.resolver.extraNodeModules = {
  "expo-router": expoRouterPath,
};

// Exclude transient skill/tool temp directories under .local from Metro's file watcher.
// These directories can be created and deleted mid-session, causing Metro to crash
// with ENOENT when it tries to watch a path that no longer exists.
const escapedWorkspace = workspaceRoot.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
config.resolver.blockList = new RegExp(
  `^${escapedWorkspace}/\\.local/.*`
);

module.exports = config;
