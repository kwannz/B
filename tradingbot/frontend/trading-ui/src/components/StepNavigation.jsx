import React from 'react';

const steps = [
  { id: 1, title: 'Agent Selection', description: 'Select trading or DeFi agent' },
  { id: 2, title: 'Strategy Creation', description: 'Create and configure strategy' },
  { id: 3, title: 'Bot Integration', description: 'Initialize trading bot' },
  { id: 4, title: 'Wallet Creation', description: 'Setup trading wallets' },
  { id: 5, title: 'Key Management', description: 'Secure key storage' },
  { id: 6, title: 'Status Display', description: 'Monitor performance' },
];

const StepNavigation = ({ currentStep, onStepClick }) => {
  return (
    <nav className="px-4 py-3">
      <ol className="flex items-center w-full">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center ${
              step.id !== steps.length ? 'w-full' : ''
            }`}
          >
            <button
              onClick={() => onStepClick(step.id)}
              className={`flex items-center ${
                currentStep === step.id
                  ? 'text-blue-600'
                  : currentStep > step.id
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}
            >
              <span
                className={`flex items-center justify-center w-8 h-8 border-2 rounded-full ${
                  currentStep === step.id
                    ? 'border-blue-600'
                    : currentStep > step.id
                    ? 'border-green-600'
                    : 'border-gray-500'
                }`}
              >
                {currentStep > step.id ? '✓' : step.id}
              </span>
              <span className="hidden sm:inline-flex ml-2">{step.title}</span>
            </button>
            {step.id !== steps.length && (
              <div
                className={`w-full h-0.5 ml-2 mr-2 ${
                  currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StepNavigation;
