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
    <div style={{ textAlign: 'center' }}>
      <h2
        style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '32px',
          margin: '0 0 32px 0',
        }}
      >
        Select Profile
      </h2>

      {/* Step 1: User Type Selection */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {loadingUsers ? (
            <p>Loading user options...</p>
          ) : availableUsers.length === 0 ? (
            <p>No user options available for this network and upgrade ID.</p>
          ) : (
            availableUsers.map(option => (
              <button
                key={option.fileName}
                onClick={() => handleUserSelect(option)}
                style={{
                  width: '100%',
                  background: selectedUser?.fileName === option.fileName ? '#EBF8FF' : 'white',
                  border:
                    selectedUser?.fileName === option.fileName
                      ? '2px solid #3B82F6'
                      : '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '20px',
                  color: selectedUser?.fileName === option.fileName ? '#1E40AF' : '#374151',
                  fontWeight: selectedUser?.fileName === option.fileName ? '600' : '500',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  boxShadow:
                    selectedUser?.fileName === option.fileName
                      ? '0 4px 6px rgba(59, 130, 246, 0.15)'
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={e => {
                  if (selectedUser?.fileName !== option.fileName) {
                    e.currentTarget.style.background = '#F9FAFB';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedUser?.fileName !== option.fileName) {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }
                }}
              >
                {selectedUser?.fileName === option.fileName && (
                  <span style={{ marginRight: '8px' }}>✓</span>
                )}
                {option.displayName}
              </button>
            ))
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: '500',
              color: '#DC2626',
            }}
          >
            ❌ Error:
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#DC2626',
            }}
          >
            {error}
          </p>
          {error.includes('not found') && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#DC2626',
              }}
            >
              Run:{' '}
              <code style={{ background: '#FEE2E2', padding: '2px 4px', borderRadius: '4px' }}>
                make install-eip712sign
              </code>{' '}
              in project root
            </p>
          )}
        </div>
      )}

      {/* Proceed Button */}
      {selectedUser && (
        <button
          onClick={handleProceed}
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}
        >
          Simulate
        </button>
      )}

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
