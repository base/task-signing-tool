import { Fragment } from 'react';

const SETUP_STEPS = ['upgrade', 'user'] as const;
const HIDDEN_STEPS = new Set(['validation', 'ledger', 'signing']);
const STEP_LABELS: Record<string, string> = {
  upgrade: 'Select Task',
  user: 'Select Profile',
};

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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-4">
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step];
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;

          return (
            <Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isComplete || isPast
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isActive
                        ? 'border-blue-600 bg-white text-blue-600'
                        : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isComplete || isPast ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isComplete || isPast || isActive ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < SETUP_STEPS.length - 1 && (
                <div
                  className={`mb-6 h-0.5 w-16 transition-all ${
                    isComplete || isPast ? 'bg-blue-600' : 'bg-gray-300'
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
