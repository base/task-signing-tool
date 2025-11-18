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
        <div
          className={`mx-auto px-4 sm:px-6 lg:px-8 py-12 ${maxWidth} transition-all duration-300 ease-in-out`}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
