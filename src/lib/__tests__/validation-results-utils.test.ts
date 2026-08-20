import { describe, expect, it } from '@jest/globals';
import type {
  BalanceChange,
  Change,
  Override,
  StateChange,
  StateOverride,
  ValidationData,
} from '@/lib/types';
import {
  buildValidationItems,
  evaluateValidationEntry,
  hasBlockingErrors,
} from '@/lib/validation-results-utils';

const hash = (nibble: string): `0x${string}` => `0x${nibble.repeat(64)}`;
const ADDR_A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const ADDR_B = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const KEY_A = hash('1');
const KEY_B = hash('2');
const VAL_A = hash('a');
const VAL_B = hash('b');
const VAL_C = hash('c');
const FIELD = 'ETH Balance (wei)';

const override = (key: string, value: string): Override => ({
  key,
  value,
  description: 'override',
});

const change = (key: string, before: string, after: string): Change => ({
  key,
  before,
  after,
  description: 'change',
  allowDifference: false,
});

const balanceOf = (address: `0x${string}`, before: string, after: string): BalanceChange => ({
  name: address === ADDR_A ? 'TokenA' : 'TokenB',
  address,
  field: FIELD,
  before,
  after,
  description: 'balance',
  allowDifference: false,
});

const stateOverride = (address: `0x${string}`, overrides: Override[]): StateOverride => ({
  name: address === ADDR_A ? 'ProxyA' : 'ProxyB',
  address,
  overrides,
});

const stateChange = (address: `0x${string}`, changes: Change[]): StateChange => ({
  name: address === ADDR_A ? 'ProxyA' : 'ProxyB',
  address,
  changes,
});

const validation = (
  expected: Partial<ValidationData['expected']>,
  actual: Partial<ValidationData['actual']>
): ValidationData => ({
  expected: {
    stateOverrides: expected.stateOverrides ?? [],
    stateChanges: expected.stateChanges ?? [],
    balanceChanges: expected.balanceChanges ?? [],
  },
  actual: {
    stateOverrides: actual.stateOverrides ?? [],
    stateChanges: actual.stateChanges ?? [],
    balanceChanges: actual.balanceChanges ?? [],
  },
});

const matching = {
  stateOverrides: [stateOverride(ADDR_A, [override(KEY_A, VAL_A)])],
  stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])],
  balanceChanges: [balanceOf(ADDR_A, VAL_A, VAL_B)],
};

describe('state-diff comparison pairing', () => {
  it('does not block when actual matches expected', () => {
    expect(hasBlockingErrors(buildValidationItems(validation(matching, matching)))).toBe(false);
  });

  it('blocks when a declared entry differs', () => {
    const items = buildValidationItems(
      validation(matching, {
        stateOverrides: [stateOverride(ADDR_A, [override(KEY_A, VAL_C)])],
        stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_C)])],
        balanceChanges: [balanceOf(ADDR_A, VAL_A, VAL_C)],
      })
    );
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('blocks undeclared actual overrides, changes, and balances', () => {
    const items = buildValidationItems(
      validation(matching, {
        stateOverrides: [
          stateOverride(ADDR_A, [override(KEY_A, VAL_A)]),
          stateOverride(ADDR_B, [override(KEY_B, VAL_C)]),
        ],
        stateChanges: [
          stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
          stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
        ],
        balanceChanges: [balanceOf(ADDR_A, VAL_A, VAL_B), balanceOf(ADDR_B, VAL_A, VAL_C)],
      })
    );
    expect(items.overrides.filter(row => !row.expected)).toHaveLength(1);
    expect(items.changes.filter(row => !row.expected)).toHaveLength(1);
    expect(items.balance.filter(row => !row.expected)).toHaveLength(1);
    expect(items.balance.filter(row => !row.expected)[0]?.contractAddress).toBe(ADDR_B);
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('pairs overrides, changes, and balances by identity, not array index', () => {
    const expected = {
      stateOverrides: [
        stateOverride(ADDR_A, [override(KEY_A, VAL_A)]),
        stateOverride(ADDR_B, [override(KEY_B, VAL_B)]),
      ],
      stateChanges: [
        stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
        stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
      ],
      balanceChanges: [balanceOf(ADDR_A, VAL_A, VAL_B), balanceOf(ADDR_B, VAL_A, VAL_C)],
    };
    const items = buildValidationItems(
      validation(expected, {
        stateOverrides: [...expected.stateOverrides].reverse(),
        stateChanges: [...expected.stateChanges].reverse(),
        balanceChanges: [...expected.balanceChanges].reverse(),
      })
    );
    expect(items.overrides).toHaveLength(2);
    expect(items.changes).toHaveLength(2);
    expect(items.balance).toHaveLength(2);
    expect(items.overrides.every(row => row.expected && row.actual)).toBe(true);
    expect(items.changes.every(row => row.expected && row.actual)).toBe(true);
    expect(items.balance.every(row => row.expected && row.actual)).toBe(true);
    expect(hasBlockingErrors(items)).toBe(false);
  });

  it('emits duplicate actual identities as blocking unexpected rows', () => {
    const items = buildValidationItems(
      validation(
        { stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])] },
        {
          stateChanges: [
            stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B), change(KEY_A, VAL_A, VAL_C)]),
          ],
        }
      )
    );
    expect(items.changes).toHaveLength(2);
    expect(items.changes.filter(row => !row.expected)).toHaveLength(1);
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('emits duplicate expected identities as blocking missing rows', () => {
    const items = buildValidationItems(
      validation(
        {
          stateChanges: [
            stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B), change(KEY_A, VAL_A, VAL_C)]),
          ],
        },
        { stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])] }
      )
    );
    expect(items.changes).toHaveLength(2);
    expect(items.changes.filter(row => !row.actual)).toHaveLength(1);
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('compares hex keys and values case-insensitively', () => {
    const upperA = `0x${'A'.repeat(64)}`;
    const upperB = `0x${'B'.repeat(64)}`;
    const items = buildValidationItems(
      validation(
        {
          stateOverrides: [stateOverride(ADDR_A, [override(VAL_A, VAL_B)])],
          stateChanges: [stateChange(ADDR_A, [change(VAL_A, VAL_A, VAL_B)])],
          balanceChanges: [balanceOf(ADDR_A, VAL_A, VAL_B)],
        },
        {
          stateOverrides: [stateOverride(ADDR_A, [override(upperA, upperB)])],
          stateChanges: [stateChange(ADDR_A, [change(upperA, upperA, upperB)])],
          balanceChanges: [balanceOf(ADDR_A, upperA, upperB)],
        }
      )
    );
    expect(hasBlockingErrors(items)).toBe(false);

    const changeEval = evaluateValidationEntry({ kind: 'change', index: 0 }, items);
    expect(changeEval.matchStatus.status).toBe('match');
    expect(changeEval.cards.actual.storageKeyDiffs).toBeUndefined();
    expect(changeEval.cards.actual.beforeValueDiffs).toBeUndefined();
    expect(changeEval.cards.actual.afterValueDiffs).toBeUndefined();
  });
});
