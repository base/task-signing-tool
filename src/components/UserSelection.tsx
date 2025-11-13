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
      <h2 className="mb-8 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold text-transparent">
        Select Profile
      </h2>

      {/* Step 1: User Type Selection */}
      <div className="mb-8">
        <div className="flex flex-col gap-4">
          {loadingUsers ? (
            <p className="text-base font-medium text-gray-600">Loading user options...</p>
          ) : availableUsers.length === 0 ? (
            <p className="text-base font-medium text-gray-600">
              No user options available for this network and upgrade ID.
            </p>
          ) : (
            availableUsers.map(option => {
              const isSelected = selectedUser?.fileName === option.fileName;

              return (
                <button
                  key={option.fileName}
                  type="button"
                  onClick={() => handleUserSelect(option)}
                  className={`inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-8 py-6 text-base font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-transparent bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-xl scale-[1.02] ring-2 ring-purple-300/50'
                      : 'border-purple-200/50 bg-gradient-to-br from-white to-purple-50/30 text-gray-700 shadow-md hover:-translate-y-1 hover:border-purple-300 hover:bg-white hover:shadow-xl hover:ring-1 hover:ring-purple-200'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <span className="text-xl font-bold">✓</span>}
                  {option.displayName}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
          <p className="mb-2 text-sm font-semibold text-red-700">❌ Error:</p>
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
            Next, simulate the transaction to confirm it behaves as expected.
          </p>
          <button
            onClick={() => {
              if (selectedUser) {
                onSelect(selectedUser);
              }
            }}
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-10 py-5 text-base font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-2xl hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Simulate →
          </button>
        </div>
      )}
    </div>
  );
}
