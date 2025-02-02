import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../services/api';
import OrderForm from '../../components/OrderForm';
import MarketData from '../../components/MarketData';
import OrderBook from '../../components/OrderBook';
import TradeHistory from '../../components/TradeHistory';

interface MarketDataType {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  change: number;
}

interface OrderType {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: number;
  quantity: number;
  status: string;
  timestamp: string;
}

const Trading: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketDataType[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC-USD');
  const [orderBook, setOrderBook] = useState<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });
  const [tradeHistory, setTradeHistory] = useState<OrderType[]>([]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // 订阅市场数据
    subscribe('market', selectedSymbol, (data) => {
      setMarketData(prev => {
        const index = prev.findIndex(item => item.symbol === data.symbol);
        if (index === -1) return [...prev, data];
        const newData = [...prev];
        newData[index] = data;
        return newData;
      });
    });

    // 订阅订单簿数据
    subscribe('orderbook', selectedSymbol, (data) => {
      setOrderBook(data);
    });

    // 订阅交易历史
    subscribe('trades', selectedSymbol, (data) => {
      setTradeHistory(prev => [data, ...prev].slice(0, 50));
    });

    // 初始加载数据
    loadInitialData();

    return () => {
      unsubscribe('market', selectedSymbol);
      unsubscribe('orderbook', selectedSymbol);
      unsubscribe('trades', selectedSymbol);
    };
  }, [selectedSymbol]);

  const loadInitialData = async () => {
    try {
      const [marketResponse, orderBookResponse, tradesResponse] = await Promise.all([
        api.getMarketData(),
        api.getOrderBook(selectedSymbol),
        api.getTradeHistory(selectedSymbol)
      ]);

      setMarketData(marketResponse.data);
      setOrderBook(orderBookResponse.data);
      setTradeHistory(tradesResponse.data);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleOrderSubmit = async (orderData: any) => {
    try {
      const response = await api.createOrder({
        ...orderData,
        symbol: selectedSymbol
      });
      
      // 可以添加订单成功的提示
      console.log('Order created:', response.data);
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  return (
    <div className="trading-page">
      <div className="trading-header">
        <h1>交易</h1>
        <select 
          value={selectedSymbol} 
          onChange={(e) => handleSymbolChange(e.target.value)}
        >
          {marketData.map(data => (
            <option key={data.symbol} value={data.symbol}>
              {data.symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="trading-grid">
        <div className="market-data-section">
          <MarketData 
            data={marketData.find(data => data.symbol === selectedSymbol)} 
          />
        </div>

        <div className="order-book-section">
          <OrderBook data={orderBook} />
        </div>

        <div className="order-form-section">
          <OrderForm onSubmit={handleOrderSubmit} />
        </div>

        <div className="trade-history-section">
          <TradeHistory trades={tradeHistory} />
        </div>
      </div>
    </div>
  );
};

export default Trading; 