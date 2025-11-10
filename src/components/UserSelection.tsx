import React, { useState, useEffect } from 'react';

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

export const UserSelection: React.FC<UserSelectionProps> = ({ network, upgradeId, onSelect }) => {
  const [availableUsers, setAvailableUsers] = useState<ConfigOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<ConfigOption | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch available users when network and upgradeId change
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!network || !upgradeId) return;

      setLoadingUsers(true);
      try {
        const response = await fetch(
          `/api/upgrade-config?network=${network.toLowerCase()}&upgradeId=${upgradeId}`
        );
        const { configOptions, error: apiError } = await response.json();

        if (apiError) {
          setError(`UserSelection::fetchAvailableUsers: API returned an error: ${apiError}`);
          setAvailableUsers([]);
        } else {
          setAvailableUsers(configOptions);
          setError('');
        }
      } catch (err) {
        console.error('Failed to fetch upgrade config:', err);
        setError(`UserSelection::fetchAvailableUsers: Failed to fetch upgrade config: ${err}`);
        setAvailableUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchAvailableUsers();
  }, [network, upgradeId]);

  const handleUserSelect = (userOption: ConfigOption) => {
    setSelectedUser(userOption);
    setError('');
  };

  const handleProceed = () => {
    if (selectedUser) {
      onSelect(selectedUser);
    }
  };

  return (
    <div className="text-center">
      <h2 className="mb-8 text-2xl font-semibold text-gray-700">Select Profile</h2>

      {/* Step 1: User Type Selection */}
      <div className="mb-8">
        <div className="flex flex-col gap-3">
          {loadingUsers ? (
            <p className="text-sm text-gray-500">Loading user options...</p>
          ) : availableUsers.length === 0 ? (
            <p className="text-sm text-gray-500">
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
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-5 text-base font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-lg'
                      : 'border-gray-200 bg-white text-gray-700 shadow-sm hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <span className="text-lg font-semibold text-indigo-600">✓</span>}
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
            onClick={handleProceed}
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-500 hover:to-emerald-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Simulate
          </button>
        </div>
      )}
    </div>
  );
};
