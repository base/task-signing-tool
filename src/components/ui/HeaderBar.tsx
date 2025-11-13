import { ReactNode } from 'react';

interface HeaderBarProps {
  title?: string;
  right?: ReactNode;
  subtitle?: string;
}

export function HeaderBar({ title = 'Task Signer', subtitle, right }: HeaderBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4 md:px-6 h-14">
      <div className="flex min-w-0 flex-col">
        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}


