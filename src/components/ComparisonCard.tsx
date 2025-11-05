import React from 'react';
import { StringDiff } from '@/lib/types/index';
import { toChecksumAddressSafe, checksummizeAddressesInText } from '@/lib/format';
import { HighlightedText } from './HighlightedText';

interface ComparisonCardProps {
  type: 'expected' | 'actual';
  contractName: string;
  contractAddress: string;
  storageKey: string;
  storageKeyDiffs?: StringDiff[];
  beforeValue?: string;
  beforeValueDiffs?: StringDiff[];
  afterValue: string;
  afterValueDiffs?: StringDiff[];
}

const baseValueStyle: React.CSSProperties = {
  borderRadius: '8px',
  padding: '12px',
  marginTop: '4px',
  fontFamily: 'monospace',
  fontSize: '11px',
  overflowX: 'auto',
  whiteSpace: 'pre',
  wordBreak: 'normal',
};

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  type,
  contractName,
  contractAddress,
  storageKey,
  storageKeyDiffs,
  beforeValue,
  beforeValueDiffs,
  afterValue,
  afterValueDiffs,
}) => {
  const isExpected = type === 'expected';
  const bgColor = isExpected ? '#EFF6FF' : '#F0F9FF';
  const borderColor = isExpected ? '#93C5FD' : '#7DD3FC';
  const headerColor = isExpected ? '#1D4ED8' : '#0369A1';
  const headerIcon = isExpected ? '✅' : '🔍';
  const headerText = isExpected ? 'Expected' : 'Actual';
  const contractBgColor = isExpected ? '#DBEAFE' : '#E0F2FE';

  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '20px',
        padding: '24px',
      }}
    >
      <h3
        style={{
          color: headerColor,
          fontWeight: '700',
          fontSize: '18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '0 0 16px 0',
        }}
      >
        <span>{headerIcon}</span> {headerText}
      </h3>

      <div
        style={{
          background: contractBgColor,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4
          style={{
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '8px',
            margin: '0 0 8px 0',
          }}
        >
          {contractName}
        </h4>
        <p
          style={{
            fontSize: '12px',
            color: '#6B7280',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            margin: 0,
          }}
        >
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          border: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Storage Key
          </label>
          <div
            style={{
              ...baseValueStyle,
              background: '#F9FAFB',
              color: '#1F2937',
            }}
          >
            {storageKeyDiffs ? (
              <HighlightedText diffs={storageKeyDiffs} />
            ) : (
              checksummizeAddressesInText(storageKey)
            )}
          </div>
        </div>

        {beforeValue && (
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Before
            </label>
            <div
              style={{
                ...baseValueStyle,
                background: '#FEF3C7',
                color: '#D97706',
              }}
            >
              {beforeValueDiffs ? (
                <HighlightedText diffs={beforeValueDiffs} />
              ) : (
                checksummizeAddressesInText(beforeValue)
              )}
            </div>
          </div>
        )}

        <div>
          <label
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {beforeValue ? 'After' : 'Value'}
          </label>
          <div
            style={{
              ...baseValueStyle,
              background: '#EFF6FF',
              color: '#1D4ED8',
            }}
          >
            {afterValueDiffs ? (
              <HighlightedText diffs={afterValueDiffs} />
            ) : (
              checksummizeAddressesInText(afterValue)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
