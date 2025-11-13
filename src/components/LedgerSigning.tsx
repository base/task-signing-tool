import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

const CARD_CLASSES = 'bg-white border border-gray-200 rounded-xl p-6 shadow-sm';
const INFO_BOX_CLASSES = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6';
const WARNING_BOX_CLASSES = 'bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6';
const ERROR_BOX_CLASSES = 'bg-red-50 border border-red-200 rounded-lg p-4 mb-6';
const STEP_TITLE_CLASSES = 'text-lg font-semibold text-gray-900 mb-4';
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
              <p className="mb-3 text-sm font-medium text-blue-900">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm text-blue-800">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              className="w-full rounded-lg bg-blue-600 py-3 px-6 text-base font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
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
              <p className="mb-2 text-sm font-medium text-blue-900">Important:</p>
              <p className="text-sm text-blue-800">
                Verify the domain and message hashes match the values displayed on your Ledger device.
              </p>
            </div>

            <div className={WARNING_BOX_CLASSES}>
              <p className="mb-3 text-sm font-medium text-amber-900">EIP-712 Signing Data</p>
              <div className="mb-3">
                <label className="text-xs font-medium text-amber-900 uppercase tracking-wide">Domain Hash</label>
                <div className="mt-1 block w-full rounded-lg bg-amber-100 px-3 py-2 font-mono text-xs text-amber-900 break-all">
                  {displayDomainHash}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-amber-900 uppercase tracking-wide">Message Hash</label>
                <div className="mt-1 block w-full rounded-lg bg-amber-100 px-3 py-2 font-mono text-xs text-amber-900 break-all">
                  {displayMessageHash}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className={ERROR_BOX_CLASSES}>
                <p className="mb-2 text-sm font-medium text-red-700">Error</p>
                <p className="text-sm text-red-600">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs text-red-600">
                    Run{' '}
                    <code className="rounded bg-red-200 px-1.5 py-0.5 font-mono text-xs">
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

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 px-4 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              >
                ← Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className={`flex flex-[2] items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  loading || !hasRequiredFields
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
    <div className="box-border w-full max-w-[800px] mx-auto">
      {configurationError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-700">Configuration Error</p>
          <p className="mb-2 text-sm text-red-600">{configurationError}</p>
          <p className="text-xs text-red-600">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Ledger Signing
        </h2>
        <p className="text-sm text-gray-600">
          Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}:{' '}
          {currentStep === 'connect' && 'Connect your device'}
          {currentStep === 'sign' && 'Sign the transaction'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
