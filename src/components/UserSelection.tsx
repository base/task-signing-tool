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
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Select a profile</h2>

      {/* Step 1: User Type Selection */}
      <div className="mb-8">
        <div className="flex flex-col gap-4">
          {loadingUsers ? (
            <p className="text-sm font-medium text-slate-600">Loading user options…</p>
          ) : availableUsers.length === 0 ? (
            <p className="text-sm font-medium text-slate-600">
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
                  className={`inline-flex w-full items-center justify-center gap-3 rounded-lg border px-5 py-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <span className="text-base font-bold">✓</span>}
                  {option.displayName}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-left">
          <p className="mb-2 text-sm font-semibold text-rose-700">❌ Error:</p>
          <p className="text-sm text-rose-700">{error}</p>
          {error.includes('not found') && (
            <p className="mt-2 text-xs text-rose-700">
              Run:{' '}
              <code className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs">
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
          <p className="mb-3 text-xs text-slate-500">
            Next, simulate the transaction to confirm it behaves as expected.
          </p>
          <button
            onClick={() => {
              if (selectedUser) {
                onSelect(selectedUser);
              }
            }}
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
