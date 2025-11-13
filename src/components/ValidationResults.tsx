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
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-3 border-gray-300 border-t-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          {loadingTitle}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-red-900">Validation Failed</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => runValidation()}
            className="btn-secondary"
          >
            Retry Validation
          </button>

          <button
            onClick={onBackToSetup}
            className="btn-secondary"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-yellow-900">No Changes Found</h3>
          <p className="text-sm text-yellow-700">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="btn-secondary"
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
        <h2 className="mb-2 text-3xl font-bold text-gray-900">
          Validation Results
        </h2>
        <div className="text-sm text-gray-600">
          <div className="mb-1">
            <span className="font-semibold text-gray-900">
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-xs text-gray-500">
            Step 1: {stepCounts.signing} • Step 2: {stepCounts.overrides} • Step 3:{' '}
            {stepCounts.changes} • Step 4: {stepCounts.balance}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className={`btn-secondary flex-shrink-0 ${currentIndex === 0 ? 'opacity-50' : ''}`}
        >
          ← Previous
        </button>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className={`btn-primary flex-shrink-0 ${currentIndex === totalItems - 1 ? 'opacity-50' : ''}`}
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
          className={`rounded-lg border p-4 ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{descriptionContent.icon}</span>
            <div className="flex-1">
              <h4
                className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-green-800'
                    : 'text-blue-800'
                }`}
              >
                {descriptionContent.title}
              </h4>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-green-900'
                    : 'text-blue-900'
                }`}
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
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white ${matchStatus.bgClass}`}
          >
            <span>{matchStatus.icon}</span> {matchStatus.text}
          </div>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-8 text-center">
          <div
            className={`mx-auto mb-6 max-w-md rounded-lg border p-6 ${
              blockingErrorsExist
                ? 'border-red-200 bg-red-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="text-2xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className={`text-lg font-semibold ${
                  blockingErrorsExist ? 'text-red-900' : 'text-green-900'
                }`}
              >
                {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p className="text-sm text-red-700">
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
                className="inline-flex items-center gap-2 btn-primary px-8 py-4 text-base font-semibold"
              >
                <span className="text-lg">🔐</span>
                Sign with Ledger →
              </button>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-left">
              <p className="mb-1 text-sm font-semibold text-yellow-900">Signing Not Available</p>
              <p className="text-sm text-yellow-700">
                Domain and message hashes are required for signing but were not generated during
                validation. This may indicate an issue with the script execution or validation
                process.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onBackToSetup}
          className="btn-secondary"
        >
          ← Back to Setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className={`btn-primary flex items-center justify-center gap-2 ${isLoading ? 'opacity-50' : ''}`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running...
            </>
          ) : (
            <>
              <span>🔄</span>
              Rerun Validation
            </>
          )}
        </button>
      </div>
    </div>
  );
};
