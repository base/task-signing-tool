import { describe, expect, it } from '@jest/globals';
import { checkOverrides } from '../scripts/override-checker';

function npmResponses(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    'deepmerge version': '4.3.1',
    'jest-config version': '30.5.2',
    'jest-config@30.5.2 dependencies': { deepmerge: '^4.3.1' },
    ...overrides,
  };
  return (pkg: string, field: string) => responses[`${pkg} ${field}`];
}

describe('checkOverrides', () => {
  it('returns 0 when deepmerge is newer than 4.3.1', () => {
    expect(checkOverrides(npmResponses({ 'deepmerge version': '4.3.2' }))).toBe(0);
  });

  it('returns 0 when the latest jest-config drops deepmerge', () => {
    expect(
      checkOverrides(
        npmResponses({
          'jest-config version': '31.0.0',
          'jest-config@31.0.0 dependencies': {},
        })
      )
    ).toBe(0);
  });

  it('returns 1 when deepmerge is 4.3.1 and Jest still requires it', () => {
    expect(checkOverrides(npmResponses())).toBe(1);
  });

  it.each(['deepmerge version', 'jest-config version', 'jest-config@30.5.2 dependencies'])(
    'returns 2 when the %s lookup throws',
    lookup => {
      const responses = npmResponses();
      expect(
        checkOverrides((pkg, field) => {
          if (`${pkg} ${field}` === lookup) throw new Error('Registry unavailable');
          return responses(pkg, field);
        })
      ).toBe(2);
    }
  );

  it.each<[string, unknown]>([
    ['deepmerge version', 431],
    ['jest-config version', null],
  ])('returns 2 when %s is not a string', (lookup, version) => {
    expect(checkOverrides(npmResponses({ [lookup]: version }))).toBe(2);
  });
});
