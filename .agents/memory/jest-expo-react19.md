---
name: jest-expo + React 19 incompatibility
description: Why @testing-library/react-native breaks with React 19 and how to test Expo SDK 54 apps instead.
---

## The rule

Do NOT install `@testing-library/react-native` or `react-test-renderer` for Expo SDK 54 apps using React 19. Write pure unit tests instead.

**Why:** `@testing-library/react-native@14` calls `createRoot` from `react-test-renderer`, but React 19 changed that API. It errors with `(0, _testRenderer.createRoot) is not a function`. There is no clean shim.

**How to apply:**
- Use `jest@~29.7.0`, `jest-expo@~54.0.17`, `@types/jest@~29.5.14` (Expo SDK 54 compatible). Expo warns if newer jest is installed.
- Do NOT add a custom `transformIgnorePatterns` — the `jest-expo` preset already handles pnpm's `.pnpm/.../node_modules/` path layout.
- Do NOT add `setupFilesAfterFramework` (typo); correct key is `setupFilesAfterEnv` but it's only needed for @testing-library matchers.
- Write tests that don't render components: test data shapes, pure functions, and module exports via `require()`.
- Any test file that transitively imports `AppContext` needs `jest.mock("@react-native-async-storage/async-storage", ...)` even if the test itself doesn't render — the import chain triggers the native module check at load time.
- Run tests with `--passWithNoTests --forceExit --runInBand` to avoid worker OOM and hanging open handles.
- `moduleNameMapper` needs `"^@/(.*)$": "<rootDir>/$1"` for the `@/` path alias used throughout the app.
