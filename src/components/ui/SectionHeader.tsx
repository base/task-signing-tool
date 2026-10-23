import React from 'react';

export const SectionHeader = ({ title, description }: { title: string; description?: string }) => {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--cds-text-primary)] tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-[var(--cds-text-secondary)] mt-1 text-base leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};
