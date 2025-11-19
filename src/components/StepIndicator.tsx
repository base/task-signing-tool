import { Fragment } from 'react';
import { Check } from 'lucide-react';

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

  return (
    <div className="flex items-center justify-center mb-12">
      <div className="flex items-center gap-6">
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step];
          const isActive = index <= activeIndex || isComplete;

          return (
            <Fragment key={step}>
              <div className="relative">
                <div
                  className={`relative z-10 h-5 w-5 rounded-full transition-all duration-500 ${
                    isActive
                      ? 'bg-gradient-to-br from-purple-500 to-amber-500 shadow-lg shadow-purple-500/50 scale-110'
                      : 'bg-gray-300'
                  }`}
                >
                  {isComplete && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  {isActive && !isComplete && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-amber-500 animate-pulse opacity-75" />
                  )}
                </div>
              </div>
              {index < SETUP_STEPS.length - 1 && (
                <div
                  className={`h-1 w-16 rounded-full transition-all duration-500 ${
                    isComplete
                      ? 'bg-gradient-to-r from-purple-500 to-amber-500 shadow-md'
                      : 'bg-gray-300'
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
