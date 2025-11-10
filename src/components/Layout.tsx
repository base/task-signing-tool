import Image from 'next/image';
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

const maxWidthClassMap = {
  '600px': 'max-w-[600px]',
  '800px': 'max-w-[800px]',
  '900px': 'max-w-[900px]',
  '1200px': 'max-w-[1200px]',
} as const;

export const Layout: React.FC<LayoutProps> = ({ children, maxWidth = '600px' }) => {
  const resolvedMaxWidthClass =
    maxWidth in maxWidthClassMap
      ? maxWidthClassMap[maxWidth as keyof typeof maxWidthClassMap]
      : maxWidthClassMap['600px'];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] px-4 py-8 font-sans">
      <div
        className={`mx-auto w-full transition-[max-width] duration-300 ease-in-out ${resolvedMaxWidthClass}`}
        style={maxWidth in maxWidthClassMap ? undefined : { maxWidth }}
      >
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
            <Image
              src="/base.jpg"
              alt="Base Logo"
              width={120}
              height={120}
              className="rounded-full"
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="mb-8 rounded-[32px] bg-white p-12 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
          {children}
        </div>
      </div>
    </div>
  );
};
