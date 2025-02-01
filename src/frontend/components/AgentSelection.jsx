import React from 'react';

const AgentSelection = ({ onComplete }) => {
  const handleAgentSelect = (type) => {
    console.log('Selected agent type:', type);
    onComplete(type);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Select Trading Agent</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="border rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200"
          onClick={() => handleAgentSelect('trading')}
        >
          <h3 className="text-lg font-semibold mb-4">Trading Agent</h3>
          <ul className="space-y-2">
            <li>• Automated trading strategies</li>
            <li>• Real-time market analysis</li>
            <li>• Risk management</li>
            <li>• Performance tracking</li>
          </ul>
        </div>

        <div className="border rounded-lg p-6 opacity-50 cursor-not-allowed">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold mb-4">Strategy Market</h3>
            <span className="text-sm bg-gray-100 px-2 py-1 rounded">Coming Soon</span>
          </div>
          <ul className="space-y-2 text-gray-500">
            <li>• Advanced trading strategies</li>
            <li>• Community marketplace</li>
            <li>• Strategy analytics</li>
            <li>• Performance metrics</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AgentSelection;
