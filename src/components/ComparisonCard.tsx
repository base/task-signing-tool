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

const getValueClasses = (
  value: string | undefined,
  diffs: StringDiff[] | undefined,
  toneClasses: string
): string => {
  const content = diffs && diffs.length > 0 ? diffs.map(diff => diff.value).join('') : value ?? '';
  let shouldWrap = false;

  if (content) {
    shouldWrap = content.split(/\r?\n/).some(segment => {
      const trimmed = segment.trim();
      return /^0x[0-9a-fA-F]+$/.test(trimmed) && trimmed.length > HEX_SEGMENT_WRAP_THRESHOLD;
    });
  }

  return [
    baseValueClasses,
    shouldWrap ? 'break-words overflow-hidden' : 'break-normal overflow-x-auto scrollbar-hide',
    toneClasses,
  ]
    .filter(Boolean)
    .join(' ');
};

interface ValueSectionProps {
  label: string;
  value: string;
  diffs?: StringDiff[];
  toneClasses: string;
  className?: string;
}

const ValueSection = ({ label, value, diffs, toneClasses, className }: ValueSectionProps) => (
  <div className={className}>
    <label className="text-xs font-medium uppercase text-gray-500 tracking-wide">
      {label}
    </label>
    <div className={getValueClasses(value, diffs, toneClasses)}>
      {diffs ? <HighlightedText diffs={diffs} /> : checksummizeAddressesInText(value)}
    </div>
  </div>
);

const variants = {
  expected: {
    container: 'bg-blue-50 border-blue-200',
    header: 'text-blue-900',
    icon: '✅',
    title: 'Expected',
    contract: 'bg-blue-100',
    border: 'border-blue-200',
  },
  actual: {
    container: 'bg-gray-50 border-gray-200',
    header: 'text-gray-900',
    icon: '🔍',
    title: 'Actual',
    contract: 'bg-gray-100',
    border: 'border-gray-200',
  },
} as const;

export function ComparisonCard({
  type,
  contractName,
  contractAddress,
  storageKey,
  storageKeyDiffs,
  beforeValue,
  beforeValueDiffs,
  afterValue,
  afterValueDiffs,
}: ComparisonCardProps) {
  const variant = variants[type];
  return (
    <div className={`rounded-lg border p-5 ${variant.container}`}>
      <h3 className={`mb-4 flex items-center gap-2 text-base font-semibold ${variant.header}`}>
        <span>{variant.icon}</span> {variant.title}
      </h3>

      <div className={`mb-4 rounded-lg p-3 ${variant.contract}`}>
        <h4 className="mb-1.5 text-sm font-semibold text-gray-800">{contractName}</h4>
        <p className="m-0 break-all font-mono text-xs text-gray-600">
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div className={`rounded-lg border bg-white p-4 ${variant.border}`}>
        <ValueSection
          label="Storage Key"
          value={storageKey}
          diffs={storageKeyDiffs}
          toneClasses="bg-gray-50 text-gray-700"
          className="mb-3"
        />

        {beforeValue && (
          <ValueSection
            label="Before"
            value={beforeValue}
            diffs={beforeValueDiffs}
            toneClasses="bg-amber-50 text-amber-700"
            className="mb-3"
          />
        )}

        <ValueSection
          label={beforeValue ? 'After' : 'Value'}
          value={afterValue}
          diffs={afterValueDiffs}
          toneClasses="bg-blue-50 text-blue-700"
        />
      </div>
    </div>
  );
}
