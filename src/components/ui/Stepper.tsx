import { ReactNode } from 'react';

export type StepId = 'upgrade' | 'user' | 'validation' | 'ledger' | 'signing';

interface StepperStep {
  id: StepId;
  label: string;
  allowed: boolean;
  onClick?: () => void;
}

interface StepperProps {
  current: StepId;
  steps: StepperStep[];
}

export function Stepper({ current, steps }: StepperProps) {
  return (
    <nav aria-label="Progress" className="hidden md:block">
      <ol className="m-0 list-none p-0 space-y-2">
        {steps.map((step, idx) => {
          const isActive = step.id === current;
          const isComplete = steps.findIndex(s => s.id === current) > idx;
          const base = 'flex items-center gap-3 rounded-lg px-3 py-2';
          const state = isActive
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : isComplete
            ? 'bg-white text-slate-700 border border-slate-200'
            : 'bg-white text-slate-500 border border-slate-200';
          const content = (
            <>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? 'bg-indigo-600 text-white' : isComplete ? 'bg-slate-200' : 'bg-slate-100'
                }`}
              >
                {idx + 1}
              </span>
              <span className="text-sm font-medium">{step.label}</span>
            </>
          );

          return (
            <li key={step.id}>
              {step.allowed && step.onClick ? (
                <button
                  type="button"
                  className={`${base} ${state} w-full text-left hover:bg-slate-50`}
                  onClick={step.onClick}
                >
                  {content}
                </button>
              ) : (
                <div className={`${base} ${state}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


