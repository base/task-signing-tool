import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

const CARD_CLASSES = 'bg-gradient-to-br from-white to-purple-50/30 border border-purple-200/50 rounded-2xl p-8 shadow-lg backdrop-blur-sm';
const INFO_BOX_CLASSES = 'bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-300 rounded-xl p-5 mb-6 shadow-sm backdrop-blur-sm';
const WARNING_BOX_CLASSES = 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-400 rounded-xl p-5 mb-6 shadow-md backdrop-blur-sm';
const ERROR_BOX_CLASSES = 'bg-gradient-to-br from-red-50 to-red-100/50 border-2 border-red-300 rounded-xl p-5 mb-6 shadow-md backdrop-blur-sm';
const STEP_TITLE_CLASSES = 'text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-5';
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
              className="w-full rounded-xl border border-transparent bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 px-6 text-base font-bold text-white shadow-lg transition-all duration-200 hover:from-emerald-600 hover:to-emerald-700 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Continue to Signing →
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
                className="flex-1 rounded-xl border border-gray-300 bg-white py-3 px-6 text-base font-semibold text-gray-600 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className={`flex flex-[2] items-center justify-center gap-2 rounded-xl border border-transparent py-4 px-6 text-base font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                  loading || !hasRequiredFields
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                    : 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg hover:from-red-700 hover:to-red-800 hover:-translate-y-0.5 hover:shadow-xl'
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing...
                  </>
                ) : (
                  '🔐 Sign on Ledger'
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
        <h2 className="mb-3 text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 bg-clip-text text-transparent">
          Ledger Signing - Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
        </h2>
        <p className="m-0 text-base font-medium text-gray-600">
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6 flex justify-between">
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
