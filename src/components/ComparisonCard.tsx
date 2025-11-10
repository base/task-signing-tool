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

const HEX_SEGMENT_WRAP_THRESHOLD = 66;

const baseValueClasses =
  'rounded-lg p-3 mt-1 font-mono text-[11px] block max-w-full whitespace-pre-wrap';

const combineContent = (value?: string, diffs?: StringDiff[]): string => {
  if (diffs && diffs.length > 0) {
    return diffs.map(diff => diff.value).join('');
  }
  return value ?? '';
};

const shouldEnableHexWrapping = (value?: string, diffs?: StringDiff[]): boolean => {
  const combined = combineContent(value, diffs);
  if (!combined) return false;

  const segments = combined.split(/\r?\n/);
  const longestHexSegment = segments.reduce((max, segment) => {
    const trimmed = segment.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return Math.max(max, trimmed.length);
    }
    return max;
  }, 0);

  return longestHexSegment > HEX_SEGMENT_WRAP_THRESHOLD;
};

const buildValueClasses = (
  value: string | undefined,
  diffs: StringDiff[] | undefined,
  additionalClasses: string
): string => {
  const allowHexWrapping = shouldEnableHexWrapping(value, diffs);

  return [
    baseValueClasses,
    allowHexWrapping
      ? 'break-words overflow-hidden'
      : 'break-normal overflow-x-auto scrollbar-hide',
    additionalClasses,
  ]
    .filter(Boolean)
    .join(' ');
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
  const containerClasses = isExpected ? 'bg-blue-50 border-blue-300' : 'bg-sky-50 border-sky-300';
  const headerClasses = isExpected ? 'text-blue-700' : 'text-sky-700';
  const headerIcon = isExpected ? '✅' : '🔍';
  const headerText = isExpected ? 'Expected' : 'Actual';
  const contractClasses = isExpected ? 'bg-blue-100' : 'bg-sky-100';
  const borderClasses = isExpected ? 'border-blue-300' : 'border-sky-300';

  return (
    <div className={`rounded-2xl border-2 p-6 ${containerClasses}`}>
      <h3 className={`mb-4 flex items-center gap-2 text-lg font-bold ${headerClasses}`}>
        <span>{headerIcon}</span> {headerText}
      </h3>

      <div className={`mb-4 rounded-xl p-4 ${contractClasses}`}>
        <h4 className="mb-2 font-semibold text-gray-800">{contractName}</h4>
        <p className="m-0 break-all font-mono text-xs text-gray-500">
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div className={`rounded-xl border bg-white p-4 ${borderClasses}`}>
        <div className="mb-4">
          <label className="text-[10px] font-semibold uppercase text-gray-500 tracking-[0.05em]">
            Storage Key
          </label>
          <div
            className={buildValueClasses(storageKey, storageKeyDiffs, 'bg-gray-50 text-gray-800')}
          >
            {storageKeyDiffs ? (
              <HighlightedText diffs={storageKeyDiffs} />
            ) : (
              checksummizeAddressesInText(storageKey)
            )}
          </div>
        </div>

        {beforeValue && (
          <div className="mb-4">
            <label className="text-[10px] font-semibold uppercase text-gray-500 tracking-[0.05em]">
              Before
            </label>
            <div
              className={buildValueClasses(
                beforeValue,
                beforeValueDiffs,
                'bg-amber-100 text-amber-600'
              )}
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
          <label className="text-[10px] font-semibold uppercase text-gray-500 tracking-[0.05em]">
            {beforeValue ? 'After' : 'Value'}
          </label>
          <div
            className={buildValueClasses(afterValue, afterValueDiffs, 'bg-blue-50 text-blue-700')}
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
