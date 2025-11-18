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
    <label className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-soft)]">
      {label}
    </label>
    <div className={getValueClasses(value, diffs, toneClasses)}>
      {diffs ? <HighlightedText diffs={diffs} /> : checksummizeAddressesInText(value)}
    </div>
  </div>
);

const variants = {
  expected: {
    container: 'bg-[var(--color-surface-muted)] border-[var(--color-border)]',
    header: 'text-[var(--color-primary)]',
    icon: '✅',
    title: 'Expected',
    contract: 'bg-white',
    border: 'border-[var(--color-border)]',
  },
  actual: {
    container: 'bg-white border-[var(--color-border-strong)] shadow-[0_20px_40px_rgba(6,20,58,0.05)]',
    header: 'text-[var(--color-text)]',
    icon: '🔍',
    title: 'Actual',
    contract: 'bg-[var(--color-surface-muted)]',
    border: 'border-[var(--color-border-strong)]',
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
    <div className={`rounded-2xl border-2 p-6 ${variant.container}`}>
      <h3 className={`mb-4 flex items-center gap-2 text-lg font-bold ${variant.header}`}>
        <span>{variant.icon}</span> {variant.title}
      </h3>

      <div className={`mb-4 rounded-xl p-4 ${variant.contract}`}>
        <h4 className="mb-2 font-semibold text-gray-800">{contractName}</h4>
        <p className="m-0 break-all font-mono text-xs text-gray-500">
          {toChecksumAddressSafe(contractAddress)}
        </p>
      </div>

      <div className={`rounded-xl border bg-white p-4 ${variant.border}`}>
        <ValueSection
          label="Storage Key"
          value={storageKey}
          diffs={storageKeyDiffs}
          toneClasses="bg-[var(--color-surface-muted)] text-[var(--color-text)]"
          className="mb-4"
        />

        {beforeValue && (
          <ValueSection
            label="Before"
            value={beforeValue}
            diffs={beforeValueDiffs}
            toneClasses="bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
            className="mb-4"
          />
        )}

        <ValueSection
          label={beforeValue ? 'After' : 'Value'}
          value={afterValue}
          diffs={afterValueDiffs}
          toneClasses="bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
        />
      </div>
    </div>
  );
}
