---
name: Expo + pnpm Metro symlink resolution
description: How to configure Metro to resolve pnpm-linked packages in this monorepo; required whenever adding a new native Expo package.
---

## Rule
After installing any new Expo package via `pnpm add` inside an artifact, Metro will fail with "Unable to resolve module X" because pnpm installs packages as symlinks into the virtual store (`../../../node_modules/.pnpm/...`). Metro does not follow symlinks by default.

## Fix
Update `artifacts/<name>/metro.config.js` to:
1. Add `watchFolders: [workspaceRoot]` so Metro watches the pnpm virtual store.
2. Add `resolver.nodeModulesPaths` for both the artifact and workspace root.
3. Set `resolver.unstable_enableSymlinks = true`.

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
```

Then restart the Expo workflow — Metro must restart (not HMR) to pick up new packages and config changes.

**Why:** pnpm uses a content-addressable virtual store with symlinks. Metro's default resolver only walks real directories and ignores symlinks, so newly installed packages are invisible until symlink resolution is enabled.

**How to apply:** Any time a `pnpm add` inside an Expo artifact is followed by "Unable to resolve module X" in Metro logs. Also check the installed version matches the SDK's expected version (e.g. `expo-camera@~17.0.10` for SDK 54, not `^56`).
