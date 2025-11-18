import { useEffect, useState } from 'react';
import { Button, Card, SectionHeader, Badge } from './ui';

export interface ConfigOption {
  fileName: string;
  displayName: string;
  configFile: string;
  ledgerId: number;
}

interface UserSelectionProps {
  network: string;
  upgradeId: string;
  onSelect: (cfg: ConfigOption) => void;
}

export function UserSelection({ network, upgradeId, onSelect }: UserSelectionProps) {
  const [availableUsers, setAvailableUsers] = useState<ConfigOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<ConfigOption | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const resetState = () => {
      setAvailableUsers([]);
      setSelectedUser(null);
      setError('');
      setLoadingUsers(false);
    };

    if (!network || !upgradeId) {
      resetState();
      return;
    }

    let isActive = true;
    setAvailableUsers([]);
    setSelectedUser(null);
    setError('');
    setLoadingUsers(true);

    const fetchAvailableUsers = async () => {
      try {
        const response = await fetch(
          `/api/upgrade-config?network=${network.toLowerCase()}&upgradeId=${upgradeId}`
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || response.statusText);
        }
        const { configOptions, error: apiError } = await response.json();

        if (!isActive) return;

        if (apiError) {
          setError(`UserSelection::fetchAvailableUsers: API returned an error: ${apiError}`);
          setAvailableUsers([]);
        } else {
          setAvailableUsers(configOptions);
          setError('');
        }
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to fetch upgrade config:', err);
        setError(`UserSelection::fetchAvailableUsers: Failed to fetch upgrade config: ${message}`);
        setAvailableUsers([]);
      } finally {
        if (isActive) {
          setLoadingUsers(false);
        }
      }
    };

    fetchAvailableUsers();

    return () => {
      isActive = false;
    };
  }, [network, upgradeId]);

  const handleUserSelect = (userOption: ConfigOption) => {
    setSelectedUser(userOption);
    setError('');
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Step 2"
        title="Choose which signer profile to simulate"
        description="Profiles are sourced from the validation config and include ledger paths."
        aside={
          selectedUser ? (
            <Badge tone="success">Profile locked</Badge>
          ) : (
            <Badge tone="neutral">Select to continue</Badge>
          )
        }
      />

      <div className="grid gap-4">
        {loadingUsers ? (
          <Card className="text-sm text-[var(--color-text-muted)]">Loading signer configs…</Card>
        ) : availableUsers.length === 0 ? (
          <Card className="text-sm text-[var(--color-text-muted)]">
            No signer profiles found for this upgrade. Confirm the validation configs exist.
          </Card>
        ) : (
          availableUsers.map(option => {
            const isSelected = selectedUser?.fileName === option.fileName;
            return (
              <Card
                key={option.fileName}
                className={`flex items-center justify-between border-2 transition ${
                  isSelected
                    ? 'border-[var(--color-primary)] shadow-[0_25px_50px_rgba(0,82,255,0.12)]'
                    : 'border-[var(--color-border)] hover:-translate-y-1 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {option.displayName}
                  </p>
                  <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-soft)]">
                    Ledger #{option.ledgerId}
                  </p>
                </div>
                <Button
                  variant={isSelected ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleUserSelect(option)}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </Card>
            );
          })
        )}
      </div>

      {error && (
        <Card className="border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-sm text-[var(--color-danger)]">
          {error}
        </Card>
      )}

      <div className="flex items-center justify-between rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Run validation next</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            We will fetch expected vs. actual state diffs for this profile.
          </p>
        </div>
        <Button disabled={!selectedUser} onClick={() => selectedUser && onSelect(selectedUser)}>
          Run validation
        </Button>
      </div>
    </section>
  );
}
