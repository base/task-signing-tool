import { formatEther } from 'viem';

import {
  BalanceChangeComparison,
  OverrideComparison,
  SigningDataComparison,
  StateChangeComparison,
  StringDiff,
  ValidationData,
  ValidationItemsByStep,
} from '@/lib/types';

const NOT_FOUND_TEXT = 'Not found';

export type ValidationNavEntry =
  | { kind: 'signing'; index: number }
  | { kind: 'override'; index: number }
  | { kind: 'change'; index: number }
  | { kind: 'balance'; index: number };

export type ValidationMatchStatus =
  | {
      status: 'match';
      bgClass: string;
      icon: string;
      text: string;
    }
  | {
      status: 'mismatch' | 'expected-difference' | 'missing';
      bgClass: string;
      icon: string;
      text: string;
    };

export interface ValidationDescription {
  variant: 'info' | 'expected-difference';
  icon: string;
  title: string;
  text: string;
}

export interface ComparisonCardContent {
  contractName: string;
  contractAddress: string;
  storageKey: string;
  storageKeyDiffs?: StringDiff[];
  beforeValue?: string;
  beforeValueDiffs?: StringDiff[];
  afterValue: string;
  afterValueDiffs?: StringDiff[];
}

export interface ValidationEntryEvaluation {
  matchStatus: ValidationMatchStatus;
  description?: ValidationDescription;
  cards: {
    expected: ComparisonCardContent;
    actual: ComparisonCardContent;
  };
  contractName: string;
  stepLabel: string;
}

export interface StepCounts {
  signing: number;
  overrides: number;
  changes: number;
  balance: number;
}

const STEP_DEFINITIONS = [
  { kind: 'signing', label: 'Domain/Message Hash', itemsKey: 'signing', order: 1 },
  { kind: 'override', label: 'State Overrides', itemsKey: 'overrides', order: 2 },
  { kind: 'change', label: 'State Changes', itemsKey: 'changes', order: 3 },
  { kind: 'balance', label: 'Balance Changes', itemsKey: 'balance', order: 4 },
] as const satisfies ReadonlyArray<{
  kind: ValidationNavEntry['kind'];
  label: string;
  itemsKey: keyof ValidationItemsByStep;
  order: number;
}>;

type StepDefinition = (typeof STEP_DEFINITIONS)[number];
type StepKind = StepDefinition['kind'];

const STEP_DEFINITION_MAP: Record<StepKind, StepDefinition> = STEP_DEFINITIONS.reduce(
  (acc, definition) => {
    acc[definition.kind] = definition;
    return acc;
  },
  {} as Record<StepKind, StepDefinition>
);

export const STEP_LABELS: Record<ValidationNavEntry['kind'], string> = STEP_DEFINITIONS.reduce(
  (acc, definition) => {
    acc[definition.kind] = definition.label;
    return acc;
  },
  {} as Record<ValidationNavEntry['kind'], string>
);

export const formatBalanceValue = (hex: string): string => {
  try {
    const value = BigInt(hex);
    const wei = value.toString();
    const eth = formatEther(value);
    const normalizedHex = hex.startsWith('0x') ? hex : `0x${hex}`;
    return `${eth} ETH (${wei} wei)\nHex: ${normalizedHex}`;
  } catch {
    return hex;
  }
};

export const formatBalanceDelta = (beforeHex: string, afterHex: string): string => {
  try {
    const before = BigInt(beforeHex);
    const after = BigInt(afterHex);
    const delta = after - before;
    if (delta === BigInt(0)) {
      return '0 ETH (0 wei)';
    }
    const abs = delta >= BigInt(0) ? delta : -delta;
    const sign = delta >= BigInt(0) ? '+' : '-';
    const wei = abs.toString();
    const eth = formatEther(abs);
    return `${sign}${eth} ETH (${sign}${wei} wei)`;
  } catch {
    return `${afterHex} - ${beforeHex}`;
  }
};

