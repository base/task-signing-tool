'use client';

import { useState } from 'react';
import {
  UpgradeSelection,
  UserSelection,
  ValidationResults,
  LedgerSigning,
  SigningConfirmation,
  SelectionSummary,
} from '@/components';
import { PageShell, StepIndicator } from '@/components/ui';
import { NetworkType, ValidationData, Upgrade } from '@/lib/types';
import { ConfigOption } from '@/components/UserSelection';
import { LedgerSigningResult } from '@/lib/ledger-signing';

type Step = 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  upgrade: 'max-w-4xl',
  user: 'max-w-3xl',
  validation: 'max-w-[1600px]',
  ledger: 'max-w-4xl',
  signing: 'max-w-4xl',
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('upgrade');
  const [selectedUser, setSelectedUser] = useState<ConfigOption>();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | null>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [signingData, setSigningData] = useState<LedgerSigningResult | null>(null);
  const [userLedgerAccount, setUserLedgerAccount] = useState<number>(0);

  const resetSelectionsFrom = (step: 'upgrade' | 'user') => {
    if (step === 'upgrade') {
      setSelectedNetwork(null);
      setSelectedUpgrade(null);
    }

    if (step === 'upgrade' || step === 'user') {
      setSelectedUser(undefined);
      setValidationData(null);
      setSigningData(null);
      setUserLedgerAccount(0);
    }
  };

  const handleUpgradeSelection = (upgrade: Upgrade) => {
    setSelectedUpgrade(upgrade);
    setSelectedNetwork(upgrade.network as NetworkType);
    setCurrentStep('user');
  };

  const handleUserSelection = (cfg: ConfigOption) => {
    setSelectedUser(cfg);
    setUserLedgerAccount(cfg.ledgerId);
    setCurrentStep('validation');
  };

  const handleProceedToLedgerSigning = (validationResult: ValidationData) => {
    setValidationData(validationResult);
    setCurrentStep('ledger');
  };

  const handleLedgerSigningComplete = (res: LedgerSigningResult) => {
    setSigningData(res);
    setCurrentStep('signing');
  };

  const handleBackToValidation = () => {
    setCurrentStep('validation');
  };

  const handleBackToLedger = () => {
    setCurrentStep('ledger');
  };

  const handleGoToUpgradeSelection = () => {
    resetSelectionsFrom('upgrade');
    setCurrentStep('upgrade');
  };

  const canEditUpgrade =
    currentStep === 'user' ||
    currentStep === 'validation' ||
    currentStep === 'ledger' ||
    currentStep === 'signing';
  const canEditUser =
    currentStep === 'validation' || currentStep === 'ledger' || currentStep === 'signing';

  // Map current step to step indicator format
  const steps = [
    {
      id: 'upgrade',
      label: 'Select Task',
      status:
        currentStep === 'upgrade'
          ? 'current'
          : ((selectedUpgrade ? 'completed' : 'pending') as 'current' | 'completed' | 'pending'),
    },
    {
      id: 'user',
      label: 'Select User',
      status:
        currentStep === 'user'
          ? 'current'
          : ((selectedUser ? 'completed' : selectedUpgrade ? 'pending' : 'pending') as
              | 'current'
              | 'completed'
              | 'pending'),
    },
    {
      id: 'validation',
      label: 'Review & Validate',
      status:
        currentStep === 'validation'
          ? 'current'
          : ((validationData ? 'completed' : selectedUser ? 'pending' : 'pending') as
              | 'current'
              | 'completed'
              | 'pending'),
    },
    {
      id: 'ledger',
      label: 'Sign with Ledger',
      status:
        currentStep === 'ledger'
          ? 'current'
          : ((signingData ? 'completed' : validationData ? 'pending' : 'pending') as
              | 'current'
              | 'completed'
              | 'pending'),
    },
    {
      id: 'signing',
      label: 'Confirmation',
      status:
        currentStep === 'signing' ? 'current' : ('pending' as 'current' | 'completed' | 'pending'),
    },
  ];

  return (
    <PageShell maxWidth={STEP_LAYOUT_WIDTH[currentStep]}>
      <StepIndicator steps={steps} />

      <div className="mt-8 animate-fade-in">
        {canEditUpgrade && <SelectionSummary selectedUpgrade={selectedUpgrade} />}

        {currentStep === 'upgrade' && (
          <UpgradeSelection
            selectedWallet={selectedUpgrade?.id || null}
            selectedNetwork={selectedNetwork}
            onSelect={handleUpgradeSelection}
          />
        )}

        {currentStep === 'user' && selectedNetwork && selectedUpgrade && (
          <UserSelection
            network={selectedNetwork}
            upgradeId={selectedUpgrade.id}
            onSelect={handleUserSelection}
          />
        )}

        {currentStep === 'validation' && (
          <ValidationResults
            userType={selectedUser?.fileName || ''}
            network={selectedNetwork || ''}
            selectedUpgrade={{
              id: selectedUpgrade?.id || '',
              name: selectedUpgrade?.name || '',
            }}
            onProceedToLedgerSigning={handleProceedToLedgerSigning}
          />
        )}

        {currentStep === 'ledger' && validationData && (
          <LedgerSigning
            domainHash={validationData.expected?.domainAndMessageHashes?.domainHash || ''}
            messageHash={validationData.expected?.domainAndMessageHashes?.messageHash || ''}
            ledgerAccount={userLedgerAccount}
            onSigningComplete={handleLedgerSigningComplete}
            onCancel={handleBackToValidation}
          />
        )}

        {currentStep === 'signing' && (
          <SigningConfirmation
            user={selectedUser}
            network={selectedNetwork || ''}
            selectedUpgrade={{
              id: selectedUpgrade?.id || '',
              name: selectedUpgrade?.name || '',
            }}
            signingData={signingData}
            onBackToValidation={handleBackToValidation}
            onBackToLedger={signingData ? handleBackToLedger : undefined}
            onBackToSetup={handleGoToUpgradeSelection}
          />
        )}
      </div>
    </PageShell>
  );
}
