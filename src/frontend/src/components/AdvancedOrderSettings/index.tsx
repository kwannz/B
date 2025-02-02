import React, { useState } from 'react';
import './styles.css';

interface AdvancedOrderSettingsProps {
  onSettingsChange: (settings: AdvancedSettings) => void;
  defaultSettings?: Partial<AdvancedSettings>;
}

export interface AdvancedSettings {
  stopLoss: {
    enabled: boolean;
    price: number | null;
    percentage: number | null;
    triggerType: 'price' | 'percentage';
  };
  takeProfit: {
    enabled: boolean;
    price: number | null;
    percentage: number | null;
    triggerType: 'price' | 'percentage';
  };
  trailingStop: {
    enabled: boolean;
    distance: number;
    unit: 'price' | 'percentage';
  };
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  postOnly: boolean;
  reduceOnly: boolean;
}

const AdvancedOrderSettings: React.FC<AdvancedOrderSettingsProps> = ({
  onSettingsChange,
  defaultSettings
}) => {
  const [settings, setSettings] = useState<AdvancedSettings>({
    stopLoss: {
      enabled: false,
      price: null,
      percentage: null,
      triggerType: 'percentage'
    },
    takeProfit: {
      enabled: false,
      price: null,
      percentage: null,
      triggerType: 'percentage'
    },
    trailingStop: {
      enabled: false,
      distance: 1,
      unit: 'percentage'
    },
    timeInForce: 'GTC',
    postOnly: false,
    reduceOnly: false,
    ...defaultSettings
  });

  const handleSettingChange = <T extends keyof AdvancedSettings>(
    key: T,
    value: AdvancedSettings[T]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="advanced-settings">
      <div className="settings-section">
        <h3>止损设置</h3>
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={settings.stopLoss.enabled}
              onChange={(e) => handleSettingChange('stopLoss', {
                ...settings.stopLoss,
                enabled: e.target.checked
              })}
            />
            启用止损
          </label>
          {settings.stopLoss.enabled && (
            <>
              <div className="trigger-type">
                <label>
                  <input
                    type="radio"
                    value="percentage"
                    checked={settings.stopLoss.triggerType === 'percentage'}
                    onChange={(e) => handleSettingChange('stopLoss', {
                      ...settings.stopLoss,
                      triggerType: 'percentage'
                    })}
                  />
                  百分比
                </label>
                <label>
                  <input
                    type="radio"
                    value="price"
                    checked={settings.stopLoss.triggerType === 'price'}
                    onChange={(e) => handleSettingChange('stopLoss', {
                      ...settings.stopLoss,
                      triggerType: 'price'
                    })}
                  />
                  价格
                </label>
              </div>
              <input
                type="number"
                value={settings.stopLoss.triggerType === 'percentage' 
                  ? settings.stopLoss.percentage || ''
                  : settings.stopLoss.price || ''
                }
                onChange={(e) => handleSettingChange('stopLoss', {
                  ...settings.stopLoss,
                  [settings.stopLoss.triggerType === 'percentage' ? 'percentage' : 'price']: Number(e.target.value)
                })}
                placeholder={settings.stopLoss.triggerType === 'percentage' ? '止损百分比' : '止损价格'}
              />
            </>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>止盈设置</h3>
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={settings.takeProfit.enabled}
              onChange={(e) => handleSettingChange('takeProfit', {
                ...settings.takeProfit,
                enabled: e.target.checked
              })}
            />
            启用止盈
          </label>
          {settings.takeProfit.enabled && (
            <>
              <div className="trigger-type">
                <label>
                  <input
                    type="radio"
                    value="percentage"
                    checked={settings.takeProfit.triggerType === 'percentage'}
                    onChange={(e) => handleSettingChange('takeProfit', {
                      ...settings.takeProfit,
                      triggerType: 'percentage'
                    })}
                  />
                  百分比
                </label>
                <label>
                  <input
                    type="radio"
                    value="price"
                    checked={settings.takeProfit.triggerType === 'price'}
                    onChange={(e) => handleSettingChange('takeProfit', {
                      ...settings.takeProfit,
                      triggerType: 'price'
                    })}
                  />
                  价格
                </label>
              </div>
              <input
                type="number"
                value={settings.takeProfit.triggerType === 'percentage'
                  ? settings.takeProfit.percentage || ''
                  : settings.takeProfit.price || ''
                }
                onChange={(e) => handleSettingChange('takeProfit', {
                  ...settings.takeProfit,
                  [settings.takeProfit.triggerType === 'percentage' ? 'percentage' : 'price']: Number(e.target.value)
                })}
                placeholder={settings.takeProfit.triggerType === 'percentage' ? '止盈百分比' : '止盈价格'}
              />
            </>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>追踪止损</h3>
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={settings.trailingStop.enabled}
              onChange={(e) => handleSettingChange('trailingStop', {
                ...settings.trailingStop,
                enabled: e.target.checked
              })}
            />
            启用追踪止损
          </label>
          {settings.trailingStop.enabled && (
            <>
              <div className="trigger-type">
                <label>
                  <input
                    type="radio"
                    value="percentage"
                    checked={settings.trailingStop.unit === 'percentage'}
                    onChange={(e) => handleSettingChange('trailingStop', {
                      ...settings.trailingStop,
                      unit: 'percentage'
                    })}
                  />
                  百分比
                </label>
                <label>
                  <input
                    type="radio"
                    value="price"
                    checked={settings.trailingStop.unit === 'price'}
                    onChange={(e) => handleSettingChange('trailingStop', {
                      ...settings.trailingStop,
                      unit: 'price'
                    })}
                  />
                  价格
                </label>
              </div>
              <input
                type="number"
                value={settings.trailingStop.distance}
                onChange={(e) => handleSettingChange('trailingStop', {
                  ...settings.trailingStop,
                  distance: Number(e.target.value)
                })}
                placeholder="追踪距离"
              />
            </>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>订单选项</h3>
        <div className="setting-group">
          <div className="time-in-force">
            <label>订单有效期:</label>
            <select
              value={settings.timeInForce}
              onChange={(e) => handleSettingChange('timeInForce', e.target.value as AdvancedSettings['timeInForce'])}
            >
              <option value="GTC">GTC - 成交为止</option>
              <option value="IOC">IOC - 立即成交或取消</option>
              <option value="FOK">FOK - 全部成交或取消</option>
            </select>
          </div>

          <label>
            <input
              type="checkbox"
              checked={settings.postOnly}
              onChange={(e) => handleSettingChange('postOnly', e.target.checked)}
            />
            只做挂单(Post Only)
          </label>

          <label>
            <input
              type="checkbox"
              checked={settings.reduceOnly}
              onChange={(e) => handleSettingChange('reduceOnly', e.target.checked)}
            />
            只减仓(Reduce Only)
          </label>
        </div>
      </div>
    </div>
  );
};

export default AdvancedOrderSettings; 