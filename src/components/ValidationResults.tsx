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
        color: '#3B82F6',
        icon: '❌',
        text: 'Missing - Not found in actual results',
      };
    }

    if (currentEntry.kind === 'signing') {
      const item = itemsByStep.signing[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          color: '#3B82F6',
          icon: '❌',
          text: 'Missing - Not found in actual results',
        };
      }
      const match = item.expected.dataToSign === item.actual.dataToSign;
      return match
        ? {
            status: 'match',
            color: '#1D4ED8',
            icon: '✅',
            text: 'Match - EIP-712 data matches expected',
          }
        : {
            status: 'mismatch',
            color: '#DC2626',
            icon: '❌',
            text: 'Mismatch - EIP-712 data does not match expected',
          };
    }

    if (currentEntry.kind === 'override') {
      const item = itemsByStep.overrides[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          color: '#3B82F6',
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
          color: '#1D4ED8',
          icon: '✅',
          text: 'Match - This override is correct',
        };
      }
      if (isExpectedDifference) {
        return {
          status: 'expected-difference',
          color: '#059669',
          icon: '✅',
          text: 'Expected Difference - This mismatch is acceptable and expected',
        };
      }
      return {
        status: 'mismatch',
        color: '#DC2626',
        icon: '❌',
        text: 'Mismatch - Override values do not match expected',
      };
    }

    if (currentEntry.kind === 'change') {
      const item = itemsByStep.changes[currentEntry.index];
      if (!item || !item.actual) {
        return {
          status: 'missing',
          color: '#3B82F6',
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
          color: '#1D4ED8',
          icon: '✅',
          text: 'Match - This change is correct',
        };
      }
      if (isExpectedDifference) {
        return {
          status: 'expected-difference',
          color: '#059669',
          icon: '✅',
          text: 'Expected Difference - This mismatch is acceptable and expected',
        };
      }
      return {
        status: 'mismatch',
        color: '#DC2626',
        icon: '❌',
        text: 'Mismatch - Change values do not match expected',
      };
    }

    const item = itemsByStep.balance[currentEntry.index];
    if (!item || !item.actual) {
      return {
        status: 'missing',
        color: '#3B82F6',
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
        color: '#1D4ED8',
        icon: '✅',
        text: 'Match - Balance change matches expected',
      };
    }

    if (isExpectedDifference) {
      return {
        status: 'expected-difference',
        color: '#059669',
        icon: '✅',
        text: 'Expected Difference - This mismatch is acceptable and expected',
      };
    }

    return {
      status: 'mismatch',
      color: '#DC2626',
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
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div
          style={{
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #6366F1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '24px',
          }}
        />
        <h3 style={{ color: '#374151', marginBottom: '8px' }}>{getLoadingTitle()}</h3>
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div
          style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '24px',
            maxWidth: '600px',
            margin: '0 auto 24px',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0' }}>❌ Validation Failed</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>

        <button
          onClick={() => handleRunValidation()}
          style={{
            background: '#F3F4F6',
            color: '#374151',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            marginRight: '12px',
          }}
        >
          Retry Validation
        </button>

        <button
          onClick={onBackToSetup}
          style={{
            background: '#6B7280',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Back to Setup
        </button>
      </div>
    );
  }

  if (!validationResult || totalValidationItems === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div
          style={{
            background: '#FEF3C7',
            color: '#D97706',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '600px',
            margin: '0 auto 24px',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0' }}>⚠️ No Changes Found</h3>
          <p style={{ margin: 0 }}>
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          style={{
            background: '#6B7280',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
          }}
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
    headingColor: string;
    textColor: string;
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
        headingColor: '#0369A1',
        textColor: '#0C4A6E',
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
        headingColor: '#0369A1',
        textColor: '#0C4A6E',
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
        headingColor: allowDifference ? '#059669' : '#0369A1',
        textColor: allowDifference ? '#064E3B' : '#0C4A6E',
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
      headingColor: allowDifference ? '#059669' : '#0369A1',
      textColor: allowDifference ? '#064E3B' : '#0C4A6E',
      text: details.join('\n\n'),
    };
  })();

  return (
    <div>
      <div
        style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        <h2
          style={{
            fontSize: '32px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
            margin: '0 0 8px 0',
          }}
        >
          Validation Results
        </h2>
        <div
          style={{
            color: '#6B7280',
            margin: 0,
            fontSize: '16px',
          }}
        >
          <div style={{ marginBottom: '4px' }}>
            <strong>
              Step {stepInfo.currentStep}:{' '}
              {(() => {
                if (!currentEntry) return '';
                if (currentEntry.kind === 'signing') return 'Domain/Message Hash';
                if (currentEntry.kind === 'override') return 'State Overrides';
                if (currentEntry.kind === 'change') return 'State Changes';
                return 'Balance Changes';
              })()}
            </strong>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            Step 1: {stepInfo.step1Count} items • Step 2: {stepInfo.step2Count} items • Step 3:{' '}
            {stepInfo.step3Count} items • Step 4: {stepInfo.step4Count} items
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <button
          onClick={() => setCurrentChangeIndex(Math.max(0, currentChangeIndex - 1))}
          disabled={currentChangeIndex === 0}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '600',
            border: 'none',
            cursor: currentChangeIndex === 0 ? 'not-allowed' : 'pointer',
            background: currentChangeIndex === 0 ? '#E5E7EB' : '#F3F4F6',
            color: currentChangeIndex === 0 ? '#9CA3AF' : '#374151',
            fontFamily: 'inherit',
          }}
        >
          ← Previous
        </button>

        <div
          style={{
            background: '#DBEAFE',
            color: '#1D4ED8',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
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
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '600',
            border: 'none',
            cursor: currentChangeIndex === totalValidationItems - 1 ? 'not-allowed' : 'pointer',
            background: currentChangeIndex === totalValidationItems - 1 ? '#E5E7EB' : '#6366F1',
            color: currentChangeIndex === totalValidationItems - 1 ? '#9CA3AF' : 'white',
            fontFamily: 'inherit',
          }}
        >
          Next →
        </button>
      </div>

      {/* Comparison Cards */}
      {currentEntry && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px',
          }}
        >
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
          style={{
            background:
              descriptionContent.variant === 'expected-difference'
                ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                : 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
            border:
              descriptionContent.variant === 'expected-difference'
                ? '2px solid #10B981'
                : '2px solid #7DD3FC',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontSize: '24px',
                marginTop: '2px',
              }}
            >
              {descriptionContent.icon}
            </span>
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: descriptionContent.headingColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 8px 0',
                }}
              >
                {descriptionContent.title}
              </h4>
              <p
                style={{
                  fontSize: '16px',
                  color: descriptionContent.textColor,
                  margin: 0,
                  lineHeight: '1.6',
                  fontWeight: '500',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {descriptionContent.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Match Status */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            background: matchStatus.color,
            color: 'white',
            padding: '16px 32px',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            fontWeight: '700',
            fontSize: '18px',
            gap: '8px',
          }}
        >
          <span>{matchStatus.icon}</span> {matchStatus.text}
        </div>
      </div>

      {/* Proceed to Signing Button */}
      {currentChangeIndex === totalValidationItems - 1 && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '48px',
          }}
        >
          {/* Status Summary */}
          <div
            style={{
              background: blockingErrorsExist
                ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
                : 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
              border: `2px solid ${blockingErrorsExist ? '#FECACA' : '#86EFAC'}`,
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              maxWidth: '500px',
              margin: '0 auto 24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: blockingErrorsExist ? '12px' : '8px',
              }}
            >
              <span style={{ fontSize: '28px' }}>{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '700',
                  color: blockingErrorsExist ? '#DC2626' : '#047857',
                }}
              >
                {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#DC2626',
                  textAlign: 'center',
                  lineHeight: '1.4',
                }}
              >
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
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                  color: 'white',
                  padding: '16px 48px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '18px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  boxShadow:
                    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                }}
              >
                <span style={{ fontSize: '20px' }}>🔐</span>
                Sign with Ledger →
              </button>
            )}

          {/* Show message if signing is not available */}
          {(!validationResult?.expected?.domainAndMessageHashes ||
            !validationResult?.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult?.expected?.domainAndMessageHashes?.messageHash) && (
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#92400E',
                }}
              >
                ⚠️ Signing Not Available
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#92400E',
                }}
              >
                Domain and message hashes are required for signing but were not generated during
                validation. This may indicate an issue with the script execution or validation
                process.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '48px',
        }}
      >
        {/* Back to Setup - Left */}
        <button
          onClick={onBackToSetup}
          style={{
            background: '#F3F4F6',
            color: '#6B7280',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '500',
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#E5E7EB';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#F3F4F6';
          }}
        >
          ← Back to Setup
        </button>

        {/* Rerun Validation - Right */}
        <button
          onClick={handleRunValidation}
          disabled={loading}
          style={{
            background: loading ? '#E5E7EB' : '#6366F1',
            color: loading ? '#9CA3AF' : 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            if (!loading) {
              e.currentTarget.style.background = '#4F46E5';
            }
          }}
          onMouseLeave={e => {
            if (!loading) {
              e.currentTarget.style.background = '#6366F1';
            }
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #9CA3AF',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Running Validation...
            </>
          ) : (
            <>
              <span style={{ fontSize: '16px' }}>🔄</span>
              Rerun Validation
            </>
          )}
        </button>
      </div>
    </div>
  );
};
