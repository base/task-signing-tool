import { useEffect, useState } from 'react';

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
    <div className="text-center">
      <h2 className="mb-8 text-3xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
        Select Profile
      </h2>

      {/* User Type Selection */}
      <div className="mb-8">
        <div className="flex flex-col gap-3">
          {loadingUsers ? (
            <p className="text-base font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
              Loading profiles...
            </p>
          ) : availableUsers.length === 0 ? (
            <p className="text-base font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
              No profiles available for this network and task.
            </p>
          ) : (
            availableUsers.map(option => {
              const isSelected = selectedUser?.fileName === option.fileName;

              return (
                <button
                  key={option.fileName}
                  type="button"
                  onClick={() => handleUserSelect(option)}
                  className={`inline-flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    isSelected ? 'scale-[1.01]' : 'hover:-translate-y-0.5'
                  }`}
                  style={{
                    background: isSelected ? 'var(--cb-primary)' : 'var(--cb-surface-elevated)',
                    border: isSelected ? '2px solid var(--cb-primary-dark)' : '1px solid var(--cb-border)',
                    color: isSelected ? 'white' : 'var(--cb-text-primary)',
                    boxShadow: isSelected ? 'var(--cb-shadow-lg)' : 'var(--cb-shadow-sm)'
                  }}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <div 
                      className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '2px solid white'
                      }}
                    >
                      ✓
                    </div>
                  )}
                  {option.displayName}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div 
          className="mt-4 rounded-lg p-4 text-left"
          style={{
            background: 'var(--cb-error-light)',
            border: '1px solid var(--cb-error)',
            color: 'var(--cb-error)'
          }}
        >
          <p className="mb-2 text-sm font-semibold">❌ Error:</p>
          <p className="text-sm">{error}</p>
          {error.includes('not found') && (
            <p className="mt-2 text-xs">
              Run:{' '}
              <code className="rounded px-1.5 py-0.5 font-mono text-xs" style={{ background: 'rgba(215, 58, 73, 0.1)' }}>
                make install-eip712sign
              </code>{' '}
              in project root
            </p>
          )}
        </div>
      )}

      {/* Proceed Button */}
      {selectedUser && (
        <div className="mt-8">
          <p className="mb-4 text-sm" style={{ color: 'var(--cb-text-secondary)' }}>
            Next, simulate the transaction to confirm it behaves as expected.
          </p>
          <button
            onClick={() => {
              if (selectedUser) {
                onSelect(selectedUser);
              }
            }}
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: 'var(--cb-primary)',
              boxShadow: 'var(--cb-shadow-md)'
            }}
          >
            Simulate Transaction →
          </button>
        </div>
      )}
    </div>
  );
}
