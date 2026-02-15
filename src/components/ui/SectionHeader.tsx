import React from 'react';

export const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => {
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
      {action && <div className="ml-4 pb-1">{action}</div>}
    </div>
  );
};
