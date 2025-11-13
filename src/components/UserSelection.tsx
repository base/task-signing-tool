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
      <h2 className="mb-6 text-xl font-semibold text-gray-900">
        Select Profile
      </h2>

      {/* User Type Selection */}
      <div className="mb-6">
        <div className="flex flex-col gap-3">
          {loadingUsers ? (
            <p className="text-sm text-gray-600">Loading profiles...</p>
          ) : availableUsers.length === 0 ? (
            <p className="text-sm text-gray-600">
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
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 px-6 py-4 text-base font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-md'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600 text-sm font-bold">
                      ✓
                    </span>
                  )}
                  {option.displayName}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
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

      {/* Proceed Button */}
      {selectedUser && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-gray-600">
            Proceed to simulate and validate the transaction
          </p>
          <button
            onClick={() => {
              if (selectedUser) {
                onSelect(selectedUser);
              }
            }}
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Continue to Validation →
          </button>
        </div>
      )}
    </div>
  );
}
