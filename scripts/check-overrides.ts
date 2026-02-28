/**
 * Check if dependency overrides in package.json are still needed.
 *
 * This script verifies whether the npm overrides can be safely removed by checking
 * if upstream dependencies have updated to use modern versions.
 *
 * Usage: npx tsx scripts/check-overrides.ts
 */

import { execSync } from 'child_process';
import semver from 'semver';

// Exit codes
const EXIT_SUCCESS = 0; // All overrides can be removed
const EXIT_OVERRIDES_NEEDED = 1; // Some overrides are still needed
const EXIT_ERROR = 2; // Script encountered an error

interface OverrideCheck {
  package: string;
  currentOverride: string;
  reason: string;
  stillNeeded: boolean;
  details: string;
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function getPackageDependency(pkg: string, dep: string): string | null {
  const output = runCommand(`npm view ${pkg} dependencies --json 2>/dev/null`);
  if (!output) return null;
  try {
    const deps = JSON.parse(output);
    return deps[dep] || null;
  } catch {
    return null;
  }
}

/**
 * Check if a version range satisfies a minimum major version.
 * Handles ranges like "^7.0.0", ">=7.0.0", "~7.0.1", "7.x", etc.
 */
function satisfiesMinMajor(range: string | null, minMajor: number): boolean {
  if (!range) return false;

  // Get the minimum version that satisfies this range
  const minVersion = semver.minVersion(range);
  if (!minVersion) return false;

  return semver.major(minVersion) >= minMajor;
}

function checkBabelPluginIstanbul(): OverrideCheck {
  const pkg = 'babel-plugin-istanbul';
  const currentOverride = '7.0.1';
  const latestVersion = runCommand(`npm view ${pkg} version 2>/dev/null`);
  const testExcludeDep = getPackageDependency(`${pkg}@${latestVersion}`, 'test-exclude');

  const usesModernTestExclude = satisfiesMinMajor(testExcludeDep, 7);

  return {
    package: pkg,
    currentOverride,
    reason: 'Pinned for consistent override chain with test-exclude',
    stillNeeded: !usesModernTestExclude,
    details: usesModernTestExclude
      ? `Latest ${pkg}@${latestVersion} uses test-exclude@${testExcludeDep} (modern). Override may be removable.`
      : `Latest ${pkg}@${latestVersion} still uses test-exclude@${testExcludeDep || 'unknown'}. Override still needed.`,
  };
}

function checkTestExclude(): OverrideCheck {
  const pkg = 'test-exclude';
  const currentOverride = '7.0.1';

  // Check what babel-plugin-istanbul depends on
  const babelPluginDep = getPackageDependency('babel-plugin-istanbul@7.0.1', 'test-exclude');
  const usesV7 = satisfiesMinMajor(babelPluginDep, 7);

  return {
    package: pkg,
    currentOverride,
    reason: 'Upgraded from ^6.0.0 to avoid deprecated glob@7.x',
    stillNeeded: !usesV7,
    details: usesV7
      ? `babel-plugin-istanbul now uses test-exclude@${babelPluginDep}. Override may be removable.`
      : `babel-plugin-istanbul still uses test-exclude@${babelPluginDep || '^6.0.0'}. Override needed to avoid deprecated glob@7.x.`,
  };
}

/**
 * Packages that pull in vulnerable minimatch versions.
 * Each entry maps a package (at the version used by this project) to the
 * minimum acceptable minimatch major version it should depend on.
 */
const MINIMATCH_CONSUMERS: { pkg: string; minMajor: number }[] = [
  { pkg: 'eslint@9', minMajor: 10 },
  { pkg: '@eslint/eslintrc@3', minMajor: 10 },
  { pkg: 'eslint-plugin-import', minMajor: 10 },
  { pkg: 'eslint-plugin-react', minMajor: 10 },
];

function checkMinimatch(): OverrideCheck {
  const pkg = 'minimatch';
  const currentOverride = '>=10.2.1';
  const needsOverride: string[] = [];

  for (const consumer of MINIMATCH_CONSUMERS) {
    const dep = getPackageDependency(consumer.pkg, 'minimatch');
    if (dep && !satisfiesMinMajor(dep, consumer.minMajor)) {
      needsOverride.push(`${consumer.pkg} → minimatch@${dep}`);
    }
  }

  const stillNeeded = needsOverride.length > 0;

  return {
    package: pkg,
    currentOverride,
    reason: 'Override to fix ReDoS vulnerability (GHSA-3ppc-4f35-3m26)',
    stillNeeded,
    details: stillNeeded
      ? `Still needed for: ${needsOverride.join(', ')}`
      : 'All upstream packages now use minimatch >= 10.x. Override may be removable.',
  };
}

function checkGlob(testExcludeCheck: OverrideCheck): OverrideCheck {
  const pkg = 'glob';
  const currentOverride = '10.5.0';

  // Check what glob versions each test-exclude version uses
  const testExclude6Glob = getPackageDependency('test-exclude@6.0.0', 'glob');
  const testExclude7Glob = getPackageDependency('test-exclude@7.0.1', 'glob');

  // If test-exclude override is still needed, glob override is also needed
  return {
    package: pkg,
    currentOverride,
    reason: 'Pinned to avoid deprecated glob@7.x (unsupported since v9)',
    stillNeeded: testExcludeCheck.stillNeeded,
    details: testExcludeCheck.stillNeeded
      ? `test-exclude@6.0.0 uses glob@${testExclude6Glob}. Override needed until test-exclude override is removed.`
      : `test-exclude@7.0.1 uses glob@${testExclude7Glob}. Override can be removed with test-exclude override.`,
  };
}

function main(): void {
  console.log('Checking if dependency overrides are still needed...\n');
  console.log('='.repeat(70));

  try {
    // Run checks, passing results where needed to avoid duplicate calls
    const babelPluginCheck = checkBabelPluginIstanbul();
    const testExcludeCheck = checkTestExclude();
    const globCheck = checkGlob(testExcludeCheck);

    const minimatchCheck = checkMinimatch();
    const checks: OverrideCheck[] = [babelPluginCheck, testExcludeCheck, globCheck, minimatchCheck];

    let allRemovable = true;

    for (const check of checks) {
      const status = check.stillNeeded ? '❌ STILL NEEDED' : '✅ CAN REMOVE';
      console.log(`\n${check.package}@${check.currentOverride}`);
      console.log(`  Status: ${status}`);
      console.log(`  Reason: ${check.reason}`);
      console.log(`  Details: ${check.details}`);

      if (check.stillNeeded) {
        allRemovable = false;
      }
    }

    console.log('\n' + '='.repeat(70));

    if (allRemovable) {
      console.log('\n✅ All overrides can potentially be removed!');
      console.log('   Test by removing overrides from package.json and running:');
      console.log('   rm -rf node_modules package-lock.json && npm install && npm test');
    } else {
      console.log('\n❌ Some overrides are still needed.');
      console.log('   Review the details above for each package.');
    }

    console.log('\nTo check for deprecation warnings without overrides:');
    console.log('  1. Backup package.json and package-lock.json');
    console.log('  2. Remove the "overrides" section from package.json');
    console.log('  3. Run: rm -rf node_modules && npm install 2>&1 | grep -i deprec');
    console.log('  4. Restore backups if warnings appear\n');

    console.log('Exit codes: 0 = all removable, 1 = some still needed, 2 = error\n');

    process.exit(allRemovable ? EXIT_SUCCESS : EXIT_OVERRIDES_NEEDED);
  } catch (error) {
    console.error('\n❌ Error running override checks:', error);
    process.exit(EXIT_ERROR);
  }
}

main();
