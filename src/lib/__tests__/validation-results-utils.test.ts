import { buildValidationItems, hasBlockingErrors } from '../validation-results-utils';
import type { ValidationData } from '../types/validation-data';

describe('buildValidationItems change/override/balance matching', () => {
  it('does not report a false mismatch when config order differs from actual (sorted) order', () => {
    const ownerChange = {
      key: '0x0000000000000000000000000000000000000000000000000000000000000001',
      before: '0x0000000000000000000000000000000000000000000000000000000000000000',
      after: '0x000000000000000000000000000000000000000000000000000000000000dead',
      description: 'owner slot',
      allowDifference: false,
    };

    const pausedChange = {
      key: '0x0000000000000000000000000000000000000000000000000000000000000002',
      before: '0x0000000000000000000000000000000000000000000000000000000000000000',
      after: '0x0000000000000000000000000000000000000000000000000000000000000001',
      description: 'paused flag',
      allowDifference: false,
    };

    // Human-authored config: paused flag listed first (narratively relevant),
    // owner slot second. getExpectedData() in validation-service.ts returns
    // parsedConfig.stateChanges completely unsorted, exactly like this.
    const expectedStateChanges = [
      {
        name: 'MyContract',
        address: '0x0000000000000000000000000000000000000010' as `0x${string}`,
        changes: [pausedChange, ownerChange],
      },
    ];

    // state-diff.ts's ValidatorStateDiff always sorts a contract's changes by
    // key ascending (see the `.sort((a, b) => a.key.localeCompare(b.key))`
    // call it makes before returning results) -- so "actual" naturally comes
    // back owner-slot-first here, same two changes, same values.
    const actualStateChanges = [
      {
        name: 'MyContract',
        address: '0x0000000000000000000000000000000000000010' as `0x${string}`,
        changes: [ownerChange, pausedChange],
      },
    ];

    const validationResult: ValidationData = {
      expected: { stateOverrides: [], stateChanges: expectedStateChanges, balanceChanges: [] },
      actual: { stateOverrides: [], stateChanges: actualStateChanges, balanceChanges: [] },
    };

    const items = buildValidationItems(validationResult);

    // Each expected entry is paired with the actual entry that has the same
    // key, regardless of position in either array.
    const paused = items.changes.find(c => c.expected.description === 'paused flag');
    const owner = items.changes.find(c => c.expected.description === 'owner slot');
    expect(paused?.actual?.key).toBe(pausedChange.key);
    expect(owner?.actual?.key).toBe(ownerChange.key);

    // A task where the real on-chain state changes exactly match what the
    // config expects (same keys, same before/after values) must not be
    // flagged as a blocking validation failure just because of array order.
    expect(hasBlockingErrors(items)).toBe(false);
  });

  it('still reports a genuine mismatch when the actual value truly differs', () => {
    const expectedStateChanges = [
      {
        name: 'MyContract',
        address: '0x0000000000000000000000000000000000000010' as `0x${string}`,
        changes: [
          {
            key: '0x0000000000000000000000000000000000000000000000000000000000000001',
            before: '0x0000000000000000000000000000000000000000000000000000000000000000',
            after: '0x000000000000000000000000000000000000000000000000000000000000dead',
            description: 'owner slot',
            allowDifference: false,
          },
        ],
      },
    ];

    const actualStateChanges = [
      {
        name: 'MyContract',
        address: '0x0000000000000000000000000000000000000010' as `0x${string}`,
        changes: [
          {
            key: '0x0000000000000000000000000000000000000000000000000000000000000001',
            before: '0x0000000000000000000000000000000000000000000000000000000000000000',
            // actually set to a different address than expected -- a real mismatch
            after: '0x000000000000000000000000000000000000000000000000000000beef0000',
            description: 'owner slot',
            allowDifference: false,
          },
        ],
      },
    ];

    const validationResult: ValidationData = {
      expected: { stateOverrides: [], stateChanges: expectedStateChanges, balanceChanges: [] },
      actual: { stateOverrides: [], stateChanges: actualStateChanges, balanceChanges: [] },
    };

    const items = buildValidationItems(validationResult);
    expect(hasBlockingErrors(items)).toBe(true);
  });
});