export const getFieldDiffs = (expected: string, actual: string): StringDiff[] => {
  if (expected === actual) {
    return [{ type: 'unchanged', value: expected }];
  }

  const diffs: StringDiff[] = [];

  let prefixLength = 0;
  while (
    prefixLength < Math.min(expected.length, actual.length) &&
    expected[prefixLength] === actual[prefixLength]
  ) {
    prefixLength++;
  }

  let suffixLength = 0;
  while (
    suffixLength < Math.min(expected.length - prefixLength, actual.length - prefixLength) &&
    expected[expected.length - 1 - suffixLength] === actual[actual.length - 1 - suffixLength]
  ) {
    suffixLength++;
  }

  if (prefixLength > 0) {
    diffs.push({
      type: 'unchanged',
      value: expected.substring(0, prefixLength),
    });
  }

  const removedPart = expected.substring(prefixLength, expected.length - suffixLength);
  if (removedPart) {
    diffs.push({
      type: 'removed',
      value: removedPart,
    });
  }

  const addedPart = actual.substring(prefixLength, actual.length - suffixLength);
  if (addedPart) {
    diffs.push({
      type: 'added',
      value: addedPart,
    });
  }

  if (suffixLength > 0) {
    diffs.push({
      type: 'unchanged',
      value: expected.substring(expected.length - suffixLength),
    });
  }

  return diffs;
};

const buildSigningComparisons = (
  validationResult: ValidationData | null
): SigningDataComparison[] => {
  if (!validationResult) return [];

  const expectedHashes = validationResult.expected.domainAndMessageHashes;
  const actualHashes = validationResult.actual.domainAndMessageHashes;

  if (!expectedHashes || !actualHashes) return [];

  const expectedDataToSign = `0x1901${expectedHashes.domainHash.replace(
    '0x',
    ''
  )}${expectedHashes.messageHash.replace('0x', '')}`;
  const actualDataToSign = `0x1901${actualHashes.domainHash.replace(
    '0x',
    ''
  )}${actualHashes.messageHash.replace('0x', '')}`;

  return [
    {
      contractName: 'EIP-712 Signing Data',
      contractAddress: expectedHashes.address,
      expected: {
        dataToSign: expectedDataToSign,
        address: expectedHashes.address,
        domainHash: expectedHashes.domainHash,
        messageHash: expectedHashes.messageHash,
      },
      actual: {
        dataToSign: actualDataToSign,
        address: actualHashes.address,
        domainHash: actualHashes.domainHash,
        messageHash: actualHashes.messageHash,
      },
    },
  ];
};

const buildOverrideComparisons = (
  validationResult: ValidationData | null
): OverrideComparison[] => {
  if (!validationResult) return [];

  const expectedOverrides = validationResult.expected.stateOverrides ?? [];
  const actualOverrides = validationResult.actual.stateOverrides ?? [];

  return expectedOverrides.flatMap((stateOverride, soIndex) =>
    stateOverride.overrides.map((override, oIndex) => ({
      contractName: stateOverride.name,
      contractAddress: stateOverride.address,
      expected: override,
      actual: actualOverrides[soIndex]?.overrides?.[oIndex],
    }))
  );
};

const buildChangeComparisons = (
  validationResult: ValidationData | null
): StateChangeComparison[] => {
  if (!validationResult) return [];

  const expectedChanges = validationResult.expected.stateChanges ?? [];
  const actualChanges = validationResult.actual.stateChanges ?? [];

  return expectedChanges.flatMap((stateChange, scIndex) =>
    stateChange.changes.map((change, cIndex) => ({
      contractName: stateChange.name,
      contractAddress: stateChange.address,
      expected: change,
      actual: actualChanges[scIndex]?.changes?.[cIndex],
    }))
  );
};

const buildBalanceComparisons = (
  validationResult: ValidationData | null
): BalanceChangeComparison[] => {
  if (!validationResult) return [];

  const expectedBalances = validationResult.expected.balanceChanges ?? [];
  const actualBalances = validationResult.actual.balanceChanges ?? [];

  return expectedBalances.map((balanceChange, bcIndex) => ({
    contractName: balanceChange.name,
    contractAddress: balanceChange.address,
    expected: balanceChange,
    actual: actualBalances[bcIndex],
  }));
};

