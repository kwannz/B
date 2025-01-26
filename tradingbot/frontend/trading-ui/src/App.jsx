import React, { useState, useEffect } from 'react';
import StepNavigation from './components/StepNavigation';
import AgentSelection from './components/steps/AgentSelection';
import StrategyCreation from './components/steps/StrategyCreation';
import BotIntegration from './components/steps/BotIntegration';
import WalletCreation from './components/steps/WalletCreation';
import KeyManagement from './components/steps/KeyManagement';
import StatusDisplay from './components/steps/StatusDisplay';

const App = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [workflowData, setWorkflowData] = useState({
    selectedAgent: null,
    strategy: null,
    botStatus: null,
    walletInfo: null,
    keyStatus: null,
  });

  useEffect(() => {
    console.log('Current workflow data:', JSON.stringify(workflowData, null, 2));
  }, [workflowData]);

  const handleStepComplete = (step, data) => {
    console.log('Step completed:', step, 'Data:', JSON.stringify(data, null, 2));
    
    setWorkflowData(prev => {
      const newData = { ...prev };
      
      switch (step) {
        case 1:
          newData.selectedAgent = data;
          setCurrentStep(2);
          break;
        case 2:
          newData.strategy = data;
          setCurrentStep(3);
          break;
        case 3:
          newData.botStatus = data;
          setCurrentStep(4);
          break;
        case 4:
          newData.walletInfo = data;
          setCurrentStep(5);
          break;
        case 5:
          newData.keyStatus = data;
          setCurrentStep(6);
          break;
        default:
          break;
      }
      
      return newData;
    });
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <AgentSelection
            onComplete={(agent) => handleStepComplete(1, agent)}
          />
        );
      case 2:
        return (
          <StrategyCreation
            onComplete={(strategy) => handleStepComplete(2, strategy)}
          />
        );
      case 3:
        return (
          <BotIntegration
            strategy={workflowData.strategy}
            onComplete={(botStatus) => handleStepComplete(3, botStatus)}
          />
        );
      case 4:
        return (
          <WalletCreation
            onComplete={(walletInfo) => handleStepComplete(4, walletInfo)}
          />
        );
      case 5:
        return (
          <KeyManagement
            walletInfo={workflowData.walletInfo}
            onComplete={(keyStatus) => handleStepComplete(5, keyStatus)}
          />
        );
      case 6:
        return (
          <StatusDisplay
            botInfo={workflowData}
          />
        );
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
          onStepClick={setCurrentStep}
        />
        <div className="mt-8">{renderCurrentStep()}</div>
      </main>
    </div>
  );
};

export default App;
