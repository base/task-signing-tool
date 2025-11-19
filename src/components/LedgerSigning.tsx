import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

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
          <Card className="max-w-2xl mx-auto p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[var(--cds-text-primary)]">
                Connect Your Ledger
              </h3>
              <Badge variant="primary" size="sm">
                Step 1
              </Badge>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
              <p className="text-[var(--cds-primary)] font-medium mb-4">
                Before proceeding, ensure your device is:
              </p>
              <ul className="space-y-3">
                {[
                  'Connected via USB',
                  'Unlocked with your PIN',
                  'Ethereum app is open',
                  'Blind signing is enabled in settings',
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-[var(--cds-text-secondary)]"
                  >
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-[var(--cds-primary)] flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={!hasRequiredFields}
              fullWidth
              size="lg"
              icon={<span>→</span>}
            >
              Continue
            </Button>
          </Card>
        );

      case 'sign':
        return (
          <Card className="max-w-2xl mx-auto p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[var(--cds-text-primary)]">
                Sign Transaction
              </h3>
              <Badge variant="warning" size="sm">
                Step 2
              </Badge>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
              <div className="flex gap-3">
                <div className="text-blue-600 text-xl">💡</div>
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">Verification Required</p>
                  <p className="text-sm text-blue-800">
                    Verify the domain and message hashes match the values displayed on your Ledger
                    device.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 space-y-4">
              <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2">
                EIP-712 Signing Data
              </h4>

              <div>
                <strong className="text-xs text-yellow-800 uppercase block mb-1">
                  Domain Hash
                </strong>
                <div className="font-mono text-xs bg-white border border-yellow-200 rounded-lg p-3 break-all text-gray-700">
                  {displayDomainHash}
                </div>
              </div>

              <div>
                <strong className="text-xs text-yellow-800 uppercase block mb-1">
                  Message Hash
                </strong>
                <div className="font-mono text-xs bg-white border border-yellow-200 rounded-lg p-3 break-all text-gray-700">
                  {displayMessageHash}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
                <div className="flex gap-3">
                  <span className="text-red-500 text-lg">❌</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--cds-error)] mb-1">Signing Error</p>
                    <p className="text-sm text-red-700 mb-2">{errorMessage}</p>
                    {errorMessage.includes('not found') && (
                      <div className="text-xs bg-white/50 p-2 rounded border border-red-100 inline-block font-mono text-red-800">
                        make install-eip712sign
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                variant="secondary"
                className="flex-1"
              >
                Go Back
              </Button>

              <Button
                onClick={handleSign}
                disabled={loading || !hasRequiredFields}
                isLoading={loading}
                className="flex-[2]"
              >
                Sign
              </Button>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-[var(--cds-text-primary)] tracking-tight mb-2">
          Ledger Signing
        </h2>
        <div className="flex items-center justify-center gap-2 text-[var(--cds-text-secondary)]">
          <span
            className={`h-2 w-2 rounded-full ${
              currentStep === 'connect' ? 'bg-[var(--cds-primary)]' : 'bg-gray-300'
            }`}
          />
          <span
            className={`h-2 w-2 rounded-full ${
              currentStep === 'sign' ? 'bg-[var(--cds-primary)]' : 'bg-gray-300'
            }`}
          />
          <span className="ml-2 text-sm">
            Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {configurationError && (
        <div className="max-w-2xl mx-auto mb-8 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="text-sm font-bold text-[var(--cds-error)]">Configuration Error</p>
              <p className="text-sm text-red-700 mt-1">{configurationError}</p>
            </div>
          </div>
        </div>
      )}

      {renderStepContent()}
    </div>
  );
}