export const buildValidationItems = (
  validationResult: ValidationData | null
): ValidationItemsByStep => ({
  signing: buildSigningComparisons(validationResult),
  overrides: buildOverrideComparisons(validationResult),
  changes: buildChangeComparisons(validationResult),
  balance: buildBalanceComparisons(validationResult),
});

export const buildNavList = (items: ValidationItemsByStep): ValidationNavEntry[] => {
  return STEP_DEFINITIONS.flatMap(definition => {
    const stepItems = items[definition.itemsKey];
    return stepItems.map((_, index) => ({ kind: definition.kind, index }));
  });
};

export const getStepCounts = (items: ValidationItemsByStep): StepCounts =>
  STEP_DEFINITIONS.reduce(
    (acc, definition) => {
      acc[definition.itemsKey] = items[definition.itemsKey].length;
      return acc;
    },
    { signing: 0, overrides: 0, changes: 0, balance: 0 } satisfies StepCounts
  );

const matchesOverride = (comparison: OverrideComparison) =>
  comparison.actual &&
  comparison.expected.key === comparison.actual.key &&
  comparison.expected.value === comparison.actual.value;

const matchesChange = (comparison: StateChangeComparison) =>
  comparison.actual &&
  comparison.expected.key === comparison.actual.key &&
  comparison.expected.before === comparison.actual.before &&
  comparison.expected.after === comparison.actual.after;

const matchesBalance = (comparison: BalanceChangeComparison) =>
  comparison.actual &&
  comparison.expected.field === comparison.actual.field &&
  comparison.expected.before === comparison.actual.before &&
  comparison.expected.after === comparison.actual.after;

export const hasBlockingErrors = (items: ValidationItemsByStep): boolean => {
  const signingMismatch = items.signing.some(
    signing => !signing.actual || signing.expected.dataToSign !== signing.actual.dataToSign
  );
  if (signingMismatch) return true;

  const overrideMismatch = items.overrides.some(
    override => !override.actual || !matchesOverride(override)
  );
  if (overrideMismatch) return true;

  const changeMismatch = items.changes.some(
    change => !change.actual || (!matchesChange(change) && !change.expected.allowDifference)
  );
  if (changeMismatch) return true;

  const balanceMismatch = items.balance.some(
    balance => !balance.actual || (!matchesBalance(balance) && !balance.expected.allowDifference)
  );
  return balanceMismatch;
};

const defaultContractAddress = (address?: string) =>
  address && address.trim().length > 0 ? address : 'Unknown Address';

const STATUS_STYLES: Record<ValidationMatchStatus['status'], { bgClass: string; icon: string }> = {
  match: { bgClass: 'bg-blue-700', icon: '✅' },
  mismatch: { bgClass: 'bg-red-600', icon: '❌' },
  missing: { bgClass: 'bg-blue-500', icon: '❌' },
  'expected-difference': { bgClass: 'bg-emerald-600', icon: '✅' },
};

