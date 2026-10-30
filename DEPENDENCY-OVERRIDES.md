# Dependency overrides

`package.json` keeps one npm override. Direct dependencies stay pinned to exact versions;
`package-lock.json` pins the resolved transitive dependencies.

## Jest's deepmerge dependency

```json
"overrides": {
  "jest-config": {
    "deepmerge": "4.1.1"
  }
}
```

`jest-config@30.2.0` requires `deepmerge@^4.3.1`. The latest Jest release checked,
`30.5.2`, still requires that range. The latest deepmerge release is `4.3.1`.
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
reports prototype poisoning in deepmerge versions `>=4.2.0 <=4.3.1`.

No patched release is available, so this override selects `4.1.1`, outside the advisory's
affected range. It applies only below `jest-config`, rather than to every consumer.
Version `4.1.1` exports the merge function Jest uses and the `.all` helper. The full
Jest suite validates the dependency downgrade. This is a dev dependency, not application
input validation.

Remove the override when deepmerge ships a patched compatible release or Jest drops
the dependency. Update Jest if needed, remove the override, regenerate the lockfile,
and require both `npm audit` and `npm test` to pass.

`npm run check-overrides` checks the latest upstream releases for removal candidates.
Exit codes are 0 for a candidate, 1 when the override is still needed, and 2 for a
lookup error. A candidate still requires advisory review, a clean audit, and tests.

## Removed overrides

The dependency upgrade resolves these packages through upstream dependency ranges.
A clean `npm ci` and `npm audit` verify the lockfile without the old pins.

| Removed override               | Reason                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `babel-plugin-istanbul: 7.0.1` | Its upstream range already resolves `7.0.1`; the lockfile supplies reproducibility.                                                                                 |
| `test-exclude: 7.0.1`          | The forced major upgrade was for glob deprecation warnings, not an unresolved audit advisory. Restore the upstream-supported range.                                 |
| `glob: 10.5.0`                 | Remove the global major-version substitution; consumers now resolve their declared ranges. Jest's older glob chain emits deprecation warnings but passes the audit. |
| `brace-expansion: 1.1.18`      | The pin was vulnerable and forced one major version on incompatible consumers. Upstream ranges resolve patched `1.1.21`, `2.1.7`, and `5.0.12`.                     |
| `postcss: 8.5.26`              | Next's declared `8.5.23` and Tailwind's resolved `8.5.26` pass the audit without an override.                                                                       |
| `js-yaml@3: 3.15.1`            | The pin was vulnerable. The upstream range resolves patched `3.15.2`.                                                                                               |
| `js-yaml@4: 4.3.1`             | The pin was vulnerable. Updated `@eslint/eslintrc` requires patched `^4.3.2`.                                                                                       |
| `nanoid: 3.3.18`               | The upstream range already resolves `3.3.18`; no override is needed.                                                                                                |
| `ip-address: 10.5.0`           | The pin was vulnerable. Socks' `^10.1.1` range resolves patched `10.7.5`.                                                                                           |
