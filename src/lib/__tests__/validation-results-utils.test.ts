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
const SIGNING_HASHES = { address: ADDR_A, domainHash: VAL_A, messageHash: VAL_B };

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
  ledgerId: 0,
  expected: {
    domainAndMessageHashes: SIGNING_HASHES,
    stateOverrides: expected.stateOverrides ?? [],
    stateChanges: expected.stateChanges ?? [],
    balanceChanges: expected.balanceChanges ?? [],
  },
  actual: {
    domainAndMessageHashes: actual.domainAndMessageHashes,
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

describe('signing comparison', () => {
  it('matches EIP-712 signing data without blocking when hashes match', () => {
    const items = buildValidationItems(validation({}, { domainAndMessageHashes: SIGNING_HASHES }));
    const dataToSign = `0x1901${'a'.repeat(64)}${'b'.repeat(64)}`;

    expect(items.signing).toHaveLength(1);
    const evaluation = evaluateValidationEntry({ kind: 'signing', index: 0 }, items);
    expect(evaluation.cards.expected.afterValue).toBe(dataToSign);
    expect(evaluation.cards.actual.afterValue).toBe(dataToSign);
    expect(evaluation.matchStatus.status).toBe('match');
    expect(hasBlockingErrors(items)).toBe(false);
  });

  it('mismatches and blocks signing when hashes differ', () => {
    const items = buildValidationItems(
      validation({}, { domainAndMessageHashes: { ...SIGNING_HASHES, messageHash: VAL_C } })
    );
    const evaluation = evaluateValidationEntry({ kind: 'signing', index: 0 }, items);

    expect(evaluation.cards.actual.afterValue).toBe(`0x1901${'a'.repeat(64)}${'c'.repeat(64)}`);
    expect(evaluation.matchStatus.status).toBe('mismatch');
    expect(hasBlockingErrors(items)).toBe(true);
  });

  it('omits signing items when actual hashes are absent', () => {
    expect(buildValidationItems(validation({}, {})).signing).toEqual([]);
  });
});

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

describe('declared entry evaluation', () => {
  const evaluate = (
    kind: 'override' | 'change' | 'balance',
    actualAfter: string | undefined,
    allowDifference = false,
    description = ''
  ) => {
    const expected = {
      stateOverrides: [
        stateOverride(ADDR_A, [{ ...override(KEY_A, '0x1'), allowDifference, description }]),
      ],
      stateChanges: [
        stateChange(ADDR_A, [{ ...change(KEY_A, '0x0', '0x1'), allowDifference, description }]),
      ],
      balanceChanges: [{ ...balanceOf(ADDR_A, '0x0', '0x1'), allowDifference, description }],
    };
    const actual =
      actualAfter === undefined
        ? {}
        : {
            stateOverrides: [stateOverride(ADDR_A, [override(KEY_A, actualAfter)])],
            stateChanges: [stateChange(ADDR_A, [change(KEY_A, '0x0', actualAfter)])],
            balanceChanges: [balanceOf(ADDR_A, '0x0', actualAfter)],
          };
    return evaluateValidationEntry(
      { kind, index: 0 },
      buildValidationItems(validation(expected, actual))
    );
  };

  describe.each([
    [
      'override',
      'Match - This override is correct',
      'Mismatch - Override values do not match expected',
    ],
    ['change', 'Match - This change is correct', 'Mismatch - Change values do not match expected'],
    [
      'balance',
      'Match - Balance change matches expected',
      'Mismatch - Balance change does not match expected',
    ],
  ] as const)('%s status', (kind, matchText, mismatchText) => {
    it.each([
      ['0x1', false, 'match', matchText, 'check'],
      ['0x1', true, 'match', matchText, 'check'],
      [
        '0x2',
        true,
        'expected-difference',
        'Expected Difference - This mismatch is acceptable and expected',
        'check',
      ],
      [
        undefined,
        true,
        'expected-difference',
        'Expected Difference - This mismatch is acceptable and expected',
        'check',
      ],
      ['0x2', false, 'mismatch', mismatchText, 'x'],
      [undefined, false, 'missing', 'Missing - Not found in actual results', 'x'],
    ] as const)(
      'actual %s, allowDifference %s yields %s',
      (actualAfter, allowDifference, status, text, icon) => {
        expect(evaluate(kind, actualAfter, allowDifference).matchStatus).toEqual({
          status,
          text,
          icon,
        });
      }
    );
  });

  describe.each(['override', 'change'] as const)('%s description', kind => {
    it.each([
      [false, 'info', 'lightbulb', 'What this does'],
      [true, 'expected-difference', 'check', 'Expected Difference - This is Fine'],
    ] as const)(
      'preserves non-empty text with allowDifference %s',
      (allowDifference, variant, icon, title) => {
        expect(evaluate(kind, '0x1', allowDifference, '  explanation  ').description).toEqual({
          variant,
          icon,
          title,
          text: '  explanation  ',
        });
      }
    );

    it.each([
      [false, undefined],
      [true, undefined],
      [false, ''],
      [true, ''],
      [false, ' \t\n '],
      [true, ' \t\n '],
    ] as const)(
      'omits empty text with allowDifference %s and description %j',
      (allowDifference, description) => {
        expect(evaluate(kind, '0x1', allowDifference, description).description).toBeUndefined();
      }
    );
  });

  const deltas =
    'Expected delta: +0.000000000000000001 ETH (+1 wei)\n\nActual delta: +0.000000000000000001 ETH (+1 wei)';
  it.each([
    [false, undefined, deltas],
    [false, 'explanation', `${deltas}\n\nexplanation`],
    [false, '   ', `${deltas}\n\n   `],
    [true, undefined, `${deltas}\n\nDifferences for this balance change are allowed.`],
    [
      true,
      'explanation',
      `${deltas}\n\nexplanation\n\nDifferences for this balance change are allowed.`,
    ],
    [true, '   ', `${deltas}\n\n   \n\nDifferences for this balance change are allowed.`],
  ] as const)(
    'describes balance deltas with allowDifference %s and description %j',
    (allowDifference, description, text) => {
      expect(evaluate('balance', '0x1', allowDifference, description).description).toEqual({
        variant: allowDifference ? 'expected-difference' : 'info',
        icon: allowDifference ? 'check' : 'coins',
        title: allowDifference
          ? 'Expected Difference - Balance Change OK'
          : 'Balance Change Details',
        text,
      });
    }
  );
});

describe('task origin evaluation', () => {
  it('keeps disabled validation available for the skipped UI without blocking', () => {
    const items = buildValidationItems({
      ...validation({}, {}),
      taskOriginValidation: {
        enabled: false,
        hidden: false,
        results: [{ role: 'taskCreator', success: false }],
      },
    });

    expect(items.taskOrigin).toHaveLength(1);
    expect(items.taskOrigin[0].isDisabled).toBe(true);
    expect(hasBlockingErrors(items)).toBe(false);
    expect(evaluateValidationEntry({ kind: 'taskOrigin', index: 0 }, items)).toBeTruthy();
  });

  it('matches without blocking when all enabled signatures pass', () => {
    const items = buildValidationItems({
      ...validation({}, {}),
      taskOriginValidation: {
        enabled: true,
        results: [
          { role: 'taskCreator', success: true },
          { role: 'baseFacilitator', success: true },
          { role: 'securityCouncilFacilitator', success: true },
        ],
      },
    });

    expect(
      evaluateValidationEntry({ kind: 'taskOrigin', index: 0 }, items).matchStatus.status
    ).toBe('match');
    expect(hasBlockingErrors(items)).toBe(false);
  });

  it('mismatches and blocks when one enabled signature fails', () => {
    const items = buildValidationItems({
      ...validation({}, {}),
      taskOriginValidation: {
        enabled: true,
        results: [
          { role: 'taskCreator', success: true },
          { role: 'baseFacilitator', success: false },
          { role: 'securityCouncilFacilitator', success: true },
        ],
      },
    });

    expect(
      evaluateValidationEntry({ kind: 'taskOrigin', index: 0 }, items).matchStatus.status
    ).toBe('mismatch');
    expect(hasBlockingErrors(items)).toBe(true);
  });
});
