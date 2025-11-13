import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STATUS_CLASS_MAP: Record<TaskStatus, string> = {
  [TaskStatus.Executed]: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  [TaskStatus.ReadyToSign]: 'border-amber-200 bg-amber-100 text-amber-900',
  [TaskStatus.Pending]: 'border-gray-200 bg-gray-100 text-gray-800',
};

const BADGE_BASE_CLASSES =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors';
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
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
        <p className="mt-4 text-sm text-gray-500">Loading upgrades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchUpgrades}
          disabled={loading}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Retry
        </button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-gray-500">No tasks ready to sign</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-8 text-2xl font-semibold text-gray-700">Select Task</h2>

      <div className="mb-8 flex max-h-[400px] flex-col gap-5 overflow-y-auto pr-2">
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
              className={`upgrade-card group relative w-full cursor-pointer rounded-3xl p-7 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? 'border border-transparent bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_10px_25px_rgba(99,102,241,0.3)]'
                  : 'border border-gray-200 bg-gray-50 text-gray-700 shadow-sm hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-lg'
              }`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 text-xl font-bold leading-tight">{option.name}</div>
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className={`text-sm font-medium ${
                        isSelected ? 'text-white/90' : 'text-gray-500'
                      }`}
                    >
                      {option.date}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {option.network.charAt(0).toUpperCase() + option.network.slice(1)}
                    </span>
                  </div>
                </div>

                <StatusBadge status={option.status} executionLinks={option.executionLinks} />
              </div>

              <div
                className={`relative text-base leading-relaxed ${
                  isSelected ? 'text-white/95' : 'text-gray-600'
                }`}
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
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-9 ${
                      isSelected
                        ? 'bg-gradient-to-b from-transparent to-white/20'
                        : 'bg-gradient-to-b from-transparent to-gray-100'
                    }`}
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
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                    isSelected
                      ? 'border-white/60 bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white/80'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-indigo-500'
                  }`}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <span className="text-sm">{isExpanded ? '▲' : '▼'}</span>
                </button>
              )}

              {isSelected && (
                <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base font-bold">
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
}> = ({ status, executionLinks }) => {
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

  const resolvedStatusClasses = STATUS_CLASS_MAP[status] ?? STATUS_CLASS_MAP[TaskStatus.Pending];
  const badgeClasses = `${BADGE_BASE_CLASSES} ${resolvedStatusClasses}`;

  // If it's executed and has links
  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    // Single link - make the badge clickable
    if (executionLinks.length === 1) {
      return (
        <button
          type="button"
          className={`${badgeClasses} cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
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
          className={`${badgeClasses} cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
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
            className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-xl"
            role="menu"
          >
            <div className="py-1">
              {executionLinks.map((link, index) => (
                <button
                  type="button"
                  key={`${link.url}-${index}`}
                  onClick={e => handleLinkClick(link.url, e)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  role="menuitem"
                >
                  <div className="font-medium">{link.label}</div>
                  <div className="w-full truncate text-xs text-gray-500">
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
  return <span className={badgeClasses}>{status}</span>;
};
