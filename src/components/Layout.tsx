import Image from 'next/image';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  maxWidth?: string;
};

export function Layout({ children, maxWidth = '600px' }: LayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 font-sans">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(212,175,55,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_70%)]" />
      </div>

      {/* Animated mesh gradient overlay */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-purple-500/20 via-transparent to-amber-500/20 animate-shimmer" />
      </div>

      {/* Floating particles effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 blur-sm animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${Math.random() * 4 + 4}s`,
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 mx-auto w-full transition-[max-width] duration-500 ease-in-out"
        style={{ maxWidth }}
      >
        {/* Logo with premium styling */}
        <div className="mb-10 flex justify-center">
          <div className="group relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-amber-400 opacity-75 blur-lg transition duration-300 group-hover:opacity-100 group-hover:blur-xl animate-pulse-glow" />
            <div className="relative flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white via-purple-50 to-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] ring-4 ring-white/20 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/base.jpg"
                alt="Base Logo"
                width={140}
                height={140}
                className="rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Main Card with glassmorphism */}
        <div className="relative mb-8 overflow-hidden rounded-[40px] bg-white/95 p-12 shadow-[0_25px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl ring-1 ring-white/20 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/50 before:via-transparent before:to-transparent before:opacity-50">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-amber-500/5 pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
