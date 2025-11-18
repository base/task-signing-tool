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
          <div 
            className="rounded-xl p-6"
            style={{
              background: 'var(--cb-surface-elevated)',
              border: '1px solid var(--cb-border)',
              boxShadow: 'var(--cb-shadow-md)'
            }}
          >
            <h3 className="mb-5 text-lg font-bold" style={{ color: 'var(--cb-text-primary)' }}>
              Step 1: Connect Your Ledger
            </h3>

            <div 
              className="mb-6 rounded-lg p-4"
              style={{
                background: 'var(--cb-primary-light)',
                border: '1px solid var(--cb-primary)',
                color: 'var(--cb-primary)'
              }}
            >
              <p className="mb-3 font-medium">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-1 pl-5">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              className="w-full rounded-lg py-3 px-6 text-base font-bold text-white transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'var(--cb-primary)',
                boxShadow: 'var(--cb-shadow-md)'
              }}
            >
              Continue to Signing →
            </button>
          </div>
        );

      case 'sign':
        return (
          <div 
            className="rounded-xl p-6"
            style={{
              background: 'var(--cb-surface-elevated)',
              border: '1px solid var(--cb-border)',
              boxShadow: 'var(--cb-shadow-md)'
            }}
          >
            <h3 className="mb-5 text-lg font-bold" style={{ color: 'var(--cb-text-primary)' }}>
              Step 2: Sign Transaction
            </h3>

            <div 
              className="mb-5 rounded-lg p-4"
              style={{
                background: 'var(--cb-primary-light)',
                border: '1px solid var(--cb-primary)',
                color: 'var(--cb-primary)'
              }}
            >
              <p className="mb-2 text-sm font-semibold">💡 MUST DO:</p>
              <p className="text-sm">
                Verify the domain and message hashes match the values on your Ledger device.
              </p>
            </div>

            <div 
              className="mb-5 rounded-lg p-4"
              style={{
                background: 'var(--cb-warning-light)',
                border: '1px solid var(--cb-warning)',
                color: 'var(--cb-warning)'
              }}
            >
              <p className="mb-3 text-sm font-semibold">📝 EIP-712 Signing Data:</p>
              <div className="mb-3">
                <strong className="text-sm">Domain Hash:</strong>
                <div className="mt-1 rounded bg-white px-3 py-2 font-mono text-xs">
                  {displayDomainHash}
                </div>
              </div>
              <div>
                <strong className="text-sm">Message Hash:</strong>
                <div className="mt-1 rounded bg-white px-3 py-2 font-mono text-xs">
                  {displayMessageHash}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div 
                className="mb-5 rounded-lg p-4"
                style={{
                  background: 'var(--cb-error-light)',
                  border: '1px solid var(--cb-error)',
                  color: 'var(--cb-error)'
                }}
              >
                <p className="mb-2 text-sm font-semibold">❌ Error:</p>
                <p className="text-sm">{errorMessage}</p>
                {errorMessage.includes('not found') && (
                  <p className="mt-2 text-xs">
                    Run{' '}
                    <code className="rounded px-1.5 py-0.5 font-mono" style={{ background: 'rgba(215, 58, 73, 0.1)' }}>
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {errorMessage.includes('rejected') && (
                  <p className="mt-2 text-xs">
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {errorMessage.includes('locked') && (
                  <p className="mt-2 text-xs">
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
                className="flex-1 rounded-lg py-2.5 px-6 text-base font-semibold transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: 'var(--cb-surface)',
                  color: 'var(--cb-text-primary)',
                  border: '1px solid var(--cb-border)',
                  boxShadow: 'var(--cb-shadow-sm)'
                }}
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                className="flex flex-[2] items-center justify-center gap-2 rounded-lg py-3 px-6 text-base font-bold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: 'var(--cb-error)',
                  boxShadow: 'var(--cb-shadow-md)'
                }}
              >
                {loading ? (
                  <>
                    <div 
                      className="h-5 w-5 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        borderTopColor: 'white'
                      }}
                    />
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
        <div 
          className="mb-6 rounded-lg p-4"
          style={{
            background: 'var(--cb-error-light)',
            border: '1px solid var(--cb-error)',
            color: 'var(--cb-error)'
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">❌</span>
            <p className="m-0 text-base font-semibold">Configuration Error</p>
          </div>
          <p className="mb-3 text-sm">{configurationError}</p>
          <p className="text-xs">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-8 text-center">
        <h2 className="mb-3 text-4xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
          Ledger Signing - Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
        </h2>
        <p className="m-0 text-base font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onCancel}
          className="rounded-lg px-6 py-2.5 text-base font-semibold transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: 'var(--cb-surface)',
            color: 'var(--cb-text-primary)',
            border: '1px solid var(--cb-border)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
