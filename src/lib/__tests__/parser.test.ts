import { z } from 'zod';
import { getValidationSummary, parseFromString } from '../parser';

const config = {
  cmd: 'forge script Test',
  ledgerId: 0,
  rpcUrl: 'http://localhost:8545',
  expectedDomainAndMessageHashes: {
    address: '0x0000000000000000000000000000000000000001',
    domainHash: '0x' + 'a'.repeat(64),
    messageHash: '0x' + 'b'.repeat(64),
  },
  stateOverrides: [],
  stateChanges: [],
};

it('parses valid config JSON', () => {
  expect(parseFromString(JSON.stringify(config))).toEqual({ success: true, config });
});

it.each([0, 9007199254740992])('accepts nonnegative integer values including %s', value => {
  const input = {
    ...config,
    ledgerId: value,
    l2GasEstimation: { estimatedGas: '1', buffer: value, recommendedGasLimit: '1' },
  };
  expect(parseFromString(JSON.stringify(input))).toEqual({ success: true, config: input });
});

it.each([-1, 0.5])('rejects invalid integer fields with value %s', value => {
  const result = parseFromString(
    JSON.stringify({
      ...config,
      ledgerId: value,
      l2GasEstimation: { estimatedGas: '1', buffer: value, recommendedGasLimit: '1' },
    })
  );
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected parsing to fail');
  expect(result.zodError.issues.map(issue => issue.path)).toEqual([
    ['ledgerId'],
    ['l2GasEstimation', 'buffer'],
  ]);
  if (value === 0.5) {
    for (const issue of result.zodError.issues) {
      expect(issue.message).toBe('Expected integer, received float');
    }
  }
});

it('returns schema issues for invalid config JSON', () => {
  const result = parseFromString(JSON.stringify({ ...config, ledgerId: -1 }));
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected parsing to fail');
  expect(result.zodError.issues).toEqual([
    expect.objectContaining({ path: ['ledgerId'], code: 'too_small' }),
  ]);
});

it('returns one invalid JSON issue for malformed JSON', () => {
  const result = parseFromString('{');
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected parsing to fail');
  expect(result.zodError.issues).toEqual([
    { code: 'custom', path: [], message: expect.stringMatching(/^Invalid JSON:/) },
  ]);
});

it('formats the exact failure summary', () => {
  const failure = {
    success: false as const,
    zodError: new z.ZodError([{ code: 'custom', path: ['task', 'name'], message: 'Required' }]),
  };
  expect(getValidationSummary(failure)).toBe(
    '❌ Configuration has errors\n\nErrors (1):\n  • task.name: Required'
  );
});
