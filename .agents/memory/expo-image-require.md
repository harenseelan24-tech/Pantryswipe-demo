---
name: Expo static image require gotcha
description: Metro bundler fails at compile time if a require("@/assets/images/foo.png") path doesn't exist on disk, even if wrapped in try-catch.
---

## Rule

All image files referenced via `require("@/assets/images/...")` must exist on disk before Metro starts bundling. Missing files cause a hard bundle failure — Metro statically analyzes require() paths.

**Why:** Metro's module resolver is static, not runtime. Try-catch in JS code does not prevent the resolution error.

**How to apply:**
- When generating images async in the background, create placeholder copies of existing images for any that might be missing (e.g. `cp recipe-salmon.png recipe-bowl.png`).
- Or restructure to only require images that are known to exist, with null-guarded fallback UI.
- After real images are generated, swap the placeholders.
