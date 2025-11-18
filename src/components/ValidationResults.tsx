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
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

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
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">
          {loadingTitle}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <Card className="mx-auto mb-6 max-w-xl border-red-200 bg-red-50 p-6">
          <h3 className="mb-2 text-xl font-semibold text-red-700">Validation Failed</h3>
          <p className="text-base text-red-600">{error}</p>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button onClick={() => runValidation()} variant="secondary">
            Retry Validation
          </Button>

          <Button onClick={onBackToSetup}>
            Back to Setup
          </Button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="py-16 text-center">
        <Card className="mx-auto mb-6 max-w-xl border-yellow-200 bg-yellow-50 p-6">
          <h3 className="mb-2 text-xl font-semibold text-yellow-700">No Changes Found</h3>
          <p className="text-base text-yellow-600">
            No state changes or overrides were found in the validation data.
          </p>
        </Card>
        <Button onClick={onBackToSetup}>
          Back to Setup
        </Button>
      </div>
    );
  }

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="mb-4 text-3xl font-bold text-gray-900">
          Validation Results
        </h2>
        <div className="text-sm text-gray-600">
          <div className="mb-2">
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          variant="secondary"
        >
          ← Previous
        </Button>

        <Badge variant="info" className="px-4 py-2 text-sm font-semibold">
          {getContractNameForEntry(currentEntry, itemsByStep)}
        </Badge>

        <Button
          onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
          disabled={currentIndex === totalItems - 1}
        >
          Next →
        </Button>
      </div>

      {evaluation && (
        <div className="grid gap-6 md:grid-cols-2">
          <ComparisonCard type="expected" {...evaluation.cards.expected} />
          <ComparisonCard type="actual" {...evaluation.cards.actual} />
        </div>
      )}

      {descriptionContent && (
        <Card
          className={`border-2 p-6 ${
            descriptionContent.variant === 'expected-difference'
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 text-lg ${
              descriptionContent.variant === 'expected-difference' ? 'text-green-600' : 'text-blue-600'
            }`}>
              {descriptionContent.icon}
            </div>
            <div className="flex-1">
              <h4
                className={`mb-2 text-xs font-bold uppercase tracking-wider ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-green-700'
                    : 'text-blue-700'
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
        </Card>
      )}

      {matchStatus && (
        <div className="text-center">
          <Badge
            variant={matchStatus.text.includes('Match') ? 'success' : 'error'}
            className="px-6 py-3 text-base font-semibold"
          >
            <span className="mr-2">{matchStatus.icon}</span>
            {matchStatus.text}
          </Badge>
        </div>
      )}

      {currentIndex === totalItems - 1 && (
        <div className="mt-12 text-center">
          <Card
            className={`mx-auto mb-6 max-w-md border-2 p-6 ${
              blockingErrorsExist
                ? 'border-red-200 bg-red-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <div className={`text-2xl ${blockingErrorsExist ? 'text-red-600' : 'text-green-600'}`}>
                {blockingErrorsExist ? '🚫' : '✅'}
              </div>
              <h3
                className={`text-xl font-bold ${
                  blockingErrorsExist ? 'text-red-700' : 'text-green-700'
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
          </Card>

          {!blockingErrorsExist &&
            validationResult.expected?.domainAndMessageHashes?.domainHash &&
            validationResult.expected?.domainAndMessageHashes?.messageHash && (
              <Button
                onClick={() => onProceedToLedgerSigning(validationResult)}
                size="lg"
                className="gap-2"
              >
                <span>🔐</span>
                Sign with Ledger →
              </Button>
            )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
            <Card className="mt-6 border-yellow-200 bg-yellow-50 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-yellow-800">⚠️ Signing Not Available</p>
              <p className="text-sm text-yellow-800">
                Domain and message hashes are required for signing but were not generated during
                validation. This may indicate an issue with the script execution or validation
                process.
              </p>
            </Card>
          )}
        </div>
      )}

      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onBackToSetup} variant="secondary">
          ← Back to Setup
        </Button>

        <Button onClick={runValidation} disabled={isLoading} className="gap-2">
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running Validation...
            </>
          ) : (
            <>
              <span>🔄</span>
              Rerun Validation
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
