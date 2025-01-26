import React, { useState, useEffect } from 'react';

const BotIntegration = ({ strategy, onComplete }) => {
  const [status, setStatus] = useState('initializing');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Simulate integration process
    const steps = [
      { message: 'Validating strategy parameters...', duration: 1000 },
      { message: 'Initializing trading bot...', duration: 1500 },
      { message: 'Configuring risk parameters...', duration: 1000 },
      { message: 'Setting up monitoring...', duration: 1000 },
      { message: 'Integration complete', duration: 500 },
    ];

    let currentStep = 0;
    const processSteps = () => {
      if (currentStep < steps.length) {
        setLogs((prev) => [...prev, steps[currentStep].message]);
        setProgress(((currentStep + 1) / steps.length) * 100);
        
        if (currentStep === steps.length - 1) {
          setStatus('complete');
          onComplete();
        } else {
          currentStep++;
          setTimeout(processSteps, steps[currentStep - 1].duration);
        }
      }
    };

    processSteps();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Bot Integration</h2>
      
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span>Integration Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Integration Logs</h3>
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>

      {status === 'complete' && (
        <button
          onClick={onComplete}
          className="mt-6 w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
        >
          Continue to Wallet Setup
        </button>
      )}
    </div>
  );
};

export default BotIntegration;