const createMatchStatus = (
  status: ValidationMatchStatus['status'],
  text: string
): ValidationMatchStatus => ({
  status,
  text,
  ...STATUS_STYLES[status],
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled entry kind: ${(value as ValidationNavEntry).kind}`);
};

export const evaluateValidationEntry = (
  entry: ValidationNavEntry,
  items: ValidationItemsByStep
): ValidationEntryEvaluation => {
  switch (entry.kind) {
    case 'signing': {
      const item = items.signing[entry.index]!;
      const expectedData = item.expected.dataToSign;
      const actualData = item.actual?.dataToSign ?? NOT_FOUND_TEXT;
      const match = item.actual ? expectedData === item.actual.dataToSign : false;
      const matchStatus: ValidationMatchStatus = item.actual
        ? match
          ? createMatchStatus('match', 'Match - EIP-712 data matches expected')
          : createMatchStatus('mismatch', 'Mismatch - EIP-712 data does not match expected')
        : createMatchStatus('missing', 'Missing - Not found in actual results');

      const description =
        item.expected.description && item.expected.description.trim().length > 0
          ? ({
              variant: 'info',
              icon: '💡',
              title: 'What this does',
              text: item.expected.description,
            } satisfies ValidationDescription)
          : undefined;

      return {
        matchStatus,
        description,
        stepLabel: STEP_DEFINITION_MAP.signing.label,
        contractName: item.contractName,
        cards: {
          expected: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: 'EIP-712 Data to Sign',
            afterValue: expectedData,
          },
          actual: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: 'EIP-712 Data to Sign',
            afterValue: actualData,
            afterValueDiffs: getFieldDiffs(expectedData, actualData),
          },
        },
      };
    }
    case 'override': {
      const item = items.overrides[entry.index]!;
      const actualKey = item.actual?.key ?? NOT_FOUND_TEXT;
      const actualValue = item.actual?.value ?? NOT_FOUND_TEXT;
      const match = matchesOverride(item);
      const matchStatus: ValidationMatchStatus = item.actual
        ? match
          ? createMatchStatus('match', 'Match - This override is correct')
          : createMatchStatus('mismatch', 'Mismatch - Override values do not match expected')
        : createMatchStatus('missing', 'Missing - Not found in actual results');

      const description =
        item.expected.description && item.expected.description.trim().length > 0
          ? ({
              variant: 'info',
              icon: '💡',
              title: 'What this does',
              text: item.expected.description,
            } satisfies ValidationDescription)
          : undefined;

      return {
        matchStatus,
        description,
        stepLabel: STEP_DEFINITION_MAP.override.label,
        contractName: item.contractName,
        cards: {
          expected: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: item.expected.key,
            afterValue: item.expected.value,
          },
          actual: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: actualKey,
            storageKeyDiffs: getFieldDiffs(item.expected.key, actualKey),
            afterValue: actualValue,
            afterValueDiffs: getFieldDiffs(item.expected.value, actualValue),
          },
        },
      };
    }
    case 'change': {
      const item = items.changes[entry.index]!;
      const actualKey = item.actual?.key ?? NOT_FOUND_TEXT;
      const actualBefore = item.actual?.before ?? NOT_FOUND_TEXT;
      const actualAfter = item.actual?.after ?? NOT_FOUND_TEXT;
      const match = matchesChange(item);
      const expectedDifference = item.expected.allowDifference;

      let matchStatus: ValidationMatchStatus;
      if (match) {
        matchStatus = createMatchStatus('match', 'Match - This change is correct');
      } else if (expectedDifference) {
        matchStatus = createMatchStatus(
          'expected-difference',
          'Expected Difference - This mismatch is acceptable and expected'
        );
      } else if (item.actual) {
        matchStatus = createMatchStatus(
          'mismatch',
          'Mismatch - Change values do not match expected'
        );
      } else {
        matchStatus = createMatchStatus('missing', 'Missing - Not found in actual results');
      }

      const description =
        item.expected.description && item.expected.description.trim().length > 0
          ? ({
              variant: expectedDifference ? 'expected-difference' : 'info',
              icon: expectedDifference ? '✅' : '💡',
              title: expectedDifference ? 'Expected Difference - This is Fine' : 'What this does',
              text: item.expected.description,
            } satisfies ValidationDescription)
          : undefined;

      return {
        matchStatus,
        description,
        stepLabel: STEP_DEFINITION_MAP.change.label,
        contractName: item.contractName,
        cards: {
          expected: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: item.expected.key,
            beforeValue: item.expected.before,
            afterValue: item.expected.after,
          },
          actual: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: actualKey,
            storageKeyDiffs: getFieldDiffs(item.expected.key, actualKey),
            beforeValue: actualBefore,
            beforeValueDiffs: getFieldDiffs(item.expected.before, actualBefore),
            afterValue: actualAfter,
            afterValueDiffs: getFieldDiffs(item.expected.after, actualAfter),
          },
        },
      };
    }
    case 'balance': {
      const item = items.balance[entry.index]!;
      const actualField = item.actual?.field ?? NOT_FOUND_TEXT;
      const match = matchesBalance(item);
      const expectedDifference = item.expected.allowDifference;

      const actualBefore = item.actual ? formatBalanceValue(item.actual.before) : NOT_FOUND_TEXT;
      const actualAfter = item.actual ? formatBalanceValue(item.actual.after) : NOT_FOUND_TEXT;

      let matchStatus: ValidationMatchStatus;
      if (match) {
        matchStatus = createMatchStatus('match', 'Match - Balance change matches expected');
      } else if (expectedDifference) {
        matchStatus = createMatchStatus(
          'expected-difference',
          'Expected Difference - This mismatch is acceptable and expected'
        );
      } else if (item.actual) {
        matchStatus = createMatchStatus(
          'mismatch',
          'Mismatch - Balance change does not match expected'
        );
      } else {
        matchStatus = createMatchStatus('missing', 'Missing - Not found in actual results');
      }

      const expectedBefore = formatBalanceValue(item.expected.before);
      const expectedAfter = formatBalanceValue(item.expected.after);

      const descriptionParts = [
        `Expected delta: ${formatBalanceDelta(item.expected.before, item.expected.after)}`,
        `Actual delta: ${
          item.actual ? formatBalanceDelta(item.actual.before, item.actual.after) : NOT_FOUND_TEXT
        }`,
      ];
      if (item.expected.description) {
        descriptionParts.push(item.expected.description);
      }
      if (item.expected.allowDifference) {
        descriptionParts.push('Differences for this balance change are allowed.');
      }

      const description: ValidationDescription | undefined = descriptionParts.length
        ? {
            variant: expectedDifference ? 'expected-difference' : 'info',
            icon: expectedDifference ? '✅' : '💰',
            title: expectedDifference
              ? 'Expected Difference - Balance Change OK'
              : 'Balance Change Details',
            text: descriptionParts.join('\n\n'),
          }
        : undefined;

      return {
        matchStatus,
        description,
        stepLabel: STEP_DEFINITION_MAP.balance.label,
        contractName: item.contractName,
        cards: {
          expected: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: item.expected.field,
            beforeValue: expectedBefore,
            afterValue: expectedAfter,
          },
          actual: {
            contractName: item.contractName,
            contractAddress: defaultContractAddress(item.contractAddress),
            storageKey: actualField,
            storageKeyDiffs: getFieldDiffs(item.expected.field, actualField),
            beforeValue: actualBefore,
            beforeValueDiffs: getFieldDiffs(expectedBefore, actualBefore),
            afterValue: actualAfter,
            afterValueDiffs: getFieldDiffs(expectedAfter, actualAfter),
          },
        },
      };
    }
    /* istanbul ignore next */
    default: {
      return assertNever(entry as never);
    }
  }
};

export interface StepInfo {
  currentStep: number;
  currentStepItems: number;
  currentStepIndex: number;
}

export const getStepInfo = (
  entry: ValidationNavEntry | undefined,
  counts: StepCounts
): StepInfo => {
  if (!entry) {
    return {
      currentStep: 0,
      currentStepItems: 0,
      currentStepIndex: 0,
    };
  }

  const definition = STEP_DEFINITION_MAP[entry.kind];
  return {
    currentStep: definition.order,
    currentStepItems: counts[definition.itemsKey],
    currentStepIndex: entry.index + 1,
  };
};

export const getContractNameForEntry = (
  entry: ValidationNavEntry | undefined,
  items: ValidationItemsByStep
): string => {
  if (!entry) return 'Unknown Contract';

  const definition = STEP_DEFINITION_MAP[entry.kind];
  const stepItems = items[definition.itemsKey];
  const item = stepItems[entry.index];
  return item?.contractName ?? 'Unknown Contract';
};
