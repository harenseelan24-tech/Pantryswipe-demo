---
name: "@babel/generator pnpm hoisting"
description: When a @babel/core version override shifts which Babel instance is primary, @babel/generator can lose its hoisted position in pnpm's virtual store, breaking Metro iOS/Android bundling.
---

## The Rule

Whenever a `@babel/core` version override is added to `pnpm-workspace.yaml`, also add `@babel/generator` (same version range) to the root `package.json` devDependencies.

**Why:** `react-native-worklets`' Babel plugin does `require('@babel/generator')` from its own module context — not from `@babel/core`'s. In pnpm's virtual store, this only resolves if `@babel/generator` is hoisted to `node_modules/@babel/generator` (i.e. it's a direct dep of the workspace root). When `@babel/core@7.29.0` was the primary version used by many packages, pnpm hoisted `@babel/generator` automatically. After the override forced `@babel/core@7.29.7`, `@babel/generator` landed only in `@babel/core`'s nested virtual env and became inaccessible to `react-native-worklets`.

**How to apply:** Any time `@babel/core` appears in `pnpm-workspace.yaml` overrides, check that `@babel/generator` is in the root `package.json` devDependencies with a matching version range. Run `pnpm install` and verify `node_modules/@babel/generator` exists at the workspace root before publishing.

**Symptom:** Metro iOS/Android bundle fails with HTTP 500 and `Cannot find module '@babel/generator'` in the `react-native-worklets` plugin's require stack. Web bundling works fine (web doesn't trigger the native worklets Babel plugin).
