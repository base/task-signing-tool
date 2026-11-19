import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

const requireFromTest = createRequire(import.meta.url);

describe('dependency overrides', () => {
  it('preserves the cache glob adapter used by the signing dependencies', async () => {
    const cacheEntry = requireFromTest.resolve('cacache');
    const cacheGlob = requireFromTest(path.join(path.dirname(cacheEntry), 'util/glob.js')) as (
      pattern: string,
      options: { nodir: boolean }
    ) => Promise<string[]>;
    const pattern = path.join(process.cwd(), '__tests__/fixtures/valid-task/**/*.sol');
    const matches = await cacheGlob(pattern, { nodir: true });
    expect(matches.map(match => path.basename(match)).sort()).toEqual([
      'Test.s.sol',
      'Test.sol',
      'TestLib.sol',
    ]);
  });

  it('preserves coverage include and exclude matching', () => {
    const TestExclude = requireFromTest('test-exclude') as new (options: {
      cwd: string;
      include: string[];
      exclude: string[];
    }) => { shouldInstrument: (filename: string) => boolean };
    const exclude = new TestExclude({
      cwd: process.cwd(),
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    });
    expect(exclude.shouldInstrument(path.join(process.cwd(), 'src/lib/parser.ts'))).toBe(true);
    expect(exclude.shouldInstrument(path.join(process.cwd(), 'src/lib/parser.test.ts'))).toBe(
      false
    );
  });
});
