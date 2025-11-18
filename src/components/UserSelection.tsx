import { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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
    <div>
      <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
        Select Profile
      </h2>

      <div className="mb-8">
        <div className="flex flex-col gap-4">
          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              <p className="mt-4 text-base font-medium text-gray-600">Loading profiles...</p>
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base text-gray-600">
                No profiles available for this network and upgrade.
              </p>
            </div>
          ) : (
            availableUsers.map(option => {
              const isSelected = selectedUser?.fileName === option.fileName;

              return (
                <Card
                  key={option.fileName}
                  onClick={() => handleUserSelect(option)}
                  interactive
                  elevated={isSelected}
                  className={`p-6 transition-all duration-200 focus-ring ${
                    isSelected
                      ? 'border-2 border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                      : 'hover:border-gray-300'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {option.displayName}
                    </span>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-700">Error</p>
          <p className="text-sm text-red-600">{error}</p>
          {error.includes('not found') && (
            <p className="mt-2 text-xs text-red-600">
              Run:{' '}
              <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">
                make install-eip712sign
              </code>{' '}
              in project root
            </p>
          )}
        </div>
      )}

      {selectedUser && (
        <div className="mt-8 text-center">
          <p className="mb-4 text-sm text-gray-600">
            Next, simulate the transaction to confirm it behaves as expected.
          </p>
          <Button
            onClick={() => {
              if (selectedUser) {
                onSelect(selectedUser);
              }
            }}
            size="lg"
          >
            Simulate Transaction →
          </Button>
        </div>
      )}
    </div>
  );
}
