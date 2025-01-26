import React, { useState } from 'react';

const AddAgentModal = ({ onClose, onAgentAdded }) => {
  const [agentType, setAgentType] = useState('trading');
  const [agentName, setAgentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/agents/${agentType}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_enabled: true,
          strategies: [],
          wallets: [],
          risk_limits: {},
          notifications: {}
        })
      });

      if (response.ok) {
        const startResponse = await fetch(`/api/agents/${agentType}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (startResponse.ok) {
          const newAgent = {
            id: `agent_${Date.now()}`,
            name: agentName || `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent`,
            type: agentType,
            status: 'active',
            lastUpdate: new Date().toLocaleTimeString()
          };
          onAgentAdded(newAgent);
          onClose();
        }
      }
    } catch (error) {
      console.error('Error adding agent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">Add New Agent</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full p-2 border rounded"
              disabled={isSubmitting}
            >
              <option value="trading">Trading Agent</option>
              <option value="defi" disabled>DeFi Agent (Coming Soon)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name (Optional)
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name"
              className="w-full p-2 border rounded"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAgentModal;
