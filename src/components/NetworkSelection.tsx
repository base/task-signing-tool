import { availableNetworks } from '@/lib/constants';
import { NetworkType } from '@/lib/types';
import { Button, Card, SectionHeader } from './ui';

interface NetworkSelectionProps {
  onSelect: (network: NetworkType) => void;
}

export function NetworkSelection({ onSelect }: NetworkSelectionProps) {
  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Select network"
        title="Choose the environment to inspect"
        description="Only Base networks configured in this workspace will appear."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {availableNetworks.map(option => (
          <Card key={option} variant="outline">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)] capitalize">{option}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Tap to proceed</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onSelect(option)}>
                Select
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
