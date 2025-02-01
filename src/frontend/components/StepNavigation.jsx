import React from 'react';

const StepNavigation = ({ currentStep, onStepClick }) => {
  const steps = [
    { number: 1, name: 'Agent Selection', status: 'completed' },
    { number: 2, name: 'Strategy Creation', status: 'current' },
    { number: 3, name: 'Bot Integration', status: 'upcoming' },
    { number: 4, name: 'Wallet Creation', status: 'upcoming' },
    { number: 5, name: 'Key Management', status: 'upcoming' },
    { number: 6, name: 'Status Display', status: 'upcoming' }
  ];

  const getStepStatus = (stepNumber) => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepClasses = (status) => {
    const baseClasses = 'flex items-center';
    switch (status) {
      case 'completed':
        return `${baseClasses} text-green-600`;
      case 'current':
        return `${baseClasses} text-blue-600`;
      default:
        return `${baseClasses} text-gray-500`;
    }
  };

  const getCircleClasses = (status) => {
    const baseClasses = 'flex items-center justify-center w-8 h-8 rounded-full border-2 mr-2';
    switch (status) {
      case 'completed':
        return `${baseClasses} border-green-600 bg-green-100`;
      case 'current':
        return `${baseClasses} border-blue-600 bg-blue-100`;
      default:
        return `${baseClasses} border-gray-300 bg-white`;
    }
  };

  const getLineClasses = (status) => {
    switch (status) {
      case 'completed':
        return 'border-green-600';
      case 'current':
        return 'border-blue-600';
      default:
        return 'border-gray-300';
    }
  };

  return (
    <nav className="relative">
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.number);
          
          return (
            <React.Fragment key={step.number}>
              <button
                className={`relative flex flex-col items-center group ${index === steps.length - 1 ? 'flex-1' : ''}`}
                onClick={() => onStepClick(step.number)}
              >
                <div className={getStepClasses(status)}>
                  <div className={getCircleClasses(status)}>
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>
                  <span className="hidden md:block">{step.name}</span>
                </div>
              </button>

              {index < steps.length - 1 && (
                <div className="flex-auto border-t-2 transition duration-500 ease-in-out mt-4 mx-2 md:mx-4">
                  <div className={`border-t-2 -mt-2 ${getLineClasses(status)}`}></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default StepNavigation;
