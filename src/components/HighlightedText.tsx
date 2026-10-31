import type { StringDiff } from '@/lib/types';
import { checksummizeAddressesInText } from '@/lib/format';

const DIFF_CLASSNAMES: Record<StringDiff['type'], string> = {
  added: 'rounded-sm bg-green-100 px-0.5 py-0.5 text-green-800',
  removed: 'rounded-sm bg-red-100 px-0.5 py-0.5 text-red-600 line-through',
  unchanged: '',
};

type HighlightedTextProps = {
  diffs: StringDiff[];
};

export function HighlightedText({ diffs }: HighlightedTextProps) {
  return (
    <span>
      {diffs.map((diff, index) => (
        <span
          key={index}
          className={DIFF_CLASSNAMES[diff.type]}
          title={diff.type !== 'unchanged' ? `${diff.type}: "${diff.value}"` : undefined}
        >
          {checksummizeAddressesInText(diff.value)}
        </span>
      ))}
    </span>
  );
}
