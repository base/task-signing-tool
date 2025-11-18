import React, { useEffect, useState } from 'react';

import { useValidationRunner } from '@/hooks/useValidationRunner';
import { useValidationSummary } from '@/hooks/useValidationSummary';
import {
  evaluateValidationEntry,
  getContractNameForEntry,
  getStepInfo,
  STEP_LABELS,
  ValidationNavEntry,
} from '@/lib/validation-results-utils';
import { ValidationData } from '@/lib/types';
import { ComparisonCard } from './ComparisonCard';

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

export const ValidationResults: React.FC<ValidationResultsProps> = ({
  userType,
  network,
  selectedUpgrade,
  onBackToSetup,
  onProceedToLedgerSigning,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    error,
    result: validationResult,
    isLoading,
    isInstallingDeps,
    runValidation,
  } = useValidationRunner({
    network,
    upgradeId: selectedUpgrade.id,
    userType,
  });

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const { itemsByStep, navList, blockingErrorsExist, stepCounts } =
    useValidationSummary(validationResult);

  useEffect(() => {
    if (navList.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex(prev => Math.min(prev, navList.length - 1));
  }, [navList.length]);

  useEffect(() => {
    if (validationResult) {
      setCurrentIndex(0);
    }
  }, [validationResult]);

  const currentEntry: ValidationNavEntry | undefined = navList[currentIndex];
  const evaluation = currentEntry ? evaluateValidationEntry(currentEntry, itemsByStep) : null;
  const totalItems = navList.length;
  const stepInfo = getStepInfo(currentEntry, stepCounts);

  if (isLoading) {
    const loadingTitle = isInstallingDeps ? 'Installing Dependencies' : 'Running Validation';

    return (
      <div className="py-16 text-center">
        <div 
          className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-3"
          style={{
            borderColor: 'var(--cb-border)',
            borderTopColor: 'var(--cb-primary)'
          }}
        />
        <h3 className="text-xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
          {loadingTitle}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div 
          className="mx-auto mb-6 max-w-xl rounded-xl p-6"
          style={{
            background: 'var(--cb-error-light)',
            border: '1px solid var(--cb-error)',
            color: 'var(--cb-error)'
          }}
        >
          <h3 className="mb-2 text-xl font-semibold">❌ Validation Failed</h3>
          <p className="text-base">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => runValidation()}
            className="rounded-lg px-6 py-2.5 font-semibold transition hover:-translate-y-0.5"
            style={{
              background: 'var(--cb-surface)',
              color: 'var(--cb-text-primary)',
              border: '1px solid var(--cb-border)',
              boxShadow: 'var(--cb-shadow-sm)'
            }}
          >
            Retry Validation
          </button>

          <button
            onClick={onBackToSetup}
            className="rounded-lg px-6 py-2.5 font-semibold text-white transition hover:-translate-y-0.5"
            style={{
              background: 'var(--cb-primary)',
              boxShadow: 'var(--cb-shadow-sm)'
            }}
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="py-16 text-center">
        <div 
          className="mx-auto mb-6 max-w-xl rounded-xl p-6"
          style={{
            background: 'var(--cb-warning-light)',
            border: '1px solid var(--cb-warning)',
            color: 'var(--cb-warning)'
          }}
        >
          <h3 className="mb-2 text-xl font-semibold">⚠️ No Changes Found</h3>
          <p className="text-base">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="rounded-lg px-6 py-2.5 font-semibold text-white transition hover:-translate-y-0.5"
          style={{
            background: 'var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          Back to Setup
        </button>
      </div>
    );
  }

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-3 text-4xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
          Validation Results
        </h2>
        <div className="text-base" style={{ color: 'var(--cb-text-secondary)' }}>
          <div className="mb-2">
            <span className="font-semibold" style={{ color: 'var(--cb-text-primary)' }}>
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--cb-text-tertiary)' }}>
            Step 1: {stepCounts.signing} items • Step 2: {stepCounts.overrides} items • Step 3:{' '}
            {stepCounts.changes} items • Step 4: {stepCounts.balance} items
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg px-6 py-2.5 font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5"
          style={{
            background: currentIndex === 0 ? 'var(--cb-surface)' : 'var(--cb-surface)',
            color: currentIndex === 0 ? 'var(--cb-text-tertiary)' : 'var(--cb-text-primary)',
            border: '1px solid var(--cb-border)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          ← Previous
        </button>

        <div 
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{
            background: 'var(--cb-primary-light)',
            color: 'var(--cb-primary)',
            border: '1px solid var(--cb-primary)'
          }}
        >
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className="rounded-lg px-6 py-2.5 font-semibold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5"
          style={{
            background: currentIndex === totalItems - 1 ? 'var(--cb-border)' : 'var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          Next →
        </button>
      </div>

      {evaluation && (
        <div className="grid gap-6 md:grid-cols-2">
          <ComparisonCard type="expected" {...evaluation.cards.expected} />
          <ComparisonCard type="actual" {...evaluation.cards.actual} />
        </div>
      )}

      {descriptionContent && (
        <div
          className="rounded-xl p-5"
          style={{
            background: descriptionContent.variant === 'expected-difference' 
              ? 'var(--cb-success-light)' 
              : 'var(--cb-primary-light)',
            border: descriptionContent.variant === 'expected-difference'
              ? '1px solid var(--cb-success)'
              : '1px solid var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">{descriptionContent.icon}</span>
            <div className="flex-1">
              <h4
                className="mb-2 text-xs font-bold uppercase tracking-wider"
                style={{
                  color: descriptionContent.variant === 'expected-difference'
                    ? 'var(--cb-success)'
                    : 'var(--cb-primary)'
                }}
              >
                {descriptionContent.title}
              </h4>
              <p
                className="text-sm font-medium leading-relaxed whitespace-pre-wrap"
                style={{
                  color: descriptionContent.variant === 'expected-difference'
                    ? 'var(--cb-success)'
                    : 'var(--cb-primary)'
                }}
              >
                {descriptionContent.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {matchStatus && (
        <div className="text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-bold text-white ${matchStatus.bgClass}`}
          >
            <span>{matchStatus.icon}</span> {matchStatus.text}
          </div>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-10 text-center">
          <div
            className="mx-auto mb-6 max-w-md rounded-xl p-6"
            style={{
              background: blockingErrorsExist ? 'var(--cb-error-light)' : 'var(--cb-success-light)',
              border: blockingErrorsExist ? '1px solid var(--cb-error)' : '1px solid var(--cb-success)',
              boxShadow: 'var(--cb-shadow-md)'
            }}
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="text-2xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className="text-xl font-bold"
                style={{ color: blockingErrorsExist ? 'var(--cb-error)' : 'var(--cb-success)' }}
              >
                {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p className="text-sm" style={{ color: 'var(--cb-error)' }}>
                Found <strong>Missing</strong> or <strong>Different</strong> instances. Contact
                developers before continuing.
              </p>
            )}
          </div>

          {!blockingErrorsExist &&
            validationResult.expected?.domainAndMessageHashes?.domainHash &&
            validationResult.expected?.domainAndMessageHashes?.messageHash && (
              <button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                className="inline-flex items-center gap-3 rounded-lg px-10 py-4 text-lg font-bold text-white transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: 'var(--cb-primary)',
                  boxShadow: 'var(--cb-shadow-lg)'
                }}
              >
                <span className="text-xl">🔐</span>
                Sign with Ledger →
              </button>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <div 
              className="mt-6 rounded-lg p-4 text-left"
              style={{
                background: 'var(--cb-warning-light)',
                border: '1px solid var(--cb-warning)',
                color: 'var(--cb-warning)'
              }}
            >
              <p className="mb-2 text-sm font-semibold">⚠️ Signing Not Available</p>
              <p className="text-sm">
                Domain and message hashes are required for signing but were not generated during
                validation. This may indicate an issue with the script execution or validation
                process.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onBackToSetup}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-base font-medium transition hover:-translate-y-0.5"
          style={{
            background: 'var(--cb-surface)',
            color: 'var(--cb-text-primary)',
            border: '1px solid var(--cb-border)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          ← Back to Setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-base font-semibold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5"
          style={{
            background: isLoading ? 'var(--cb-border)' : 'var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          {isLoading ? (
            <>
              <div 
                className="h-4 w-4 animate-spin rounded-full border-2"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white'
                }}
              />
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
