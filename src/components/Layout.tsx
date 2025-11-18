import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-12 lg:px-0">
      <div className="mb-8 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)]/90 p-4 shadow-[0_20px_60px_rgba(6,20,58,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-lg font-semibold text-[var(--color-primary)] shadow-inner">
              CB
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-text-soft)]">
                Signing Workspace
              </p>
              <p className="text-lg font-semibold text-[var(--color-text)]">Base Task Signing Console</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">
              <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden />
              Secure session
            </span>
            <span className="text-xs text-[var(--color-text-soft)]">Last audit refreshed moments ago</span>
          </div>
        </div>
      </div>

      <div className="space-y-10">{children}</div>
    </div>
  );
}
