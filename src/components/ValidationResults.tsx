import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StringDiff,
  ValidationData,
  SigningDataComparison,
  OverrideComparison,
  StateChangeComparison,
  BalanceChangeComparison,
} from '@/lib/types/index';
import { formatEther } from 'viem';
import { ComparisonCard } from './index';

interface ValidationResultsProps {
  userType: string;
  network: string;
  selectedUpgrade: {
    id: string;
    name: string;
  };
  onBackToSetup: () => void;
  onProceedToLedgerSigning: (validationResult: ValidationData) => void;
}

type NavEntry =
  | { kind: 'signing'; index: number }
  | { kind: 'override'; index: number }
  | { kind: 'change'; index: number }
  | { kind: 'balance'; index: number };

export const ValidationResults: React.FC<ValidationResultsProps> = ({
  userType,
  network,
  selectedUpgrade,
  onBackToSetup,
  onProceedToLedgerSigning,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationData | null>(null);
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const isRunningRef = useRef(false);

  const formatBalanceValue = (hex: string): string => {
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

  const formatBalanceDelta = (beforeHex: string, afterHex: string): string => {
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

  // Helper function to get highlighted diffs for a specific field comparison
  const getFieldDiffs = (expected: string, actual: string): StringDiff[] => {
    if (expected === actual) {
      return [{ type: 'unchanged', value: expected }];
    }

    // Use a simple diff algorithm for character-level comparison
    const diffs: StringDiff[] = [];

    // Find common prefix
    let prefixLength = 0;
    while (
      prefixLength < Math.min(expected.length, actual.length) &&
      expected[prefixLength] === actual[prefixLength]
    ) {
      prefixLength++;
    }

    // Find common suffix
    let suffixLength = 0;
    while (
      suffixLength < Math.min(expected.length - prefixLength, actual.length - prefixLength) &&
      expected[expected.length - 1 - suffixLength] === actual[actual.length - 1 - suffixLength]
    ) {
      suffixLength++;
    }

    // Add unchanged prefix
    if (prefixLength > 0) {
      diffs.push({
        type: 'unchanged',
        value: expected.substring(0, prefixLength),
        startIndex: 0,
        endIndex: prefixLength,
      });
    }

    // Add removed part (from expected)
    const removedPart = expected.substring(prefixLength, expected.length - suffixLength);
    if (removedPart) {
      diffs.push({
        type: 'removed',
        value: removedPart,
        startIndex: prefixLength,
        endIndex: expected.length - suffixLength,
      });
    }

    // Add added part (from actual)
    const addedPart = actual.substring(prefixLength, actual.length - suffixLength);
    if (addedPart) {
      diffs.push({
        type: 'added',
        value: addedPart,
        startIndex: prefixLength,
        endIndex: actual.length - suffixLength,
      });
    }

    // Add unchanged suffix
    if (suffixLength > 0) {
      diffs.push({
        type: 'unchanged',
        value: expected.substring(expected.length - suffixLength),
        startIndex: expected.length - suffixLength,
        endIndex: expected.length,
      });
    }

    return diffs;
  };

  const getValidationItemsByStep = (): {
    signing: SigningDataComparison[];
    overrides: OverrideComparison[];
    changes: StateChangeComparison[];
    balance: BalanceChangeComparison[];
  } => {
    if (!validationResult) return { signing: [], overrides: [], changes: [], balance: [] };

    const signing: SigningDataComparison[] = [];
    const expectedHashes = validationResult.expected.domainAndMessageHashes;
    const actualHashes = validationResult.actual.domainAndMessageHashes;
    if (expectedHashes && actualHashes) {
      const expectedDataToSign = `0x1901${expectedHashes.domainHash.replace(
        '0x',
        ''
      )}${expectedHashes.messageHash.replace('0x', '')}`;
      const actualDataToSign = `0x1901${actualHashes.domainHash.replace(
        '0x',
        ''
      )}${actualHashes.messageHash.replace('0x', '')}`;
      signing.push({
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
      });
    }

    const overrides: OverrideComparison[] = [];
    validationResult.expected.stateOverrides.forEach((stateOverride, soIndex) => {
      stateOverride.overrides.forEach((override, oIndex) => {
        overrides.push({
          contractName: stateOverride.name,
          contractAddress: stateOverride.address,
          expected: override,
          actual: validationResult.actual.stateOverrides[soIndex]?.overrides[oIndex],
        });
      });
    });

    const changes: StateChangeComparison[] = [];
    validationResult.expected.stateChanges.forEach((stateChange, scIndex) => {
      stateChange.changes.forEach((change, cIndex) => {
        changes.push({
          contractName: stateChange.name,
          contractAddress: stateChange.address,
          expected: change,
          actual: validationResult.actual.stateChanges[scIndex]?.changes[cIndex],
        });
      });
    });

    const balance: BalanceChangeComparison[] = [];
    (validationResult.expected.balanceChanges ?? []).forEach((balanceChange, bcIndex) => {
      balance.push({
        contractName: balanceChange.name,
        contractAddress: balanceChange.address,
        expected: balanceChange,
        actual: validationResult.actual.balanceChanges?.[bcIndex],
      });
    });

    return { signing, overrides, changes, balance };
  };

  const handleRunValidation = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }
    isRunningRef.current = true;
    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      // First, check and install dependencies if needed
      console.log(`🔍 Checking dependencies for ${network.toLowerCase()}/${selectedUpgrade.id}`);
      setIsInstallingDeps(true);

      const depsResponse = await fetch('/api/install-deps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          network: network.toLowerCase(),
          upgradeId: selectedUpgrade.id,
        }),
      });

      const depsResult = await depsResponse.json();

      if (!depsResult.success) {
        setError(
          `ValidationResults::handleRunValidation: install-deps api returned an error: ${depsResult.error}`
        );
        setIsInstallingDeps(false);
        setLoading(false);
        return;
      }

      if (depsResult.depsInstalled) {
        console.log(
          `✅ Dependencies installed successfully for ${network.toLowerCase()}/${
            selectedUpgrade.id
          }`
        );
      }

      setIsInstallingDeps(false);

      // Now proceed with validation
      console.log('Running validation with options:', {
        upgradeId: selectedUpgrade.id,
        network,
        userType,
      });

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upgradeId: selectedUpgrade.id,
          network: network.toLowerCase(),
          userType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setValidationResult(result.data);
        setCurrentChangeIndex(0);
        console.log('Validation completed successfully');
      } else {
        setError(
          `ValidationResults::handleRunValidation: validate api returned an error: ${
            result.error || 'Validation failed'
          }`
        );
        console.error('Validation failed:', result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(`ValidationResults::handleRunValidation: error running validation: ${errorMessage}`);
      console.error('Validation error:', err);
    } finally {
      setLoading(false);
      setIsInstallingDeps(false);
      isRunningRef.current = false;
    }
  }, [network, selectedUpgrade.id, userType]);

  useEffect(() => {
    handleRunValidation();
  }, [handleRunValidation]);

  const itemsByStep = getValidationItemsByStep();
  const buildNavList = (items: {
    signing: SigningDataComparison[];
    overrides: OverrideComparison[];
    changes: StateChangeComparison[];
    balance: BalanceChangeComparison[];
  }): NavEntry[] => {
    const nav: NavEntry[] = [];
    for (let i = 0; i < items.signing.length; i++) nav.push({ kind: 'signing', index: i });
    for (let i = 0; i < items.overrides.length; i++) nav.push({ kind: 'override', index: i });
    for (let i = 0; i < items.changes.length; i++) nav.push({ kind: 'change', index: i });
    for (let i = 0; i < items.balance.length; i++) nav.push({ kind: 'balance', index: i });
    return nav;
  };
  const navList = buildNavList(itemsByStep);
  const currentEntry = navList[currentChangeIndex];
  const totalValidationItems = navList.length;

  // Check if there are any blocking validation errors
  const hasBlockingErrors = () => {
    if (!validationResult) return false;

    // Signing
    for (const s of itemsByStep.signing) {
      if (!s.actual) return true;
      if (s.expected.dataToSign !== s.actual.dataToSign) return true;
    }

    // Overrides
    for (const o of itemsByStep.overrides) {
      if (!o.actual) return true;
      const match = o.expected.key === o.actual.key && o.expected.value === o.actual.value;
      const isExpectedDifference =
        o.expected.description &&
        o.expected.description.toLowerCase().includes('difference is expected');
      if (!match && !isExpectedDifference) return true;
    }

    // Changes
    for (const c of itemsByStep.changes) {
      if (!c.actual) return true;
      const match =
        c.expected.key === c.actual.key &&
        c.expected.before === c.actual.before &&
        c.expected.after === c.actual.after;
      const isExpectedDifference =
        c.expected.description &&
        c.expected.description.toLowerCase().includes('difference is expected');
      if (!match && !isExpectedDifference) return true;
    }

    // Balance changes
    for (const b of itemsByStep.balance) {
      if (!b.actual) return true;
      const match =
        b.expected.field === b.actual.field &&
        b.expected.before === b.actual.before &&
        b.expected.after === b.actual.after;
      const isExpectedDifference =
        b.expected.allowDifference ||
        (b.expected.description &&
          b.expected.description.toLowerCase().includes('difference is expected'));
      if (!match && !isExpectedDifference) return true;
    }

    return false;
  };

  const blockingErrorsExist = hasBlockingErrors();

  // Get step-specific counts and current step info
  const getStepInfo = () => {
    const step1Count = itemsByStep.signing.length;
    const step2Count = itemsByStep.overrides.length;
    const step3Count = itemsByStep.changes.length;
    const step4Count = itemsByStep.balance.length;

    let currentStep = 1;
    let currentStepItems = 0;
    let currentStepIndex = 0;

    if (currentEntry) {
      if (currentEntry.kind === 'signing') {
        currentStep = 1;
        currentStepItems = step1Count;
        currentStepIndex = currentEntry.index + 1;
      } else if (currentEntry.kind === 'override') {
        currentStep = 2;
        currentStepItems = step2Count;
        currentStepIndex = currentEntry.index + 1;
      } else if (currentEntry.kind === 'change') {
        currentStep = 3;
        currentStepItems = step3Count;
        currentStepIndex = currentEntry.index + 1;
      } else {
        currentStep = 4;
        currentStepItems = step4Count;
        currentStepIndex = currentEntry.index + 1;
      }
    }

    return {
      step1Count,
      step2Count,
      step3Count,
      step4Count,
      currentStepItems,
      currentStepIndex,
      currentStep,
    };
  };

  const stepInfo = getStepInfo();

  const getMatchStatus = () => {
    if (!currentEntry) {
      return {
        status: 'missing',
        bgClass: 'bg-blue-500',
        icon: '❌',
        text: 'Missing - Not found in actual results',
      };
    }

    if (currentEntry.kind === 'signing') {
      const item = itemsByStep.signing[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          bgClass: 'bg-blue-500',
          icon: '❌',
          text: 'Missing - Not found in actual results',
        };
      }
      const match = item.expected.dataToSign === item.actual.dataToSign;
      return match
        ? {
            status: 'match',
            bgClass: 'bg-blue-700',
            icon: '✅',
            text: 'Match - EIP-712 data matches expected',
          }
        : {
            status: 'mismatch',
            bgClass: 'bg-red-600',
            icon: '❌',
            text: 'Mismatch - EIP-712 data does not match expected',
          };
    }

    if (currentEntry.kind === 'override') {
      const item = itemsByStep.overrides[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          bgClass: 'bg-blue-500',
          icon: '❌',
          text: 'Missing - Not found in actual results',
        };
      }
      const match =
        item.expected.key === item.actual.key && item.expected.value === item.actual.value;
      const isExpectedDifference =
        item.expected.description &&
        item.expected.description.toLowerCase().includes('difference is expected');
      if (match) {
        return {
          status: 'match',
          bgClass: 'bg-blue-700',
          icon: '✅',
          text: 'Match - This override is correct',
        };
      }
      if (isExpectedDifference) {
        return {
          status: 'expected-difference',
          bgClass: 'bg-emerald-600',
          icon: '✅',
          text: 'Expected Difference - This mismatch is acceptable and expected',
        };
      }
      return {
        status: 'mismatch',
        bgClass: 'bg-red-600',
        icon: '❌',
        text: 'Mismatch - Override values do not match expected',
      };
    }

    if (currentEntry.kind === 'change') {
      const item = itemsByStep.changes[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          bgClass: 'bg-blue-500',
          icon: '❌',
          text: 'Missing - Not found in actual results',
        };
      }
      const match =
        item.expected.key === item.actual.key &&
        item.expected.before === item.actual.before &&
        item.expected.after === item.actual.after;
      const isExpectedDifference =
        item.expected.description &&
        item.expected.description.toLowerCase().includes('difference is expected');
      if (match) {
        return {
          status: 'match',
          bgClass: 'bg-blue-700',
          icon: '✅',
          text: 'Match - This change is correct',
        };
      }
      if (isExpectedDifference) {
        return {
          status: 'expected-difference',
          bgClass: 'bg-emerald-600',
          icon: '✅',
          text: 'Expected Difference - This mismatch is acceptable and expected',
        };
      }
      return {
        status: 'mismatch',
        bgClass: 'bg-red-600',
        icon: '❌',
        text: 'Mismatch - Change values do not match expected',
      };
    }

    const item = itemsByStep.balance[currentEntry.index];
    if (!item || !item.actual) {
      return {
        status: 'missing',
        bgClass: 'bg-blue-500',
        icon: '❌',
        text: 'Missing - Not found in actual results',
      };
    }

    const match =
      item.expected.field === item.actual.field &&
      item.expected.before === item.actual.before &&
      item.expected.after === item.actual.after;
    const isExpectedDifference =
      item.expected.allowDifference ||
      (item.expected.description &&
        item.expected.description.toLowerCase().includes('difference is expected'));

    if (match) {
      return {
        status: 'match',
        bgClass: 'bg-blue-700',
        icon: '✅',
        text: 'Match - Balance change matches expected',
      };
    }

    if (isExpectedDifference) {
      return {
        status: 'expected-difference',
        bgClass: 'bg-emerald-600',
        icon: '✅',
        text: 'Expected Difference - This mismatch is acceptable and expected',
      };
    }

    return {
      status: 'mismatch',
      bgClass: 'bg-red-600',
      icon: '❌',
      text: 'Mismatch - Balance change does not match expected',
    };
  };

  if (loading) {
    const getLoadingTitle = () => {
      if (isInstallingDeps) {
        return 'Installing Dependencies';
      } else {
        return 'Running Validation';
      }
    };

    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
        <h3 className="text-lg font-semibold text-slate-700">{getLoadingTitle()}</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-rose-100 p-6 text-rose-600">
          <h3 className="mb-2 text-xl font-semibold">❌ Validation Failed</h3>
          <p className="text-base">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => handleRunValidation()}
            className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Retry Validation
          </button>

          <button
            onClick={onBackToSetup}
            className="rounded-xl bg-slate-600 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalValidationItems === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-amber-100 p-6 text-amber-700">
          <h3 className="mb-2 text-xl font-semibold">⚠️ No Changes Found</h3>
          <p className="text-base">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="rounded-xl bg-slate-600 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Back to Setup
        </button>
      </div>
    );
  }

  const matchStatus = getMatchStatus();

  const descriptionContent: {
    variant: 'info' | 'expected-difference';
    icon: string;
    title: string;
    text: string;
  } | null = (() => {
    if (!currentEntry) return null;

    if (currentEntry.kind === 'signing') {
      const item = itemsByStep.signing[currentEntry.index];
      if (!item?.expected.description) return null;
      return {
        variant: 'info',
        icon: '💡',
        title: 'What this does',
        text: item.expected.description,
      };
    }

    if (currentEntry.kind === 'override') {
      const item = itemsByStep.overrides[currentEntry.index];
      if (!item?.expected.description) return null;
      return {
        variant: 'info',
        icon: '💡',
        title: 'What this does',
        text: item.expected.description,
      };
    }

    if (currentEntry.kind === 'change') {
      const item = itemsByStep.changes[currentEntry.index];
      if (!item?.expected.description) return null;
      const allowDifference = item.expected.allowDifference;
      return {
        variant: allowDifference ? 'expected-difference' : 'info',
        icon: allowDifference ? '✅' : '💡',
        title: allowDifference ? 'Expected Difference - This is Fine' : 'What this does',
        text: item.expected.description,
      };
    }

    const item = itemsByStep.balance[currentEntry.index];
    if (!item) return null;
    const expectedDelta = formatBalanceDelta(item.expected.before, item.expected.after);
    const actualDelta = item.actual
      ? formatBalanceDelta(item.actual.before, item.actual.after)
      : 'Not found';
    const details = [`Expected delta: ${expectedDelta}`, `Actual delta: ${actualDelta}`];
    if (item.expected.description) {
      details.push(item.expected.description);
    }
    if (item.expected.allowDifference) {
      details.push('Differences for this balance change are allowed.');
    }
    const allowDifference = item.expected.allowDifference;
    return {
      variant: allowDifference ? 'expected-difference' : 'info',
      icon: allowDifference ? '✅' : '💰',
      title: allowDifference ? 'Expected Difference - Balance Change OK' : 'Balance Change Details',
      text: details.join('\n\n'),
    };
  })();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="mb-2 text-4xl font-bold text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text">
          Validation Results
        </h2>
        <div className="text-base text-slate-500">
          <div className="mb-1">
            <span className="font-semibold text-slate-600">
              Step {stepInfo.currentStep}:{' '}
              {(() => {
                if (!currentEntry) return '';
                if (currentEntry.kind === 'signing') return 'Domain/Message Hash';
                if (currentEntry.kind === 'override') return 'State Overrides';
                if (currentEntry.kind === 'change') return 'State Changes';
                return 'Balance Changes';
              })()}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-sm opacity-80">
            Step 1: {stepInfo.step1Count} items • Step 2: {stepInfo.step2Count} items • Step 3:{' '}
            {stepInfo.step3Count} items • Step 4: {stepInfo.step4Count} items
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setCurrentChangeIndex(Math.max(0, currentChangeIndex - 1))}
          disabled={currentChangeIndex === 0}
          className={`rounded-xl px-6 py-3 font-semibold transition ${
            currentChangeIndex === 0
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          ← Previous
        </button>

        <div className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
          {(() => {
            if (!currentEntry) return 'Unknown Contract';
            if (currentEntry.kind === 'signing') {
              return itemsByStep.signing[currentEntry.index]?.contractName || 'Unknown Contract';
            }
            if (currentEntry.kind === 'override') {
              return itemsByStep.overrides[currentEntry.index]?.contractName || 'Unknown Contract';
            }
            if (currentEntry.kind === 'change') {
              return itemsByStep.changes[currentEntry.index]?.contractName || 'Unknown Contract';
            }
            return itemsByStep.balance[currentEntry.index]?.contractName || 'Unknown Contract';
          })()}
        </div>

        <button
          onClick={() =>
            setCurrentChangeIndex(Math.min(totalValidationItems - 1, currentChangeIndex + 1))
          }
          disabled={currentChangeIndex === totalValidationItems - 1}
          className={`rounded-xl px-6 py-3 font-semibold transition ${
            currentChangeIndex === totalValidationItems - 1
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          Next →
        </button>
      </div>

      {/* Comparison Cards */}
      {currentEntry && (
        <div className="grid gap-6 md:grid-cols-2">
          {(() => {
            if (currentEntry.kind === 'signing') {
              const item = itemsByStep.signing[currentEntry.index]!;
              // Step 1: Domain/Message Hash validation
              const expectedData = item.expected.dataToSign;
              const actualData = item.actual?.dataToSign || 'Not found';
              const dataDiffs = getFieldDiffs(expectedData, actualData);

              return (
                <>
                  <ComparisonCard
                    type="expected"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey="EIP-712 Data to Sign"
                    afterValue={expectedData}
                  />
                  <ComparisonCard
                    type="actual"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey="EIP-712 Data to Sign"
                    afterValue={actualData}
                    afterValueDiffs={dataDiffs}
                  />
                </>
              );
            } else if (currentEntry.kind === 'override') {
              const item = itemsByStep.overrides[currentEntry.index]!;
              // Step 2: State Override validation (no before/after, just key/value)
              const expectedKey = item.expected.key;
              const expectedValue = item.expected.value;
              const actualKey = item.actual?.key || 'Not found';
              const actualValue = item.actual?.value || 'Not found';

              const keyDiffs = getFieldDiffs(expectedKey, actualKey);
              const valueDiffs = getFieldDiffs(expectedValue, actualValue);

              return (
                <>
                  <ComparisonCard
                    type="expected"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={expectedKey}
                    afterValue={expectedValue}
                  />
                  <ComparisonCard
                    type="actual"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={actualKey}
                    storageKeyDiffs={keyDiffs}
                    afterValue={actualValue}
                    afterValueDiffs={valueDiffs}
                  />
                </>
              );
            } else if (currentEntry.kind === 'change') {
              const item = itemsByStep.changes[currentEntry.index]!;
              // Step 3: State Change validation (has before/after values)
              const expectedKey = item.expected.key;
              const actualKey = item.actual?.key || 'Not found';

              const expectedBefore = item.expected.before;
              const expectedAfter = item.expected.after;
              const actualBefore = item.actual?.before || 'Not found';
              const actualAfter = item.actual?.after || 'Not found';

              // Generate diffs only for actual card (comparing actual vs expected)
              const keyDiffs = getFieldDiffs(expectedKey, actualKey);
              const beforeDiffs = getFieldDiffs(expectedBefore, actualBefore);
              const afterDiffs = getFieldDiffs(expectedAfter, actualAfter);

              return (
                <>
                  <ComparisonCard
                    type="expected"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={expectedKey}
                    beforeValue={expectedBefore}
                    afterValue={expectedAfter}
                  />
                  <ComparisonCard
                    type="actual"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={actualKey}
                    storageKeyDiffs={keyDiffs}
                    beforeValue={actualBefore}
                    beforeValueDiffs={beforeDiffs}
                    afterValue={actualAfter}
                    afterValueDiffs={afterDiffs}
                  />
                </>
              );
            } else {
              const item = itemsByStep.balance[currentEntry.index]!;
              // Step 4: Balance change validation (ETH transfers)
              const expectedField = item.expected.field;
              const actualField = item.actual?.field || 'Not found';

              const expectedBefore = formatBalanceValue(item.expected.before);
              const expectedAfter = formatBalanceValue(item.expected.after);
              const actualBefore = item.actual
                ? formatBalanceValue(item.actual.before)
                : 'Not found';
              const actualAfter = item.actual ? formatBalanceValue(item.actual.after) : 'Not found';

              const keyDiffs = getFieldDiffs(expectedField, actualField);
              const beforeDiffs = getFieldDiffs(expectedBefore, actualBefore);
              const afterDiffs = getFieldDiffs(expectedAfter, actualAfter);

              return (
                <>
                  <ComparisonCard
                    type="expected"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={expectedField}
                    beforeValue={expectedBefore}
                    afterValue={expectedAfter}
                  />
                  <ComparisonCard
                    type="actual"
                    contractName={item.contractName}
                    contractAddress={item.contractAddress || 'Unknown Address'}
                    storageKey={actualField}
                    storageKeyDiffs={keyDiffs}
                    beforeValue={actualBefore}
                    beforeValueDiffs={beforeDiffs}
                    afterValue={actualAfter}
                    afterValueDiffs={afterDiffs}
                  />
                </>
              );
            }
          })()}
        </div>
      )}

      {/* Description Box - show when available */}
      {descriptionContent && (
        <div
          className={`rounded-2xl border-2 p-6 shadow-md ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100'
              : 'border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl">{descriptionContent.icon}</span>
            <div className="flex-1">
              <h4
                className={`mb-2 text-sm font-bold uppercase tracking-wider ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-emerald-700'
                    : 'text-sky-700'
                }`}
              >
                {descriptionContent.title}
              </h4>
              <p
                className={`text-base font-medium leading-relaxed whitespace-pre-wrap ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-emerald-900'
                    : 'text-sky-900'
                }`}
              >
                {descriptionContent.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Match Status */}
      <div className="text-center">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white ${matchStatus.bgClass}`}
        >
          <span>{matchStatus.icon}</span> {matchStatus.text}
        </div>
      </div>

      {/* Proceed to Signing Button */}
      {currentChangeIndex === totalValidationItems - 1 && (
        <div className="mt-12 text-center">
          {/* Status Summary */}
          <div
            className={`mx-auto mb-6 max-w-md rounded-2xl border-2 p-6 ${
              blockingErrorsExist
                ? 'border-rose-200 bg-gradient-to-r from-rose-100 to-rose-200'
                : 'border-emerald-200 bg-gradient-to-r from-emerald-100 to-emerald-200'
            }`}
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="text-3xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className={`text-xl font-bold ${
                  blockingErrorsExist ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p className="text-sm text-rose-600">
                Found <strong>Missing</strong> or <strong>Different</strong> instances. Contact
                developers before continuing.
              </p>
            )}
          </div>

          {/* Ledger Signing Button - Only show when no blocking errors */}
          {!blockingErrorsExist &&
            validationResult?.expected?.domainAndMessageHashes &&
            validationResult?.expected?.domainAndMessageHashes?.domainHash &&
            validationResult?.expected?.domainAndMessageHashes?.messageHash && (
              <button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span className="text-xl">🔐</span>
                Sign with Ledger →
              </button>
            )}

          {/* Show message if signing is not available */}
          {(!validationResult?.expected?.domainAndMessageHashes ||
            !validationResult?.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult?.expected?.domainAndMessageHashes?.messageHash) && (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-100 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-amber-800">⚠️ Signing Not Available</p>
              <p className="text-sm text-amber-800">
                Domain and message hashes are required for signing but were not generated during
                validation. This may indicate an issue with the script execution or validation
                process.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Buttons */}
      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Back to Setup - Left */}
        <button
          onClick={onBackToSetup}
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-base font-medium text-slate-600 transition hover:bg-slate-200"
        >
          ← Back to Setup
        </button>

        {/* Rerun Validation - Right */}
        <button
          onClick={handleRunValidation}
          disabled={loading}
          className={`flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold transition ${
            loading
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              Running Validation...
            </>
          ) : (
            <>
              <span className="text-base">🔄</span>
              Rerun Validation
            </>
          )}
        </button>
      </div>
    </div>
  );
};
