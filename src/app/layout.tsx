import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Task Signer Tool',
  description: 'A utility for improving the signer UX in Base smart contract ops processes',
  icons: {
    icon: '/base.jpg',
    shortcut: '/base.jpg',
    apple: '/base.jpg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text)]">
          <div className="relative isolate min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute inset-y-0 left-1/2 h-[120%] w-[70%] -translate-x-1/2 rounded-[40%] bg-[radial-gradient(circle_at_top,var(--color-primary-transparent),transparent_60%)] blur-3xl" />
              <div className="absolute top-0 right-0 h-[50%] w-[40%] rounded-full bg-[radial-gradient(circle,var(--color-accent-transparent),transparent_60%)] blur-3xl" />
            </div>
            <div className="relative flex min-h-screen flex-col">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
