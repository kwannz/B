import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import { useToast } from '../../contexts/ToastContext';

interface TradingSettings {
  defaultLeverage: number;
  riskLimit: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  tradingEnabled: boolean;
}

interface NotificationSettings {
  emailNotifications: boolean;
  orderNotifications: boolean;
  priceAlerts: boolean;
  marginCallWarning: boolean;
}

interface APISettings {
  apiKey: string;
  apiSecret: string;
  exchangeType: 'binance' | 'okex' | 'huobi';
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tradingSettings, setTradingSettings] = useState<TradingSettings>({
    defaultLeverage: 1,
    riskLimit: 1000,
    stopLossPercentage: 10,
    takeProfitPercentage: 20,
    tradingEnabled: true
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    orderNotifications: true,
    priceAlerts: true,
    marginCallWarning: true
  });

  const [apiSettings, setApiSettings] = useState<APISettings>({
    apiKey: '',
    apiSecret: '',
    exchangeType: 'binance'
  });

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tradingData, notificationData, apiData] = await Promise.all([
        api.getTradingSettings(),
        api.getNotificationSettings(),
        api.getAPISettings()
      ]);

      setTradingSettings(tradingData.data);
      setNotificationSettings(notificationData.data);
      setApiSettings(apiData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTradingSettingsSave = async () => {
    try {
      setSaving(true);
      await api.updateTradingSettings(tradingSettings);
      showToast('交易设置已更新', 'success');
    } catch (err) {
      setError('保存交易设置失败');
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationSettingsSave = async () => {
    try {
      setSaving(true);
      await api.updateNotificationSettings(notificationSettings);
      showToast('通知设置已更新', 'success');
    } catch (err) {
      setError('保存通知设置失败');
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAPISettingsSave = async () => {
    try {
      setSaving(true);
      await api.updateAPISettings(apiSettings);
      showToast('API设置已更新', 'success');
    } catch (err) {
      setError('保存API设置失败');
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="settings-login-prompt">
        <h2>请先登录</h2>
        <p>登录后修改您的设置</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadSettings} />;
  }

  return (
    <div className="settings-page">
      <h1>设置</h1>

      <section className="settings-section">
        <h2>交易设置</h2>
        <div className="settings-form">
          <div className="form-group">
            <label>默认杠杆</label>
            <input
              type="number"
              min="1"
              max="100"
              value={tradingSettings.defaultLeverage}
              onChange={(e) => setTradingSettings({
                ...tradingSettings,
                defaultLeverage: Number(e.target.value)
              })}
            />
          </div>

          <div className="form-group">
            <label>风险限额</label>
            <input
              type="number"
              min="0"
              value={tradingSettings.riskLimit}
              onChange={(e) => setTradingSettings({
                ...tradingSettings,
                riskLimit: Number(e.target.value)
              })}
            />
          </div>

          <div className="form-group">
            <label>止损百分比</label>
            <input
              type="number"
              min="0"
              max="100"
              value={tradingSettings.stopLossPercentage}
              onChange={(e) => setTradingSettings({
                ...tradingSettings,
                stopLossPercentage: Number(e.target.value)
              })}
            />
          </div>

          <div className="form-group">
            <label>止盈百分比</label>
            <input
              type="number"
              min="0"
              max="100"
              value={tradingSettings.takeProfitPercentage}
              onChange={(e) => setTradingSettings({
                ...tradingSettings,
                takeProfitPercentage: Number(e.target.value)
              })}
            />
          </div>

          <div className="form-group">
            <label>启用交易</label>
            <input
              type="checkbox"
              checked={tradingSettings.tradingEnabled}
              onChange={(e) => setTradingSettings({
                ...tradingSettings,
                tradingEnabled: e.target.checked
              })}
            />
          </div>

          <button 
            onClick={handleTradingSettingsSave}
            disabled={saving}
          >
            保存交易设置
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>通知设置</h2>
        <div className="settings-form">
          <div className="form-group">
            <label>邮件通知</label>
            <input
              type="checkbox"
              checked={notificationSettings.emailNotifications}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                emailNotifications: e.target.checked
              })}
            />
          </div>

          <div className="form-group">
            <label>订单通知</label>
            <input
              type="checkbox"
              checked={notificationSettings.orderNotifications}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                orderNotifications: e.target.checked
              })}
            />
          </div>

          <div className="form-group">
            <label>价格提醒</label>
            <input
              type="checkbox"
              checked={notificationSettings.priceAlerts}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                priceAlerts: e.target.checked
              })}
            />
          </div>

          <div className="form-group">
            <label>保证金预警</label>
            <input
              type="checkbox"
              checked={notificationSettings.marginCallWarning}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                marginCallWarning: e.target.checked
              })}
            />
          </div>

          <button 
            onClick={handleNotificationSettingsSave}
            disabled={saving}
          >
            保存通知设置
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>API设置</h2>
        <div className="settings-form">
          <div className="form-group">
            <label>交易所</label>
            <select
              value={apiSettings.exchangeType}
              onChange={(e) => setApiSettings({
                ...apiSettings,
                exchangeType: e.target.value as 'binance' | 'okex' | 'huobi'
              })}
            >
              <option value="binance">Binance</option>
              <option value="okex">OKEx</option>
              <option value="huobi">Huobi</option>
            </select>
          </div>

          <div className="form-group">
            <label>API Key</label>
            <input
              type="text"
              value={apiSettings.apiKey}
              onChange={(e) => setApiSettings({
                ...apiSettings,
                apiKey: e.target.value
              })}
            />
          </div>

          <div className="form-group">
            <label>API Secret</label>
            <input
              type="password"
              value={apiSettings.apiSecret}
              onChange={(e) => setApiSettings({
                ...apiSettings,
                apiSecret: e.target.value
              })}
            />
          </div>

          <button 
            onClick={handleAPISettingsSave}
            disabled={saving}
          >
            保存API设置
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings; 