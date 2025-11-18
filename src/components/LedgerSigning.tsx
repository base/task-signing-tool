import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const TOTAL_STEPS = 2;

interface LedgerSigningProps {
  domainHash: string;
  messageHash: string;
  ledgerAccount: number;
  onSigningComplete: (res: LedgerSigningResult) => void;
  onCancel: () => void;
}

type LedgerSigningStep = 'connect' | 'sign';

async function submitLedgerSignatureRequest(payload: {
  domainHash: string;
  messageHash: string;
  ledgerAccount: number;
}): Promise<LedgerSigningResult> {
  const response = await fetch('/api/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'sign',
      ...payload,
    }),
  });

  return response.json();
}

export function LedgerSigning({
  domainHash,
  messageHash,
  ledgerAccount,
  onSigningComplete,
  onCancel,
}: LedgerSigningProps) {
  const [currentStep, setCurrentStep] = useState<LedgerSigningStep>('connect');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayDomainHash = domainHash.toUpperCase();
  const displayMessageHash = messageHash.toUpperCase();

  const missingFields = [!domainHash && 'domainHash', !messageHash && 'messageHash'].filter(
    Boolean
  ) as string[];
  const configurationError = missingFields.length
    ? `Missing required signing fields: ${missingFields.join(', ')}`
    : null;
  const hasRequiredFields = !configurationError;

  const handleConnect = () => {
    if (!hasRequiredFields) {
      setErrorMessage(configurationError);
      return;
    }

    setCurrentStep('sign');
    setErrorMessage(null);
  };

  const handleSign = async () => {
    if (!hasRequiredFields) {
      setErrorMessage(configurationError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await submitLedgerSignatureRequest({
        domainHash,
        messageHash,
        ledgerAccount,
      });

      if (result.success) {
        onSigningComplete(result);
      } else {
        setErrorMessage(result.error ?? 'Failed to sign transaction');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Failed to sign transaction: ${err.message}`
          : 'Failed to sign transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'connect':
        return (
          <Card className="p-8" elevated>
            <h3 className="mb-6 text-xl font-bold text-gray-900">Step 1: Connect Your Ledger</h3>

            <Card className="mb-6 border-blue-200 bg-blue-50 p-5">
              <p className="mb-3 font-medium text-blue-900">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-blue-800">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </Card>

            <Button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              size="lg"
              className="w-full"
            >
              Continue to Signing →
            </Button>
          </Card>
        );

      case 'sign':
        return (
          <Card className="p-8" elevated>
            <h3 className="mb-6 text-xl font-bold text-gray-900">Step 2: Sign Transaction</h3>

            <Card className="mb-6 border-blue-200 bg-blue-50 p-5">
              <p className="mb-2 text-sm font-medium text-blue-900">Important:</p>
              <p className="text-sm text-blue-800">
                Verify the domain and message hashes match the values on your ledger.
              </p>
            </Card>

            <Card className="mb-6 border-yellow-200 bg-yellow-50 p-5">
              <p className="mb-4 text-sm font-semibold text-yellow-900">EIP-712 Signing Data:</p>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-yellow-900">Domain Hash:</label>
                <div className="rounded-lg bg-white border border-yellow-200 p-3 font-mono text-xs text-gray-900 break-all">
                  {displayDomainHash}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-yellow-900">Message Hash:</label>
                <div className="rounded-lg bg-white border border-yellow-200 p-3 font-mono text-xs text-gray-900 break-all">
                  {displayMessageHash}
                </div>
              </div>
            </Card>

            {errorMessage && (
              <Card className="mb-6 border-red-200 bg-red-50 p-5">
                <p className="mb-2 text-sm font-semibold text-red-700">Error</p>
                <p className="text-sm text-red-600">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs text-red-600">
                    Run{' '}
                    <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono">
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {errorMessage.includes('rejected') && (
                  <p className="mt-2 text-xs text-red-600">
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {errorMessage.includes('locked') && (
                  <p className="mt-2 text-xs text-red-600">
                    Please unlock your Ledger device and open the Ethereum app
                  </p>
                )}
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                variant="secondary"
                className="flex-1"
              >
                ← Go Back
              </Button>
              <Button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                variant="danger"
                className="flex-[2] gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <span>🔐</span>
                    Sign on Ledger
                  </>
                )}
              </Button>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {configurationError && (
        <Card className="mb-6 border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <p className="m-0 text-base font-semibold text-red-700">Configuration Error</p>
          </div>
          <p className="mb-3 text-sm text-red-600">{configurationError}</p>
          <p className="text-xs text-red-600">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </Card>
      )}

      <div className="mb-8 text-center">
        <h2 className="mb-3 text-3xl font-bold text-gray-900">
          Ledger Signing - Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
        </h2>
        <p className="m-0 text-base text-gray-600">
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6">
        <button
          onClick={onCancel}
          className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-600 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
