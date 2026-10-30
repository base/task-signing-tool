'use client';

import { useState } from 'react';
import {
  UpgradeSelection,
  UserSelection,
  ValidationResults,
  HardwareSigning,
  SigningConfirmation,
  SelectionSummary,
  UserSummary,
} from '@/components';
import { PageShell, StepIndicator } from '@/components/ui';
import { ValidationData, Upgrade } from '@/lib/types';
import { ConfigOption } from '@/components/UserSelection';
import type { SigningResult } from '@/lib/types/signing';

type Step = 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';
type StepStatus = 'current' | 'completed' | 'pending';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  upgrade: 'max-w-4xl',
  user: 'max-w-3xl',
  validation: 'max-w-[1200px]',
  ledger: 'max-w-4xl',
  signing: 'max-w-4xl',
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('upgrade');
  const [selectedUser, setSelectedUser] = useState<ConfigOption>();
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);
  const selectedNetwork = selectedUpgrade?.network ?? null;
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [signingData, setSigningData] = useState<SigningResult | null>(null);

  const resetSelectionsFrom = (step: 'upgrade' | 'user') => {
    if (step === 'upgrade') {
      setSelectedUpgrade(null);
    }

    setSelectedUser(undefined);
    setValidationData(null);
    setSigningData(null);
  };

  const handleUpgradeSelection = (upgrade: Upgrade) => {
    setSelectedUpgrade(upgrade);
    setCurrentStep('user');
  };

  const handleUserSelection = (cfg: ConfigOption) => {
    setSelectedUser(cfg);
    setCurrentStep('validation');
  };

  const handleProceedToLedgerSigning = (validationResult: ValidationData) => {
    setValidationData(validationResult);
    setCurrentStep('ledger');
  };

  const handleSigningComplete = (res: SigningResult) => {
    setSigningData(res);
    setCurrentStep('signing');
  };

  const handleGoToUpgradeSelection = () => {
    resetSelectionsFrom('upgrade');
    setCurrentStep('upgrade');
  };

  const handleGoToUserSelection = () => {
    resetSelectionsFrom('user');
    setCurrentStep('user');
  };

  const canEditUpgrade = currentStep !== 'upgrade';

  const canEditUser =
    currentStep === 'validation' || currentStep === 'ledger' || currentStep === 'signing';

  const stepStatus = (step: Step, completed: boolean): StepStatus =>
    currentStep === step ? 'current' : completed ? 'completed' : 'pending';

  const steps = [
    {
      id: 'upgrade',
      label: 'Select Task',
      status: stepStatus('upgrade', !!selectedUpgrade),
    },
    {
      id: 'user',
      label: 'Select User',
      status: stepStatus('user', !!selectedUser),
    },
    {
      id: 'validation',
      label: 'Review & Validate',
      status: stepStatus('validation', !!validationData),
    },
    {
      id: 'ledger',
      label: 'Sign with Hardware Wallet',
      status: stepStatus('ledger', !!signingData),
    },
    {
      id: 'signing',
      label: 'Confirmation',
      status: stepStatus('signing', false),
    },
  ];

  return (
    <PageShell maxWidth={STEP_LAYOUT_WIDTH[currentStep]}>
      <StepIndicator steps={steps} />

      <div className="mt-8 animate-fade-in">
        {canEditUpgrade && (
          <SelectionSummary
            selectedUpgrade={selectedUpgrade}
            onChange={handleGoToUpgradeSelection}
          />
        )}

        {canEditUser && (
          <UserSummary selectedUser={selectedUser} onChange={handleGoToUserSelection} />
        )}

        {currentStep === 'upgrade' && <UpgradeSelection onSelect={handleUpgradeSelection} />}

        {currentStep === 'user' && selectedNetwork && selectedUpgrade && (
          <UserSelection
            network={selectedNetwork}
            upgradeId={selectedUpgrade.id}
            onSelect={handleUserSelection}
          />
        )}

        {currentStep === 'validation' && selectedUpgrade && (
          <ValidationResults
            userType={selectedUser?.fileName || ''}
            network={selectedNetwork || ''}
            upgradeId={selectedUpgrade.id}
            onProceedToLedgerSigning={handleProceedToLedgerSigning}
          />
        )}

        {currentStep === 'ledger' && validationData && (
          <HardwareSigning
            domainHash={validationData.expected.domainAndMessageHashes?.domainHash || ''}
            messageHash={validationData.expected.domainAndMessageHashes?.messageHash || ''}
            ledgerAccount={selectedUser?.ledgerId ?? 0}
            safeTxTypedData={validationData.actual.safeTxTypedData}
            onSigningComplete={handleSigningComplete}
          />
        )}

        {currentStep === 'signing' && signingData && (
          <SigningConfirmation
            user={selectedUser}
            network={selectedNetwork || ''}
            selectedUpgrade={{
              name: selectedUpgrade?.name || '',
            }}
            signingData={signingData}
            onBackToSetup={handleGoToUpgradeSelection}
          />
        )}
      </div>
    </PageShell>
  );
}
