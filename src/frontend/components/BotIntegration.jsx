import React, { useState, useEffect, useCallback } from 'react';

const BotIntegration = ({ strategy, onComplete }) => {
  const [status, setStatus] = useState('pending');
  const [logs, setLogs] = useState([]);
  const [mounted, setMounted] = useState(false);

  const addLog = useCallback((log) => {
    setLogs(prev => [...prev, log]);
  }, []);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      simulateIntegration();
    }
  }, [mounted, addLog]);

  const simulateIntegration = () => {
    const steps = [
      'Initializing bot configuration...',
      'Loading trading strategy parameters...',
      'Connecting to trading servers...',
      'Setting up market data feeds...',
      'Configuring risk management rules...',
      'Integration complete!'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        addLog(steps[currentStep]);
        currentStep++;

        if (currentStep === steps.length) {
          setStatus('completed');
          clearInterval(interval);
          onComplete && onComplete({ status: 'success' });
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Bot Integration</h2>
      
      <div className="bg-gray-50 p-6 rounded-lg border">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Integration Status</h3>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              status === 'completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
            }`}></div>
            <span className="capitalize">{status}</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Integration Logs</h3>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">{`> ${log}`}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotIntegration;
