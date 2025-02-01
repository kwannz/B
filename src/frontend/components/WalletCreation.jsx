import React, { useState } from 'react';

const WalletCreation = ({ onComplete }) => {
  const [walletInfo, setWalletInfo] = useState({
    walletA: {
      address: '',
      privateKey: ''
    },
    walletBAddress: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete && onComplete(walletInfo);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create Trading Wallets</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Primary Trading Wallet</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={walletInfo.walletA.address}
                onChange={(e) => setWalletInfo({
                  ...walletInfo,
                  walletA: { ...walletInfo.walletA, address: e.target.value }
                })}
                className="w-full p-2 border border-gray-200 rounded font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Private Key
              </label>
              <input
                type="password"
                value={walletInfo.walletA.privateKey}
                onChange={(e) => setWalletInfo({
                  ...walletInfo,
                  walletA: { ...walletInfo.walletA, privateKey: e.target.value }
                })}
                className="w-full p-2 border border-gray-200 rounded font-mono text-sm"
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Secondary Trading Wallet</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={walletInfo.walletBAddress}
              onChange={(e) => setWalletInfo({
                ...walletInfo,
                walletBAddress: e.target.value
              })}
              className="w-full p-2 border border-gray-200 rounded font-mono text-sm"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Continue
        </button>
      </form>
    </div>
  );
};

export default WalletCreation;
