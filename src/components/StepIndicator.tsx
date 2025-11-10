import React from 'react';

interface StepIndicatorProps {
  currentStep: string;
  hasNetwork: boolean;
  hasWallet: boolean;
  hasUser: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  hasNetwork,
  hasWallet,
  hasUser,
}) => {
  if (currentStep === 'validation' || currentStep === 'ledger' || currentStep === 'signing')
    return null;

  const steps = [
    { key: 'network', completed: hasNetwork },
    { key: 'upgrade', completed: hasWallet },
    { key: 'user', completed: hasUser },
  ];

  return (
    <div className="flex items-center justify-center mb-12">
      <div className="flex items-center gap-4">
        {steps.map((step, index) => {
          const isActive = currentStep === step.key || step.completed;
          return (
            <React.Fragment key={step.key}>
              <div
                className={`h-3 w-3 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-gray-300'}`}
              />
              {index < steps.length - 1 && (
                <div className={`h-0.5 w-12 ${step.completed ? 'bg-indigo-500' : 'bg-gray-300'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
