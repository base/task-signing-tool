import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STATUS_CLASS_MAP: Record<TaskStatus, string> = {
  [TaskStatus.Executed]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TaskStatus.ReadyToSign]: 'border-amber-200 bg-amber-50 text-amber-700',
  [TaskStatus.Pending]: 'border-gray-200 bg-gray-50 text-gray-600',
};

const BADGE_BASE_CLASSES =
  'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200';
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
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-blue-600" />
        <p className="mt-4 text-sm font-medium text-gray-600">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchUpgrades}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-500">No tasks ready to sign</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">
        Select Task
      </h2>

      <div className="flex max-h-[500px] flex-col gap-3 overflow-y-auto pr-1 scrollbar-hide">
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
              className={`upgrade-card group relative w-full cursor-pointer rounded-xl p-5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? 'border-2 border-blue-600 bg-blue-600 text-white shadow-lg'
                  : 'border border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-md'
              }`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1.5 text-lg font-semibold leading-tight">{option.name}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={isSelected ? 'text-blue-100' : 'text-gray-500'}>
                      {option.date}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {option.network.charAt(0).toUpperCase() + option.network.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <StatusBadge status={option.status} executionLinks={option.executionLinks} />
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 font-semibold text-sm">
                      ✓
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`relative text-sm leading-relaxed ${
                  isSelected ? 'text-blue-50' : 'text-gray-600'
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
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 ${
                      isSelected
                        ? 'bg-gradient-to-b from-transparent to-blue-600'
                        : 'bg-gradient-to-b from-transparent to-white'
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
                  className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
                    isSelected
                      ? 'border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/80'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 focus-visible:ring-blue-500'
                  }`}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>
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
          className={`${badgeClasses} cursor-pointer hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
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
          className={`${badgeClasses} cursor-pointer hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
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
            className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
            role="menu"
          >
            <div className="py-1">
              {executionLinks.map((link, index) => (
                <button
                  type="button"
                  key={`${link.url}-${index}`}
                  onClick={e => handleLinkClick(link.url, e)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
