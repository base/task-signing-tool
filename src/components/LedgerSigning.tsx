import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

const CARD_CLASSES = 'bg-gray-50 border border-gray-200 rounded-xl p-6';
const INFO_BOX_CLASSES = 'bg-blue-50 border border-blue-300 rounded-lg p-4 mb-5';
const WARNING_BOX_CLASSES = 'bg-amber-50 border border-amber-500 rounded-lg p-4 mb-5';
const ERROR_BOX_CLASSES = 'bg-red-100 border border-red-200 rounded-lg p-4 mb-5';
const STEP_TITLE_CLASSES = 'text-lg font-semibold text-gray-700 mb-4';
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
          <div className={CARD_CLASSES}>
            <h3 className={STEP_TITLE_CLASSES}>Step 1: Connect Your Ledger</h3>

            <div className={INFO_BOX_CLASSES}>
              <p className="mb-3 text-blue-800">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-1 pl-5 text-blue-800">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              className="w-full rounded-lg border border-transparent bg-emerald-500 py-3 px-6 text-base font-semibold text-white transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
            >
              Continue to Signing
            </button>
          </div>
        );

      case 'sign':
        return (
          <div className={CARD_CLASSES}>
            <h3 className={STEP_TITLE_CLASSES}>Step 2: Sign Transaction</h3>

            <div className={INFO_BOX_CLASSES}>
              <p className="mb-3 text-sm font-medium text-blue-800">💡 MUST DO:</p>
              <p className="mb-2 text-sm text-blue-800">
                Verify the domain and message hashes match the values on your ledger.
              </p>
            </div>

            <div className={WARNING_BOX_CLASSES}>
              <p className="mb-3 text-sm font-medium text-amber-900">📝 EIP-712 Signing Data:</p>
              <div className="mb-3">
                <strong className="text-amber-900">Domain Hash:</strong>
                <div className="mt-1 block w-full rounded font-mono text-sm text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1">
                    {displayDomainHash}
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <strong className="text-amber-900">Message Hash:</strong>
                <div className="mt-1 block w-full rounded font-mono text-sm text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1">
                    {displayMessageHash}
                  </span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className={ERROR_BOX_CLASSES}>
                <p className="mb-2 text-sm font-medium text-red-600">❌ Error:</p>
                <p className="text-sm text-red-600">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs text-red-600">
                    Run{' '}
                    <code className="rounded bg-red-200 px-1.5 py-0.5">
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
              </div>
            )}

            <div className="mb-5 flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-3 px-6 text-base font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className={`flex flex-[2] items-center justify-center gap-2 rounded-lg border border-transparent py-3 px-6 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                  loading || !hasRequiredFields
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                    Signing...
                  </>
                ) : (
                  'Sign on Ledger'
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
    <div className="box-border w-full max-w-[960px] p-5 mx-auto">
      {configurationError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-100 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="m-0 text-base font-semibold text-red-600">Configuration Error</p>
          </div>
          <p className="mb-3 text-sm text-red-600">{configurationError}</p>
          <p className="text-xs text-red-600">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-8 text-center">
        <h2 className="mb-4 text-2xl font-semibold text-gray-700">
          Ledger Signing - Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
        </h2>
        <p className="m-0 text-sm text-gray-500">
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
