import React, { useState } from 'react';
import './styles.css';

interface TradingStrategyConfigProps {
  onStrategyChange: (strategy: TradingStrategy) => void;
  defaultStrategy?: Partial<TradingStrategy>;
}

export interface TradingStrategy {
  type: 'GRID' | 'MOMENTUM' | 'MEAN_REVERSION' | 'CUSTOM';
  parameters: {
    // 网格交易参数
    gridSpacing?: number;
    upperPrice?: number;
    lowerPrice?: number;
    gridLevels?: number;
    
    // 动量交易参数
    momentumPeriod?: number;
    momentumThreshold?: number;
    
    // 均值回归参数
    maType?: 'SMA' | 'EMA' | 'WMA';
    maPeriod?: number;
    deviationThreshold?: number;
    
    // 通用参数
    positionSize: number;
    maxPositions: number;
    riskPerTrade: number;
    profitTarget: number;
  };
  timeframes: string[];
  indicators: {
    name: string;
    parameters: Record<string, number>;
    enabled: boolean;
  }[];
}

const TradingStrategyConfig: React.FC<TradingStrategyConfigProps> = ({
  onStrategyChange,
  defaultStrategy
}) => {
  const [strategy, setStrategy] = useState<TradingStrategy>({
    type: 'GRID',
    parameters: {
      positionSize: 0.1,
      maxPositions: 5,
      riskPerTrade: 1,
      profitTarget: 2,
      gridSpacing: 1,
      upperPrice: 0,
      lowerPrice: 0,
      gridLevels: 10
    },
    timeframes: ['1m'],
    indicators: [
      {
        name: 'RSI',
        parameters: { period: 14 },
        enabled: false
      },
      {
        name: 'MACD',
        parameters: { 
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        },
        enabled: false
      },
      {
        name: 'Bollinger Bands',
        parameters: {
          period: 20,
          standardDeviations: 2
        },
        enabled: false
      }
    ],
    ...defaultStrategy
  });

  const handleStrategyTypeChange = (type: TradingStrategy['type']) => {
    const newStrategy = { ...strategy, type };
    
    // 根据策略类型更新默认参数
    switch (type) {
      case 'GRID':
        newStrategy.parameters = {
          ...newStrategy.parameters,
          gridSpacing: 1,
          upperPrice: 0,
          lowerPrice: 0,
          gridLevels: 10
        };
        break;
      case 'MOMENTUM':
        newStrategy.parameters = {
          ...newStrategy.parameters,
          momentumPeriod: 14,
          momentumThreshold: 0.5
        };
        break;
      case 'MEAN_REVERSION':
        newStrategy.parameters = {
          ...newStrategy.parameters,
          maType: 'SMA',
          maPeriod: 20,
          deviationThreshold: 2
        };
        break;
    }

    setStrategy(newStrategy);
    onStrategyChange(newStrategy);
  };

  const handleParameterChange = (key: string, value: number | string) => {
    const newStrategy = {
      ...strategy,
      parameters: {
        ...strategy.parameters,
        [key]: typeof value === 'string' ? parseFloat(value) || 0 : value
      }
    };
    setStrategy(newStrategy);
    onStrategyChange(newStrategy);
  };

  const handleTimeframeToggle = (timeframe: string) => {
    const timeframes = strategy.timeframes.includes(timeframe)
      ? strategy.timeframes.filter(t => t !== timeframe)
      : [...strategy.timeframes, timeframe];
    
    const newStrategy = { ...strategy, timeframes };
    setStrategy(newStrategy);
    onStrategyChange(newStrategy);
  };

  const handleIndicatorToggle = (index: number) => {
    const indicators = [...strategy.indicators];
    indicators[index] = {
      ...indicators[index],
      enabled: !indicators[index].enabled
    };

    const newStrategy = { ...strategy, indicators };
    setStrategy(newStrategy);
    onStrategyChange(newStrategy);
  };

  const handleIndicatorParameterChange = (
    index: number,
    paramKey: string,
    value: string
  ) => {
    const indicators = [...strategy.indicators];
    indicators[index] = {
      ...indicators[index],
      parameters: {
        ...indicators[index].parameters,
        [paramKey]: parseFloat(value) || 0
      }
    };

    const newStrategy = { ...strategy, indicators };
    setStrategy(newStrategy);
    onStrategyChange(newStrategy);
  };

  return (
    <div className="strategy-config">
      <div className="strategy-section">
        <h3>策略类型</h3>
        <select
          value={strategy.type}
          onChange={(e) => handleStrategyTypeChange(e.target.value as TradingStrategy['type'])}
        >
          <option value="GRID">网格交易</option>
          <option value="MOMENTUM">动量交易</option>
          <option value="MEAN_REVERSION">均值回归</option>
          <option value="CUSTOM">自定义策略</option>
        </select>
      </div>

      <div className="strategy-section">
        <h3>基本参数</h3>
        <div className="parameter-group">
          <label>
            仓位大小
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={strategy.parameters.positionSize}
              onChange={(e) => handleParameterChange('positionSize', e.target.value)}
            />
          </label>

          <label>
            最大持仓数
            <input
              type="number"
              min="1"
              value={strategy.parameters.maxPositions}
              onChange={(e) => handleParameterChange('maxPositions', e.target.value)}
            />
          </label>

          <label>
            每笔交易风险 (%)
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={strategy.parameters.riskPerTrade}
              onChange={(e) => handleParameterChange('riskPerTrade', e.target.value)}
            />
          </label>

          <label>
            目标利润 (%)
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={strategy.parameters.profitTarget}
              onChange={(e) => handleParameterChange('profitTarget', e.target.value)}
            />
          </label>
        </div>
      </div>

      {strategy.type === 'GRID' && (
        <div className="strategy-section">
          <h3>网格参数</h3>
          <div className="parameter-group">
            <label>
              网格间距 (%)
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={strategy.parameters.gridSpacing}
                onChange={(e) => handleParameterChange('gridSpacing', e.target.value)}
              />
            </label>

            <label>
              上限价格
              <input
                type="number"
                min="0"
                value={strategy.parameters.upperPrice}
                onChange={(e) => handleParameterChange('upperPrice', e.target.value)}
              />
            </label>

            <label>
              下限价格
              <input
                type="number"
                min="0"
                value={strategy.parameters.lowerPrice}
                onChange={(e) => handleParameterChange('lowerPrice', e.target.value)}
              />
            </label>

            <label>
              网格层数
              <input
                type="number"
                min="2"
                value={strategy.parameters.gridLevels}
                onChange={(e) => handleParameterChange('gridLevels', e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {strategy.type === 'MOMENTUM' && (
        <div className="strategy-section">
          <h3>动量参数</h3>
          <div className="parameter-group">
            <label>
              动量周期
              <input
                type="number"
                min="1"
                value={strategy.parameters.momentumPeriod}
                onChange={(e) => handleParameterChange('momentumPeriod', e.target.value)}
              />
            </label>

            <label>
              动量阈值
              <input
                type="number"
                step="0.1"
                value={strategy.parameters.momentumThreshold}
                onChange={(e) => handleParameterChange('momentumThreshold', e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {strategy.type === 'MEAN_REVERSION' && (
        <div className="strategy-section">
          <h3>均值回归参数</h3>
          <div className="parameter-group">
            <label>
              均线类型
              <select
                value={strategy.parameters.maType}
                onChange={(e) => handleParameterChange('maType', e.target.value)}
              >
                <option value="SMA">简单移动平均</option>
                <option value="EMA">指数移动平均</option>
                <option value="WMA">加权移动平均</option>
              </select>
            </label>

            <label>
              均线周期
              <input
                type="number"
                min="1"
                value={strategy.parameters.maPeriod}
                onChange={(e) => handleParameterChange('maPeriod', e.target.value)}
              />
            </label>

            <label>
              偏离阈值
              <input
                type="number"
                step="0.1"
                value={strategy.parameters.deviationThreshold}
                onChange={(e) => handleParameterChange('deviationThreshold', e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      <div className="strategy-section">
        <h3>时间周期</h3>
        <div className="timeframe-group">
          {['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map(timeframe => (
            <label key={timeframe}>
              <input
                type="checkbox"
                checked={strategy.timeframes.includes(timeframe)}
                onChange={() => handleTimeframeToggle(timeframe)}
              />
              {timeframe}
            </label>
          ))}
        </div>
      </div>

      <div className="strategy-section">
        <h3>技术指标</h3>
        <div className="indicators-group">
          {strategy.indicators.map((indicator, index) => (
            <div key={indicator.name} className="indicator-item">
              <label>
                <input
                  type="checkbox"
                  checked={indicator.enabled}
                  onChange={() => handleIndicatorToggle(index)}
                />
                {indicator.name}
              </label>
              
              {indicator.enabled && (
                <div className="indicator-parameters">
                  {Object.entries(indicator.parameters).map(([key, value]) => (
                    <label key={key}>
                      {key}
                      <input
                        type="number"
                        min="1"
                        value={value}
                        onChange={(e) => handleIndicatorParameterChange(index, key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TradingStrategyConfig; 