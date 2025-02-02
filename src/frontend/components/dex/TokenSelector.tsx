import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Loading from '../common/Loading';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenSelectorProps {
  selectedToken?: Token;
  onSelect: (token: Token) => void;
  className?: string;
  disabled?: boolean;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onSelect,
  className,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);

  // 模拟获取代币列表
  const fetchTokens = async (query: string) => {
    setIsLoading(true);
    try {
      // TODO: 实现实际的代币搜索逻辑
      // const response = await fetch(`/api/tokens?query=${query}`);
      // const data = await response.json();
      // setTokens(data);
      
      // 临时模拟数据
      setTokens([
        {
          address: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
        },
        {
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
        }
      ]);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    fetchTokens(query);
  };

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
  };

  return (
    <>
      <button
        className={cn(
          "flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        {selectedToken ? (
          <>
            {selectedToken.logoURI && (
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                className="h-6 w-6 rounded-full"
              />
            )}
            <span>{selectedToken.symbol}</span>
          </>
        ) : (
          <span>Select Token</span>
        )}
        <svg
          className="h-5 w-5 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Select Token"
      >
        <div className="space-y-4">
          <Input
            placeholder="Search by name or paste address"
            value={searchQuery}
            onChange={handleSearch}
            icon={
              <svg
                className="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loading size="md" text="Loading tokens..." />
              </div>
            ) : tokens.length > 0 ? (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <button
                    key={token.address}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => handleSelect(token)}
                  >
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-sm text-gray-500">{token.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No tokens found
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TokenSelector;
