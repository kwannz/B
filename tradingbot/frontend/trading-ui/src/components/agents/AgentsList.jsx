import React from 'react';
import AgentCard from './AgentCard';

const AgentsList = ({ agents, onEditAgent }) => {
  return (
    <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Active Agents</h3>
      <div className="space-y-4">
        {agents.map((agent) => (
          <AgentCard 
            key={agent.id} 
            agent={agent} 
            onEdit={onEditAgent}
          />
        ))}
        {agents.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No agents added yet. Click "Add Agent" to create one.
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsList;
