import { ReactNode, useEffect, useRef, useState } from 'react';
import { toChecksumAddressSafe, toDisplaySignature } from '@/lib/format';
import { LedgerSigningResult } from '@/lib/ledger-signing';
import { ConfigOption } from './UserSelection';
import { Badge, Button, Card, SectionHeader } from './ui';

interface SigningConfirmationProps {
  user?: ConfigOption;
  network: string;
  selectedUpgrade: {
    id: string;
    name: string;
  };
  signingData?: LedgerSigningResult | null;
  onBackToValidation: () => void;
  onBackToLedger?: () => void;
  onBackToSetup: () => void;
}

type DetailItem = {
  label: string;
  value: ReactNode;
  monospace?: boolean;
};

export function SigningConfirmation({
  user,
  network,
  selectedUpgrade,
  signingData,
  onBackToValidation,
  onBackToLedger,
  onBackToSetup,
}: SigningConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCopied(false);
    if (resetTimeoutRef.current !== null) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, [signingData]);

  const handleCopySignature = async () => {
    if (!signingData) return;

    try {
      await navigator.clipboard.writeText(toDisplaySignature(signingData));
      setCopied(true);
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy signature to clipboard', error);
    }
  };

  const summaryItems: DetailItem[] = [
    { label: 'Signer profile', value: user?.displayName ?? '—' },
    { label: 'Network', value: network },
    { label: 'Upgrade', value: selectedUpgrade.name },
  ];

  if (signingData?.signer) {
    summaryItems.push({
      label: 'Ledger address',
      value: toChecksumAddressSafe(signingData.signer),
      monospace: true,
    });
  }

  const signatureItems: DetailItem[] = signingData
    ? [
        { label: 'Data', value: signingData.data, monospace: true },
        { label: 'Signer', value: toChecksumAddressSafe(signingData.signer), monospace: true },
        { label: 'Signature', value: signingData.signature, monospace: true },
      ]
    : [];

  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Step 5"
        title="Signature captured"
        description="Share the payload with your facilitator or commit it to the audit log."
        aside={<Badge tone="success">Complete</Badge>}
      />

      <Card className="space-y-4">
        <p className="text-lg font-semibold text-[var(--color-text)]">Transaction summary</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          {summaryItems.map(item => (
            <div key={item.label}>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-soft)]">
                {item.label}
              </dt>
              <dd
                className={`text-sm font-semibold text-[var(--color-text)] ${
                  item.monospace ? 'font-mono break-all' : ''
                }`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {signingData ? (
        <Card className="space-y-4 border-[var(--color-success)] bg-[var(--color-success-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-[var(--color-success)]">
              Ledger signature ready
            </p>
            <Button variant="secondary" size="sm" onClick={handleCopySignature}>
              {copied ? 'Copied' : 'Copy signature'}
            </Button>
          </div>
          <div className="rounded-2xl bg-white p-4 font-mono text-xs text-[var(--color-text)] shadow-inner">
            {signatureItems.map(item => (
              <p key={item.label} className="mb-2 break-all last:mb-0">
                <span className="font-semibold text-[var(--color-text-muted)]">{item.label}:</span>{' '}
                {item.value}
              </p>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-sm text-[var(--color-warning)]">
          No signature data was produced. Return to the Ledger step to authorize the payload.
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {onBackToLedger && (
          <Button variant="secondary" onClick={onBackToLedger}>
            Back to Ledger
          </Button>
        )}
        <Button variant="quiet" onClick={onBackToValidation}>
          Back to validation
        </Button>
        <Button onClick={onBackToSetup}>Start new validation</Button>
      </div>
    </section>
  );
}
