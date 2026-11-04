# Dependency overrides

`package.json` keeps version-scoped npm overrides. Direct dependencies stay pinned to exact versions;
`package-lock.json` pins the resolved transitive dependencies.

## Jest's deepmerge dependency

```json
"overrides": {
  "jest-config": {
    "deepmerge": "4.1.1"
  }
}
```

`jest-config@30.5.2` requires `deepmerge@^4.3.1`. The latest deepmerge release is `4.3.1`.
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
reports prototype poisoning in deepmerge versions `>=4.2.0 <=4.3.1`.

No patched release is available. This override selects `4.1.1` to clear `npm audit`
by moving deepmerge outside the advisory's reported range. Version `4.1.1` predates
the prototype-pollution guard and is not safer; it does not fix the weakness.
The override applies only below `jest-config`, which uses the default merge export
to merge `preset.globals` with `options.globals`. We accept this risk only because
both values come from trusted repo config. The full Jest suite validates
compatibility with the downgrade, not its security.

Remove the override when deepmerge ships a patched compatible release or Jest drops
the dependency. Update Jest if needed, remove the override, regenerate the lockfile,
and require both `npm audit` and `npm test` to pass.

`npm run check-overrides` checks the latest upstream releases for deepmerge removal candidates only.
Exit codes are 0 for a candidate, 1 when the override is still needed, and 2 for a
lookup error. A candidate still requires advisory review, a clean audit, and tests.

## Glob and minimatch dependencies

```json
"glob@>=9.0.0 <=14.0.1": "14.0.3",
"minimatch@>=7.0.0 <11.0.1": "11.0.4"
```

[GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) affects
glob versions `>=9.0.0 <=14.0.1`, and
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects
minimatch versions `>=7.0.0 <11.0.1`. Jest, the Sigstore cache, the coverage
filter, and TypeScript ESLint depend on affected versions. These overrides replace
only versions in the affected ranges; minimatch 3 remains unchanged.

The replacements cross major versions. The dependency override tests cover the
cache glob adapter and coverage include/exclude matching; lint, tests, and the build
also exercise their consumers. Remove each override when upstream dependency ranges
resolve to fixed versions without it, and rerun `npm audit` and the test suite.
