import { TaskStatus, Upgrade, ExecutionLink } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SectionHeader } from './ui/SectionHeader';

const STATUS_VARIANT_MAP: Record<TaskStatus, 'success' | 'warning' | 'neutral'> = {
  [TaskStatus.Executed]: 'success',
  [TaskStatus.ReadyToSign]: 'warning',
  [TaskStatus.Pending]: 'neutral',
};

interface UpgradeSelectionProps {
  selectedWallet: string | null;
  selectedNetwork: string | null;
  onSelect: (upgrade: Upgrade) => void;
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
      const response = await fetch(`/api/upgrades?readyToSign=true`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status} ${response.statusText}`);
      }

      const upgrades: Upgrade[] = await response.json();
      setUpgradeOptions(upgrades);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to load upgrades: ${message}`);
      console.error('Error fetching upgrades:', err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUpgrades();
    return () => abortControllerRef.current?.abort();
  }, [fetchUpgrades]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--cds-primary)] border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-[var(--cds-text-secondary)]">
          Loading available tasks...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <div className="mb-4 rounded-full bg-red-50 p-3">
          <svg
            className="h-6 w-6 text-[var(--cds-error)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="mb-4 text-sm font-medium text-[var(--cds-text-primary)]">{error}</p>
        <button
          onClick={fetchUpgrades}
          className="text-sm font-semibold text-[var(--cds-primary)] hover:underline cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  if (upgradeOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px] bg-white rounded-2xl border border-[var(--cds-border)] border-dashed">
        <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <svg
            className="h-6 w-6 text-[var(--cds-text-tertiary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">No tasks found</h3>
        <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
          There are no tasks currently ready to sign.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <SectionHeader
        title="Select Task"
        description="Choose a task to validate and sign. Tasks are fetched from the configured repositories."
      />

      <div className="space-y-4">
        {upgradeOptions.map(option => {
          const isSelected = selectedWallet === option.id && selectedNetwork === option.network;
          const isExpanded = !!expandedCards[option.id];

          return (
            <Card
              key={`${option.network}-${option.id}`}
              interactive
              selected={isSelected}
              onClick={() => onSelect(option)}
              className="relative group"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge
                      variant="neutral"
                      size="sm"
                      className="uppercase tracking-wider text-[10px] font-bold"
                    >
                      {option.network}
                    </Badge>
                    <span className="text-xs text-[var(--cds-text-tertiary)]">{option.date}</span>
                  </div>

                  <h3 className="text-lg font-semibold text-[var(--cds-text-primary)] mb-2 truncate">
                    {option.name}
                  </h3>

                  <div
                    className={`text-sm text-[var(--cds-text-secondary)] ${
                      !isExpanded ? 'line-clamp-2' : ''
                    }`}
                  >
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--cds-primary)] underline font-medium hover:text-[var(--cds-primary-hover)] break-all"
                            onClick={e => e.stopPropagation()}
                          />
                        ),
                        p: ({ ...props }) => (
                          <p {...props} className="mb-2 last:mb-0 leading-relaxed" />
                        ),
                        ul: ({ ...props }) => (
                          <ul {...props} className="list-disc list-inside mb-2 space-y-1" />
                        ),
                        ol: ({ ...props }) => (
                          <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />
                        ),
                        li: ({ ...props }) => <li {...props} className="ml-1" />,
                        code: ({ ...props }) => (
                          <code
                            {...props}
                            className="text-[var(--cds-text-primary)] bg-gray-100 px-1 py-0.5 rounded font-mono text-xs"
                          />
                        ),
                        pre: ({ ...props }) => (
                          <pre
                            {...props}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto my-2 text-xs text-[var(--cds-text-primary)] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
                          />
                        ),
                      }}
                    >
                      {option.description}
                    </Markdown>
                  </div>

                  {option.description.length > 150 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedCards(prev => ({ ...prev, [option.id]: !isExpanded }));
                      }}
                      className="mt-2 text-xs font-medium text-[var(--cds-primary)] hover:text-[var(--cds-primary-hover)] focus:outline-none cursor-pointer"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <StatusBadge status={option.status} executionLinks={option.executionLinks} />
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-[var(--cds-primary)] text-white flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
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
  if (!status) return null;

  const variant = STATUS_VARIANT_MAP[status] || 'neutral';

  if (status === TaskStatus.Executed && executionLinks && executionLinks.length > 0) {
    return (
      <div className="relative group/dropdown">
        <Badge variant={variant} className="cursor-pointer hover:opacity-80">
          {status} {executionLinks.length > 1 && `(${executionLinks.length})`}
          <svg
            className="ml-1 w-3 h-3 inline-block"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </Badge>

        <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-white rounded-md shadow-lg border border-gray-100 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all duration-200 z-10">
          {executionLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={e => e.stopPropagation()}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return <Badge variant={variant}>{status}</Badge>;
};
