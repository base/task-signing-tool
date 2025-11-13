import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

const CARD_CLASSES = 'bg-white border border-slate-200 rounded-lg p-6';
const INFO_BOX_CLASSES = 'bg-sky-50 border border-sky-200 rounded-md p-4 mb-5';
const WARNING_BOX_CLASSES = 'bg-amber-50 border border-amber-200 rounded-md p-4 mb-5';
const ERROR_BOX_CLASSES = 'bg-rose-50 border border-rose-200 rounded-md p-4 mb-5';
const STEP_TITLE_CLASSES = 'text-sm font-semibold text-slate-900 mb-4';
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
              className="w-full rounded-lg bg-indigo-600 py-3 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              Continue
            </button>
          </div>
        );

      case 'sign':
        return (
          <div className={CARD_CLASSES}>
            <h3 className={STEP_TITLE_CLASSES}>Step 2: Sign Transaction</h3>

            <div className={INFO_BOX_CLASSES}>
              <p className="mb-2 text-xs font-semibold text-slate-800">💡 Reminder</p>
              <p className="mb-0.5 text-sm text-slate-800">
                Verify the domain and message hashes match the values on your ledger.
              </p>
            </div>

            <div className={WARNING_BOX_CLASSES}>
              <p className="mb-3 text-sm font-medium text-amber-900">📝 EIP-712 Signing Data:</p>
              <div className="mb-3">
                <strong className="text-amber-900">Domain hash</strong>
                <div className="mt-1 block w-full rounded font-mono text-xs text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1.5">
                    {displayDomainHash}
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <strong className="text-amber-900">Message hash</strong>
                <div className="mt-1 block w-full rounded font-mono text-xs text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1.5">
                    {displayMessageHash}
                  </span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className={ERROR_BOX_CLASSES}>
                <p className="mb-1 text-sm font-semibold text-rose-800">❌ Error</p>
                <p className="text-sm text-rose-800">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs text-rose-800">
                    Run{' '}
                    <code className="rounded bg-rose-100 px-1.5 py-0.5">
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {errorMessage.includes('rejected') && (
                  <p className="mt-2 text-xs text-rose-800">
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {errorMessage.includes('locked') && (
                  <p className="mt-2 text-xs text-rose-800">
                    Please unlock your Ledger device and open the Ethereum app
                  </p>
                )}
              </div>
            )}

            <div className="mb-4 flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                ← Go back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className={`flex flex-[2] items-center justify-center gap-2 rounded-lg border border-transparent py-2.5 px-4 text-sm font-semibold ${
                  loading || !hasRequiredFields
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                    Signing…
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
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="m-0 text-sm font-semibold text-rose-800">Configuration error</p>
          </div>
          <p className="mb-2 text-sm text-rose-800">{configurationError}</p>
          <p className="text-xs text-rose-800">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-6 text-center">
        <h2 className="mb-1 text-2xl font-semibold text-slate-900">
          Ledger signing • Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
        </h2>
        <p className="m-0 text-sm text-slate-600">
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
