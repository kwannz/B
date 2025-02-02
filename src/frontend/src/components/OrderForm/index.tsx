import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface OrderFormProps {
  onSubmit: (orderData: any) => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ onSubmit }) => {
  const { user } = useAuth();
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('请先登录');
      return;
    }

    const orderData = {
      type: orderType,
      side,
      quantity: Number(quantity),
      ...(orderType === 'limit' && { price: Number(price) })
    };

    onSubmit(orderData);
    
    // 重置表单
    if (orderType === 'limit') setPrice('');
    setQuantity('');
  };

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div className="order-type-selector">
          <button
            type="button"
            className={orderType === 'limit' ? 'active' : ''}
            onClick={() => setOrderType('limit')}
          >
            限价单
          </button>
          <button
            type="button"
            className={orderType === 'market' ? 'active' : ''}
            onClick={() => setOrderType('market')}
          >
            市价单
          </button>
        </div>

        <div className="order-side-selector">
          <button
            type="button"
            className={`side-btn ${side === 'buy' ? 'buy active' : ''}`}
            onClick={() => setSide('buy')}
          >
            买入
          </button>
          <button
            type="button"
            className={`side-btn ${side === 'sell' ? 'sell active' : ''}`}
            onClick={() => setSide('sell')}
          >
            卖出
          </button>
        </div>
      </div>

      <div className="form-body">
        {orderType === 'limit' && (
          <div className="form-group">
            <label>价格</label>
            <input
              type="number"
              step="0.00000001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
            />
          </div>
        )}

        <div className="form-group">
          <label>数量</label>
          <input
            type="number"
            step="0.00000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="0"
          />
        </div>

        {price && quantity && (
          <div className="order-summary">
            <div>预计总额: {(Number(price) * Number(quantity)).toFixed(8)}</div>
          </div>
        )}

        <button 
          type="submit" 
          className={`submit-btn ${side}`}
          disabled={!user}
        >
          {side === 'buy' ? '买入' : '卖出'}
        </button>
      </div>
    </form>
  );
};

export default OrderForm; 