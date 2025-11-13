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
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">{loadingTitle}</h3>
        <p className="mt-2 text-sm text-slate-600">This may take a moment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-red-900">Validation Failed</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runValidation()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry Validation
          </button>

          <button
            onClick={onBackToSetup}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="py-16">
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-amber-900">No Changes Found</h3>
          <p className="text-sm text-amber-700">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
      <div>
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">Validation Results</h2>
        <div className="text-sm text-slate-600">
          <div className="mb-1">
            <span className="font-medium">
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-xs text-slate-500">
            Step 1: {stepCounts.signing} • Step 2: {stepCounts.overrides} • Step 3:{' '}
            {stepCounts.changes} • Step 4: {stepCounts.balance}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            currentIndex === 0
              ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          ← Previous
        </button>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            currentIndex === totalItems - 1
              ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400'
              : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Next →
        </button>
      </div>

      {evaluation && (
        <div className="grid gap-4 md:grid-cols-2">
          <ComparisonCard type="expected" {...evaluation.cards.expected} />
          <ComparisonCard type="actual" {...evaluation.cards.actual} />
        </div>
      )}

      {descriptionContent && (
        <div
          className={`rounded-lg border p-4 ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{descriptionContent.icon}</span>
            <div className="flex-1">
              <h4
                className={`mb-1 text-xs font-semibold uppercase tracking-wider ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-emerald-700'
                    : 'text-blue-700'
                }`}
              >
                {descriptionContent.title}
              </h4>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-emerald-900'
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
        <div className="flex justify-center">
          <div
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold ${
              matchStatus.bgClass.includes('emerald')
                ? 'bg-emerald-100 text-emerald-700'
                : matchStatus.bgClass.includes('amber')
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            <span>{matchStatus.icon}</span> {matchStatus.text}
          </div>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-8">
          <div
            className={`mb-6 rounded-lg border p-6 ${
              blockingErrorsExist
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="text-2xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className={`text-lg font-semibold ${
                  blockingErrorsExist ? 'text-red-900' : 'text-emerald-900'
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
              <div className="text-center">
                <button
                  onClick={() => onProceedToLedgerSigning(validationResult)}
                  className="rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white hover:bg-blue-700"
                >
                  Sign with Ledger
                </button>
              </div>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-semibold text-amber-800">Signing Not Available</p>
              <p className="text-sm text-amber-700">
                Domain and message hashes are required for signing but were not generated during
                validation.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
        <button
          onClick={onBackToSetup}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Back to Setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isLoading
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              Running...
            </>
          ) : (
            'Rerun Validation'
          )}
        </button>
      </div>
    </div>
  );
};
