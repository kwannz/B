import React, { useState, useEffect } from 'react';
import StepNavigation from './components/StepNavigation';
import AgentSelection from './components/steps/AgentSelection';
import StrategyCreation from './components/steps/StrategyCreation';
import BotIntegration from './components/steps/BotIntegration';
import WalletCreation from './components/steps/WalletCreation';
import KeyManagement from './components/steps/KeyManagement';
import StatusDisplay from './components/steps/StatusDisplay';

const App = () => {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('currentStep');
    return saved ? parseInt(saved, 10) : 1;
  });
  
  const [workflowData, setWorkflowData] = useState(() => {
    const saved = localStorage.getItem('workflowData');
    return saved ? JSON.parse(saved) : {
      selectedAgent: null,
      strategy: null,
      botStatus: null,
      walletInfo: null,
      keyStatus: null,
    };
  });

  useEffect(() => {
    localStorage.setItem('currentStep', currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('workflowData', JSON.stringify(workflowData));
  }, [workflowData]);

  const handleStepComplete = (step, data) => {
    setWorkflowData(prev => ({ ...prev, ...data }));
    setCurrentStep(step + 1);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <AgentSelection
            onSelect={(agentType) =>
              handleStepComplete(1, { selectedAgent: agentType })
            }
          />
        );
      case 2:
        return (
          <StrategyCreation
            agentType={workflowData.selectedAgent}
            onSubmit={(strategy) =>
              handleStepComplete(2, { strategy })
            }
          />
        );
      case 3:
        return (
          <BotIntegration
            strategy={workflowData.strategy}
            onComplete={(botStatus) =>
              handleStepComplete(3, { botStatus })
            }
          />
        );
      case 4:
        return (
          <WalletCreation
            onComplete={(walletInfo) =>
              handleStepComplete(4, { walletInfo })
            }
          />
        );
      case 5:
        return (
          <KeyManagement
            walletInfo={workflowData.walletInfo}
            onComplete={(keyStatus) =>
              handleStepComplete(5, { keyStatus })
            }
          />
        );
      case 6:
        return <StatusDisplay botInfo={workflowData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Trading Bot Setup
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <StepNavigation
          currentStep={currentStep}
          onStepClick={(step) => {
            // Only allow going back to completed steps
            if (step < currentStep) {
              setCurrentStep(step);
            }
          }}
        />
        <div className="mt-8">{renderCurrentStep()}</div>
      </main>
    </div>
  );
};

export default App;
