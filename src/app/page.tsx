'use client';

import { useState } from 'react';
import {
  NetworkSelection,
  NetworkSummary,
  UpgradeSelection,
  UserSelection,
  ValidationResults,
  LedgerSigning,
  SigningConfirmation,
  SelectionSummary,
  UserSummary,
} from '@/components';
import { PageShell, StepIndicator } from '@/components/ui';
import { NetworkType, ValidationData, Upgrade } from '@/lib/types';
import { getUpgradeForNetwork, TaskOption } from '@/lib/task-selection';
import { ConfigOption } from '@/components/UserSelection';
import { LedgerSigningResult } from '@/lib/ledger-signing';

type Step = 'upgrade' | 'network' | 'user' | 'validation' | 'ledger' | 'signing';
type StepStatus = 'current' | 'completed' | 'pending';

const STEP_LAYOUT_WIDTH: Record<Step, string> = {
  upgrade: 'max-w-4xl',
  network: 'max-w-3xl',
  user: 'max-w-3xl',
  validation: 'max-w-[1200px]',
  ledger: 'max-w-4xl',
  signing: 'max-w-4xl',
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('upgrade');
  const [selectedUser, setSelectedUser] = useState<ConfigOption>();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | null>(null);
  const [availableNetworksForTask, setAvailableNetworksForTask] = useState<NetworkType[]>([]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);
  const [selectedTaskOption, setSelectedTaskOption] = useState<TaskOption | null>(null);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [signingData, setSigningData] = useState<LedgerSigningResult | null>(null);
  const [userLedgerAccount, setUserLedgerAccount] = useState<number>(0);

  const resetSelectionsFrom = (step: 'upgrade' | 'network' | 'user') => {
    if (step === 'upgrade') {
      setSelectedNetwork(null);
      setSelectedUpgrade(null);
      setSelectedTaskOption(null);
      setAvailableNetworksForTask([]);
    }

    if (step === 'network') {
      setSelectedNetwork(null);
    }

    if (step === 'upgrade' || step === 'network' || step === 'user') {
      setSelectedUser(undefined);
      setValidationData(null);
      setSigningData(null);
      setUserLedgerAccount(0);
    }
  };

  const handleUpgradeSelection = (taskOption: TaskOption) => {
    setSelectedTaskOption(taskOption);
    setSelectedUpgrade(taskOption.displayUpgrade);
    setSelectedNetwork(null);
    setSelectedUser(undefined);
    setValidationData(null);
    setSigningData(null);
    setUserLedgerAccount(0);
    setAvailableNetworksForTask(taskOption.networks);
    setCurrentStep('network');
  };

  const handleNetworkSelection = (network: NetworkType) => {
    const networkUpgrade = selectedTaskOption
      ? getUpgradeForNetwork(selectedTaskOption, network)
      : undefined;

    if (!networkUpgrade) {
      console.error(`No upgrade metadata found for ${network}`);
      return;
    }

    setSelectedUpgrade(networkUpgrade);
    setSelectedNetwork(network);
    setSelectedUser(undefined);
    setValidationData(null);
    setSigningData(null);
    setUserLedgerAccount(0);
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

  const handleGoToUpgradeSelection = () => {
    resetSelectionsFrom('upgrade');
    setCurrentStep('upgrade');
  };

  const handleGoToNetworkSelection = () => {
    resetSelectionsFrom('network');
    setCurrentStep('network');
  };

  const handleGoToUserSelection = () => {
    resetSelectionsFrom('user');
    setCurrentStep('user');
  };

  const canEditUpgrade =
    currentStep === 'network' ||
    currentStep === 'user' ||
    currentStep === 'validation' ||
    currentStep === 'ledger' ||
    currentStep === 'signing';

  const canEditNetwork =
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
      id: 'network',
      label: 'Select Network',
      status:
        currentStep === 'network'
          ? 'current'
          : ((selectedNetwork ? 'completed' : 'pending') as StepStatus),
    },
    {
      id: 'user',
      label: 'Select User',
      status:
        currentStep === 'user'
          ? 'current'
          : ((selectedUser ? 'completed' : 'pending') as StepStatus),
    },
    {
      id: 'validation',
      label: 'Review & Validate',
      status:
        currentStep === 'validation'
          ? 'current'
          : ((validationData ? 'completed' : 'pending') as StepStatus),
    },
    {
      id: 'ledger',
      label: 'Sign with Ledger',
      status:
        currentStep === 'ledger'
          ? 'current'
          : ((signingData ? 'completed' : 'pending') as StepStatus),
    },
    {
      id: 'signing',
      label: 'Confirmation',
      status: currentStep === 'signing' ? 'current' : ('pending' as StepStatus),
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

        {canEditNetwork && (
          <NetworkSummary selectedNetwork={selectedNetwork} onChange={handleGoToNetworkSelection} />
        )}

        {canEditUser && (
          <UserSummary selectedUser={selectedUser} onChange={handleGoToUserSelection} />
        )}

        {currentStep === 'upgrade' && (
          <UpgradeSelection
            selectedUpgradeId={selectedUpgrade?.id ?? null}
            onSelect={handleUpgradeSelection}
          />
        )}

        {currentStep === 'network' && selectedUpgrade && (
          <NetworkSelection
            selectedNetwork={selectedNetwork}
            networks={availableNetworksForTask}
            onSelect={handleNetworkSelection}
          />
        )}

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
          <LedgerSigning
            domainHash={validationData.expected?.domainAndMessageHashes?.domainHash || ''}
            messageHash={validationData.expected?.domainAndMessageHashes?.messageHash || ''}
            ledgerAccount={userLedgerAccount}
            onSigningComplete={handleLedgerSigningComplete}
          />
        )}

        {currentStep === 'signing' && (
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
