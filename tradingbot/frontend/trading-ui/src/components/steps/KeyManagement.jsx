import React, { useState, useEffect } from 'react';

const KeyManagement = ({ walletInfo, onComplete }) => {
  const [status, setStatus] = useState('pending');
  const [logs, setLogs] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mounted && walletInfo) {
      setMounted(true);
      simulateKeySetup();
    }
  }, [mounted, walletInfo]);

  const simulateKeySetup = () => {
    const steps = [
      'Validating wallet addresses...',
      'Generating API keys...',
      'Setting up trading permissions...',
      'Configuring security parameters...',
      'Verifying key access...',
      'Key management setup complete!'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setLogs(prev => [...prev, steps[currentStep]]);
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
      <h2 className="text-2xl font-bold mb-6">Key Management Setup</h2>
      
      <div className="space-y-6">
        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Primary Trading Wallet</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-blue-900">Address:</label>
              <div className="p-2 bg-white rounded border border-gray-200 font-mono text-sm">
                {walletInfo?.walletA?.address || 'Not available'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Secondary Trading Wallet</h3>
          <div>
            <label className="block text-sm font-medium">Address:</label>
            <div className="p-2 bg-white rounded border border-gray-200 font-mono text-sm">
              {walletInfo?.walletBAddress || 'Not available'}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Setup Status</h3>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                status === 'completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
              }`}></div>
              <span className="capitalize">{status}</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Setup Logs</h3>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-48 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">{`> ${log}`}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyManagement;
