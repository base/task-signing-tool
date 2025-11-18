import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const getStatusStyle = (status: TaskStatus, isSelected: boolean) => {
  if (isSelected) {
    return {
      background: 'rgba(255, 255, 255, 0.2)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    };
  }

  switch (status) {
    case TaskStatus.Executed:
      return {
        background: 'var(--cb-success-light)',
        color: 'var(--cb-success)',
        border: '1px solid var(--cb-success)'
      };
    case TaskStatus.ReadyToSign:
      return {
        background: 'var(--cb-warning-light)',
        color: 'var(--cb-warning)',
        border: '1px solid var(--cb-warning)'
      };
    case TaskStatus.Pending:
    default:
      return {
        background: 'var(--cb-surface)',
        color: 'var(--cb-text-tertiary)',
        border: '1px solid var(--cb-border)'
      };
  }
};

const BADGE_BASE_CLASSES =
  'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150';
const DESCRIPTION_CHAR_LIMIT = 200;

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
  onSelect: (upgradeId: string, network: string) => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchUpgrades = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // Fetch all ready-to-sign tasks across all networks
      const response = await fetch(`/api/upgrades?readyToSign=true`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `UpgradeSelection::fetchUpgrades: API response not ok: ${response.status} ${response.statusText}`
        );
      }

      const upgrades: Upgrade[] = await response.json();
      setUpgradeOptions(upgrades);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      setError(`UpgradeSelection::fetchUpgrades: Failed to load upgrades: ${message}`);
      console.error('Error fetching upgrades:', err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUpgrades();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchUpgrades]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div 
          className="inline-block h-10 w-10 animate-spin rounded-full border-3"
          style={{ 
            borderColor: 'var(--cb-border)',
            borderTopColor: 'var(--cb-primary)'
          }}
        />
        <p className="mt-4 text-base font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
          Loading tasks...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div 
          className="mb-4 rounded-xl p-4"
          style={{
            background: 'var(--cb-error-light)',
            border: '1px solid var(--cb-error)',
            color: 'var(--cb-error)'
          }}
        >
          <p className="text-sm font-medium">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchUpgrades}
          disabled={loading}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: 'var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-md)'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm" style={{ color: 'var(--cb-text-tertiary)' }}>
          No tasks ready to sign
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-8 text-3xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
        Select Task
      </h2>

      <div className="mb-8 flex max-h-[400px] flex-col gap-5 overflow-y-auto pr-2 scrollbar-hide">
        {upgradeOptions.map(option => {
          const isSelected = selectedWallet === option.id && selectedNetwork === option.network;
          const isExpanded = !!expandedCards[option.id];
          const isTruncated = option.description.length > DESCRIPTION_CHAR_LIMIT;
          const collapsed = isTruncated && !isExpanded;

          return (
            <div
              key={`${option.network}-${option.id}`}
              onClick={() => onSelect(option.id, option.network)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(option.id, option.network);
                }
              }}
              role="button"
              tabIndex={0}
              className={`task-card group relative w-full cursor-pointer rounded-xl p-6 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                isSelected
                  ? 'scale-[1.01]'
                  : 'hover:-translate-y-1'
              }`}
              style={{
                background: isSelected ? 'var(--cb-primary)' : 'var(--cb-surface-elevated)',
                border: isSelected ? '2px solid var(--cb-primary-dark)' : '1px solid var(--cb-border)',
                boxShadow: isSelected ? 'var(--cb-shadow-lg)' : 'var(--cb-shadow-sm)',
                color: isSelected ? 'white' : 'var(--cb-text-primary)'
              }}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 text-xl font-bold leading-tight">{option.name}</div>
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className="text-sm font-medium"
                      style={{ 
                        color: isSelected ? 'rgba(255, 255, 255, 0.9)' : 'var(--cb-text-secondary)' 
                      }}
                    >
                      {option.date}
                    </div>
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--cb-surface)',
                        color: isSelected ? 'white' : 'var(--cb-text-secondary)',
                        border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--cb-border)'
                      }}
                    >
                      {option.network.charAt(0).toUpperCase() + option.network.slice(1)}
                    </span>
                  </div>
                </div>

                <StatusBadge status={option.status} executionLinks={option.executionLinks} isSelected={isSelected} />
              </div>

              <div
                className="relative text-sm leading-relaxed"
                style={{ 
                  color: isSelected ? 'rgba(255, 255, 255, 0.95)' : 'var(--cb-text-secondary)' 
                }}
              >
                <div className={`markdown-content ${collapsed ? 'collapsed line-clamp-5' : ''}`}>
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ ...props }) => (
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

                {collapsed && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-9"
                    style={{
                      background: isSelected 
                        ? 'linear-gradient(to bottom, transparent, rgba(0, 82, 255, 1))' 
                        : 'linear-gradient(to bottom, transparent, var(--cb-surface-elevated))'
                    }}
                  />
                )}
              </div>

              {isTruncated && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedCards(prev => ({ ...prev, [option.id]: !isExpanded }));
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--cb-surface)',
                    color: isSelected ? 'white' : 'var(--cb-text-primary)',
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--cb-border)'
                  }}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>
              )}

              {isSelected && (
                <div 
                  className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '2px solid white',
                    color: 'white'
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{
  status?: TaskStatus;
  executionLinks?: ExecutionLink[];
  isSelected?: boolean;
}> = ({ status, executionLinks, isSelected = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  if (!status) return null;

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const statusStyle = getStatusStyle(status, isSelected);

  // If it's executed and has links
  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    // Single link - make the badge clickable
    if (executionLinks.length === 1) {
      return (
        <button
          type="button"
          className={`${BADGE_BASE_CLASSES} cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
          style={statusStyle}
          onClick={e => handleLinkClick(executionLinks[0].url, e)}
          title={`View transaction: ${executionLinks[0].label}`}
          aria-haspopup="menu"
          aria-expanded="false"
        >
          {status}
        </button>
      );
    }

    // Multiple links - toggle dropdown on click
    return (
      <div ref={dropdownRef} className="relative inline-block">
        <button
          type="button"
          className={`${BADGE_BASE_CLASSES} cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
          style={statusStyle}
          title="Multiple transactions available - click to see options"
          aria-haspopup="menu"
          aria-expanded={showDropdown}
          onClick={e => {
            e.stopPropagation();
            setShowDropdown(prev => !prev);
          }}
        >
          {status} ({executionLinks.length})
        </button>

        {showDropdown && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg"
            style={{
              background: 'var(--cb-surface-elevated)',
              border: '1px solid var(--cb-border)',
              boxShadow: 'var(--cb-shadow-lg)'
            }}
            role="menu"
          >
            <div className="py-1">
              {executionLinks.map((link, index) => (
                <button
                  type="button"
                  key={`${link.url}-${index}`}
                  onClick={e => handleLinkClick(link.url, e)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:opacity-75 focus-visible:outline-none focus-visible:ring-2"
                  style={{ color: 'var(--cb-text-primary)' }}
                  role="menuitem"
                >
                  <div className="font-medium">{link.label}</div>
                  <div className="w-full truncate text-xs" style={{ color: 'var(--cb-text-tertiary)' }}>
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
  return <span className={BADGE_BASE_CLASSES} style={statusStyle}>{status}</span>;
};
