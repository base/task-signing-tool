import Image from 'next/image';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '600px' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div
        className="mx-auto w-full transition-[max-width] duration-300 ease-in-out"
        style={{ maxWidth }}
      >
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-105">
            <Image
              src="/base.jpg"
              alt="Base Logo"
              width={80}
              height={80}
              className="rounded-2xl"
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 animate-fadeIn">
          {children}
        </div>
      </div>
    </div>
  );
}
