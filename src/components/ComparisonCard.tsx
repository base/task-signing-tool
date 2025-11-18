import { StringDiff } from '@/lib/types/index';
import { toChecksumAddressSafe, checksummizeAddressesInText } from '@/lib/format';
import { HighlightedText } from './HighlightedText';
import { Card } from './ui/Card';

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
  'rounded-lg p-3 mt-1 font-mono text-xs block max-w-full whitespace-pre-wrap';

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
    <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1 block">
      {label}
    </label>
    <div className={getValueClasses(value, diffs, toneClasses)}>
      {diffs ? <HighlightedText diffs={diffs} /> : checksummizeAddressesInText(value)}
    </div>
  </div>
);

const variants = {
  expected: {
    container: 'border-blue-200 bg-blue-50/50',
    header: 'text-blue-700',
    title: 'Expected',
    contract: 'bg-blue-100/50 border-blue-200',
    border: 'border-blue-200',
  },
  actual: {
    container: 'border-gray-200 bg-gray-50/50',
    header: 'text-gray-700',
    title: 'Actual',
    contract: 'bg-gray-100/50 border-gray-200',
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
    <Card className={`border-2 p-6 ${variant.container}`} elevated>
      <div className="mb-6 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${type === 'expected' ? 'bg-blue-600' : 'bg-gray-400'}`} />
        <h3 className={`text-lg font-bold ${variant.header}`}>
          {variant.title}
        </h3>
      </div>

      <div className={`mb-4 rounded-lg border p-4 ${variant.contract}`}>
        <h4 className="mb-2 font-semibold text-gray-900">{contractName}</h4>
        <p className="m-0 break-all font-mono text-xs text-gray-600">
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div className={`rounded-lg border bg-white p-4 ${variant.border}`}>
        <ValueSection
          label="Storage Key"
          value={storageKey}
          diffs={storageKeyDiffs}
          toneClasses="bg-gray-50 text-gray-900"
          className="mb-4"
        />

        {beforeValue && (
          <ValueSection
            label="Before"
            value={beforeValue}
            diffs={beforeValueDiffs}
            toneClasses="bg-yellow-50 text-yellow-900"
            className="mb-4"
          />
        )}

        <ValueSection
          label={beforeValue ? 'After' : 'Value'}
          value={afterValue}
          diffs={afterValueDiffs}
          toneClasses={type === 'expected' ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-900'}
        />
      </div>
    </Card>
  );
}
