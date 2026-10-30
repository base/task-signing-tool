import { execFileSync } from 'node:child_process';
import semver from 'semver';

function npmView(pkg: string, field: string): unknown {
  return JSON.parse(execFileSync('npm', ['view', pkg, field, '--json'], { encoding: 'utf-8' }));
}

try {
  const latestDeepmerge = npmView('deepmerge', 'version');
  const latestJestConfig = npmView('jest-config', 'version');
  if (typeof latestDeepmerge !== 'string' || typeof latestJestConfig !== 'string') {
    throw new Error('npm did not return package versions');
  }
  const dependencies = npmView(`jest-config@${latestJestConfig}`, 'dependencies') as Record<
    string,
    string
  >;
  const dropsDeepmerge = !Object.hasOwn(dependencies, 'deepmerge');
  const hasNewRelease = semver.gt(latestDeepmerge, '4.3.1');

  console.log('jest-config > deepmerge override: 4.1.1');
  console.log(`Latest deepmerge: ${latestDeepmerge}`);
  console.log(`Latest jest-config: ${latestJestConfig}`);
  if (dropsDeepmerge || hasNewRelease) {
    console.log(
      'An upstream release may allow removing the override. Update Jest or deepmerge, then verify npm audit and npm test.'
    );
    process.exitCode = 0;
  } else {
    console.log('Override still needed: Jest requires deepmerge, and no newer fix is published.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('Error checking overrides:', error);
  process.exitCode = 2;
}
