'use client';

import { useState } from 'react';
import {
  Header,
  Layout,
  LedgerSigning,
  NetworkSelection,
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
type Step = 'network' | 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  network: '600px',
  upgrade: '900px',
  user: '600px',
  validation: '1200px',
  ledger: '800px',
  signing: '800px',
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('network');
  const [selectedUser, setSelectedUser] = useState<ConfigOption>();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | null>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradeType>(null);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [signingData, setSigningData] = useState<LedgerSigningResult | null>(null);
  const [userLedgerAccount, setUserLedgerAccount] = useState<number>(0);

  const resetSelectionsFrom = (step: 'network' | 'upgrade' | 'user') => {
    if (step === 'network') {
      setSelectedNetwork(null);
    }

    if (step === 'network' || step === 'upgrade') {
      setSelectedUpgrade(null);
    }

    if (step === 'network' || step === 'upgrade' || step === 'user') {
      setSelectedUser(undefined);
      setValidationData(null);
      setSigningData(null);
      setUserLedgerAccount(0);
    }
  };

  const handleNetworkSelection = (network: NetworkType) => {
    setSelectedNetwork(network);
    setCurrentStep('upgrade');
  };

  const handleUpgradeSelection = (upgradeId: string) => {
    setSelectedUpgrade(upgradeId);
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

  const handleGoToNetworkSelection = () => {
    resetSelectionsFrom('network');
    setCurrentStep('network');
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
          hasWallet={!!selectedUpgrade}
          hasUser={!!selectedUser}
        />

        <SelectionSummary
          selectedUser={selectedUser}
          selectedNetwork={selectedNetwork}
          selectedWallet={selectedUpgrade}
          onNetworkClick={currentStep !== 'network' ? handleGoToNetworkSelection : undefined}
          onWalletClick={canEditUpgrade ? handleGoToUpgradeSelection : undefined}
          onUserClick={canEditUser ? handleGoToUserSelection : undefined}
        />

        {currentStep === 'network' && <NetworkSelection onSelect={handleNetworkSelection} />}

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
            onBackToSetup={handleGoToNetworkSelection}
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
            onBackToSetup={handleGoToNetworkSelection}
          />
        )}
      </Layout>
    </>
  );
}
