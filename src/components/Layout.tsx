import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '1200px' }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cb-background)' }}>
      {/* Main content area */}
      <main className="mx-auto w-full px-6 py-8 transition-[max-width] duration-300" style={{ maxWidth }}>
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
