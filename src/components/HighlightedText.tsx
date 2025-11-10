import React from 'react';
import { StringDiff } from '@/lib/types/index';
import { checksummizeAddressesInText } from '@/lib/format';

interface HighlightedTextProps {
  diffs: StringDiff[];
  className?: string;
  style?: React.CSSProperties;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ diffs, className, style }) => {
  const getClassNameForDiffType = (diffType: StringDiff['type']): string => {
    switch (diffType) {
      case 'added':
        return 'rounded-sm bg-green-100 px-0.5 py-0.5 text-green-800';
      case 'removed':
        return 'rounded-sm bg-red-100 px-0.5 py-0.5 text-red-600 line-through';
      case 'modified':
        return 'rounded-sm bg-yellow-100 px-0.5 py-0.5 text-yellow-600';
      case 'unchanged':
      default:
        return '';
    }
  };

  return (
    <span className={className} style={style}>
      {diffs.map((diff, index) => (
        <span
          key={index}
          className={getClassNameForDiffType(diff.type)}
          title={diff.type !== 'unchanged' ? `${diff.type}: "${diff.value}"` : undefined}
        >
          {checksummizeAddressesInText(diff.value)}
        </span>
      ))}
    </span>
  );
};
