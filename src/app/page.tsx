'use client';

import Head from 'next/head';
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
import { ValidationData } from '@/lib/types';
import { ConfigOption } from '@/components/UserSelection';

type UserType = string | null;
type NetworkType = 'Sepolia' | 'Mainnet' | null;
type UpgradeType = string | null;
type Step = 'network' | 'upgrade' | 'user' | 'simulation' | 'validation' | 'ledger' | 'signing';

interface SigningData {
  signature: string;
  signerAddress: string;
  domainHash: string;
  messageHash: string;
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('network');
  const [selectedUser, setSelectedUser] = useState<UserType>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradeType>(null);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [signingData, setSigningData] = useState<SigningData | null>(null);
  const [userLedgerAddress, setUserLedgerAddress] = useState<string>('');
  const [userLedgerAccount, setUserLedgerAccount] = useState<number>(0);

  const handleNetworkSelection = (network: NetworkType) => {
    setSelectedNetwork(network);
    setCurrentStep('upgrade');
  };

  const handleUpgradeSelection = (upgradeId: string) => {
    setSelectedUpgrade(upgradeId);
    setCurrentStep('user');
  };

  const handleUserSelection = (cfg: ConfigOption) => {
    setSelectedUser(cfg.fileName);
    setUserLedgerAccount(cfg.ledgerId);
    setCurrentStep('validation');
  };

  const handleBackToSetup = () => {
    setCurrentStep('simulation');
    setValidationData(null);
    setSigningData(null);
  };

  const handleProceedToLedgerSigning = (validationResult: ValidationData) => {
    setValidationData(validationResult);
    setCurrentStep('ledger');
  };

  const handleLedgerSigningComplete = (signature: string) => {
    // Extract domain and message hash from validation data
    const domainHash = validationData?.expected?.domainAndMessageHashes?.domain_hash || '';
    const messageHash = validationData?.expected?.domainAndMessageHashes?.message_hash || '';

    setSigningData({
      signature,
      signerAddress: userLedgerAddress,
      domainHash,
      messageHash,
    });
    setCurrentStep('signing');
  };

  const handleBackToValidation = () => {
    setCurrentStep('validation');
  };

  const handleBackToLedger = () => {
    setCurrentStep('ledger');
  };

  const handleGoToNetworkSelection = () => {
    setCurrentStep('network');
    setSelectedUser(null);
    setSelectedNetwork(null);
    setSelectedUpgrade(null);
    setValidationData(null);
    setSigningData(null);
    setUserLedgerAddress('');
    setUserLedgerAccount(0);
  };

  const handleGoToUpgradeSelection = () => {
    setCurrentStep('upgrade');
    setSelectedUpgrade(null);
    setSelectedUser(null);
    setValidationData(null);
    setSigningData(null);
    setUserLedgerAddress('');
    setUserLedgerAccount(0);
  };

  const handleGoToUserSelection = () => {
    setCurrentStep('user');
    setSelectedUser(null);
    setValidationData(null);
    setSigningData(null);
    setUserLedgerAddress('');
    setUserLedgerAccount(0);
  };

  return (
    <>
      <Head>
        <title>Contract Deployment Verification Tool</title>
        <meta
          name="description"
          content="Streamline your smart contract deployment verification process"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout
        maxWidth={
          currentStep === 'validation'
            ? '1200px'
            : currentStep === 'ledger'
            ? '800px'
            : currentStep === 'signing'
            ? '800px'
            : currentStep === 'upgrade'
            ? '900px'
            : currentStep === 'simulation'
            ? '900px'
            : '600px'
        }
      >
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
          onWalletClick={
            currentStep === 'user' ||
            currentStep === 'simulation' ||
            currentStep === 'validation' ||
            currentStep === 'ledger' ||
            currentStep === 'signing'
              ? handleGoToUpgradeSelection
              : undefined
          }
          onUserClick={
            currentStep === 'simulation' ||
            currentStep === 'validation' ||
            currentStep === 'ledger' ||
            currentStep === 'signing'
              ? handleGoToUserSelection
              : undefined
          }
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
            userType={selectedUser || ''}
            network={selectedNetwork || ''}
            selectedUpgrade={{
              id: selectedUpgrade || '',
              name: selectedUpgrade || '',
            }}
            onBackToSetup={handleBackToSetup}
            onProceedToLedgerSigning={handleProceedToLedgerSigning}
          />
        )}

        {currentStep === 'ledger' && validationData && (
          <LedgerSigning
            domainHash={validationData.expected?.domainAndMessageHashes?.domain_hash || ''}
            messageHash={validationData.expected?.domainAndMessageHashes?.message_hash || ''}
            ledgerAccount={userLedgerAccount}
            onSigningComplete={handleLedgerSigningComplete}
            onCancel={handleBackToValidation}
          />
        )}

        {currentStep === 'signing' && (
          <SigningConfirmation
            userType={selectedUser || ''}
            network={selectedNetwork || ''}
            selectedUpgrade={{
              id: selectedUpgrade || '',
              name: selectedUpgrade || '',
            }}
            signingData={signingData}
            onBackToValidation={handleBackToValidation}
            onBackToLedger={signingData ? handleBackToLedger : undefined}
            onBackToSetup={handleBackToSetup}
          />
        )}
      </Layout>
    </>
  );
}
