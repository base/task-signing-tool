import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">Ledger Signing</h2>
        <p className="text-sm text-slate-600">
          Step {currentStep === 'connect' ? '1' : '2'} of 2
        </p>
      </div>

      {configurationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-semibold text-red-700">Configuration Error</p>
          <p className="text-sm text-red-600">{configurationError}</p>
        </div>
      )}

      {currentStep === 'connect' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Connect Your Ledger</h3>

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="mb-2 text-sm font-medium text-blue-900">Ensure your Ledger device is:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-blue-800">
              <li>Connected via USB</li>
              <li>Unlocked with your PIN</li>
              <li>Ethereum app is open and ready</li>
              <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={!hasRequiredFields}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Signing
          </button>
        </div>
      )}

      {currentStep === 'sign' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Sign Transaction</h3>

          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-medium text-amber-900">
              ⚠️ Verify the hashes match your Ledger device
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900">Domain Hash</label>
                <div className="rounded border border-amber-300 bg-white p-3 font-mono text-xs text-amber-900 break-all">
                  {displayDomainHash}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900">Message Hash</label>
                <div className="rounded border border-amber-300 bg-white p-3 font-mono text-xs text-amber-900 break-all">
                  {displayMessageHash}
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="mb-1 text-sm font-semibold text-red-700">Error</p>
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
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentStep('connect');
                setErrorMessage(null);
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back
            </button>
            <button
              onClick={handleSign}
              disabled={loading || !hasRequiredFields}
              className={`flex-[2] rounded-lg px-4 py-3 text-base font-medium text-white transition-colors ${
                loading || !hasRequiredFields
                  ? 'cursor-not-allowed bg-slate-400'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Signing...
                </>
              ) : (
                'Sign on Ledger'
              )}
            </button>
          </div>
        </div>
      )}

      <div>
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
