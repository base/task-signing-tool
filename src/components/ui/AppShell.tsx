import { ReactNode } from 'react';
import { HeaderBar } from './HeaderBar';

interface AppShellProps {
  sidebar: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, headerRight, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <HeaderBar right={headerRight} />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">
          <aside>{sidebar}</aside>
          <main>
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}


