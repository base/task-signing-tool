import { useState } from 'react';
import type { LedgerSigningResult } from '@/lib/ledger-signing';
import { Badge, Button, Card, SectionHeader } from './ui';

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

  const missingFields = [!domainHash && 'domain hash', !messageHash && 'message hash'].filter(
    Boolean
  ) as string[];
  const configurationError = missingFields.length
    ? `Missing required signing fields: ${missingFields.join(', ')}`
    : null;
  const hasRequiredFields = !configurationError;

  const displayDomainHash = domainHash.toUpperCase();
  const displayMessageHash = messageHash.toUpperCase();

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
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Step 4"
        title="Authorize via hardware"
        description="Confirm the EIP‑712 payload on your Ledger before producing the signature."
        aside={<Badge tone="neutral">Ledger #{ledgerAccount}</Badge>}
      />

      {configurationError && (
        <Card className="border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-sm text-[var(--color-danger)]">
          {configurationError}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="outline">
          <p className="text-sm font-semibold text-[var(--color-text)]">Checklist</p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
            <li>Connect Ledger via USB and unlock with PIN.</li>
            <li>Open the Ethereum app and enable blind signing.</li>
            <li>Match the domain + message hashes shown below.</li>
          </ul>
        </Card>

        <Card variant="outline">
          <p className="text-sm font-semibold text-[var(--color-text)]">Signing data</p>
          <div className="mt-4 space-y-3 font-mono text-xs">
            <div>
              <p className="text-[var(--color-text-soft)]">Domain hash</p>
              <p className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--color-text)]">
                {displayDomainHash}
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text-soft)]">Message hash</p>
              <p className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--color-text)]">
                {displayMessageHash}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {errorMessage && (
        <Card className="space-y-2 border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-sm text-[var(--color-danger)]">
          <p>{errorMessage}</p>
          {errorMessage.includes('not found') && (
            <p className="text-xs">
              Ensure `eip712sign` is installed and available on your PATH, then retry.
            </p>
          )}
          {errorMessage.includes('unlock') && (
            <p className="text-xs">Unlock the Ledger device and open the Ethereum app.</p>
          )}
        </Card>
      )}

      <Card variant="outline" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {currentStep === 'connect' ? 'Connect & verify device' : 'Review hashes & sign'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {currentStep === 'connect'
                ? 'We will prompt your Ledger once the device is ready.'
                : 'Signature will be captured locally and never leaves this browser.'}
            </p>
          </div>
          <Badge tone="info">
            Step {currentStep === 'connect' ? '1' : '2'} of 2
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3">
          {currentStep === 'sign' && (
            <Button variant="secondary" onClick={() => setCurrentStep('connect')}>
              Back
            </Button>
          )}
          {currentStep === 'connect' ? (
            <Button onClick={handleConnect} disabled={!hasRequiredFields}>
              Continue to signing
            </Button>
          ) : (
            <Button onClick={handleSign} disabled={loading || !hasRequiredFields} icon="🔐">
              {loading ? 'Awaiting Ledger…' : 'Sign on Ledger'}
            </Button>
          )}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
