import React from 'react';
import { Card } from '@/components/ui/Card';

interface ComparisonRowProps {
  label: string;
  before?: string | React.ReactNode;
  after: string | React.ReactNode;
  isHighlight?: boolean;
}

export const ComparisonRow = ({ label, before, after, isHighlight }: ComparisonRowProps) => {
  return (
    <div className={`grid grid-cols-12 gap-4 py-3 px-4 border-b border-[var(--cds-divider)] last:border-0 ${isHighlight ? 'bg-yellow-50/50' : ''}`}>
      <div className="col-span-4 text-sm text-[var(--cds-text-secondary)] font-medium flex items-center">
        {label}
      </div>
      <div className="col-span-4 text-sm text-[var(--cds-text-primary)] font-mono break-all">
        {before}
      </div>
      <div className="col-span-4 text-sm font-mono break-all flex items-center">
        {isHighlight && <span className="mr-2 text-[var(--cds-warning)]">→</span>}
        <span className={isHighlight ? 'text-[var(--cds-text-primary)] font-semibold' : 'text-[var(--cds-text-primary)]'}>
          {after}
        </span>
      </div>
    </div>
  );
};

interface ComparisonTableProps {
  title?: string;
  children: React.ReactNode;
}

export const ComparisonTable = ({ title, children }: ComparisonTableProps) => {
  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-semibold text-[var(--cds-text-secondary)] uppercase tracking-wider mb-3 ml-1">{title}</h4>}
      <Card padding="none" className="bg-white">
        <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-gray-50 border-b border-[var(--cds-border)] rounded-t-2xl">
          <div className="col-span-4 text-xs font-semibold text-[var(--cds-text-tertiary)] uppercase">Property</div>
          <div className="col-span-4 text-xs font-semibold text-[var(--cds-text-tertiary)] uppercase">Current</div>
          <div className="col-span-4 text-xs font-semibold text-[var(--cds-text-tertiary)] uppercase">Proposed</div>
        </div>
        {children}
      </Card>
    </div>
  );
};

