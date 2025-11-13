import Image from 'next/image';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '800px' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto w-full px-4 py-12 transition-[max-width] duration-300" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}
