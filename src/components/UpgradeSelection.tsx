import { Upgrade } from '@/lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownText } from './MarkdownText';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SectionHeader } from './ui/SectionHeader';

interface UpgradeSelectionProps {
  onSelect: (upgrade: Upgrade) => void;
}

export const UpgradeSelection: React.FC<UpgradeSelectionProps> = ({ onSelect }) => {
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
          className="text-sm font-semibold text-[var(--cds-primary)] hover:underline focus:outline-none focus-visible:underline cursor-pointer"
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
      <SectionHeader title="Select Task" description="Choose a task to validate and sign." />

      <div className="space-y-4">
        {upgradeOptions.map(option => {
          const optionKey = `${option.network}-${option.id}`;
          const isExpanded = !!expandedCards[optionKey];

          return (
            <Card
              key={optionKey}
              interactive
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
                    <MarkdownText>{option.description}</MarkdownText>
                  </div>

                  {option.description.length > 150 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedCards(prev => ({ ...prev, [optionKey]: !isExpanded }));
                      }}
                      className="mt-2 text-xs font-medium text-[var(--cds-primary)] hover:text-[var(--cds-primary-hover)] focus:outline-none focus-visible:underline cursor-pointer"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <Badge variant="warning">{option.status}</Badge>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
