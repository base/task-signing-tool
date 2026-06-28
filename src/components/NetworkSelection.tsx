import { Check, Globe } from 'lucide-react';
import { formatNetworkName } from '@/lib/network-utils';
import { NetworkType } from '@/lib/types';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { SectionHeader } from './ui/SectionHeader';

interface NetworkSelectionProps {
  selectedNetwork?: NetworkType | null;
  networks: NetworkType[];
  onSelect: (network: NetworkType) => void;
}

export function NetworkSelection({ selectedNetwork, networks, onSelect }: NetworkSelectionProps) {
  if (networks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[320px] bg-white rounded-2xl border border-[var(--cds-border)] border-dashed">
        <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <Globe size={24} className="text-[var(--cds-text-tertiary)]" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">No networks found</h3>
        <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
          This task does not have any ready-to-sign network configs.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <SectionHeader title="Select Network" description="Choose which network config to sign." />

      <div className="space-y-4">
        {networks.map(network => {
          const isSelected = selectedNetwork === network;

          return (
            <Card
              key={network}
              interactive
              selected={isSelected}
              onClick={() => onSelect(network)}
              className="relative group"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-[var(--cds-primary)] flex items-center justify-center shrink-0">
                    <Globe size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--cds-text-primary)] truncate">
                      {formatNetworkName(network)}
                    </h3>
                    <Badge
                      variant="neutral"
                      size="sm"
                      className="mt-1 uppercase tracking-wider text-[10px] font-bold"
                    >
                      {network}
                    </Badge>
                  </div>
                </div>

                {isSelected && (
                  <div className="h-6 w-6 rounded-full bg-[var(--cds-primary)] text-white flex items-center justify-center shrink-0">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
