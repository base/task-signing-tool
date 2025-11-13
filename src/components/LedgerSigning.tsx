import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

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
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Step 1: Connect Your Ledger</h3>

            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="mb-2 text-sm font-medium text-blue-900">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-blue-800">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              className="btn-success w-full"
            >
              Continue to Signing →
            </button>
          </div>
        );

      case 'sign':
        return (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Step 2: Sign Transaction</h3>

            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="mb-2 text-sm font-medium text-blue-900">Important</p>
              <p className="text-sm text-blue-800">
                Verify the domain and message hashes match the values on your Ledger.
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="mb-3 text-sm font-medium text-yellow-900">EIP-712 Signing Data</p>
              <div className="mb-3">
                <strong className="text-sm text-yellow-900">Domain Hash:</strong>
                <div className="mt-1 block w-full overflow-x-auto rounded bg-yellow-100 px-3 py-2 font-mono text-xs text-yellow-900">
                  {displayDomainHash}
                </div>
              </div>
              <div>
                <strong className="text-sm text-yellow-900">Message Hash:</strong>
                <div className="mt-1 block w-full overflow-x-auto rounded bg-yellow-100 px-3 py-2 font-mono text-xs text-yellow-900">
                  {displayMessageHash}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="mb-2 text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs text-red-700">
                    Run{' '}
                    <code className="rounded bg-red-100 px-1.5 py-0.5">
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {errorMessage.includes('rejected') && (
                  <p className="mt-2 text-xs text-red-700">
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {errorMessage.includes('locked') && (
                  <p className="mt-2 text-xs text-red-700">
                    Please unlock your Ledger device and open the Ethereum app
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                className="btn-secondary flex-1"
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className={`btn-danger flex flex-[2] items-center justify-center gap-2 ${loading || !hasRequiredFields ? 'opacity-50' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <span>🔐</span>
                    Sign on Ledger
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {configurationError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-900">Configuration Error</p>
          <p className="mb-2 text-sm text-red-700">{configurationError}</p>
          <p className="text-xs text-red-700">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-6 text-center">
        <h2 className="mb-2 text-3xl font-bold text-gray-900">
          Ledger Signing
        </h2>
        <p className="text-sm text-gray-600">
          Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}:{' '}
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6">
        <button
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
