import { ReactNode, useEffect, useRef, useState } from 'react';
import { toChecksumAddressSafe, toDisplaySignature } from '@/lib/format';
import { LedgerSigningResult } from '@/lib/ledger-signing';
import { ConfigOption } from './UserSelection';

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
    if (!signingData) {
      return;
    }

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
    {
      label: 'User Type',
      value: user?.displayName ?? '—',
    },
    {
      label: 'Network',
      value: network,
    },
    {
      label: 'Upgrade',
      value: selectedUpgrade.name,
    },
  ];

  if (signingData) {
    summaryItems.push({
      label: 'Signer Address',
      value: toChecksumAddressSafe(signingData.signer),
      monospace: true,
    });
  }

  const signatureItems: DetailItem[] = signingData
    ? [
        {
          label: 'Data',
          value: signingData.data,
          monospace: true,
        },
        {
          label: 'Signer',
          value: toChecksumAddressSafe(signingData.signer),
          monospace: true,
        },
        {
          label: 'Signature',
          value: signingData.signature,
          monospace: true,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-10 text-center">
        <h2 className="mb-4 text-4xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
          Signing Complete! ✨
        </h2>
        <p className="text-lg font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
          Your transaction has been successfully signed
        </p>
      </div>

      <div 
        className="mb-8 rounded-xl p-6"
        style={{
          background: 'var(--cb-surface)',
          border: '1px solid var(--cb-border)',
          boxShadow: 'var(--cb-shadow-sm)'
        }}
      >
        <h3 className="mb-5 text-lg font-bold" style={{ color: 'var(--cb-text-primary)' }}>
          Transaction Summary
        </h3>

        <div className="space-y-3">
          {summaryItems.map(({ label, value, monospace }) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--cb-text-tertiary)' }}>
                {label}:
              </span>
              <span 
                className={`text-sm font-medium ${monospace ? 'font-mono' : ''}`}
                style={{ color: 'var(--cb-text-primary)' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {signingData && (
        <div className="mb-10 space-y-5">
          <div 
            className="rounded-xl p-6"
            style={{
              background: 'var(--cb-success-light)',
              border: '1px solid var(--cb-success)',
              boxShadow: 'var(--cb-shadow-md)'
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <h3 className="text-xl font-bold" style={{ color: 'var(--cb-success)' }}>
                Ledger Signature Generated
              </h3>
            </div>

            <div 
              className="relative break-all rounded-lg p-5 font-mono text-sm"
              style={{
                background: 'var(--cb-surface-elevated)',
                border: '1px solid var(--cb-border)',
                color: 'var(--cb-text-primary)',
                boxShadow: 'var(--cb-shadow-sm)'
              }}
            >
              <div className="space-y-2">
                {signatureItems.map(({ label, value }) => (
                  <div key={label}>
                    <span className="font-semibold">{label}:</span> {value}
                  </div>
                ))}
              </div>
              <button
                onClick={handleCopySignature}
                type="button"
                className="absolute right-3 top-3 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  background: copied ? 'var(--cb-success)' : 'var(--cb-primary)',
                  boxShadow: 'var(--cb-shadow-sm)'
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div 
            className="rounded-xl p-5"
            style={{
              background: 'var(--cb-primary-light)',
              border: '1px solid var(--cb-primary)',
              color: 'var(--cb-primary)'
            }}
          >
            <h4 className="mb-3 text-base font-bold">Next Steps:</h4>
            <ol className="list-decimal space-y-2 pl-5 font-medium">
              <li>Copy the signature above using the copy button and send to your facilitator</li>
            </ol>
          </div>
        </div>
      )}

      {!signingData && (
        <div 
          className="mb-8 rounded-xl p-6 text-center"
          style={{
            background: 'var(--cb-warning-light)',
            border: '1px solid var(--cb-warning)',
            color: 'var(--cb-warning)'
          }}
        >
          <h3 className="mb-3 text-lg font-semibold">No Signature Data</h3>
          <p>
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {onBackToLedger && (
          <button
            onClick={onBackToLedger}
            type="button"
            className="rounded-lg px-6 py-2.5 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-0.5"
            style={{
              background: 'var(--cb-primary)',
              boxShadow: 'var(--cb-shadow-sm)'
            }}
          >
            ← Back to Ledger
          </button>
        )}

        <button
          onClick={onBackToValidation}
          type="button"
          className="rounded-lg px-6 py-2.5 text-base font-semibold transition-all duration-150 hover:-translate-y-0.5"
          style={{
            background: 'var(--cb-surface)',
            color: 'var(--cb-text-primary)',
            border: '1px solid var(--cb-border)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          ← Back to Validation
        </button>

        <button
          onClick={onBackToSetup}
          type="button"
          className="rounded-lg px-6 py-2.5 text-base font-semibold transition-all duration-150 hover:-translate-y-0.5"
          style={{
            background: 'var(--cb-surface)',
            color: 'var(--cb-text-primary)',
            border: '1px solid var(--cb-border)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          Start New Validation
        </button>
      </div>
    </div>
  );
}
