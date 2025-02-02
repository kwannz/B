import React from 'react';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: string;
}

interface TradeHistoryProps {
  trades: Trade[];
}

const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const formatNumber = (num: number, decimals: number = 8) => {
    return Number(num).toFixed(decimals);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="trade-history">
      <h3>最近成交</h3>
      <div className="trade-list">
        <div className="trade-header">
          <div>时间</div>
          <div>方向</div>
          <div>价格</div>
          <div>数量</div>
          <div>总额</div>
        </div>
        <div className="trade-body">
          {trades.map((trade) => (
            <div 
              key={trade.id} 
              className={`trade-row ${trade.side}`}
            >
              <div className="time">{formatTime(trade.timestamp)}</div>
              <div className="side">
                {trade.side === 'buy' ? '买入' : '卖出'}
              </div>
              <div className="price">{formatNumber(trade.price)}</div>
              <div className="quantity">{formatNumber(trade.quantity)}</div>
              <div className="total">
                {formatNumber(trade.price * trade.quantity)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TradeHistory; 