import { Button, Card, SectionHeader } from './ui';

export function Header() {
  return (
    <Card
      className="overflow-hidden border-none bg-[radial-gradient(circle_at_top,_rgba(0,82,255,0.25),_transparent_60%),_linear-gradient(135deg,_#041436,_#0b1c3d)] text-white"
      padding="lg"
    >
      <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
        <div className="flex-1">
          <SectionHeader
            eyebrow="Base security"
            title="Sign critical tasks with confidence."
            description="A guided workspace for secure reviewers to validate upgrades, confirm every delta, and sign with hardware assurance."
            className="text-white [&>div>p]:text-white/80 [&>div>h2]:text-white"
          />

          <div className="mt-8 flex flex-wrap gap-3">
            <Button as="a" href="#tasks">
              Begin validation
            </Button>
            <Button
              as="a"
              href="https://docs.base.org"
              target="_blank"
              rel="noreferrer"
              variant="secondary"
            >
              View signing playbook
            </Button>
          </div>

          <dl className="mt-10 grid gap-6 text-sm sm:grid-cols-3">
            {[
              { label: 'Networks monitored', value: 'Base L1 / L2' },
              { label: 'Ledger ready', value: 'EIP-712 signing' },
              { label: 'Audit trails', value: 'Deterministic outputs' },
            ].map(item => (
              <div key={item.label}>
                <dt className="text-white/60">{item.label}</dt>
                <dd className="text-base font-semibold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="w-full rounded-3xl border border-white/20 bg-white/10 p-6 text-sm text-white/80 backdrop-blur md:max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            Audit snapshot
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">Signer checklist</p>
          <ul className="mt-6 space-y-4">
            {['Validate state diffs', 'Confirm addresses & keys', 'Sign through Ledger Live'].map(
              item => (
                <li key={item} className="flex items-center gap-3 text-base">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white">
                    ✓
                  </span>
                  {item}
                </li>
              )
            )}
          </ul>
          <p className="mt-8 text-xs text-white/60">Designed for Coinbase signers</p>
        </div>
      </div>
    </Card>
  );
}
