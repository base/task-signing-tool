import { TaskStatus } from '@/lib/types';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ExecutionLink {
  url: string;
  label: string;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  date: string;
  network: string;
  status?: TaskStatus;
  executionLinks?: ExecutionLink[];
}

interface UpgradeSelectionProps {
  selectedWallet: string | null;
  selectedNetwork: string | null;
  onSelect: (upgradeId: string) => void;
}

export const UpgradeSelection: React.FC<UpgradeSelectionProps> = ({
  selectedWallet,
  selectedNetwork,
  onSelect,
}) => {
  const [upgradeOptions, setUpgradeOptions] = useState<Upgrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedNetwork) return;

    const fetchUpgrades = async () => {
      setLoading(true);
      setError(null);

      try {
        const network = selectedNetwork.toLowerCase();
        const response = await fetch(`/api/upgrades?network=${network}`);

        if (!response.ok) {
          throw new Error(`UpgradeSelection::fetchUpgrades: API response not ok: ${response}`);
        }

        const upgrades = await response.json();
        setUpgradeOptions(upgrades);
      } catch (err) {
        setError(`UpgradeSelection::fetchUpgrades: Failed to load upgrades: ${err}`);
        console.error('Error fetching upgrades:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpgrades();
  }, [selectedNetwork]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div
          style={{
            display: 'inline-block',
            width: '32px',
            height: '32px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #6366F1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        ></div>
        <p style={{ marginTop: '16px', color: '#6B7280' }}>Loading upgrades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#DC2626', marginBottom: '16px' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#6366F1',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6B7280' }}>No upgrades available for {selectedNetwork}</p>
      </div>
    );
  }

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
        Which upgrade do you want to validate?
      </h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '32px',
          maxHeight: '400px',
          overflowY: 'auto',
          paddingRight: '8px',
        }}
      >
        {upgradeOptions.map(option => (
          <div
            key={option.id}
            onClick={() => onSelect(option.id)}
            onMouseEnter={e => {
              if (selectedWallet !== option.id) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={e => {
              if (selectedWallet !== option.id) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
              }
            }}
            className="upgrade-card"
            data-selected={selectedWallet === option.id ? 'true' : 'false'}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(option.id);
              }
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              borderRadius: '20px',
              padding: '28px 32px',
              border: selectedWallet === option.id ? 'none' : '1px solid #E5E7EB',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              background:
                selectedWallet === option.id
                  ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
                  : '#F9FAFB',
              color: selectedWallet === option.id ? 'white' : '#374151',
              boxShadow:
                selectedWallet === option.id
                  ? '0 10px 25px rgba(99, 102, 241, 0.3)'
                  : '0 2px 4px rgba(0, 0, 0, 0.05)',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    lineHeight: '1.2',
                  }}
                >
                  {option.name}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    opacity: selectedWallet === option.id ? 0.9 : 0.7,
                    fontWeight: '500',
                  }}
                >
                  {option.date}
                </div>
              </div>

              <StatusBadge status={option.status} executionLinks={option.executionLinks} />
            </div>

            <div
              style={{
                fontSize: '16px',
                lineHeight: '1.5',
                opacity: selectedWallet === option.id ? 0.95 : 0.8,
              }}
            >
              {(() => {
                const isExpanded = !!expandedCards[option.id];
                // Heuristic: show the toggle if description is reasonably long
                const isTruncated = (option.description || '').length > 200;
                const isSelected = selectedWallet === option.id;
                const buttonStyles: React.CSSProperties = {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '10px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  border: isSelected ? '1px solid rgba(255,255,255,0.6)' : '1px solid #E5E7EB',
                  background: isSelected ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                };

                return (
                  <div>
                    <div
                      className={
                        'markdown-content' + (!isExpanded && isTruncated ? ' collapsed' : '')
                      }
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              onClick={e => {
                                e.stopPropagation();
                              }}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {option.description}
                      </Markdown>
                    </div>

                    {isTruncated && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedCards(prev => ({ ...prev, [option.id]: !isExpanded }));
                        }}
                        style={buttonStyles}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                        <span style={{ fontSize: '14px' }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {selectedWallet === option.id && (
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '700',
                }}
              >
                ✓
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* Make links in markdown visibly distinct */
        .upgrade-card .markdown-content a {
          color: #2563eb; /* blue-600 */
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-thickness: 2px;
          font-weight: 600;
        }
        .upgrade-card .markdown-content a:hover {
          color: #1d4ed8; /* blue-700 */
        }
        .upgrade-card[data-selected='true'] .markdown-content a {
          color: #e0e7ff; /* indigo-100 for contrast on gradient */
        }
        .upgrade-card[data-selected='true'] .markdown-content a:hover {
          color: #ffffff;
        }

        /* Collapsed state: visually clamp full markdown while keeping full content rendered */
        .upgrade-card .markdown-content.collapsed {
          display: -webkit-box;
          -webkit-line-clamp: 5; /* approx preview */
          -webkit-box-orient: vertical;
          overflow: hidden;
          position: relative;
        }
        .upgrade-card .markdown-content.collapsed a {
          pointer-events: none; /* disable link interactions while collapsed */
          cursor: default;
        }
        .upgrade-card .markdown-content.collapsed::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2.25em;
          background: linear-gradient(180deg, rgba(249, 250, 251, 0), #f9fafb);
          pointer-events: none;
        }
        .upgrade-card[data-selected='true'] .markdown-content.collapsed::after {
          background: linear-gradient(180deg, rgba(99, 102, 241, 0), rgba(255, 255, 255, 0.16));
        }

        /* Inline code styling */
        .upgrade-card .markdown-content :global(code) {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
            'Courier New', monospace;
          font-size: 0.9em;
          background: #eef2ff; /* indigo-50 */
          color: #111827; /* gray-900 */
          padding: 0.15em 0.45em;
          border-radius: 6px;
          border: 1px solid #c7d2fe; /* indigo-200 */
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .upgrade-card[data-selected='true'] .markdown-content :global(code) {
          background: rgba(255, 255, 255, 0.28);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        /* Code block styling */
        .upgrade-card .markdown-content :global(pre) {
          background: #111827; /* gray-900 */
          color: #e5e7eb; /* gray-200 */
          padding: 12px 14px;
          border-radius: 8px;
          overflow: auto;
          margin: 0 0 12px 0;
          border: 1px solid #1f2937; /* gray-800 */
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
          border-left: 3px solid #6366f1; /* indigo-500 accent */
        }
        .upgrade-card .markdown-content :global(pre code) {
          background: transparent;
          color: inherit;
          padding: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
            'Courier New', monospace;
          font-size: 0.9em;
        }
        .upgrade-card[data-selected='true'] .markdown-content :global(pre) {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.45);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border-left: 3px solid rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(2px);
        }

        /* Ensure bold markdown renders bold */
        .upgrade-card .markdown-content strong,
        .upgrade-card .markdown-content b {
          font-weight: 700;
        }

        /* Restore paragraph spacing inside markdown content (react-markdown output) */
        .upgrade-card .markdown-content :global(p) {
          margin: 0 0 12px 0;
        }
        .upgrade-card .markdown-content :global(p:last-child) {
          margin-bottom: 0;
        }

        /* Ensure markdown lists render properly (lines starting with "-", "*", or numbered) */
        .upgrade-card .markdown-content :global(ul),
        .upgrade-card .markdown-content :global(ol) {
          margin: 0 0 12px 0;
          padding-left: 1.25rem; /* indent bullets */
        }
        .upgrade-card .markdown-content :global(li) {
          margin: 6px 0;
        }
        .upgrade-card .markdown-content :global(ul) {
          list-style-type: disc;
          list-style-position: outside;
        }
        .upgrade-card .markdown-content :global(ol) {
          list-style-type: decimal;
          list-style-position: outside;
        }
        /* Better spacing for nested lists */
        .upgrade-card .markdown-content :global(li > ul),
        .upgrade-card .markdown-content :global(li > ol) {
          margin-top: 6px;
        }

        /* Render markdown blockquotes (lines starting with ">") clearly */
        .upgrade-card .markdown-content :global(blockquote) {
          margin: 0 0 12px 0;
          padding: 10px 12px;
          border-left: 4px solid #d1d5db; /* gray-300 */
          background: #f9fafb; /* gray-50 */
          color: #374151; /* gray-700 for readability */
          border-radius: 6px;
        }
        .upgrade-card .markdown-content :global(blockquote > :last-child) {
          margin-bottom: 0; /* avoid extra space at end */
        }
        .upgrade-card[data-selected='true'] .markdown-content :global(blockquote) {
          background: rgba(255, 255, 255, 0.15);
          border-left-color: rgba(255, 255, 255, 0.6);
          color: #f8fafc; /* slate-50 */
        }
      `}</style>
    </div>
  );
};

const StatusBadge: React.FC<{
  status?: TaskStatus;
  executionLinks?: ExecutionLink[];
}> = ({ status, executionLinks }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  if (!status) return null;

  const getStatusStyle = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.Executed:
        return {
          backgroundColor: '#DCFCE7', // green-100
          color: '#166534', // green-800
          borderColor: '#BBF7D0', // green-200
        };
      case TaskStatus.ReadyToSign:
        return {
          backgroundColor: '#FEF3C7', // yellow-100
          color: '#92400E', // yellow-800
          borderColor: '#FDE68A', // yellow-200
        };
      case TaskStatus.Pending:
        return {
          backgroundColor: '#F3F4F6', // gray-100
          color: '#1F2937', // gray-800
          borderColor: '#E5E7EB', // gray-200
        };
      default:
        return {
          backgroundColor: '#F3F4F6', // gray-100
          color: '#1F2937', // gray-800
          borderColor: '#E5E7EB', // gray-200
        };
    }
  };

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // If it's executed and has links
  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    // Single link - make the badge clickable
    if (executionLinks.length === 1) {
      const styles = getStatusStyle(status);
      return (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '500',
            border: `1px solid ${styles.borderColor}`,
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
            ...styles,
          }}
          onClick={e => handleLinkClick(executionLinks[0].url, e)}
          title={`View transaction: ${executionLinks[0].label}`}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {status}
        </span>
      );
    }

    // Multiple links - show dropdown on hover
    const styles = getStatusStyle(status);
    return (
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
        }}
        onMouseEnter={() => setShowDropdown(true)}
        onMouseLeave={() => setShowDropdown(false)}
      >
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '500',
            border: `1px solid ${styles.borderColor}`,
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
            ...styles,
          }}
          title="Multiple transactions available - hover to see options"
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {status} ({executionLinks.length})
        </span>

        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 50,
              minWidth: '192px',
            }}
          >
            <div style={{ padding: '4px 0' }}>
              {executionLinks.map((link, index) => (
                <button
                  key={index}
                  onClick={e => handleLinkClick(link.url, e)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#374151',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#F3F4F6';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{link.label}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {link.url.includes('etherscan.io') ? 'Etherscan' : 'Transaction'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Regular status badge (not executed or no links)
  const styles = getStatusStyle(status);
  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '500',
        border: `1px solid ${styles.borderColor}`,
        ...styles,
      }}
    >
      {status}
    </span>
  );
};
