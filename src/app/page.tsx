'use client';

import { useState } from 'react';
import {
  AppShell,
  Stepper,
  LedgerSigning,
  SigningConfirmation,
  UpgradeSelection,
  UserSelection,
  ValidationResults,
  Button,
  Card,
} from '@/components';
import { NetworkType, ValidationData } from '@/lib/types';
import { ConfigOption } from '@/components/UserSelection';
import { LedgerSigningResult } from '@/lib/ledger-signing';

type UpgradeType = string | null;
type Step = 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  upgrade: '900px',
  user: '600px',
  validation: '1200px',
  ledger: '800px',
  signing: '800px',
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('upgrade');
  const [selectedUser, setSelectedUser] = useState<ConfigOption>();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | null>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradeType>(null);
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

  const handleUpgradeSelection = (upgradeId: string, network: string) => {
    setSelectedUpgrade(upgradeId);
    setSelectedNetwork(network as NetworkType);
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

  const handleGoToUserSelection = () => {
    resetSelectionsFrom('user');
    setCurrentStep('user');
  };

  const canEditUpgrade =
    currentStep === 'user' ||
    currentStep === 'validation' ||
    currentStep === 'ledger' ||
    currentStep === 'signing';
  const canEditUser =
    currentStep === 'validation' || currentStep === 'ledger' || currentStep === 'signing';

  return (
    <>
      <AppShell
        headerRight={
          <div className="hidden md:flex items-center gap-2">
            {selectedNetwork && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                🌐 {selectedNetwork}
              </span>
            )}
            {selectedUpgrade && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                Task: {selectedUpgrade}
              </span>
            )}
            {selectedUser && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                Profile: {selectedUser.displayName}
              </span>
            )}
          </div>
        }
        sidebar={
          <Stepper
            current={currentStep}
            steps={[
              {
                id: 'upgrade',
                label: 'Choose Task',
                allowed: true,
                onClick: currentStep !== 'upgrade' ? handleGoToUpgradeSelection : undefined,
              },
              {
                id: 'user',
                label: 'Choose Profile',
                allowed: canEditUpgrade,
                onClick: canEditUpgrade ? handleGoToUserSelection : undefined,
              },
              {
                id: 'validation',
                label: 'Validate',
                allowed: canEditUser,
              },
              {
                id: 'ledger',
                label: 'Sign',
                allowed: currentStep === 'ledger' || currentStep === 'signing',
              },
              {
                id: 'signing',
                label: 'Confirm',
                allowed: currentStep === 'signing',
              },
            ]}
          />
        }
      >
        {currentStep === 'upgrade' && (
          <Card title="Select a task to sign">
            <UpgradeSelection
              selectedWallet={selectedUpgrade}
              selectedNetwork={selectedNetwork}
              onSelect={handleUpgradeSelection}
            />
          </Card>
        )}

        {currentStep === 'user' && selectedNetwork && selectedUpgrade && (
          <Card title="Select a signing profile">
            <UserSelection
              network={selectedNetwork}
              upgradeId={selectedUpgrade}
              onSelect={handleUserSelection}
            />
          </Card>
        )}

        {currentStep === 'validation' && (
          <div className="space-y-4">
            <ValidationResults
              userType={selectedUser?.fileName || ''}
              network={selectedNetwork || ''}
              selectedUpgrade={{
                id: selectedUpgrade || '',
                name: selectedUpgrade || '',
              }}
              onBackToSetup={handleGoToUpgradeSelection}
              onProceedToLedgerSigning={handleProceedToLedgerSigning}
            />
          </div>
        )}

        {currentStep === 'ledger' && validationData && (
          <Card title="Sign with Ledger">
            <LedgerSigning
              domainHash={validationData.expected?.domainAndMessageHashes?.domainHash || ''}
              messageHash={validationData.expected?.domainAndMessageHashes?.messageHash || ''}
              ledgerAccount={userLedgerAccount}
              onSigningComplete={handleLedgerSigningComplete}
              onCancel={handleBackToValidation}
            />
          </Card>
        )}

        {currentStep === 'signing' && (
          <Card title="Signing confirmation">
            <SigningConfirmation
              user={selectedUser}
              network={selectedNetwork || ''}
              selectedUpgrade={{
                id: selectedUpgrade || '',
                name: selectedUpgrade || '',
              }}
              signingData={signingData}
              onBackToValidation={handleBackToValidation}
              onBackToLedger={signingData ? handleBackToLedger : undefined}
              onBackToSetup={handleGoToUpgradeSelection}
            />
          </Card>
        )}

        <div className="flex gap-3 pt-2 md:hidden">
          {canEditUpgrade && (
            <Button variant="secondary" onClick={handleGoToUpgradeSelection} className="flex-1">
              Edit Task
            </Button>
          )}
          {canEditUser && (
            <Button variant="secondary" onClick={handleGoToUserSelection} className="flex-1">
              Edit Profile
            </Button>
          )}
        </div>
      </AppShell>
    </>
  );
}
