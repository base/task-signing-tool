import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Coins,
  Lightbulb,
  Shield,
  XCircle,
} from 'lucide-react';

import { useValidationRunner } from '@/hooks/useValidationRunner';
import { useValidationSummary } from '@/hooks/useValidationSummary';
import {
  evaluateValidationEntry,
  getContractNameForEntry,
  getStepInfo,
  STEP_LABELS,
  TASK_ORIGIN_ROLE_LABELS,
  ValidationNavEntry,
} from '@/lib/validation-results-utils';
import { TaskOriginSignerResult, ValidationData } from '@/lib/types';
import { ComparisonCard } from './ComparisonCard';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

interface TaskOriginCardProps {
  results: TaskOriginSignerResult[];
}

const TaskOriginCard: React.FC<TaskOriginCardProps> = ({ results }) => {
  return (
    <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="text-[var(--cds-primary)]" size={24} />
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">
          Task Origin Signatures
        </h3>
      </div>
      <div className="space-y-3">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between py-3 px-4 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <XCircle className="text-red-600" size={20} />
              )}
              <span className="font-medium text-[var(--cds-text-primary)]">
                {TASK_ORIGIN_ROLE_LABELS[result.role]}
              </span>
            </div>
            <div className="text-sm">
              {result.success ? (
                <span className="text-green-700 font-medium">Verified</span>
              ) : (
                <span className="text-red-700 font-medium" title={result.error}>
                  {result.error ? result.error.substring(0, 50) + (result.error.length > 50 ? '...' : '') : 'Failed'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ValidationResultsProps {
  userType: string;
  network: string;
  selectedUpgrade: {
    id: string;
    name: string;
  };
  onProceedToLedgerSigning: (validationResult: ValidationData) => void;
}

const getIcon = (iconName: string, size: number = 24, className?: string) => {
  const props = { size, className };
  switch (iconName) {
    case 'check':
      return <CheckCircle {...props} />;
    case 'x':
      return <XCircle {...props} />;
    case 'lightbulb':
      return <Lightbulb {...props} />;
    case 'coins':
      return <Coins {...props} />;
    default:
      return null;
  }
};

export const ValidationResults: React.FC<ValidationResultsProps> = ({
  userType,
  network,
  selectedUpgrade,
  onProceedToLedgerSigning,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 h-16 w-16 animate-spin rounded-full border-4 border-[var(--cds-border)] border-t-[var(--cds-primary)]" />
        <h3 className="text-xl font-semibold text-[var(--cds-text-primary)]">{loadingTitle}</h3>
        <p className="mt-2 text-[var(--cds-text-secondary)]">This may take a few moments.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-red-50 p-8 border border-red-100">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <XCircle size={32} />
            </div>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-[var(--cds-error)]">Validation Failed</h3>
          <p className="text-base text-[var(--cds-text-secondary)]">{error}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button onClick={() => runValidation()} variant="secondary">
            Retry Validation
          </Button>
        </div>
      </div>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-yellow-50 p-8 border border-yellow-100">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
              <AlertTriangle size={32} />
            </div>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-yellow-800">No Changes Found</h3>
          <p className="text-base text-yellow-700">
            No state changes or overrides were found in the validation data.
          </p>
        </div>
      </div>
    );
  }

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  const handleNext = () => {
    if (currentIndex === totalItems - 1) {
      setIsResultModalOpen(true);
    } else {
      setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--cds-text-primary)] tracking-tight mb-2">
            Validation Results
          </h2>
          <div className="flex items-center gap-4 mt-2 w-full max-w-md">
            <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-[var(--cds-primary)] transition-all duration-300 ease-out"
                style={{ width: `${((currentIndex + 1) / totalItems) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[var(--cds-text-secondary)]">
              {Math.round(((currentIndex + 1) / totalItems) * 100)}%
            </span>
          </div>
        </div>

        <div className="mt-4 md:mt-0 text-right">
          <div className="text-sm font-medium text-[var(--cds-text-secondary)] mb-1">
            Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : ''}
          </div>
          <div className="text-xs text-[var(--cds-text-tertiary)]">
            Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems}
          </div>
        </div>
      </div>

      <Card className="bg-gray-50/50">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={16} />}
          >
            Previous
          </Button>

          <div className="flex-1 flex justify-center min-w-0 px-2">
            <Badge
              variant="primary"
              size="md"
              className="font-mono text-xs sm:text-sm text-center whitespace-normal h-auto break-words max-w-full"
            >
              {getContractNameForEntry(currentEntry, itemsByStep)}
            </Badge>
          </div>

          <Button onClick={handleNext} variant="primary" size="sm">
            {currentIndex === totalItems - 1 ? 'Next' : 'Next'}{' '}
            <ArrowRight size={16} className="inline ml-1" />
          </Button>
        </div>

        {matchStatus && (
          <div
            className={`flex items-center justify-center gap-3 p-4 mb-6 rounded-xl border-2 ${
              matchStatus.status === 'match'
                ? 'bg-green-100/50 border-green-200 text-green-900'
                : matchStatus.status === 'mismatch'
                ? 'bg-red-100/50 border-red-200 text-red-900'
                : matchStatus.status === 'missing'
                ? 'bg-red-100/50 border-red-200 text-red-900'
                : 'bg-emerald-100/50 border-emerald-200 text-emerald-900'
            }`}
          >
            {getIcon(matchStatus.icon, 24)}
            <span className="text-lg font-bold">{matchStatus.text}</span>
          </div>
        )}

        {evaluation && (
          <div className="grid gap-6 xl:grid-cols-2">
            {currentEntry?.kind === 'taskOrigin' && itemsByStep.taskOrigin[currentEntry.index] ? (
              <TaskOriginCard results={itemsByStep.taskOrigin[currentEntry.index].results} />
            ) : (
              <>
                <ComparisonCard type="expected" {...evaluation.cards.expected} />
                <ComparisonCard type="actual" {...evaluation.cards.actual} />
              </>
            )}
          </div>
        )}

        {descriptionContent && (
          <div
            className={`mt-6 rounded-xl border p-4 flex items-start gap-3 ${
              descriptionContent.variant === 'expected-difference'
                ? 'border-green-200 bg-green-50'
                : 'border-blue-200 bg-blue-50'
            }`}
          >
            <div className="mt-0.5">{getIcon(descriptionContent.icon, 24)}</div>
            <div className="flex-1">
              <h4
                className={`mb-1 text-xs font-bold uppercase tracking-wider ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-green-800'
                    : 'text-blue-800'
                }`}
              >
                {descriptionContent.title}
              </h4>
              <p
                className={`text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                  descriptionContent.variant === 'expected-difference'
                    ? 'text-green-900'
                    : 'text-blue-900'
                }`}
              >
                {descriptionContent.text}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={isResultModalOpen} onClose={() => setIsResultModalOpen(false)}>
        <div className="flex flex-col items-center text-center p-4">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                blockingErrorsExist ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
              }`}
            >
              {blockingErrorsExist ? <XCircle size={24} /> : <CheckCircle size={24} />}
            </div>
            <h3
              className={`text-2xl font-bold ${
                blockingErrorsExist ? 'text-red-700' : 'text-[var(--cds-text-primary)]'
              }`}
            >
              {blockingErrorsExist ? 'Cannot Sign' : 'Ready to Sign'}
            </h3>
          </div>

          {blockingErrorsExist ? (
            <p className="text-sm text-red-700 mb-6">
              Found <strong>Missing</strong> or <strong>Different</strong> instances. <br />
              Contact developers before continuing.
            </p>
          ) : (
            <p className="text-sm text-[var(--cds-text-secondary)] mb-6">
              All validations passed successfully. You can proceed to signing.
            </p>
          )}

          {(!validationResult.expected?.domainAndMessageHashes ||
            !validationResult.expected?.domainAndMessageHashes?.domainHash ||
            !validationResult.expected?.domainAndMessageHashes?.messageHash) &&
            !blockingErrorsExist && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 max-w-lg w-full mb-6">
                <p className="mb-1 text-sm font-bold text-yellow-800 flex items-center gap-1">
                  <AlertTriangle size={16} /> Signing Not Available
                </p>
                <p className="text-sm text-yellow-700 text-left">
                  Domain and message hashes are required for signing but were not generated during
                  validation.
                </p>
              </div>
            )}

          {!blockingErrorsExist &&
            validationResult.expected?.domainAndMessageHashes?.domainHash &&
            validationResult.expected?.domainAndMessageHashes?.messageHash && (
              <div className="w-full flex justify-center">
                <Button
                  onClick={() => onProceedToLedgerSigning(validationResult)}
                  size="lg"
                  icon={<ChevronRight size={20} />}
                  fullWidth
                >
                  Proceed to signing
                </Button>
              </div>
            )}
        </div>
      </Modal>
    </div>
  );
};
