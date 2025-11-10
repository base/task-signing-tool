import React, { useState } from 'react';
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

export const SigningConfirmation: React.FC<SigningConfirmationProps> = ({
  user,
  network,
  selectedUpgrade,
  signingData,
  onBackToValidation,
  onBackToLedger,
  onBackToSetup,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopySignature = () => {
    if (signingData) {
      navigator.clipboard.writeText(toDisplaySignature(signingData));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyButtonClasses = copied
    ? 'bg-emerald-500 hover:bg-emerald-600'
    : 'bg-indigo-500 hover:bg-indigo-600';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h2 className="mb-4 bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-3xl font-bold text-transparent">
          Signing Complete!
        </h2>
      </div>

      {/* Summary Card */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Transaction Summary</h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">User Type:</span>
            <span className="font-medium text-gray-900">{user?.displayName ?? ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Network:</span>
            <span className="font-medium text-gray-900">{network}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Upgrade:</span>
            <span className="font-medium text-gray-900">{selectedUpgrade.name}</span>
          </div>
          {signingData && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Signer Address:</span>
              <span className="font-mono text-sm font-medium text-gray-900">
                {toChecksumAddressSafe(signingData.signer)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Signature Display */}
      {signingData && (
        <div className="mb-12 space-y-6">
          <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-900">
                <span className="text-2xl leading-none">✅</span>
                Ledger Signature Generated
              </h3>
            </div>

            <div className="relative break-all rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-mono text-sm text-emerald-900">
              Data: {signingData.data} <br />
              Signer: {signingData.signer} <br />
              Signature: {signingData.signature}
              <button
                onClick={handleCopySignature}
                type="button"
                className={`absolute right-2 top-2 rounded-md px-3 py-1 text-xs font-medium text-white transition-colors ${copyButtonClasses}`}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-100 p-5">
            <h4 className="mb-3 text-base font-semibold text-indigo-900">Next Steps:</h4>
            <ol className="list-decimal space-y-2 pl-5 text-indigo-900">
              <li>Copy the signature above using the copy button and send to your facilitator</li>
            </ol>
          </div>
        </div>
      )}

      {/* No Signature Available */}
      {!signingData && (
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-100 p-6 text-center">
          <h3 className="mb-3 text-lg font-semibold text-amber-900">No Signature Data</h3>
          <p className="text-amber-900">
            No signature was provided. Please go back and complete the Ledger signing process.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {onBackToLedger && (
          <button
            onClick={onBackToLedger}
            type="button"
            className="rounded-xl bg-indigo-500 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-600"
          >
            ← Back to Ledger
          </button>
        )}

        <button
          onClick={onBackToValidation}
          type="button"
          className="rounded-xl bg-gray-100 px-6 py-3 text-base font-medium text-gray-500 transition-colors hover:bg-gray-200"
        >
          ← Back to Validation
        </button>

        <button
          onClick={onBackToSetup}
          type="button"
          className="rounded-xl bg-gray-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-700"
        >
          Start New Validation
        </button>
      </div>
    </div>
  );
};
