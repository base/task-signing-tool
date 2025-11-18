import React from 'react';
import Link from 'next/link';
import { Badge } from './Badge';

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--cds-divider)] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-full bg-[var(--cds-primary)] flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--cds-text-primary)] tracking-tight group-hover:text-[var(--cds-primary)] transition-colors">
              Signer Tool
            </span>
          </Link>
          <div className="h-6 w-px bg-[var(--cds-divider)] hidden sm:block" />
          <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">Internal</Badge>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex gap-6">
            <a href="#" className="text-sm font-medium text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] transition-colors">
              Documentation
            </a>
            <a href="#" className="text-sm font-medium text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] transition-colors">
              Support
            </a>
          </nav>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm ring-2 ring-white" />
        </div>
      </div>
    </header>
  );
};

