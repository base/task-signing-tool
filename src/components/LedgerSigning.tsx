import React, { useEffect, useState } from 'react';
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
          <div
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                margin: '0 0 16px 0',
              }}
            >
              Step 1: Connect Your Ledger
            </h3>

            <div
              style={{
                background: '#EBF8FF',
                border: '1px solid #90CDF4',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  color: '#1E40AF',
                  marginBottom: '12px',
                  margin: '0 0 12px 0',
                }}
              >
                Please ensure your Ledger device is:
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: '#1E40AF',
                }}
              >
                <li style={{ marginBottom: '4px' }}>Connected via USB</li>
                <li style={{ marginBottom: '4px' }}>Unlocked with your PIN</li>
                <li style={{ marginBottom: '4px' }}>Ethereum app is open and ready</li>
                <li style={{ marginBottom: '4px' }}>
                  Blind signing is enabled (Settings → Debug → Blind signing)
                </li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              style={{
                background: '#10B981',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '16px',
                width: '100%',
              }}
            >
              Continue to Signing
            </button>
          </div>
        );

      case 'sign':
        return (
          <div
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                margin: '0 0 16px 0',
              }}
            >
              Step 2: Sign Transaction
            </h3>

            <div
              style={{
                background: '#EBF8FF',
                border: '1px solid #90CDF4',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  color: '#1E40AF',
                  marginBottom: '12px',
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                💡 MUST DO:
              </p>
              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  color: '#1E40AF',
                }}
              >
                Verify the domain and message hashes match the values on your ledger.
              </p>
            </div>

            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #F59E0B',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#92400E',
                }}
              >
                📝 EIP-712 Signing Data:
              </p>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#92400E' }}>Domain Hash:</strong>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#92400E',
                    background: '#FEF3C7',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                >
                  {domainHash}
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#92400E' }}>Message Hash:</strong>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#92400E',
                    background: '#FEF3C7',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                >
                  {messageHash}
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: '#FEE2E2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#DC2626',
                  }}
                >
                  ❌ Error:
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#DC2626',
                  }}
                >
                  {error}
                </p>
                {error.includes('not found') && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      color: '#DC2626',
                    }}
                  >
                    Run:{' '}
                    <code
                      style={{ background: '#FEE2E2', padding: '2px 4px', borderRadius: '4px' }}
                    >
                      make install-eip712sign
                    </code>{' '}
                    in project root
                  </p>
                )}
                {error.includes('rejected') && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      color: '#DC2626',
                    }}
                  >
                    Please confirm the transaction on your Ledger device
                  </p>
                )}
                {error.includes('locked') && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      color: '#DC2626',
                    }}
                  >
                    Please unlock your Ledger device and open the Ethereum app
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <button
                onClick={() => setCurrentStep('connect')}
                style={{
                  background: 'transparent',
                  color: '#6B7280',
                  padding: '12px 24px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  flex: '1',
                }}
              >
                ← Go Back
              </button>
              <button
                onClick={handleSign}
                disabled={loading}
                style={{
                  background: loading ? '#E5E7EB' : '#DC2626',
                  color: loading ? '#9CA3AF' : 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  flex: '2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading ? (
                  <>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #9CA3AF',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
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
    <div
      style={{
        width: '100%',
        maxWidth: 'min(100%, 960px)',
        margin: '0 auto',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Error Display for Missing Required Fields */}
      {error && error.includes('Missing required fields') && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '20px' }}>❌</span>
            <p
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#DC2626',
              }}
            >
              Configuration Error
            </p>
          </div>
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              color: '#DC2626',
            }}
          >
            {error}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#DC2626',
            }}
          >
            Please ensure that the validation process completed successfully and generated the
            required domain and message hashes.
          </p>
        </div>
      )}

      <div
        style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            margin: '0 0 16px 0',
          }}
        >
          Ledger Signing - Step{' '}
          {currentStep === 'connect' ? '1' : currentStep === 'sign' ? '2' : '3'} of 3
        </h2>
        <p
          style={{
            color: '#6B7280',
            fontSize: '14px',
            margin: 0,
          }}
        >
          {currentStep === 'connect' && 'Connect and verify your Ledger device'}
          {currentStep === 'sign' && 'Sign the EIP-712 transaction data'}
        </p>
      </div>

      {renderStepContent()}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '24px',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: '#6B7280',
            padding: '8px 16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
