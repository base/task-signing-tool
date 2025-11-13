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
        <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        <h3 className="text-base font-semibold text-slate-900">
          {loadingTitle}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-lg bg-rose-50 border border-rose-200 p-6 text-rose-700">
          <h3 className="mb-2 text-base font-semibold">❌ Validation failed</h3>
          <p className="text-sm">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => runValidation()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Retry validation
          </button>

          <button
            onClick={onBackToSetup}
            className="rounded-lg bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-lg bg-amber-50 border border-amber-200 p-6 text-amber-800">
          <h3 className="mb-2 text-base font-semibold">⚠️ No changes found</h3>
          <p className="text-sm">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
        <button
          onClick={onBackToSetup}
          className="rounded-lg bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Back to setup
        </button>
      </div>
    );
  }

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">Validation results</h2>
        <div className="text-sm text-slate-600">
          <div className="mb-2">
            <span className="font-semibold text-slate-800">
              Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
            </span>{' '}
            • Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Step 1: {stepCounts.signing} items • Step 2: {stepCounts.overrides} items • Step 3:{' '}
            {stepCounts.changes} items • Step 4: {stepCounts.balance} items
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
            currentIndex === 0
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          ← Previous
        </button>

        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
            currentIndex === totalItems - 1
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
          className={`rounded-xl border p-5 ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-sky-200 bg-sky-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl">{descriptionContent.icon}</span>
            <div className="flex-1">
              <h4
                className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-emerald-800'
                    : 'text-sky-800'
                }`}
              >
                {descriptionContent.title}
              </h4>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
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
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white ${matchStatus.bgClass}`}
          >
            <span>{matchStatus.icon}</span> {matchStatus.text}
          </div>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-12 text-center">
          <div
            className={`mx-auto mb-6 max-w-md rounded-lg border p-5 ${
              blockingErrorsExist
                ? 'border-rose-200 bg-rose-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="text-3xl">{blockingErrorsExist ? '🚫' : '✅'}</span>
              <h3
                className={`text-base font-semibold ${
                  blockingErrorsExist ? 'text-rose-800' : 'text-emerald-800'
                }`}
              >
                {blockingErrorsExist ? 'Cannot sign' : 'Ready to sign'}
              </h3>
            </div>
            {blockingErrorsExist && (
              <p className="text-sm text-rose-800">
                Found <strong>Missing</strong> or <strong>Different</strong> instances. Contact{' '}
                developers before continuing.
              </p>
            )}
          </div>

          {!blockingErrorsExist &&
            validationResult.expected?.domainAndMessageHashes?.domainHash &&
            validationResult.expected?.domainAndMessageHashes?.messageHash && (
              <button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <span className="text-base leading-none">🔐</span>
                Sign with Ledger
              </button>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="mb-1 text-sm font-semibold text-amber-900">⚠️ Signing not available</p>
              <p className="text-sm text-amber-900">
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
          className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          ← Back to setup
        </button>

        <button
          onClick={runValidation}
          disabled={isLoading}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold ${
            isLoading
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              Running validation…
            </>
          ) : (
            <>
              <span className="text-sm">🔄</span>
              Rerun validation
            </>
          )}
        </button>
      </div>
    </div>
  );
};
