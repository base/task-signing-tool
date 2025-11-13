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
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-3 border-gray-200 border-t-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          {loadingTitle}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-lg bg-red-50 border border-red-200 p-6">
          <h3 className="mb-2 text-lg font-semibold text-red-700">Validation Failed</h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => runValidation()}
            className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Retry Validation
          </button>

          <button
            onClick={onBackToSetup}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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
        <div className="mx-auto mb-6 max-w-xl rounded-lg bg-amber-50 border border-amber-200 p-6">
          <h3 className="mb-2 text-lg font-semibold text-amber-700">No Changes Found</h3>
          <p className="text-sm text-amber-600">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Validation Results
        </h2>
        <div className="text-sm text-gray-600">
          <div className="mb-1">
            <span className="font-semibold text-gray-700">
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-xs text-gray-500">
            Step 1: {stepCounts.signing} items • Step 2: {stepCounts.overrides} items • Step 3:{' '}
            {stepCounts.changes} items • Step 4: {stepCounts.balance} items
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
            currentIndex === 0
              ? 'bg-gray-100 text-gray-400'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ← Previous
        </button>

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
            currentIndex === totalItems - 1
              ? 'bg-gray-100 text-gray-400'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
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
          className={`rounded-lg border p-5 ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-blue-200 bg-blue-50'
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

      {matchStatus && (
        <div className="text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white ${matchStatus.bgClass}`}
          >
            <span>{matchStatus.icon}</span> {matchStatus.text}
          </div>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-10 text-center">
          <div
            className={`mx-auto mb-6 max-w-md rounded-lg border p-6 ${
              blockingErrorsExist
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="text-2xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className={`text-lg font-bold ${
                  blockingErrorsExist ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p className="text-sm text-red-600">
                Found <strong>Missing</strong> or <strong>Different</strong> instances. Contact
                developers before continuing.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onBackToSetup}
              className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200"
            >
              Back to Setup
            </button>

            {!blockingErrorsExist && validationResult && (
              <button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-blue-700"
              >
                Proceed to Ledger Signing →
              </button>
            )}
          </div>

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-amber-900">Signing Not Available</p>
              <p className="text-sm text-amber-700">
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
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          ← Back to Setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            isLoading
              ? 'bg-gray-200 text-gray-400'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
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
