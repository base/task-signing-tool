import Image from 'next/image';

export function Header() {
  return (
    <header className="mb-10">
      {/* Top bar with logo */}
      <div className="mb-8 flex items-center justify-between border-b pb-6" style={{ borderColor: 'var(--cb-border)' }}>
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 overflow-hidden rounded-xl" style={{ boxShadow: 'var(--cb-shadow-sm)' }}>
            <Image
              src="/base.jpg"
              alt="Base Logo"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--cb-text-primary)' }}>
              Task Signer
            </h1>
            <p className="text-sm" style={{ color: 'var(--cb-text-tertiary)' }}>
              Base Protocol
            </p>
          </div>
        </div>
      </div>

      {/* Page title section */}
      <div className="text-center">
        <h2 className="mb-3 text-4xl font-bold tracking-tight" style={{ color: 'var(--cb-text-primary)' }}>
          Sign Protocol Tasks
        </h2>
        <p className="text-lg" style={{ color: 'var(--cb-text-secondary)' }}>
          Securely review and sign smart contract operations with your Ledger device
        </p>
      </div>
    </header>
  );
}
