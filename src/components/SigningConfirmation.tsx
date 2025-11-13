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
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-gray-900">
          Signing Complete
        </h2>
        <p className="text-sm text-gray-600">Your transaction has been successfully signed</p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Transaction Summary
        </h3>

        <div className="space-y-2">
          {summaryItems.map(({ label, value, monospace }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-600">{label}:</span>
              <span className={`font-medium text-gray-900 ${monospace ? 'font-mono text-xs' : ''}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {signingData && (
        <div className="mb-6 space-y-4">
          <div className="rounded-lg border border-green-300 bg-green-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">✓</span>
              <h3 className="text-base font-semibold text-green-900">
                Ledger Signature Generated
              </h3>
            </div>

            <div className="relative break-all rounded-lg border border-green-200 bg-white p-4 font-mono text-xs text-gray-800">
              <div className="space-y-2">
                {signatureItems.map(({ label, value }) => (
                  <div key={label}>
                    <span className="font-semibold text-gray-700">{label}:</span>{' '}
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleCopySignature}
                type="button"
                className={`absolute right-3 top-3 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all ${copyButtonClasses}`}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-blue-900">Next Steps</h4>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-800">
              <li>Copy the signature above using the copy button and send to your facilitator</li>
            </ol>
          </div>
        </div>
      )}

      {!signingData && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
          <h3 className="mb-2 text-base font-semibold text-yellow-900">No Signature Data</h3>
          <p className="text-sm text-yellow-700">
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {onBackToLedger && (
          <button
            onClick={onBackToLedger}
            type="button"
            className="btn-secondary"
          >
            ← Back to Ledger
          </button>
        )}

        <button
          onClick={onBackToValidation}
          type="button"
          className="btn-secondary"
        >
          ← Back to Validation
        </button>

        <button
          onClick={onBackToSetup}
          type="button"
          className="btn-primary"
        >
          Start New Validation
        </button>
      </div>
    </div>
  );
}
