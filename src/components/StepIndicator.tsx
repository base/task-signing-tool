import { Fragment } from 'react';

const SETUP_STEPS = ['network', 'upgrade', 'user'] as const;
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
    network: hasNetwork,
    upgrade: hasUpgrade,
    user: hasUser,
  };

  return (
    <div className="flex items-center justify-center mb-12">
      <div className="flex items-center gap-4">
        {SETUP_STEPS.map((step, index) => {
          const isComplete = completionMap[step];
          const isActive = index <= activeIndex || isComplete;

          return (
            <Fragment key={step}>
              <div
                className={`h-3 w-3 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-gray-300'}`}
              />
              {index < SETUP_STEPS.length - 1 && (
                <div className={`h-0.5 w-12 ${isComplete ? 'bg-indigo-500' : 'bg-gray-300'}`} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
