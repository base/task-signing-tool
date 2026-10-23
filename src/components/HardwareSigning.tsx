import { useState } from 'react';
import { ArrowRight, Lightbulb, XCircle } from 'lucide-react';
import type { SafeTxTypedData } from '@/lib/safe-typed-data';
import type { HardwareWallet, SigningResult } from '@/lib/types/signing';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

const TOTAL_STEPS = 2;

interface HardwareSigningProps {
  domainHash: string;
  messageHash: string;
  ledgerAccount: number;
  safeTxTypedData?: SafeTxTypedData;
  onSigningComplete: (res: SigningResult) => void;
}

type HardwareSigningStep = 'connect' | 'sign';

const DEVICE_LABELS: Record<HardwareWallet, string> = {
  ledger: 'Ledger',
  trezor: 'Trezor',
};

const DEVICE_CHECKLISTS: Record<HardwareWallet, string[]> = {
  ledger: [
    'Connected via USB',
    'Unlocked with your PIN',
    'Ethereum app is open',
    'Blind signing is enabled in settings',
  ],
  trezor: [
    'Connected via USB and unlocked with your PIN',
    'Trezor Suite is closed (it locks the device)',
    'Firmware 2.9.1 or newer (Model T, Safe 3 or Safe 5)',
    'Passphrase protection is off for this wallet (the tool signs with the standard wallet)',
    'The device shows the domain name and version as "unknown": expected, because Safe domains have neither',
    'Tap "Show full message" to review every SafeTx field; skipping it jumps to the end with no way back',
    'Before confirming, check the message hash on the device matches the Message Hash below',
  ],
};

const INSTALL_HINTS: Record<HardwareWallet, string> = {
  ledger: 'make install-eip712sign',
  trezor: 'make install-eip712sign',
};

async function submitSignatureRequest(payload: {
  device: HardwareWallet;
  domainHash: string;
  messageHash: string;
  ledgerAccount: number;
  typedData?: SafeTxTypedData;
}): Promise<SigningResult> {
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

function HashField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="text-xs text-yellow-800 uppercase block mb-1">{label}</strong>
      <div className="font-mono text-xs bg-white border border-yellow-200 rounded-lg p-3 break-all text-gray-700">
        {value}
      </div>
    </div>
  );
}

