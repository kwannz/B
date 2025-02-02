import React from 'react';
import { cn } from '../../utils/cn';
import Loading from '../common/Loading';

interface PriceDisplayProps {
  baseToken?: string;
  quoteToken?: string;
  price?: number;
  priceChange?: number;
  isLoading?: boolean;
  className?: string;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  baseToken,
  quoteToken,
  price,
  priceChange,
  isLoading,
  className
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatPriceChange = (change: number) => {
    const formatted = Math.abs(change).toFixed(2);
    return `${change >= 0 ? '+' : '-'}${formatted}%`;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Loading size="sm" />
      </div>
    );
  }

  if (!baseToken || !quoteToken || typeof price === 'undefined') {
    return (
      <div className={cn("text-center text-gray-500 p-4", className)}>
        Select tokens to view price
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg border border-gray-200", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg font-medium">
            {baseToken}/{quoteToken}
          </span>
          <span className="text-2xl font-bold">
            {formatPrice(price)}
          </span>
        </div>
        {typeof priceChange !== 'undefined' && (
          <div
            className={cn(
              "px-2 py-1 rounded text-sm font-medium",
              priceChange >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            )}
          >
            {formatPriceChange(priceChange)}
          </div>
        )}
      </div>
      
      <div className="mt-2 text-sm text-gray-500">
        <div className="flex items-center justify-between">
          <span>Best Price</span>
          <div className="flex items-center space-x-1">
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>Price includes all fees</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceDisplay;
