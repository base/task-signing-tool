import { ReactNode, useEffect, useRef, useState } from 'react';
import { toChecksumAddressSafe, toDisplaySignature } from '@/lib/format';
import { LedgerSigningResult } from '@/lib/ledger-signing';
import { ConfigOption } from './UserSelection';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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

  const copyButtonClasses = copied
    ? 'bg-emerald-500 hover:bg-emerald-600'
    : 'bg-indigo-500 hover:bg-indigo-600';

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
    <div className="mx-auto max-w-3xl">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-4 text-4xl font-bold text-gray-900">
          Signing Complete
        </h2>
        <p className="text-lg text-gray-600">Your transaction has been successfully signed</p>
      </div>

      <Card className="mb-8 p-8" elevated>
        <h3 className="mb-6 text-xl font-bold text-gray-900">
          Transaction Summary
        </h3>

        <div className="space-y-3">
          {summaryItems.map(({ label, value, monospace }) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm text-gray-500">{label}:</span>
              <span className={`text-sm font-medium text-gray-900 ${monospace ? 'font-mono' : ''}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {signingData && (
        <div className="mb-12 space-y-6">
          <Card className="border-2 border-green-200 bg-green-50 p-8" elevated>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-900">
                Ledger Signature Generated
              </h3>
            </div>

            <div className="relative break-all rounded-lg border border-green-200 bg-white p-6 font-mono text-sm text-gray-900">
              <div className="space-y-2">
                {signatureItems.map(({ label, value }) => (
                  <div key={label}>
                    <span className="font-semibold">{label}:</span> {value}
                  </div>
                ))}
              </div>
              <Button
                onClick={handleCopySignature}
                size="sm"
                variant={copied ? 'success' : 'primary'}
                className="absolute right-3 top-3"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </Button>
            </div>
          </Card>

          <Card className="border-blue-200 bg-blue-50 p-6">
            <h4 className="mb-3 text-base font-bold text-blue-900">Next Steps:</h4>
            <ol className="list-decimal space-y-2 pl-5 text-blue-900 font-medium">
              <li>Copy the signature above using the copy button and send to your facilitator</li>
            </ol>
          </Card>
        </div>
      )}

      {!signingData && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50 p-6 text-center">
          <h3 className="mb-3 text-lg font-semibold text-yellow-900">No Signature Data</h3>
          <p className="text-yellow-900">
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {onBackToLedger && (
          <Button onClick={onBackToLedger} variant="secondary">
            ← Back to Ledger
          </Button>
        )}

        <Button onClick={onBackToValidation} variant="secondary">
          ← Back to Validation
        </Button>

        <Button onClick={onBackToSetup}>
          Start New Validation
        </Button>
      </div>
    </div>
  );
}
