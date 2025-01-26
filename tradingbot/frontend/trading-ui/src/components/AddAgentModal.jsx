import React, { useState } from 'react';

const AddAgentModal = ({ onClose, onAgentAdded }) => {
  const [strategy, setStrategy] = useState({
    name: '',
    description: '',
    parameters: {},
    promotionWords: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAgent = {
      id: `agent_${Date.now()}`,
      name: strategy.name,
      type: 'trading',
      status: 'inactive',
      lastUpdate: new Date().toLocaleTimeString(),
      strategy
    };
    onAgentAdded(newAgent);
    onClose();
  };

  const renderTradingParams = () => (
    <div className="mb-6 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
      <h3 className="text-lg font-semibold text-blue-900 mb-4">Trading Parameters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-2">
            Risk Level
          </label>
          <select
            onChange={(e) =>
              setStrategy({
                ...strategy,
                parameters: { ...strategy.parameters, riskLevel: e.target.value },
              })
            }
            className="w-full p-2 border border-gray-200 rounded"
            required
            defaultValue=""
          >
            <option value="" disabled>Select Risk Level</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-2">
            Trade Size (%)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            onChange={(e) =>
              setStrategy({
                ...strategy,
                parameters: { ...strategy.parameters, tradeSize: e.target.value },
              })
            }
            className="w-full p-2 border border-gray-200 rounded"
            required
            placeholder="Enter trade size percentage"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Add New Agent</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Strategy Name
            </label>
            <input
              type="text"
              value={strategy.name}
              onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={strategy.description}
              onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded"
              rows="3"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Prompt Words
            </label>
            <textarea
              value={strategy.promotionWords}
              onChange={(e) => setStrategy({ ...strategy, promotionWords: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded"
              rows="2"
              placeholder="Enter prompt words..."
            />
          </div>

          {renderTradingParams()}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAgentModal;
