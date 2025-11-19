import { StringDiff } from '@/lib/types/index';
import { toChecksumAddressSafe, checksummizeAddressesInText } from '@/lib/format';
import { HighlightedText } from './HighlightedText';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

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
  'rounded-lg p-3 mt-1 font-mono text-[11px] block max-w-full whitespace-pre-wrap border border-[var(--cds-border)] bg-white text-[var(--cds-text-secondary)]';

const getValueClasses = (value: string | undefined, diffs: StringDiff[] | undefined): string => {
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
  ]
    .filter(Boolean)
    .join(' ');
};

interface ValueSectionProps {
  label: string;
  value: string;
  diffs?: StringDiff[];
  className?: string;
}

const ValueSection = ({ label, value, diffs, className }: ValueSectionProps) => (
  <div className={className}>
    <label className="text-[10px] font-bold uppercase text-[var(--cds-text-tertiary)] tracking-wider">
      {label}
    </label>
    <div className={getValueClasses(value, diffs)}>
      {diffs ? <HighlightedText diffs={diffs} /> : checksummizeAddressesInText(value)}
    </div>
  </div>
);

const variants = {
  expected: {
    icon: '✅',
    title: 'Expected',
    badgeVariant: 'success' as const,
  },
  actual: {
    icon: '🔍',
    title: 'Actual',
    badgeVariant: 'primary' as const,
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
    <Card className="h-full">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant={variant.badgeVariant} size="sm" className="font-bold px-2.5 py-1">
          {variant.icon} {variant.title}
        </Badge>
      </div>

      <div className="mb-4 rounded-xl bg-gray-50 p-4 border border-[var(--cds-border)]">
        <h4 className="mb-1 text-sm font-semibold text-[var(--cds-text-primary)]">
          {contractName}
        </h4>
        <p className="m-0 break-all font-mono text-[10px] text-[var(--cds-text-secondary)]">
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div className="space-y-4">
        <ValueSection label="Storage Key" value={storageKey} diffs={storageKeyDiffs} />

        {beforeValue && (
          <ValueSection label="Before" value={beforeValue} diffs={beforeValueDiffs} />
        )}

        <ValueSection
          label={beforeValue ? 'After' : 'Value'}
          value={afterValue}
          diffs={afterValueDiffs}
        />
      </div>
    </Card>
  );
}
