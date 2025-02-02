import React from 'react';

interface MarketDataProps {
  data?: {
    symbol: string;
    price: number;
    volume: number;
    high: number;
    low: number;
    change: number;
  };
}

const MarketData: React.FC<MarketDataProps> = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  const formatNumber = (num: number, decimals: number = 8) => {
    return Number(num).toFixed(decimals);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${(change * 100).toFixed(2)}%`;
  };

  return (
    <div className="market-data">
      <div className="market-header">
        <h2>{data.symbol}</h2>
        <div className={`price ${data.change >= 0 ? 'positive' : 'negative'}`}>
          {formatNumber(data.price)}
        </div>
        <div className={`change ${data.change >= 0 ? 'positive' : 'negative'}`}>
          {formatChange(data.change)}
        </div>
      </div>

      <div className="market-stats">
        <div className="stat-item">
          <label>24h 高</label>
          <span>{formatNumber(data.high)}</span>
        </div>
        <div className="stat-item">
          <label>24h 低</label>
          <span>{formatNumber(data.low)}</span>
        </div>
        <div className="stat-item">
          <label>24h 成交量</label>
          <span>{formatNumber(data.volume, 2)}</span>
        </div>
      </div>
    </div>
  );
};

export default MarketData; 