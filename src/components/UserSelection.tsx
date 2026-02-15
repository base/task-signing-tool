import { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { SectionHeader } from './ui/SectionHeader';

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

  // Fetch available users when network and upgradeId change
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
          setError(`API returned an error: ${apiError}`);
          setAvailableUsers([]);
        } else {
          setAvailableUsers(configOptions);
          setError('');
        }
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to fetch upgrade config:', err);
        setError(`Failed to fetch upgrade config: ${message}`);
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
    <div className="w-full animate-fade-in">
      <SectionHeader
        title="Select Profile"
        description="Identify which profile you are signing as. This determines the Ledger path and configuration used."
      />

      <div className="mb-8">
        <div className="flex flex-col gap-4">
          {loadingUsers ? (
            <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-[var(--cds-border)] border-dashed">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cds-primary)] border-t-transparent mb-4" />
                <p className="text-sm font-medium text-[var(--cds-text-secondary)]">
                  Loading profiles...
                </p>
              </div>
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-[var(--cds-border)] text-center">
              <p className="text-sm text-[var(--cds-text-secondary)]">
                No user profiles found for this network and task.
              </p>
            </div>
          ) : (
            availableUsers.map(option => {
              const isSelected = selectedUser?.fileName === option.fileName;

              return (
                <Card
                  key={option.fileName}
                  interactive
                  selected={isSelected}
                  onClick={() => handleUserSelect(option)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold transition-colors ${isSelected ? 'bg-[var(--cds-primary)] text-white' : 'bg-gray-100 text-[var(--cds-text-tertiary)]'}`}
                    >
                      {option.displayName.charAt(0)}
                    </div>
                    <div>
                      <h3
                        className={`font-semibold transition-colors ${isSelected ? 'text-[var(--cds-primary)]' : 'text-[var(--cds-text-primary)]'}`}
                      >
                        {option.displayName}
                      </h3>
                      <p className="text-xs text-[var(--cds-text-secondary)] font-mono mt-0.5">
                        {option.fileName}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-[var(--cds-primary)] text-white flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-100 flex gap-3">
          <div className="text-[var(--cds-error)] mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-[var(--cds-error)] mb-1">
              Error loading profiles
            </h4>
            <p className="text-sm text-red-700 mb-2">{error}</p>
            {error.includes('not found') && (
              <div className="text-xs bg-white/50 p-2 rounded border border-red-100 inline-block">
                Run <code className="font-mono font-bold">make install-eip712sign</code> in project
                root
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-[var(--cds-divider)]">
        <Button
          disabled={!selectedUser}
          onClick={() => {
            if (selectedUser) {
              onSelect(selectedUser);
            }
          }}
          size="lg"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          }
        >
          Proceed to Validation
        </Button>
      </div>
    </div>
  );
}
