import { ArrowRight, Check, Clipboard } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { toChecksumAddressSafe, toDisplaySignature } from '@/lib/format';
import type { SigningResult } from '@/lib/types/signing';
import { ConfigOption } from './UserSelection';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface SigningConfirmationProps {
  user?: ConfigOption;
  network: string;
  selectedUpgrade: {
    name: string;
  };
  signingData: SigningResult;
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

  const handleCopySignature = async () => {
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
    {
      label: 'Signer Address',
      value: toChecksumAddressSafe(signingData.signer),
      monospace: true,
    },
  ];

  const signatureItems: DetailItem[] = [
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
  ];

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-20">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 text-green-600 mb-6 shadow-sm">
          <Check size={40} strokeWidth={2} />
        </div>
        <h2 className="text-4xl font-bold text-[var(--cds-text-primary)] tracking-tight mb-2">
          Signing Complete
        </h2>
        <p className="text-lg text-[var(--cds-text-secondary)]">
          Your transaction has been successfully signed.
        </p>
      </div>

      <Card className="mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--cds-border)] bg-gray-50">
          <h3 className="text-base font-bold text-[var(--cds-text-primary)] uppercase tracking-wider">
            Transaction Summary
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {summaryItems.map(({ label, value, monospace }) => (
            <div
              key={label}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"
            >
              <span className="text-sm font-medium text-[var(--cds-text-secondary)]">{label}</span>
              <span
                className={`text-sm text-[var(--cds-text-primary)] ${
                  monospace
                    ? 'font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100'
                    : 'font-semibold'
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-6 mb-12">
        <Card className="border-green-200 bg-green-50/30 overflow-visible">
          <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                <Check size={14} />
              </div>
              <h3 className="text-base font-bold text-green-900">Signature Generated</h3>
            </div>

            <Button
              onClick={handleCopySignature}
              size="sm"
              variant={copied ? 'primary' : 'secondary'}
              className={copied ? 'bg-green-600 hover:bg-green-700 border-transparent' : ''}
              icon={!copied ? <Clipboard size={14} /> : <Check size={14} />}
            >
              {copied ? 'Copied!' : 'Copy Signature'}
            </Button>
          </div>

          <div className="p-6">
            <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm overflow-x-auto">
              <div className="space-y-3">
                {signatureItems.map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-[var(--cds-text-tertiary)] uppercase">
                      {label}
                    </span>
                    <div className="font-mono text-xs text-[var(--cds-text-primary)] break-all">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex gap-4">
          <div className="text-2xl text-blue-600">
            <ArrowRight size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900 mb-1">Next Steps</h4>
            <p className="text-sm text-blue-800">
              Copy the signature above and send it to your facilitator to complete the operation.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8 border-t border-[var(--cds-divider)]">
        <Button onClick={onBackToSetup} variant="primary">
          Start New Validation
        </Button>
      </div>
    </div>
  );
}
