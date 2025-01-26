import React from 'react';

const AgentCard = ({ agent, onEdit }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium">{agent.name}</h4>
          <p className="text-sm text-gray-600">Last Updated: {agent.lastUpdate}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-sm rounded ${
            agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {agent.status}
          </span>
          <button
            onClick={() => onEdit(agent)}
            className="text-blue-600 hover:text-blue-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
