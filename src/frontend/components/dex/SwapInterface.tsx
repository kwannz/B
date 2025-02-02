import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import Button from '../common/Button';
import Input from '../common/Input';
import TokenSelector from './TokenSelector';
import PriceDisplay from './PriceDisplay';
import Loading from '../common/Loading';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface SwapInterfaceProps {
  className?: string;
}

const SwapInterface: React.FC<SwapInterfaceProps> = ({ className }) => {
  const [fromToken, setFromToken] = useState<Token>();
  const [toToken, setToToken] = useState<Token>();
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [price, setPrice] = useState<number>();
  const [priceChange, setPriceChange] = useState<number>();
  const [error, setError] = useState<string>();

  // 模拟获取价格
  useEffect(() => {
    const fetchPrice = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
        setPrice(undefined);
        setToAmount('');
        return;
      }

      setIsLoading(true);
      try {
        // TODO: 实现实际的价格查询逻辑
        // const response = await fetch(`/api/price?from=${fromToken.address}&to=${toToken.address}&amount=${fromAmount}`);
        // const data = await response.json();
        
        // 模拟延迟和价格计算
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockPrice = 1.5; // 模拟价格
        setPrice(mockPrice);
        setPriceChange(2.5); // 模拟24h价格变化
        setToAmount((parseFloat(fromAmount) * mockPrice).toFixed(6));
        setError(undefined);
      } catch (error) {
        console.error('Error fetching price:', error);
        setError('Failed to fetch price. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
  }, [fromToken, toToken, fromAmount]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !toAmount) {
      return;
    }

    setIsLoading(true);
    try {
      // TODO: 实现实际的交换逻辑
      // const response = await fetch('/api/swap', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     fromToken: fromToken.address,
      //     toToken: toToken.address,
      //     fromAmount,
      //     toAmount,
      //   }),
      // });
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 清空输入
      setFromAmount('');
      setToAmount('');
      setError(undefined);
    } catch (error) {
      console.error('Error executing swap:', error);
      setError('Failed to execute swap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md mx-auto p-4 rounded-xl bg-white shadow-lg", className)}>
      <div className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">From</label>
          <div className="flex space-x-2">
            <TokenSelector
              selectedToken={fromToken}
              onSelect={setFromToken}
              disabled={isLoading}
            />
            <Input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.0"
              disabled={isLoading || !fromToken}
              className="flex-1"
            />
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapTokens}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <svg
              className="h-6 w-6 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">To</label>
          <div className="flex space-x-2">
            <TokenSelector
              selectedToken={toToken}
              onSelect={setToToken}
              disabled={isLoading}
            />
            <Input
              type="number"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              placeholder="0.0"
              disabled={true}
              className="flex-1"
            />
          </div>
        </div>

        {/* Price Display */}
        {fromToken && toToken && (
          <PriceDisplay
            baseToken={fromToken.symbol}
            quoteToken={toToken.symbol}
            price={price}
            priceChange={priceChange}
            isLoading={isLoading}
          />
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={isLoading || !fromToken || !toToken || !fromAmount || !toAmount}
          className="w-full"
          isLoading={isLoading}
        >
          {!fromToken || !toToken
            ? 'Select Tokens'
            : !fromAmount
            ? 'Enter Amount'
            : 'Swap'}
        </Button>
      </div>
    </div>
  );
};

export default SwapInterface;
