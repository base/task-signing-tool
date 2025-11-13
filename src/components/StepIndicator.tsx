import { Fragment } from 'react';

const SETUP_STEPS = ['upgrade', 'user'] as const;
const HIDDEN_STEPS = new Set(['validation', 'ledger', 'signing']);

type SetupStep = (typeof SETUP_STEPS)[number];
type Step = SetupStep | 'validation' | 'ledger' | 'signing';

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

  const activeStep = currentStep as SetupStep;
  const activeIndex = SETUP_STEPS.indexOf(activeStep);

  const completionMap: Record<SetupStep, boolean> = {
    upgrade: hasUpgrade,
    user: hasUser,
  };

  const stepLabels = {
    upgrade: 'Select Task',
    user: 'Select Profile',
  };

  return (
    <div className="mb-10 flex items-center justify-center">
      <div className="flex items-center gap-4">
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step];
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;

          return (
            <Fragment key={step}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isComplete
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isActive
                        ? 'border-blue-600 bg-white text-blue-600'
                        : isPast
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive || isComplete ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {stepLabels[step]}
                </span>
              </div>
              {index < SETUP_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-12 transition-all ${
                    isComplete ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
