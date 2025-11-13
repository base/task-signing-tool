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
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">
          Signing complete
        </h2>
        <p className="text-sm text-slate-600">Your transaction has been successfully signed.</p>
      </div>

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Transaction summary
        </h3>

        <div className="space-y-3">
          {summaryItems.map(({ label, value, monospace }) => (
            <div key={label} className="flex justify-between">
              <span className="text-xs text-slate-500">{label}:</span>
              <span className={`text-sm font-medium text-slate-900 ${monospace ? 'font-mono' : ''}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {signingData && (
        <div className="mb-10 space-y-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <span className="text-xl leading-none">✅</span>
                Ledger signature generated
              </h3>
            </div>

            <div className="relative break-all rounded-lg border border-emerald-300 bg-white p-4 font-mono text-xs text-emerald-900">
              <div className="space-y-1.5">
                {signatureItems.map(({ label, value }) => (
                  <div key={label}>
                    <span className="font-semibold">{label}:</span> <span className="break-all">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleCopySignature}
                type="button"
                className={`absolute right-3 top-3 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white ${copyButtonClasses}`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Next steps</h4>
            <ol className="list-decimal space-y-1.5 pl-5 text-slate-800 text-sm">
              <li>Copy the signature and send to your facilitator.</li>
            </ol>
          </div>
        </div>
      )}

      {!signingData && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">No signature data</h3>
          <p className="text-sm text-amber-900">
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {onBackToLedger && (
          <button
            onClick={onBackToLedger}
            type="button"
            className="rounded-lg bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            ← Back to Ledger
          </button>
        )}

        <button
          onClick={onBackToValidation}
          type="button"
          className="rounded-lg bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          ← Back to Validation
        </button>

        <button
          onClick={onBackToSetup}
          type="button"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Start New Validation
        </button>
      </div>
    </div>
  );
}
