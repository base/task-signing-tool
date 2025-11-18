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
import { Badge, Button, Card, SectionHeader } from './ui';

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
    const loadingTitle = isInstallingDeps ? 'Installing dependencies' : 'Running validation';
    return (
      <Card className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="h-14 w-14 animate-spin rounded-full border-4 border-[var(--color-primary-soft)] border-t-[var(--color-primary)]" />
        <p className="text-base font-semibold text-[var(--color-text)]">{loadingTitle}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          This can take a minute while we compile and compare state diffs.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="space-y-6 border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
        <div>
          <h3 className="text-lg font-semibold">Validation failed</h3>
          <p className="text-sm">{error}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => runValidation()}>
            Retry validation
          </Button>
          <Button variant="quiet" onClick={onBackToSetup}>
            Return to setup
          </Button>
        </div>
      </Card>
    );
  }

  if (!validationResult || totalItems === 0) {
    return (
      <Card className="space-y-4 text-center">
        <p className="text-base font-semibold text-[var(--color-text)]">No changes detected</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Script execution did not produce any overrides, changes, or balance shifts.
        </p>
        <Button variant="quiet" onClick={onBackToSetup}>
          Back to setup
        </Button>
      </Card>
    );
  }

  const matchStatus = evaluation?.matchStatus;
  const descriptionContent = evaluation?.description;

  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Step 3"
        title="Validate every change before you sign"
        description={`Reviewing ${totalItems} generated entries for ${selectedUpgrade.name} on ${network}.`}
        aside={
          <Badge tone={blockingErrorsExist ? 'warning' : 'success'}>
            {blockingErrorsExist ? 'Blocking issues' : 'No blockers'}
          </Badge>
        }
      />

      <Card variant="outline" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Step {stepInfo.currentStep}: {currentEntry ? STEP_LABELS[currentEntry.kind] : '—'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Item {stepInfo.currentStepIndex} of {stepInfo.currentStepItems} • Contract:{' '}
            {getContractNameForEntry(currentEntry, itemsByStep)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Signing ({stepCounts.signing}) • Overrides ({stepCounts.overrides}) • Changes (
            {stepCounts.changes}) • Balance ({stepCounts.balance})
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          <Button
            size="sm"
            onClick={() => setCurrentIndex(prev => Math.min(totalItems - 1, prev + 1))}
            disabled={currentIndex === totalItems - 1}
          >
            Next item
          </Button>
        </div>
      </Card>

      {evaluation && (
        <div className="grid gap-6 md:grid-cols-2">
          <ComparisonCard type="expected" {...evaluation.cards.expected} />
          <ComparisonCard type="actual" {...evaluation.cards.actual} />
        </div>
      )}

      {descriptionContent && (
        <Card
          className={
            descriptionContent.variant === 'expected-difference'
              ? 'border-[var(--color-success)] bg-[var(--color-success-soft)]'
              : 'border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)]/80'
          }
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{descriptionContent.icon}</span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
                {descriptionContent.title}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text)] whitespace-pre-wrap">
                {descriptionContent.text}
              </p>
            </div>
          </div>
        </Card>
      )}

      {matchStatus && (
        <Badge
          tone={matchStatus.status === 'match' || matchStatus.status === 'expected-difference' ? 'success' : 'danger'}
        >
          {matchStatus.icon} {matchStatus.text}
        </Badge>
      )}

      {currentIndex === totalItems - 1 && (
        <Card
          className={
            blockingErrorsExist
              ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
              : 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]'
          }
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold">
                {blockingErrorsExist ? 'Signing blocked' : 'Ready to sign'}
              </p>
              <p className="text-sm">
                {blockingErrorsExist
                  ? 'Resolve the mismatches above before continuing.'
                  : 'All comparisons match the expected state.'}
              </p>
            </div>
            {!blockingErrorsExist &&
              validationResult.expected?.domainAndMessageHashes?.domainHash &&
              validationResult.expected?.domainAndMessageHashes?.messageHash && (
                <Button onClick={() => onProceedToLedgerSigning(validationResult)} icon="🔐">
                  Continue to Ledger
                </Button>
              )}
          </div>
          {!blockingErrorsExist &&
            (!validationResult.expected?.domainAndMessageHashes ||
              !validationResult.expected?.domainAndMessageHashes?.domainHash ||
              !validationResult.expected?.domainAndMessageHashes?.messageHash) && (
              <p className="mt-3 text-sm">
                Domain and message hashes were not produced; rerun the simulation to proceed.
              </p>
            )}
        </Card>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="quiet" onClick={onBackToSetup}>
          Back to setup
        </Button>
        <Button variant="secondary" onClick={runValidation} disabled={isLoading}>
          {isLoading ? 'Running…' : 'Rerun validation'}
        </Button>
      </div>
    </section>
  );
};
