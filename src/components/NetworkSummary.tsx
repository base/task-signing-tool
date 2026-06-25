import { Globe } from 'lucide-react';
import { NetworkType } from '@/lib/types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface NetworkSummaryProps {
  selectedNetwork: NetworkType | null;
  onChange?: () => void;
}

const formatNetworkName = (network: NetworkType) =>
  network
    .split('-')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export function NetworkSummary({ selectedNetwork, onChange }: NetworkSummaryProps) {
  if (!selectedNetwork) return null;

  return (
    <Card padding="sm" className="mb-8 bg-gray-50/50 border-dashed">
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 text-[var(--cds-primary)] flex items-center justify-center">
            <Globe size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--cds-text-primary)]">
              {formatNetworkName(selectedNetwork)}
            </h3>
            <Badge
              variant="neutral"
              size="sm"
              className="mt-1 uppercase tracking-wider text-[10px]"
            >
              {selectedNetwork}
            </Badge>
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
