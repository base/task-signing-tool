import React, { useEffect, useMemo, useState } from 'react';
import { LedgerSigningResult } from '@/lib/ledger-signing';

interface LedgerSigningProps {
  domainHash: string;
  messageHash: string;
  ledgerAccount: number;
  onSigningComplete: (res: LedgerSigningResult) => void;
  onCancel: () => void;
}

type LedgerSigningStep = 'connect' | 'sign';

export const LedgerSigning: React.FC<LedgerSigningProps> = ({
  domainHash,
  messageHash,
  ledgerAccount,
  onSigningComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<LedgerSigningStep>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const displayDomainHash = useMemo(() => domainHash.toUpperCase(), [domainHash]);
  const displayMessageHash = useMemo(() => messageHash.toUpperCase(), [messageHash]);

  const cardClasses = 'bg-gray-50 border border-gray-200 rounded-xl p-6';
  const infoBoxClasses = 'bg-blue-50 border border-blue-300 rounded-lg p-4 mb-5';
  const warningBoxClasses = 'bg-amber-50 border border-amber-500 rounded-lg p-4 mb-5';
  const errorBoxClasses = 'bg-red-100 border border-red-200 rounded-lg p-4 mb-5';
  const stepTitleClasses = 'text-lg font-semibold text-gray-700 mb-4';

  // Validate required fields
  useEffect(() => {
    if (!domainHash || !messageHash) {
      const missingFields = [];
      if (!domainHash) missingFields.push('domainHash');
      if (!messageHash) missingFields.push('messageHash');
      setError(
        `LedgerSigning::useEffect: Missing required fields for signing: ${missingFields.join(', ')}`
      );
    } else {
      // Clear error if fields are present
      setError('');
    }
  }, [domainHash, messageHash]);

  const handleConnect = () => {
    // Check if required fields are present before proceeding
    if (!domainHash || !messageHash) {
      setError('LedgerSigning::handleConnect: Cannot proceed: missing domain hash or message hash');
      return;
    }

    setCurrentStep('sign');
    setError('');
  };

  const handleSign = async () => {
    // Check if required fields are present
    if (!domainHash || !messageHash) {
      setError('LedgerSigning::handleSign: Cannot sign: missing domain hash or message hash');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sign',
          domainHash,
          messageHash,
          ledgerAccount,
        }),
      });

      const res = await response.json();

      if (res.success) {
        onSigningComplete(res);
      } else {
        setError(
          `LedgerSigning::handleSign: api error: ${res.error}` || 'Failed to sign transaction'
        );
      }
    } catch (err) {
      setError(
        `LedgerSigning::handleSign: failed to sign transaction: ${
          err instanceof Error ? err.message : err
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'connect':
        return (
          <div className={cardClasses}>
            <h3 className={stepTitleClasses}>Step 1: Connect Your Ledger</h3>

            <div className={infoBoxClasses}>
              <p className="mb-3 text-blue-800">Please ensure your Ledger device is:</p>
              <ul className="m-0 list-disc space-y-1 pl-5 text-blue-800">
                <li>Connected via USB</li>
                <li>Unlocked with your PIN</li>
                <li>Ethereum app is open and ready</li>
                <li>Blind signing is enabled (Settings → Debug → Blind signing)</li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              className="w-full rounded-lg border border-transparent bg-emerald-500 py-3 px-6 text-base font-semibold text-white transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Continue to Signing
            </button>
          </div>
        );

      case 'sign':
        return (
          <div className={cardClasses}>
            <h3 className={stepTitleClasses}>Step 2: Sign Transaction</h3>

            <div className={infoBoxClasses}>
              <p className="mb-3 text-sm font-medium text-blue-800">💡 MUST DO:</p>
              <p className="mb-2 text-sm text-blue-800">
                Verify the domain and message hashes match the values on your ledger.
              </p>
            </div>

            <div className={warningBoxClasses}>
              <p className="mb-3 text-sm font-medium text-amber-900">📝 EIP-712 Signing Data:</p>
              <div className="mb-3">
                <strong className="text-amber-900">Domain Hash:</strong>
                <div className="mt-1 block w-full rounded font-mono text-sm text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1">
                    {displayDomainHash}
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <strong className="text-amber-900">Message Hash:</strong>
                <div className="mt-1 block w-full rounded font-mono text-sm text-amber-900">
                  <span className="block w-full whitespace-nowrap rounded bg-amber-100 px-2 py-1">
                    {displayMessageHash}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className={errorBoxClasses}>
                <p className="mb-2 text-sm font-medium text-red-600">❌ Error:</p>
                <p className="text-sm text-red-600">{error}</p>
                {error.includes('not found') && (
                  <p className="mt-2 text-xs text-red-600">
                    Run:{' '}
                    <code className="rounded bg-red-200 px-1.5 py-0.5">
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {error.includes('rejected') && (
                  <p className="mt-2 text-xs text-red-600">
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {error.includes('locked') && (
                  <p className="mt-2 text-xs text-red-600">
                    Please unlock your Ledger device and open the Ethereum app
                  </p>
                )}
              </div>
            )}

            <div className="mb-5 flex gap-3">
              <button
                onClick={() => setCurrentStep('connect')}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-3 px-6 text-base font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading}
                className={`flex flex-[2] items-center justify-center gap-2 rounded-lg border border-transparent py-3 px-6 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                  loading
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                    Signing...
                  </>
                ) : (
                  'Sign on Ledger'
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
      {/* Error Display for Missing Required Fields */}
      {error && error.includes('Missing required fields') && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-100 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="m-0 text-base font-semibold text-red-600">Configuration Error</p>
          </div>
          <p className="mb-3 text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-600">
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div className="mb-8 text-center">
        <h2 className="mb-4 text-2xl font-semibold text-gray-700">
          Ledger Signing - Step{' '}
          {currentStep === 'connect' ? '1' : currentStep === 'sign' ? '2' : '3'} of 3
        </h2>
        <p className="m-0 text-sm text-gray-500">
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
