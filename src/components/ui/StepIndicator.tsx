import React from 'react';

interface StepIndicatorProps {
  steps: {
    id: string;
    label: string;
    status: 'pending' | 'current' | 'completed';
  }[];
}

export const StepIndicator = ({ steps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center w-full py-8">
      <nav aria-label="Progress">
        <ol role="list" className="flex items-center space-x-8">
          {steps.map((step, stepIdx) => (
            <li key={step.id} className="relative">
              {step.status === 'completed' ? (
                <div className="group flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--cds-primary)] group-hover:bg-[var(--cds-primary-hover)] transition-colors">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="ml-3 text-sm font-medium text-[var(--cds-primary)]">{step.label}</span>
                </div>
              ) : step.status === 'current' ? (
                <div className="flex items-center" aria-current="step">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-[var(--cds-primary)] bg-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--cds-primary)]" />
                  </span>
                  <span className="ml-3 text-sm font-medium text-[var(--cds-primary)]">{step.label}</span>
                </div>
              ) : (
                <div className="group flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-[var(--cds-border)] bg-white group-hover:border-gray-400 transition-colors">
                    <span className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-gray-300 transition-colors" />
                  </span>
                  <span className="ml-3 text-sm font-medium text-[var(--cds-text-tertiary)]">{step.label}</span>
                </div>
              )}
              
              {stepIdx !== steps.length - 1 && (
                <div className="absolute top-4 left-full w-8 h-0.5 -ml-px" />
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
};

