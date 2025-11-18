import { TaskStatus } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Card, SectionHeader, Badge } from './ui';

const DESCRIPTION_CHAR_LIMIT = 220;

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

const statusTone: Record<TaskStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
  [TaskStatus.Executed]: { tone: 'success', label: 'Executed' },
  [TaskStatus.ReadyToSign]: { tone: 'warning', label: 'Ready to Sign' },
  [TaskStatus.Pending]: { tone: 'neutral', label: 'Pending' },
};

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

  const renderBody = () => {
    if (loading) {
      return (
        <Card className="flex flex-col items-center gap-4 text-center">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-primary-soft)] border-t-[var(--color-primary)]" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">Fetching tasks…</p>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="space-y-4 text-center">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <Button onClick={fetchUpgrades}>Retry</Button>
        </Card>
      );
    }

    if (upgradeOptions.length === 0) {
      return (
        <Card className="text-center text-sm text-[var(--color-text-muted)]">
          No upgrades are waiting for signatures right now.
        </Card>
      );
    }

    return (
      <div className="flex max-h-[480px] flex-col gap-5 overflow-y-auto pr-1 scrollbar-hide">
        {upgradeOptions.map(option => {
          const isSelected = selectedWallet === option.id && selectedNetwork === option.network;
          const isExpanded = !!expandedCards[option.id];
          const isTruncated = option.description.length > DESCRIPTION_CHAR_LIMIT;
          const collapsed = isTruncated && !isExpanded;

          return (
            <Card
              key={`${option.network}-${option.id}`}
              className={`cursor-pointer border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-[var(--color-primary)] shadow-[0_25px_60px_rgba(0,82,255,0.15)]'
                  : 'border-[var(--color-border)] hover:-translate-y-1 hover:border-[var(--color-primary)]/50'
              }`}
              onClick={() => onSelect(option.id, option.network)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(option.id, option.network);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-soft)]">
                    {option.network} • {option.date}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {option.name}
                  </h3>
                </div>
                <StatusBadge status={option.status} executionLinks={option.executionLinks} />
              </div>

              <div className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                <div className={`${collapsed ? 'line-clamp-5' : ''} markdown-content`}>
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
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Badge tone={isSelected ? 'success' : 'neutral'}>
                  {isSelected ? 'Selected' : 'Tap to review'}
                </Badge>

                {isTruncated && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedCards(prev => ({ ...prev, [option.id]: !isExpanded }));
                    }}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <section id="tasks" className="space-y-6 text-left">
      <SectionHeader
        eyebrow="Step 1"
        title="Choose the upgrade to review"
        description="Only tasks marked ready-to-sign are shown. Selecting one locks in the correct network context."
      />
      {renderBody()}
    </section>
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

  const tone = statusTone[status] ?? statusTone[TaskStatus.Pending];

  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    if (executionLinks.length === 1) {
      return (
        <Button
          as="a"
          href={executionLinks[0].url}
          target="_blank"
          rel="noreferrer"
          variant="secondary"
          size="sm"
          onClick={e => {
            e.stopPropagation();
            handleLinkClick(executionLinks[0].url, e);
          }}
        >
          View execution
        </Button>
      );
    }

    return (
      <div ref={dropdownRef} className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={e => {
            e.stopPropagation();
            setShowDropdown(prev => !prev);
          }}
          aria-haspopup="menu"
          aria-expanded={showDropdown}
        >
          {executionLinks.length} receipts
        </Button>
        {showDropdown && (
          <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_18px_40px_rgba(6,20,58,0.15)]">
            {executionLinks.map(link => (
              <button
                type="button"
                key={link.url}
                onClick={e => handleLinkClick(link.url, e)}
                className="block w-full px-4 py-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const resolvedTone =
    tone.tone === 'warning' ? 'warning' : tone.tone === 'success' ? 'success' : 'neutral';
  return <Badge tone={resolvedTone}>{tone.label}</Badge>;
};
