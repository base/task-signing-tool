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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-12 text-center">
        <h2 className="mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 bg-clip-text text-5xl font-black text-transparent">
          Signing Complete! ✨
        </h2>
        <p className="text-lg font-medium text-gray-600">Your transaction has been successfully signed</p>
      </div>

      <div className="mb-8 rounded-2xl border border-purple-200/50 bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-amber-50/80 p-8 shadow-lg backdrop-blur-sm ring-1 ring-white/50">
        <h3 className="mb-5 text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
      </div>

      {signingData && (
        <div className="mb-12 space-y-6">
          <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-xl font-bold text-emerald-900">
                <span className="text-3xl leading-none">✅</span>
                Ledger Signature Generated
              </h3>
            </div>

            <div className="relative break-all rounded-xl border-2 border-emerald-300 bg-white/80 p-6 font-mono text-sm text-emerald-900 shadow-md backdrop-blur-sm">
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
                className={`absolute right-3 top-3 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${copyButtonClasses}`}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50/50 p-6 shadow-md backdrop-blur-sm">
            <h4 className="mb-3 text-base font-bold text-purple-900">Next Steps:</h4>
            <ol className="list-decimal space-y-2 pl-5 text-purple-900 font-medium">
              <li>Copy the signature above using the copy button and send to your facilitator</li>
            </ol>
          </div>
        </div>
      )}

      {!signingData && (
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-100 p-6 text-center">
          <h3 className="mb-3 text-lg font-semibold text-amber-900">No Signature Data</h3>
          <p className="text-amber-900">
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {onBackToLedger && (
          <button
            onClick={onBackToLedger}
            type="button"
            className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-purple-700 hover:to-pink-700 hover:-translate-y-0.5 hover:shadow-xl"
          >
            ← Back to Ledger
          </button>
        )}

        <button
          onClick={onBackToValidation}
          type="button"
          className="rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-3 text-base font-semibold text-gray-700 shadow-md transition-all duration-200 hover:from-gray-200 hover:to-gray-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          ← Back to Validation
        </button>

        <button
          onClick={onBackToSetup}
          type="button"
          className="rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-xl"
        >
          Start New Validation
        </button>
      </div>
    </div>
  );
}