export function HardwareSigning({
  domainHash,
  messageHash,
  ledgerAccount,
  safeTxTypedData,
  onSigningComplete,
}: HardwareSigningProps) {
  const [currentStep, setCurrentStep] = useState<HardwareSigningStep>('connect');
  const [device, setDevice] = useState<HardwareWallet>('ledger');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deviceLabel = DEVICE_LABELS[device];
  const trezorAvailable = Boolean(safeTxTypedData);

  const handleConnect = () => {
    setCurrentStep('sign');
    setErrorMessage(null);
  };

  const handleSign = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await submitSignatureRequest({
        device,
        domainHash,
        messageHash,
        ledgerAccount,
        typedData: device === 'trezor' ? safeTxTypedData : undefined,
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

  const renderDevicePicker = () => (
    <div className="mb-6">
      <p className="text-sm font-medium text-[var(--cds-text-primary)] mb-3">Hardware wallet</p>
      <div className="grid grid-cols-2 gap-3">
        {(['ledger', 'trezor'] as const).map(option => {
          const disabled = option === 'trezor' && !trezorAvailable;
          const selected = device === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => setDevice(option)}
              aria-pressed={selected}
              className={`rounded-xl border p-4 text-left text-sm font-semibold transition-colors ${
                selected
                  ? 'border-[var(--cds-primary)] bg-blue-50 text-[var(--cds-primary)]'
                  : 'border-gray-200 text-[var(--cds-text-primary)]'
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[var(--cds-primary)]'}`}
            >
              {DEVICE_LABELS[option]}
            </button>
          );
        })}
      </div>
      {!trezorAvailable && (
        <p className="mt-2 text-xs text-[var(--cds-text-secondary)]">
          Trezor signing needs the full SafeTx, which this task&apos;s simulation did not provide.
        </p>
      )}
    </div>
  );

  const renderTrezorFields = (typedData: SafeTxTypedData) => {
    const { domain, message } = typedData;
    const rows: [string, string][] = [
      ['Chain ID', domain.chainId ?? '(not in domain)'],
      ['Verifying contract (Safe)', domain.verifyingContract],
      ['To', message.to],
      ['Value', message.value],
      ['Data', message.data],
      ['Operation', message.operation === 1 ? '1 (DelegateCall)' : '0 (Call)'],
      ['Safe tx gas', message.safeTxGas],
      ['Base gas', message.baseGas],
      ['Gas price', message.gasPrice],
      ['Gas token', message.gasToken],
      ['Refund receiver', message.refundReceiver],
      ['Nonce', message.nonce],
    ];
    return (
      <>
        <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider pt-2">
          SafeTx Fields
        </h4>
        {rows.map(([label, value]) => (
          <HashField key={label} label={label} value={value} />
        ))}
      </>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'connect':
        return (
          <Card className="max-w-2xl mx-auto p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[var(--cds-text-primary)]">
                Connect Your {deviceLabel}
              </h3>
              <Badge variant="primary" size="sm">
                Step 1
              </Badge>
            </div>

            {renderDevicePicker()}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
              <p className="text-[var(--cds-primary)] font-medium mb-4">
                Before proceeding, ensure your device is:
              </p>
              <ul className="space-y-3">
                {DEVICE_CHECKLISTS[device].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-[var(--cds-text-secondary)]"
                  >
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-[var(--cds-primary)] flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={handleConnect} fullWidth size="lg" icon={<ArrowRight size={16} />}>
              Continue
            </Button>
          </Card>
        );

      case 'sign':
        return (
          <Card className="max-w-2xl mx-auto p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[var(--cds-text-primary)]">
                Sign Transaction
              </h3>
              <Badge variant="warning" size="sm">
                Step 2
              </Badge>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
              <div className="flex gap-3">
                <div className="text-blue-600">
                  <Lightbulb size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">Verification Required</p>
                  <p className="text-sm text-blue-800">
                    {device === 'trezor'
                      ? 'Your Trezor shows each SafeTx field, then the message hash. Verify every field and the message hash on the device match the values below before confirming. The tool has checked that these fields hash to the validated domain and message hashes.'
                      : 'Verify the domain and message hashes match the values displayed on your Ledger device.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 space-y-4">
              <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2">
                EIP-712 Signing Data
              </h4>

              <HashField label="Domain Hash" value={domainHash.toUpperCase()} />
              <HashField label="Message Hash" value={messageHash.toUpperCase()} />

              {device === 'trezor' && safeTxTypedData && renderTrezorFields(safeTxTypedData)}
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
                <div className="flex gap-3">
                  <div className="text-red-500">
                    <XCircle size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--cds-error)] mb-1">Signing Error</p>
                    <p className="text-sm text-red-700 mb-2">{errorMessage}</p>
                    {errorMessage.includes('not found') && (
                      <div className="text-xs bg-white/50 p-2 rounded border border-red-100 inline-block font-mono text-red-800">
                        {INSTALL_HINTS[device]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setCurrentStep('connect');
                  setErrorMessage(null);
                }}
                variant="secondary"
                className="flex-1"
                disabled={loading}
              >
                Go Back
              </Button>

              <Button
                onClick={handleSign}
                disabled={loading}
                isLoading={loading}
                className="flex-[2]"
              >
                Sign with {deviceLabel}
              </Button>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-[var(--cds-text-primary)] tracking-tight mb-2">
          Hardware Wallet Signing
        </h2>
        <div className="flex items-center justify-center gap-2 text-[var(--cds-text-secondary)]">
          <span
            className={`h-2 w-2 rounded-full ${
              currentStep === 'connect' ? 'bg-[var(--cds-primary)]' : 'bg-gray-300'
            }`}
          />
          <span
            className={`h-2 w-2 rounded-full ${
              currentStep === 'sign' ? 'bg-[var(--cds-primary)]' : 'bg-gray-300'
            }`}
          />
          <span className="ml-2 text-sm">
            Step {currentStep === 'connect' ? '1' : '2'} of {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {renderStepContent()}
    </div>
  );
}
