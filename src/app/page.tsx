'use client';

import { useState } from 'react';
import {
  Header,
  Layout,
  LedgerSigning,
  SelectionSummary,
  SigningConfirmation,
  StepIndicator,
  UpgradeSelection,
  UserSelection,
  ValidationResults,
} from '@/components';
import { NetworkType, ValidationData } from '@/lib/types';
import { ConfigOption } from '@/components/UserSelection';
import { LedgerSigningResult } from '@/lib/ledger-signing';

type UpgradeType = string | null;
type Step = 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  upgrade: '800px',
  user: '600px',
  validation: '1400px',
  ledger: '900px',
  signing: '900px',
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
      <Layout maxWidth={STEP_LAYOUT_WIDTH[currentStep]}>
        <Header />

        <StepIndicator
          currentStep={currentStep}
          hasNetwork={!!selectedNetwork}
          hasUpgrade={!!selectedUpgrade}
          hasUser={!!selectedUser}
        />

        <SelectionSummary
          selectedUser={selectedUser}
          selectedNetwork={selectedNetwork}
          selectedWallet={selectedUpgrade}
          onNetworkClick={undefined}
          onWalletClick={canEditUpgrade ? handleGoToUpgradeSelection : undefined}
          onUserClick={canEditUser ? handleGoToUserSelection : undefined}
        />

        {currentStep === 'upgrade' && (
          <UpgradeSelection
            selectedWallet={selectedUpgrade}
            selectedNetwork={selectedNetwork}
            onSelect={handleUpgradeSelection}
          />
        )}

        {currentStep === 'user' && selectedNetwork && selectedUpgrade && (
          <UserSelection
            network={selectedNetwork}
            upgradeId={selectedUpgrade}
            onSelect={handleUserSelection}
          />
        )}

        {currentStep === 'validation' && (
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
              id: selectedUpgrade || '',
              name: selectedUpgrade || '',
            }}
            signingData={signingData}
            onBackToValidation={handleBackToValidation}
            onBackToLedger={signingData ? handleBackToLedger : undefined}
            onBackToSetup={handleGoToUpgradeSelection}
          />
        )}
      </Layout>
    </>
  );
}
