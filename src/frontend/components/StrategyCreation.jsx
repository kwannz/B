import React, { useState } from 'react';

const StrategyCreation = ({ onComplete }) => {
  const [strategy, setStrategy] = useState({
    name: '',
    description: '',
    parameters: {
      riskLevel: 'medium',
      tradeSize: 5
    },
    promotionWords: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting strategy:', strategy);
    onComplete && onComplete(strategy);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create Strategy</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
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

        <div>
          <label className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={strategy.description}
            onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded"
            rows="3"
            required
          />
        </div>

        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Trading Parameters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Risk Level
              </label>
              <select
                value={strategy.parameters.riskLevel}
                onChange={(e) => setStrategy({
                  ...strategy,
                  parameters: { ...strategy.parameters, riskLevel: e.target.value }
                })}
                className="w-full p-2 border border-gray-200 rounded"
                required
              >
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
                value={strategy.parameters.tradeSize}
                onChange={(e) => setStrategy({
                  ...strategy,
                  parameters: { ...strategy.parameters, tradeSize: Number(e.target.value) }
                })}
                className="w-full p-2 border border-gray-200 rounded"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Prompt Words
          </label>
          <textarea
            value={strategy.promotionWords}
            onChange={(e) => setStrategy({ ...strategy, promotionWords: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded"
            rows="2"
            placeholder="Enter prompt words..."
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Create Strategy
        </button>
      </form>
    </div>
  );
};

export default StrategyCreation;
