import React, { useState } from 'react';
import EditAgentModal from '../agents/EditAgentModal';
import AddAgentModal from '../agents/AddAgentModal';
import AgentsList from '../agents/AgentsList';

const StatusDisplay = ({ botInfo }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleString();
  };

  const handleEditAgent = (updatedAgent) => {
    if (selectedAgent) {
      // Update existing agent
      setAgents(agents.map(agent => 
        agent.id === selectedAgent.id ? { ...agent, ...updatedAgent } : agent
      ));
    } else {
      // Update main bot info
      console.log('Updated bot info:', updatedAgent);
    }
    setShowEditModal(false);
    setSelectedAgent(null);
  };

  const handleToggleBot = () => {
    setIsRunning(!isRunning);
  };

  const handleAddAgent = () => {
    setShowAddModal(true);
  };

  const handleAgentAdded = (newAgent) => {
    setAgents([...agents, newAgent]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Trading Bot Status</h2>
        <button
          onClick={handleAddAgent}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Agent
        </button>
      </div>
      
      <div className="space-y-6">
        <AgentsList 
          agents={agents} 
          onEditAgent={(agent) => {
            setSelectedAgent(agent);
            setShowEditModal(true);
          }} 
        />

        <div className="bg-green-50 p-6 rounded-lg border-2 border-green-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-900">Bot Status</h3>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`font-medium ${isRunning ? 'text-green-700' : 'text-red-700'}`}>
                {isRunning ? 'Active' : 'Stopped'}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-green-800">
            Last Updated: {formatDate()}
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-blue-900">Trading Strategy</h3>
            <button
              onClick={() => setShowEditModal(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-blue-900">Strategy Name:</label>
              <div className="text-blue-800">{botInfo?.strategy?.name || 'Not available'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900">Risk Level:</label>
              <div className="text-blue-800 capitalize">{botInfo?.strategy?.parameters?.riskLevel || 'Not available'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900">Trade Size:</label>
              <div className="text-blue-800">{botInfo?.strategy?.parameters?.tradeSize}%</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Trading Wallets</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Primary Wallet:</label>
              <div className="p-2 bg-white rounded border border-gray-200 font-mono text-sm">
                {botInfo?.walletInfo?.walletA?.address || 'Not available'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Secondary Wallet:</label>
              <div className="p-2 bg-white rounded border border-gray-200 font-mono text-sm">
                {botInfo?.walletInfo?.walletBAddress || 'Not available'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-600">Total Trades</div>
              <div className="text-2xl font-semibold">0</div>
            </div>
            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className="text-2xl font-semibold">0%</div>
            </div>
            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-600">Total Profit</div>
              <div className="text-2xl font-semibold text-green-600">$0.00</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleToggleBot}
            className={`flex-1 ${
              isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            } text-white py-2 px-4 rounded`}
          >
            {isRunning ? 'Stop Bot' : 'Start Bot'}
          </button>
          <button
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            View Logs
          </button>
        </div>
      </div>

      {showEditModal && (
        <EditAgentModal
          agent={selectedAgent || botInfo}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAgent(null);
          }}
          onSave={handleEditAgent}
        />
      )}

      {showAddModal && (
        <AddAgentModal
          onClose={() => setShowAddModal(false)}
          onAgentAdded={handleAgentAdded}
        />
      )}
    </div>
  );
};

export default StatusDisplay;
