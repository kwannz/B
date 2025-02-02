import React from 'react';

interface OrderBookProps {
  data: {
    bids: Array<[number, number]>; // [price, quantity]
    asks: Array<[number, number]>;
  };
}

const OrderBook: React.FC<OrderBookProps> = ({ data }) => {
  const { bids, asks } = data;
  const maxDepth = 10; // 显示深度

  const formatNumber = (num: number, decimals: number = 8) => {
    return Number(num).toFixed(decimals);
  };

  // 计算总量和累计量
  const calculateAccumulated = (orders: Array<[number, number]>) => {
    let accumulated = 0;
    return orders.map(([price, quantity]) => {
      accumulated += quantity;
      return [price, quantity, accumulated];
    });
  };

  const accumulatedAsks = calculateAccumulated(asks.slice(0, maxDepth));
  const accumulatedBids = calculateAccumulated(bids.slice(0, maxDepth));

  // 计算最大累计量用于显示深度图
  const maxAccumulated = Math.max(
    accumulatedAsks.length > 0 ? accumulatedAsks[accumulatedAsks.length - 1][2] : 0,
    accumulatedBids.length > 0 ? accumulatedBids[accumulatedBids.length - 1][2] : 0
  );

  return (
    <div className="order-book">
      <div className="order-book-header">
        <div>价格</div>
        <div>数量</div>
        <div>累计</div>
      </div>

      <div className="asks">
        {accumulatedAsks.reverse().map(([price, quantity, accumulated]) => (
          <div
            key={price}
            className="order-row ask"
            style={{
              background: `linear-gradient(to left, rgba(255, 0, 0, 0.1) ${(accumulated / maxAccumulated) * 100}%, transparent 0%)`
            }}
          >
            <div className="price">{formatNumber(price)}</div>
            <div className="quantity">{formatNumber(quantity)}</div>
            <div className="accumulated">{formatNumber(accumulated)}</div>
          </div>
        ))}
      </div>

      <div className="spread">
        {bids.length > 0 && asks.length > 0 && (
          <div className="spread-value">
            买卖价差: {formatNumber(asks[0][0] - bids[0][0])}
          </div>
        )}
      </div>

      <div className="bids">
        {accumulatedBids.map(([price, quantity, accumulated]) => (
          <div
            key={price}
            className="order-row bid"
            style={{
              background: `linear-gradient(to left, rgba(0, 255, 0, 0.1) ${(accumulated / maxAccumulated) * 100}%, transparent 0%)`
            }}
          >
            <div className="price">{formatNumber(price)}</div>
            <div className="quantity">{formatNumber(quantity)}</div>
            <div className="accumulated">{formatNumber(accumulated)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook; 