import { ConfigOption } from './UserSelection';
import { Badge, Card, SectionHeader } from './ui';

interface SelectionSummaryProps {
  selectedUser?: ConfigOption;
  selectedNetwork: string | null;
  selectedWallet: string | null;
  onUserClick?: () => void;
  onNetworkClick?: () => void;
  onWalletClick?: () => void;
}

const placeholder = 'Awaiting selection';

export function SelectionSummary({
  selectedUser,
  selectedNetwork,
  selectedWallet,
  onUserClick,
  onNetworkClick,
  onWalletClick,
}: SelectionSummaryProps) {
  return (
    <Card variant="outline" padding="lg">
      <SectionHeader
        eyebrow="Session state"
        title="Selections overview"
        description="You may revisit prior steps without losing progress."
        aside={
          <Badge tone="neutral" className="text-[var(--color-text-soft)]">
            {selectedUser || selectedWallet || selectedNetwork ? 'In progress' : 'Awaiting input'}
          </Badge>
        }
      />

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Network',
            value: selectedNetwork ?? placeholder,
            action: onNetworkClick,
          },
          {
            label: 'Task / Upgrade',
            value: selectedWallet ?? placeholder,
            action: onWalletClick,
          },
          {
            label: 'Signer profile',
            value: selectedUser?.displayName ?? placeholder,
            action: onUserClick,
          },
        ].map(({ label, value, action }) => (
          <div
            key={label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-4"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">
              {label}
            </dt>
            <dd className="mt-2 flex items-center justify-between text-sm font-medium text-[var(--color-text)]">
              <span className={value === placeholder ? 'text-[var(--color-text-soft)]' : undefined}>
                {value}
              </span>
              {action && value !== placeholder && (
                <button
                  type="button"
                  onClick={action}
                  className="text-xs font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"
                >
                  Edit
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
