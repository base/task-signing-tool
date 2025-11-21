import { Upgrade } from '@/lib/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--cds-primary)] underline font-medium hover:text-[var(--cds-primary-hover)] break-all"
                    onClick={e => e.stopPropagation()}
                  />
                ),
                p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0 leading-relaxed" />,
                ul: ({ ...props }) => (
                  <ul {...props} className="list-disc list-inside mb-2 space-y-1" />
                ),
                ol: ({ ...props }) => (
                  <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />
                ),
                li: ({ ...props }) => <li {...props} className="ml-1" />,
                code: ({ ...props }) => (
                  <code
                    {...props}
                    className="text-[var(--cds-text-primary)] bg-gray-100 px-1 py-0.5 rounded font-mono text-xs"
                  />
                ),
                pre: ({ ...props }) => (
                  <pre
                    {...props}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto my-2 text-xs text-[var(--cds-text-primary)] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
                  />
                ),
              }}
            >
              {selectedUpgrade.description}
            </Markdown>
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
