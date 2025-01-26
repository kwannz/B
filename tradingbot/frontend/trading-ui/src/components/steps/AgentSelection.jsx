import React from 'react';

const AgentSelection = ({ onSelect }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Select Trading Agent</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div
          onClick={() => onSelect('trading')}
          className="p-6 border rounded-lg hover:border-blue-500 cursor-pointer transition-all"
        >
          <h3 className="text-xl font-semibold mb-4">DeFi/Trading Agent</h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Automated trading strategies</li>
            <li>Real-time market analysis</li>
            <li>Risk management</li>
            <li>Performance tracking</li>
          </ul>
        </div>
        
        <div className="p-6 border rounded-lg bg-gray-50 opacity-75 cursor-not-allowed">
          <div className="relative">
            <h3 className="text-xl font-semibold mb-4 text-gray-500">Strategy Market</h3>
            <span className="absolute top-0 right-0 bg-gray-200 text-gray-600 px-2 py-1 rounded text-sm">Coming Soon</span>
            <ul className="list-disc list-inside space-y-2 text-gray-500">
              <li>Advanced trading strategies</li>
              <li>Community marketplace</li>
              <li>Strategy analytics</li>
              <li>Performance metrics</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSelection;
