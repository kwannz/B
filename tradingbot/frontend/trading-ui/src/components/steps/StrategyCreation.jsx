import React, { useState } from 'react';

const StrategyCreation = ({ agentType, onSubmit }) => {
  const [strategy, setStrategy] = useState({
    name: '',
    description: '',
    parameters: {},
    promotionWords: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(strategy);
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
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            rows="3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Prompt Words
          </label>
          <textarea
            value={strategy.promotionWords}
            onChange={(e) => setStrategy({ ...strategy, promotionWords: e.target.value })}
            className="w-full p-2 border rounded"
            rows="2"
            placeholder="Enter prompt words..."
          />
        </div>

        {agentType === 'trading' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Trading Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Risk Level
                </label>
                <select
                  onChange={(e) =>
                    setStrategy({
                      ...strategy,
                      parameters: { ...strategy.parameters, riskLevel: e.target.value },
                    })
                  }
                  className="w-full p-2 border rounded"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
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
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>
        )}

        {agentType === 'defi' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">DeFi Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Strategy Type
                </label>
                <select
                  onChange={(e) =>
                    setStrategy({
                      ...strategy,
                      parameters: { ...strategy.parameters, strategyType: e.target.value },
                    })
                  }
                  className="w-full p-2 border rounded"
                >
                  <option value="yield">Yield Farming</option>
                  <option value="liquidity">Liquidity Provision</option>
                  <option value="arbitrage">Arbitrage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Min APY (%)
                </label>
                <input
                  type="number"
                  min="0"
                  onChange={(e) =>
                    setStrategy({
                      ...strategy,
                      parameters: { ...strategy.parameters, minApy: e.target.value },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>
        )}

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
