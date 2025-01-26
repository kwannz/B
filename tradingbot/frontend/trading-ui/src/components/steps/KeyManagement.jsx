import React, { useState } from 'react';

const KeyManagement = ({ walletInfo, onComplete }) => {
  const [isStoring, setIsStoring] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState('initial');

  const handleStoreKey = async () => {
    setIsStoring(true);
    setStatus('storing');
    
    // Simulate key storage process
    setTimeout(() => {
      setStatus('complete');
      setIsStoring(false);
      setIsComplete(true);
    }, 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Key Management</h2>

      <div className="border rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Wallet Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Trading Wallet (A)</label>
            <input
              type="text"
              value={walletInfo?.walletA?.address || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Profit Wallet (B)</label>
            <input
              type="text"
              value={walletInfo?.walletBAddress || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Secure Key Storage</h3>
        
        {status === 'initial' && (
          <div className="space-y-4">
            <p className="text-gray-600">
              The trading bot needs to securely store your wallet's private key to execute trades.
              The key will be encrypted and stored securely.
            </p>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Your private key will only be used for trading operations and cannot be accessed by anyone else.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Important: You must deposit a minimum of 0.5 SOL into Trading Wallet (A) before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleStoreKey}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Store Key Securely
            </button>
          </div>
        )}

        {status === 'storing' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-center text-gray-600">Storing and encrypting private key...</p>
          </div>
        )}

        {status === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-green-500">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-center text-green-600 font-medium">
              Private key has been securely stored!
            </p>
            <button
              onClick={onComplete}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KeyManagement;
