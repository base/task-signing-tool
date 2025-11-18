import React from 'react';

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--cds-divider)] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-[var(--cds-primary)] flex items-center justify-center text-white font-bold text-lg"></div>
          <span className="text-lg font-bold text-[var(--cds-text-primary)] tracking-tight">
            Base Task Signer Tool
          </span>
        </div>
      </div>
    </header>
  );
};
