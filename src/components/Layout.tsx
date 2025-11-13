import Image from 'next/image';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '600px' }: LayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 font-sans bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div
        className="relative z-10 mx-auto w-full transition-[max-width] duration-300 ease-out animate-fadeIn"
        style={{ maxWidth }}
      >
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="group relative">
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:shadow-xl hover:scale-105">
              <Image
                src="/base.jpg"
                alt="Base Logo"
                width={96}
                height={96}
                className="rounded-2xl"
              />
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5">
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
