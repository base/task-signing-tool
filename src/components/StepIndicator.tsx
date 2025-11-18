import { Fragment } from 'react';

const SETUP_STEPS = [
  { id: 'upgrade', label: 'Select Task' },
  { id: 'user', label: 'Choose Profile' }
] as const;
const HIDDEN_STEPS = new Set(['validation', 'ledger', 'signing']);

type SetupStepId = typeof SETUP_STEPS[number]['id'];
type Step = SetupStepId | 'validation' | 'ledger' | 'signing';

interface StepIndicatorProps {
  currentStep: Step;
  hasNetwork: boolean;
  hasUpgrade: boolean;
  hasUser: boolean;
}

export function StepIndicator({
  currentStep,
  hasNetwork,
  hasUpgrade,
  hasUser,
}: StepIndicatorProps) {
  if (HIDDEN_STEPS.has(currentStep)) return null;

  const activeStepId = currentStep as SetupStepId;
  const activeIndex = SETUP_STEPS.findIndex(s => s.id === activeStepId);

  const completionMap: Record<SetupStepId, boolean> = {
    upgrade: hasUpgrade,
    user: hasUser,
  };

  return (
    <div className="mb-12 flex items-center justify-center">
      <div className="inline-flex items-center gap-3 rounded-full px-6 py-4" style={{ 
        background: 'var(--cb-surface)',
        border: '1px solid var(--cb-border)',
        boxShadow: 'var(--cb-shadow-sm)'
      }}>
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step.id];
          const isCurrent = index === activeIndex;
          const isPast = index < activeIndex || isComplete;

          return (
            <Fragment key={step.id}>
              <div className="flex items-center gap-2">
                {/* Step circle */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                    isComplete
                      ? 'scale-100'
                      : isCurrent
                      ? 'scale-110'
                      : 'scale-100'
                  }`}
                  style={{
                    background: isPast ? 'var(--cb-primary)' : 'var(--cb-surface)',
                    border: isPast ? 'none' : '2px solid var(--cb-border)',
                    color: isPast ? 'white' : 'var(--cb-text-tertiary)'
                  }}
                >
                  {isComplete ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                
                {/* Step label */}
                <span 
                  className="text-sm font-medium"
                  style={{ 
                    color: isPast ? 'var(--cb-text-primary)' : 'var(--cb-text-tertiary)'
                  }}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connector line */}
              {index < SETUP_STEPS.length - 1 && (
                <div
                  className="mx-2 h-0.5 w-12 rounded-full transition-all duration-200"
                  style={{
                    background: isComplete ? 'var(--cb-primary)' : 'var(--cb-border)'
                  }}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
