import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

const STATUS_VARIANT_MAP: Record<TaskStatus, 'success' | 'warning' | 'info'> = {
  [TaskStatus.Executed]: 'success',
  [TaskStatus.ReadyToSign]: 'warning',
  [TaskStatus.Pending]: 'info',
};

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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="mt-4 text-base font-medium text-gray-600">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 max-w-md">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
        <Button onClick={fetchUpgrades} disabled={loading}>
          Retry
        </Button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-base text-gray-500">No tasks ready to sign</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
        Select Task
      </h2>

      <div className="flex max-h-[600px] flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
        {upgradeOptions.map(option => {
          const isSelected = selectedWallet === option.id && selectedNetwork === option.network;
          const isExpanded = !!expandedCards[option.id];
          const isTruncated = option.description.length > DESCRIPTION_CHAR_LIMIT;
          const collapsed = isTruncated && !isExpanded;

          return (
            <Card
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
              interactive
              elevated={isSelected}
              className={`relative p-6 transition-all duration-200 focus-ring ${
                isSelected
                  ? 'border-2 border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                  : 'hover:border-gray-300'
              }`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className={`mb-2 text-xl font-bold leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {option.name}
                  </div>
                  <div className="mb-1 flex items-center gap-3">
                    <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                      {option.date}
                    </div>
                    <Badge variant="info" size="sm">
                      {option.network.charAt(0).toUpperCase() + option.network.slice(1)}
                    </Badge>
                  </div>
                </div>

                <StatusBadge status={option.status} executionLinks={option.executionLinks} />
              </div>

              <div className={`relative text-sm leading-relaxed ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
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
                          className="text-blue-600 hover:text-blue-700 underline"
                        />
                      ),
                    }}
                  >
                    {option.description}
                  </Markdown>
                </div>

                {collapsed && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-white" />
                )}
              </div>

              {isTruncated && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedCards(prev => ({ ...prev, [option.id]: !isExpanded }));
                  }}
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-ring ${
                    isSelected
                      ? 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less description' : 'Show full description'}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>
              )}

              {isSelected && (
                <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </Card>
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

  const variant = STATUS_VARIANT_MAP[status] ?? 'info';

  // If it's executed and has links
  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    // Single link - make the badge clickable
    if (executionLinks.length === 1) {
      return (
        <button
          type="button"
          onClick={e => handleLinkClick(executionLinks[0].url, e)}
          title={`View transaction: ${executionLinks[0].label}`}
          className="focus-ring"
        >
          <Badge variant={variant}>{status}</Badge>
        </button>
      );
    }

    // Multiple links - toggle dropdown on click
    return (
      <div ref={dropdownRef} className="relative inline-block">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setShowDropdown(prev => !prev);
          }}
          className="focus-ring"
          aria-haspopup="menu"
          aria-expanded={showDropdown}
        >
          <Badge variant={variant}>
            {status} ({executionLinks.length})
          </Badge>
        </button>

        {showDropdown && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg"
            role="menu"
          >
            <div className="py-1">
              {executionLinks.map((link, index) => (
                <button
                  type="button"
                  key={`${link.url}-${index}`}
                  onClick={e => handleLinkClick(link.url, e)}
                  className="flex w-full flex-col items-start px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus-ring-inset"
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
  return <Badge variant={variant}>{status}</Badge>;
};
