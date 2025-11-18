import Image from 'next/image';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '900px' }: LayoutProps) {
  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Clean, subtle background */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/30" />
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle, #0052FF 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto w-full px-4 py-12 sm:px-6 lg:px-8">
        <div
          className="mx-auto w-full transition-all duration-300 ease-in-out"
          style={{ maxWidth }}
        >
          {/* Logo */}
          <div className="mb-12 flex justify-center">
            <div className="relative">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 transition-transform duration-200 hover:scale-105">
                <Image
                  src="/base.jpg"
                  alt="Base Logo"
                  width={80}
                  height={80}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200 sm:p-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
