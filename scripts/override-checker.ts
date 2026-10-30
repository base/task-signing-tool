import semver from 'semver';

export function checkOverrides(npmView: (pkg: string, field: string) => unknown): number {
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
      return 0;
    } else {
      console.log('Override still needed: Jest requires deepmerge, and no newer fix is published.');
      return 1;
    }
  } catch (error) {
    console.error('Error checking overrides:', error);
    return 2;
  }
}
