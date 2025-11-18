const STEPS = [
  { id: 'upgrade', title: 'Task', description: 'Select upgrade + network' },
  { id: 'user', title: 'Profile', description: 'Choose signer config' },
  { id: 'validation', title: 'Validate', description: 'Review diffs & deltas' },
  { id: 'ledger', title: 'Sign', description: 'Authorize via Ledger' },
  { id: 'signing', title: 'Confirm', description: 'Capture evidence' },
] as const;

type Step = (typeof STEPS)[number]['id'];

interface StepIndicatorProps {
  currentStep: Step;
  hasNetwork: boolean;
  hasUpgrade: boolean;
  hasUser: boolean;
}

const completionRules: Record<Step, (flags: Pick<StepIndicatorProps, 'hasNetwork' | 'hasUpgrade' | 'hasUser'>) => boolean> =
  {
    upgrade: ({ hasUpgrade }) => hasUpgrade,
    user: ({ hasUser }) => hasUser,
    validation: () => false,
    ledger: () => false,
    signing: () => false,
  };

export function StepIndicator({ currentStep, hasNetwork, hasUpgrade, hasUser }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex(step => step.id === currentStep);

  return (
    <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_18px_40px_rgba(6,20,58,0.05)]">
      <ol className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = completionRules[step.id]({ hasNetwork, hasUpgrade, hasUser });
          const isPast = index < currentIndex;

          return (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-2xl border border-transparent px-3 py-2"
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl text-xs font-semibold ${
                  isComplete
                    ? 'bg-[var(--color-primary)] text-white'
                    : isPast
                      ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'bg-[var(--color-surface-muted)] text-[var(--color-text-soft)]'
                }`}
              >
                {isComplete ? '✓' : index + 1}
              </span>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isActive
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text)]'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
