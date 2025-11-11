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
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
        <h3 className="text-lg font-semibold text-slate-700">{loadingTitle}</h3>
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
            onClick={() => runValidation()}
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

  if (!validationResult || totalItems === 0) {
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

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="mb-2 text-4xl font-bold text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text">
          Validation Results
        </h2>
        <div className="text-base text-slate-500">
          <div className="mb-1">
            <span className="font-semibold text-slate-600">
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-sm opacity-80">
            Step 1: {stepCounts.signing} items • Step 2: {stepCounts.overrides} items • Step 3:{' '}
            {stepCounts.changes} items • Step 4: {stepCounts.balance} items
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className={`rounded-xl px-6 py-3 font-semibold transition ${
            currentIndex === 0
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          ← Previous
        </button>

        <div className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className={`rounded-xl px-6 py-3 font-semibold transition ${
            currentIndex === totalItems - 1
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
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
        <div className="mt-12 text-center">
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

          {!blockingErrorsExist &&
            validationResult.expected?.domainAndMessageHashes?.domainHash &&
            validationResult.expected?.domainAndMessageHashes?.messageHash && (
              <button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span className="text-xl">🔐</span>
                Sign with Ledger →
              </button>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
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

      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onBackToSetup}
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-base font-medium text-slate-600 transition hover:bg-slate-200"
        >
          ← Back to Setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className={`flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold transition ${
            isLoading
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
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
