import React, { useState } from 'react';

const WalletCreation = ({ onComplete }) => {
  const [walletA, setWalletA] = useState(null);
  const [walletBAddress, setWalletBAddress] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWallet = async () => {
    setIsGenerating(true);
    // Simulate wallet generation
    setTimeout(() => {
      // Simulate wallet generation with actual private key
      // Use placeholder values for development
      // In production, this will be replaced with actual wallet generation
      setWalletA({
        address: '[Generated Wallet Address]',
        privateKey: '[Generated Private Key]',
      });
      setIsGenerating(false);
    }, 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (walletA && walletBAddress) {
      onComplete({ walletA, walletBAddress });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Wallet Setup</h2>

      <div className="space-y-6">
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Trading Wallet (A)</h3>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Important: You must deposit a minimum of 0.5 SOL into this wallet before proceeding.
                </p>
              </div>
            </div>
          </div>
          {!walletA ? (
            <button
              onClick={generateWallet}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isGenerating ? 'Generating...' : 'Generate New Wallet'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Trading Wallet (A) Details</h4>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wallet Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={walletA.address}
                      readOnly
                      className="w-full p-2 border rounded bg-gray-50 font-mono"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(walletA.address)}
                      className="absolute right-2 top-2 text-blue-600 hover:text-blue-800"
                      title="Copy to clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Private Key
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={walletA.privateKey}
                        readOnly
                        className="w-full p-2 border rounded bg-gray-50 font-mono"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(walletA.privateKey)}
                        className="absolute right-2 top-2 text-blue-600 hover:text-blue-800"
                        title="Copy to clipboard"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                      </button>
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
                            Important: Save this private key securely offline. It will not be shown again.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


        <form onSubmit={handleSubmit} className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Profit Wallet (B)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Wallet B Address
              </label>
              <input
                type="text"
                value={walletBAddress}
                onChange={(e) => setWalletBAddress(e.target.value)}
                placeholder="Enter your wallet B address"
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!walletA || !walletBAddress}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalletCreation;
