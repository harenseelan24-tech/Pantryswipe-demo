---
name: Expo Router dual-instance crash
description: pnpm installs can create multiple expo-router instances causing useLinkPreviewContext crash; fix via metro extraNodeModules pin.
---

## The Rule

After any `pnpm add` that touches babel peer deps, pnpm may create multiple copies of `expo-router` (distinguished by peer-dep hash, e.g. `_d2aa80...` vs `_c289...`). `@expo/cli` loads one instance as the bundle entry; app code resolves another via the pantryswipe symlink. This splits the React context tree and crashes with:

```
Error: useLinkPreviewContext must be used within a LinkPreviewContextProvider.
This is likely a bug in Expo Router.
```

**Why:** pnpm's content-addressable store creates per-peer-dep-hash copies. When `@babel/core` has two resolvable versions in the lockfile (e.g. `7.29.0` vs `7.29.7`), `expo` (and transitively `expo-router`) gets duplicated.

**How to apply:** After any pnpm install that introduces the crash:

1. Verify duplicate expo-router instances: `ls node_modules/.pnpm/ | grep "^expo-router"` — if count > 2, this is the issue.
2. Clear cache: `rm -rf artifacts/pantryswipe/.expo node_modules/.cache/metro`
3. Add to `artifacts/pantryswipe/metro.config.js`:

```js
const expoRouterPath = path.resolve(projectRoot, "node_modules", "expo-router");
config.resolver.extraNodeModules = {
  "expo-router": expoRouterPath,
};
```

This forces ALL `require("expo-router")` calls to resolve to the single pantryswipe-local symlink, collapsing the dual-instance problem.

4. Restart the expo workflow.

The existing `@babel/core: ">=7.29.6"` override in `pnpm-workspace.yaml` helps prevent new duplication but doesn't retroactively fix an already-duplicated lockfile.
