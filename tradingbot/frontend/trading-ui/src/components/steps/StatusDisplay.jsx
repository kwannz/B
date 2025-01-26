import React, { useState, useEffect } from 'react';
import AddAgentModal from '../AddAgentModal';

const StatusDisplay = ({ botInfo }) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [agents, setAgents] = useState([
    {
      id: 'agent_template',
      name: 'Example Trading Bot',
      type: 'trading',
      status: 'inactive',
      lastUpdate: new Date().toLocaleTimeString()
    }
  ]);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);

  const handleAgentAdded = (newAgent) => {
    setAgents([...agents, newAgent]);
  };

  const handleAgentToggle = async (agentId, currentStatus) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const endpoint = currentStatus === 'active' ? 'stop' : 'start';
      const response = await fetch(`/api/agents/${agent.type}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setAgents(agents.map(a => 
          a.id === agentId 
            ? {...a, status: currentStatus === 'active' ? 'inactive' : 'active', lastUpdate: new Date().toLocaleTimeString()}
            : a
        ));
      }
    } catch (error) {
      console.error('Error toggling agent:', error);
    }
  };

  const [performanceData, setPerformanceData] = useState({
    totalPnL: '[PNL]',
    winRate: '[WIN_RATE]',
    totalTrades: 0,
    activePositions: 0,
  });

  const [tradeHistory, setTradeHistory] = useState([
    {
      id: '[TRADE_ID]',
      type: '[TYPE]',
      token: '[PAIR]',
      amount: '[AMOUNT]',
      price: '[PRICE]',
      time: '[TIMESTAMP]',
      status: '[STATUS]',
    },
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Trading Dashboard</h2>
          <div className="flex items-center space-x-4">
            <button className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">
              Edit Agent
            </button>
            <button
              onClick={() => setShowAddAgentModal(true)}
              className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
            >
              Add Agent
            </button>
          </div>
          {showAddAgentModal && (
            <AddAgentModal
              onClose={() => setShowAddAgentModal(false)}
              onAgentAdded={handleAgentAdded}
            />
          )}
        </div>
        
        <div className="space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">{agent.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      agent.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {agent.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-sm text-gray-600">
                      Last Update: {agent.lastUpdate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAgentToggle(agent.id, agent.status)}
                    className={`px-4 py-1 text-white rounded ${
                      agent.status === 'active'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {agent.status === 'active' ? 'Stop' : 'Start'} Agent
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500 mb-1">Total P&amp;L</h3>
          <p className="text-2xl font-bold text-green-600">{performanceData.totalPnL}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500 mb-1">Win Rate</h3>
          <p className="text-2xl font-bold">{performanceData.winRate}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500 mb-1">Total Trades</h3>
          <p className="text-2xl font-bold">{performanceData.totalTrades}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500 mb-1">Active Positions</h3>
          <p className="text-2xl font-bold">{performanceData.activePositions}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedTab('trades')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'trades'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trade History
          </button>
          <button
            onClick={() => setSelectedTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === 'trades' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tradeHistory.map((trade) => (
                <tr key={trade.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trade.type === 'buy'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {trade.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{trade.token}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{trade.amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{trade.price}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{trade.time}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'analytics' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-center text-gray-500">
            Analytics visualization will be implemented here
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;
