# Dependency Overrides

This document explains the npm dependency overrides in `package.json` and when they can be removed.

## Overview

The overrides section in `package.json` forces specific versions of transitive dependencies to resolve compatibility issues and eliminate deprecation warnings.

```json
"overrides": {
  "babel-plugin-istanbul": "7.0.1",
  "test-exclude": "7.0.1",
  "glob": "10.5.0"
}
```

## Why Each Override Exists

### 1. `glob: "10.5.0"`

**Issue:** `glob` versions prior to v9 are deprecated with the message "Glob versions prior to v9 are no longer supported".

**Problem:** Without overrides, Jest's transitive dependencies pull in `glob@7.x` through the following chain:

- `jest@30.2.0` → `@jest/transform@30.2.0` → `babel-plugin-istanbul@7.0.1` → `test-exclude@6.0.0` → `glob@^7.1.4`

**Solution:** Pin to `glob@10.5.0` which is a supported, modern version.

**Can be removed when:** Jest and its dependencies natively use `glob@9+` without requiring overrides. Check by removing this override and running `npm install` - if no deprecation warnings appear for glob, it's safe to remove.

### 2. `test-exclude: "7.0.1"`

**Issue:** `test-exclude@6.x` depends on the deprecated `glob@^7.1.4`.

**Problem:** `babel-plugin-istanbul@7.0.1` specifies `test-exclude@^6.0.0` in its dependencies, which pulls in the deprecated glob.

**Solution:** Override to `test-exclude@7.0.1` which uses `glob@^10.4.1` instead.

**Dependency comparison:**

- `test-exclude@6.0.0`: `glob@^7.1.4`, `minimatch@^3.0.4`
- `test-exclude@7.0.1`: `glob@^10.4.1`, `minimatch@^9.0.4`

**Can be removed when:** `babel-plugin-istanbul` updates its dependency on `test-exclude` to `^7.0.0`. Check the babel-plugin-istanbul package.json or changelog for this update.

### 3. `babel-plugin-istanbul: "7.0.1"`

**Issue:** Ensures consistent pinning across the dependency chain.

**Problem:** `@jest/transform@30.2.0` specifies `babel-plugin-istanbul@^7.0.1` which could resolve to different patch versions.

**Solution:** Pin to exact version for reproducible builds and to ensure our `test-exclude` override works correctly.

**Can be removed when:** This can potentially be removed now since `7.0.1` is currently the latest version. However, keeping it ensures the override chain remains stable. Remove only after confirming `test-exclude` override is no longer needed.

## Dependency Chain

```
jest@30.2.0
└── @jest/core@30.2.0
    └── @jest/transform@30.2.0
        └── babel-plugin-istanbul@^7.0.1 (overridden to 7.0.1)
            └── test-exclude@^6.0.0 (overridden to 7.0.1)
                └── glob@^10.4.1 (overridden to 10.5.0 for consistency)
```

## Verification

Run `scripts/check-overrides.ts` to verify if these overrides are still needed:

```bash
npx tsx scripts/check-overrides.ts
```

This script checks:

1. If `babel-plugin-istanbul` now depends on `test-exclude@^7.0.0`
2. If `test-exclude@7.x` is available and uses modern `glob`
3. If deprecation warnings still appear without overrides

## Periodic Review

These overrides should be reviewed when:

- Upgrading Jest to a new major/minor version
- `babel-plugin-istanbul` releases a new version
- Running `npm audit` or `npm outdated`

Run `npm run check-overrides` to verify if overrides are still needed.
