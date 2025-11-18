import React from 'react';
import { Header } from './Header';

interface PageShellProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export const PageShell = ({ children, maxWidth = 'max-w-5xl' }: PageShellProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--cds-background)]">
      <Header />
      <main className="flex-1 w-full">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-12 ${maxWidth} transition-all duration-300 ease-in-out`}>
          {children}
        </div>
      </main>
      <footer className="border-t border-[var(--cds-divider)] bg-white py-8 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-xs text-[var(--cds-text-tertiary)]">
            © {new Date().getFullYear()} Coinbase. Internal use only.
          </p>
          <div className="flex gap-4">
             <span className="text-xs text-[var(--cds-text-tertiary)]">v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

