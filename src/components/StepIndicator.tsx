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

const STEP_LABELS: Record<SetupStep, string> = {
  upgrade: 'Select Task',
  user: 'Select Profile',
};

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
    <div className="mb-12">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-4">
          {SETUP_STEPS.map((step, index) => {
            const isComplete = completionMap[step];
            const isActive = index === activeIndex;
            const isPast = index < activeIndex || isComplete;

            return (
              <Fragment key={step}>
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isComplete
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isActive
                          ? 'border-blue-600 bg-white text-blue-600 ring-4 ring-blue-100'
                          : isPast
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isComplete ? (
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
                      isActive || isComplete ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </div>
                {index < SETUP_STEPS.length - 1 && (
                  <div className="relative mx-2 h-0.5 w-16">
                    <div className="absolute inset-0 bg-gray-200 rounded-full" />
                    <div
                      className={`absolute inset-0 rounded-full transition-all duration-500 ${
                        isComplete ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      style={{ width: isComplete ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
