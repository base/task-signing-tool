import { Upgrade } from '@/lib/types';
import { Card } from './ui/Card';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SelectionSummaryProps {
  selectedUpgrade: Upgrade | null;
}

export function SelectionSummary({ selectedUpgrade }: SelectionSummaryProps) {
  if (!selectedUpgrade) return null;

  return (
    <Card padding="sm" className="mb-8 bg-gray-50/50 border-dashed">
      <div className="flex flex-col gap-2 p-4">
        <h2 className="text-xl font-semibold text-[var(--cds-text-primary)]">
          {selectedUpgrade.name}
        </h2>
        <div className="text-sm text-[var(--cds-text-secondary)] prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
          <Markdown remarkPlugins={[remarkGfm]}>{selectedUpgrade.description}</Markdown>
        </div>
      </div>
    </Card>
  );
}
