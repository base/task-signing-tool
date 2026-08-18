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

const balance = (address: `0x${string}`, before: string, after: string): BalanceChange => ({
  name: address === ADDR_A ? 'TokenA' : 'TokenB',
  address,
  field: 'ETH Balance (wei)',
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

const matchingExpected = {
  stateOverrides: [stateOverride(ADDR_A, [override(KEY_A, VAL_A)])],
  stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])],
  balanceChanges: [balance(ADDR_A, VAL_A, VAL_B)],
};

describe('state-diff comparison pairing', () => {
  it('does not block when actual matches expected exactly', () => {
    const items = buildValidationItems(validation(matchingExpected, matchingExpected));

    expect(items.overrides).toHaveLength(1);
    expect(items.changes).toHaveLength(1);
    expect(items.balance).toHaveLength(1);
    expect(items.overrides[0]?.expected).toEqual(items.overrides[0]?.actual);
    expect(items.changes[0]?.expected).toEqual(items.changes[0]?.actual);
    expect(items.balance[0]?.expected).toEqual(items.balance[0]?.actual);
    expect(hasBlockingErrors(items)).toBe(false);
  });

  it('blocks when a declared entry differs', () => {
    const items = buildValidationItems(
      validation(matchingExpected, {
        stateOverrides: [stateOverride(ADDR_A, [override(KEY_A, VAL_C)])],
        stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_C)])],
        balanceChanges: [balance(ADDR_A, VAL_A, VAL_C)],
      })
    );

    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('produces blocking unexpected rows for undeclared actual entries', () => {
    const items = buildValidationItems(
      validation(matchingExpected, {
        stateOverrides: [
          stateOverride(ADDR_A, [override(KEY_A, VAL_A)]),
          stateOverride(ADDR_B, [override(KEY_B, VAL_C)]),
        ],
        stateChanges: [
          stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
          stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
        ],
        balanceChanges: [balance(ADDR_A, VAL_A, VAL_B), balance(ADDR_B, VAL_A, VAL_C)],
      })
    );

    const unexpectedOverrides = items.overrides.filter(row => !row.expected);
    const unexpectedChanges = items.changes.filter(row => !row.expected);
    const unexpectedBalances = items.balance.filter(row => !row.expected);

    expect(unexpectedOverrides).toHaveLength(1);
    expect(unexpectedOverrides[0]?.contractAddress).toBe(ADDR_B);
    expect(unexpectedOverrides[0]?.actual?.key).toBe(KEY_B);
    expect(unexpectedChanges).toHaveLength(1);
    expect(unexpectedChanges[0]?.contractAddress).toBe(ADDR_B);
    expect(unexpectedChanges[0]?.actual?.key).toBe(KEY_B);
    expect(unexpectedBalances).toHaveLength(1);
    expect(unexpectedBalances[0]?.contractAddress).toBe(ADDR_B);
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('pairs expected and actual by address and slot, not array index', () => {
    const expected = {
      stateOverrides: [
        stateOverride(ADDR_A, [override(KEY_A, VAL_A)]),
        stateOverride(ADDR_B, [override(KEY_B, VAL_B)]),
      ],
      stateChanges: [
        stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
        stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
      ],
      balanceChanges: [balance(ADDR_A, VAL_A, VAL_B), balance(ADDR_B, VAL_A, VAL_C)],
    };
    const reorderedActual = {
      stateOverrides: [
        stateOverride(ADDR_B, [override(KEY_B, VAL_B)]),
        stateOverride(ADDR_A, [override(KEY_A, VAL_A)]),
      ],
      stateChanges: [
        stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
        stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
      ],
      balanceChanges: [balance(ADDR_B, VAL_A, VAL_C), balance(ADDR_A, VAL_A, VAL_B)],
    };

    const items = buildValidationItems(validation(expected, reorderedActual));

    expect(items.overrides).toHaveLength(2);
    expect(items.changes).toHaveLength(2);
    expect(items.balance).toHaveLength(2);
    expect(items.overrides.every(row => row.expected && row.actual)).toBe(true);
    expect(items.changes.every(row => row.expected && row.actual)).toBe(true);
    expect(items.balance.every(row => row.expected && row.actual)).toBe(true);
    expect(hasBlockingErrors(items)).toBe(false);
  });
});

describe('evaluateValidationEntry undeclared rows', () => {
  it('renders a blocking unexpected change for an undeclared actual state change', () => {
    const items = buildValidationItems(
      validation(
        { stateChanges: [stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)])] },
        {
          stateChanges: [
            stateChange(ADDR_A, [change(KEY_A, VAL_A, VAL_B)]),
            stateChange(ADDR_B, [change(KEY_B, VAL_A, VAL_C)]),
          ],
        }
      )
    );
    const unexpectedIndex = items.changes.findIndex(row => !row.expected);
    const evaluation = evaluateValidationEntry({ kind: 'change', index: unexpectedIndex }, items);

    expect(evaluation.matchStatus.status).toBe('mismatch');
    expect(evaluation.matchStatus.text).toMatch(/unexpected/i);
    expect(evaluation.description?.variant).toBe('error');
    expect(evaluation.cards.expected.storageKey).toBe('Not found');
    expect(evaluation.cards.actual.storageKey).toBe(KEY_B);
  });
});
