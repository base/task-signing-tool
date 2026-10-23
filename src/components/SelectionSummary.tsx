import { Upgrade } from '@/lib/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { MarkdownText } from './MarkdownText';

interface SelectionSummaryProps {
  selectedUpgrade: Upgrade | null;
  onChange?: () => void;
}

export function SelectionSummary({ selectedUpgrade, onChange }: SelectionSummaryProps) {
  if (!selectedUpgrade) return null;

  return (
    <Card padding="sm" className="mb-8 bg-gray-50/50 border-dashed">
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <h2 className="text-xl font-semibold text-[var(--cds-text-primary)]">
            {selectedUpgrade.name}
          </h2>
          <div className="text-sm text-[var(--cds-text-secondary)]">
            <MarkdownText>{selectedUpgrade.description}</MarkdownText>
          </div>
        </div>
        {onChange && (
          <Button variant="ghost" size="sm" onClick={onChange} className="shrink-0">
            Change
          </Button>
        )}
      </div>
    </Card>
  );
}
