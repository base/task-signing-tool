import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STATUS_CLASS_MAP: Record<TaskStatus, string> = {
  [TaskStatus.Executed]: 'border-emerald-300 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-800 shadow-sm',
  [TaskStatus.ReadyToSign]: 'border-amber-300 bg-gradient-to-r from-amber-100 to-amber-50 text-amber-900 shadow-sm',
  [TaskStatus.Pending]: 'border-gray-300 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-800 shadow-sm',
};

const BADGE_BASE_CLASSES =
  'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 shadow-sm';
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
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-3 border-gray-300 border-t-blue-600" />
        <p className="mt-4 text-sm font-medium text-gray-600">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchUpgrades}
          disabled={loading}
          className="btn-primary"
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
    <div>
      <h2 className="mb-6 text-center text-2xl font-semibold text-gray-900">
        Select Task
      </h2>

      <div className="flex max-h-[500px] flex-col gap-3 overflow-y-auto scrollbar-thin">
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
              className={`upgrade-card relative w-full cursor-pointer rounded-xl p-6 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? 'border-2 border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border border-gray-300 bg-white text-gray-900 shadow-sm hover:border-gray-400 hover:shadow-md'
              }`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 text-lg font-semibold">{option.name}</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-xs font-medium ${
                        isSelected ? 'text-white/90' : 'text-gray-500'
                      }`}
                    >
                      {option.date}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {option.network.charAt(0).toUpperCase() + option.network.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <StatusBadge status={option.status} executionLinks={option.executionLinks} />
                  {isSelected && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`relative text-sm leading-relaxed ${
                  isSelected ? 'text-white/95' : 'text-gray-700'
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
                  className={`mt-2 inline-flex items-center gap-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
                    isSelected
                      ? 'text-white hover:text-white/80 focus-visible:ring-white'
                      : 'text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500'
                  }`}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <svg
                    className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
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
