import { describe, expect, it } from '@jest/globals';
import type { Change, StateChange, ValidationData } from '@/lib/types';
import { buildValidationItems, hasBlockingErrors } from '@/lib/validation-results-utils';

const hash = (nibble: string): `0x${string}` => `0x${nibble.repeat(64)}`;
const ADDR_A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const ADDR_B = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const KEY_A = hash('1');
const KEY_B = hash('2');
const VAL_A = hash('a');
const VAL_B = hash('b');
const VAL_C = hash('c');

const change = (key: string, before: string, after: string): Change => ({
  key,
  before,
  after,
  description: 'change',
  allowDifference: false,
});

const stateChange = (address: `0x${string}`, changes: Change[]): StateChange => ({
  name: address === ADDR_A ? 'ProxyA' : 'ProxyB',
  address,
  changes,
});

const validation = (expected: StateChange[], actual: StateChange[]): ValidationData => ({
  expected: { stateOverrides: [], stateChanges: expected, balanceChanges: [] },
  actual: { stateOverrides: [], stateChanges: actual, balanceChanges: [] },
});

describe('state-diff comparison pairing', () => {
  it('blocks undeclared actual state changes', () => {
    const items = buildValidationItems(
      validation(
        [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])],
        [
          stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
          stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
        ]
      )
    );
    const unexpected = items.changes.filter(row => !row.expected);
    expect(unexpected).toHaveLength(1);
    expect(unexpected[0]?.actual?.key).toBe(KEY_B);
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('pairs by address and slot, not array index', () => {
    const items = buildValidationItems(
      validation(
        [
          stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
          stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
        ],
        [
          stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
          stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
        ]
      )
    );
    expect(items.changes).toHaveLength(2);
    expect(items.changes.every(row => row.expected && row.actual)).toBe(true);
    expect(hasBlockingErrors(items)).toBe(false);
  });
});
