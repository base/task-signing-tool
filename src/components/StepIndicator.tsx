import { Fragment } from 'react';

const SETUP_STEPS = ['upgrade', 'user'] as const;
const STEP_LABELS: Record<typeof SETUP_STEPS[number], string> = {
  upgrade: 'Select Task',
  user: 'Select Profile',
};
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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step];
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;

          return (
            <Fragment key={step}>
              <div className="flex flex-col items-center flex-1">
                <div className="relative mb-2">
                  <div
                    className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isComplete || isPast
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
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
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive || isComplete || isPast ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < SETUP_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-6">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isComplete || isPast ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
