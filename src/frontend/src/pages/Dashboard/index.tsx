import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import AccountSummary from '../../components/AccountSummary';
import PositionsList from '../../components/PositionsList';
import RecentOrders from '../../components/RecentOrders';
import ProfitLoss from '../../components/ProfitLoss';
import AdvancedOrderSettings from '../../components/AdvancedOrderSettings';
import TradingStrategyConfig from '../../components/TradingStrategyConfig';
import RiskManagement from '../../components/RiskManagement';
import { useToast } from '../../contexts/ToastContext';
import type { AdvancedSettings } from '../../components/AdvancedOrderSettings';
import type { TradingStrategy } from '../../components/TradingStrategyConfig';

interface DashboardData {
  account: {
    balance: { [key: string]: number };
    totalEquity: number;
    availableMargin: number;
    usedMargin: number;
  };
  positions: Array<{
    symbol: string;
    size: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
    margin: number;
  }>;
  orders: Array<{
    id: string;
    symbol: string;
    type: string;
    side: string;
    price: number;
    quantity: number;
    status: string;
    timestamp: string;
  }>;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
  };
}

// 添加错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>出现了一些问题</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<'overview' | 'strategy' | 'risk'>('overview');

  // 添加调试日志
  const DEBUG = process.env.NODE_ENV === 'development';
  
  const logDebug = useCallback((message: string, data?: any) => {
    if (DEBUG) {
      console.log(`[Dashboard] ${message}`, data);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    logDebug('Component mounted, loading initial data');
    loadDashboardData();
    
    const interval = setInterval(() => {
      logDebug('Auto-refresh triggered');
      loadDashboardData();
    }, 30000);
    
    return () => {
      logDebug('Component unmounting, clearing interval');
      clearInterval(interval);
    };
  }, [user]);

  const loadDashboardData = async () => {
    try {
      logDebug('Loading dashboard data');
      setError(null);

      const startTime = performance.now();
      const [accountData, positionsData, ordersData, performanceData] = await Promise.all([
        api.getAccountBalance(),
        api.getPositions(),
        api.getRecentOrders(),
        api.getPerformance()
      ]);
      const endTime = performance.now();
      
      logDebug(`Data loaded in ${endTime - startTime}ms`, {
        accountData,
        positionsData,
        ordersData,
        performanceData
      });

      setData({
        account: accountData.data,
        positions: positionsData.data,
        orders: ordersData.data,
        performance: performanceData.data
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败';
      logDebug('Error loading data', err);
      setError(errorMessage);
      showToast('加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedSettingsChange = async (settings: AdvancedSettings) => {
    try {
      logDebug('Updating advanced settings', settings);
      await api.updateAdvancedSettings(settings);
      showToast('高级设置已更新', 'success');
    } catch (err) {
      logDebug('Error updating advanced settings', err);
      showToast('更新设置失败', 'error');
    }
  };

  const handleStrategyChange = async (strategy: TradingStrategy) => {
    try {
      logDebug('Updating trading strategy', strategy);
      await api.updateTradingStrategy(strategy);
      showToast('交易策略已更新', 'success');
    } catch (err) {
      logDebug('Error updating trading strategy', err);
      showToast('更新策略失败', 'error');
    }
  };

  const handleRiskLimitChange = async (limits: any) => {
    try {
      logDebug('Updating risk limits', limits);
      await api.updateRiskLimits(limits);
      showToast('风险限额已更新', 'success');
    } catch (err) {
      logDebug('Error updating risk limits', err);
      showToast('更新风险限额失败', 'error');
    }
  };

  if (!user) {
    return (
      <div className="dashboard-login-prompt">
        <h2>请先登录</h2>
        <p>登录后查看您的交易数据</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner overlay text="加载数据中..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadDashboardData} />;
  }

  if (!data) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>交易仪表盘</h1>
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              总览
            </button>
            <button
              className={`tab-button ${activeTab === 'strategy' ? 'active' : ''}`}
              onClick={() => setActiveTab('strategy')}
            >
              策略配置
            </button>
            <button
              className={`tab-button ${activeTab === 'risk' ? 'active' : ''}`}
              onClick={() => setActiveTab('risk')}
            >
              风险管理
            </button>
          </div>
          <button onClick={loadDashboardData} className="refresh-btn">
            刷新
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="dashboard-grid">
            <div className="account-section">
              <AccountSummary 
                balance={data.account.balance}
                totalEquity={data.account.totalEquity}
                availableMargin={data.account.availableMargin}
                usedMargin={data.account.usedMargin}
              />
            </div>

            <div className="pnl-section">
              <ProfitLoss
                data={data.performance}
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
              />
            </div>

            <div className="positions-section">
              <PositionsList 
                positions={data.positions}
                onPositionClose={async (symbol) => {
                  try {
                    await api.closePosition(symbol);
                    await loadDashboardData();
                    showToast('持仓已平仓', 'success');
                  } catch (err) {
                    showToast('平仓失败', 'error');
                  }
                }}
              />
            </div>

            <div className="orders-section">
              <RecentOrders 
                orders={data.orders}
                onOrderCancel={async (orderId) => {
                  try {
                    await api.cancelOrder(orderId);
                    await loadDashboardData();
                    showToast('订单已取消', 'success');
                  } catch (err) {
                    showToast('取消订单失败', 'error');
                  }
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="strategy-container">
            <div className="strategy-section">
              <h2>高级订单设置</h2>
              <AdvancedOrderSettings
                onSettingsChange={handleAdvancedSettingsChange}
              />
            </div>

            <div className="strategy-section">
              <h2>交易策略配置</h2>
              <TradingStrategyConfig
                onStrategyChange={handleStrategyChange}
              />
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="risk-container">
            <RiskManagement
              accountBalance={data.account.totalEquity}
              positions={data.positions}
              onRiskLimitChange={handleRiskLimitChange}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard; 