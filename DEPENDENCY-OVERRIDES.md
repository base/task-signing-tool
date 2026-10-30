# Dependency overrides

`package.json` keeps one scoped npm override. Direct dependencies stay pinned to exact versions;
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
