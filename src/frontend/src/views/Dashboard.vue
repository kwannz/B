<template>
  <div class="dashboard">
    <!-- 顶部状态栏 -->
    <div class="status-bar">
      <div class="status-item" :class="systemStatus">
        <i class="fas fa-circle"></i>
        系统状态: {{ systemStatus }}
      </div>
      <div class="status-item">
        <i class="fas fa-clock"></i>
        运行时间: {{ uptime }}
      </div>
      <div class="status-item">
        <i class="fas fa-chart-line"></i>
        当日盈亏: {{ dailyPnL }}
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧策略列表 -->
      <div class="strategy-list">
        <h2>交易策略</h2>
        <div class="strategy-controls">
          <button @click="createStrategy">
            <i class="fas fa-plus"></i> 新建策略
          </button>
          <button @click="importStrategy">
            <i class="fas fa-file-import"></i> 导入策略
          </button>
        </div>
        <div class="strategy-items">
          <div v-for="strategy in strategies" 
               :key="strategy.id" 
               class="strategy-item"
               :class="{ active: strategy.status === 'running' }"
               @click="selectStrategy(strategy)">
            <div class="strategy-info">
              <h3>{{ strategy.name }}</h3>
              <p>收益率: {{ strategy.performance.returns }}%</p>
            </div>
            <div class="strategy-actions">
              <button v-if="strategy.status === 'stopped'"
                      @click.stop="startStrategy(strategy.id)">
                <i class="fas fa-play"></i>
              </button>
              <button v-else
                      @click.stop="stopStrategy(strategy.id)">
                <i class="fas fa-stop"></i>
              </button>
              <button @click.stop="editStrategy(strategy)">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 中间图表区域 -->
      <div class="chart-area">
        <div class="chart-controls">
          <select v-model="selectedTimeframe">
            <option value="1h">1小时</option>
            <option value="4h">4小时</option>
            <option value="1d">1天</option>
            <option value="1w">1周</option>
          </select>
          <div class="chart-indicators">
            <button v-for="indicator in indicators"
                    :key="indicator.name"
                    :class="{ active: indicator.enabled }"
                    @click="toggleIndicator(indicator)">
              {{ indicator.name }}
            </button>
          </div>
        </div>
        <div class="chart-container" ref="chartContainer">
          <!-- TradingView图表将在这里渲染 -->
        </div>
      </div>

      <!-- 右侧信息面板 -->
      <div class="info-panel">
        <!-- 持仓信息 -->
        <div class="panel-section">
          <h3>当前持仓</h3>
          <div class="position-list">
            <div v-for="position in positions" 
                 :key="position.symbol"
                 class="position-item">
              <div class="position-header">
                <span class="symbol">{{ position.symbol }}</span>
                <span class="size" :class="position.side">
                  {{ position.side === 'long' ? '+' : '-' }}{{ position.size }}
                </span>
              </div>
              <div class="position-details">
                <div class="detail-item">
                  <span>入场价</span>
                  <span>{{ position.entryPrice }}</span>
                </div>
                <div class="detail-item">
                  <span>当前价</span>
                  <span>{{ position.currentPrice }}</span>
                </div>
                <div class="detail-item">
                  <span>盈亏</span>
                  <span :class="position.pnl >= 0 ? 'profit' : 'loss'">
                    {{ position.pnl }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 系统指标 -->
        <div class="panel-section">
          <h3>系统指标</h3>
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-label">CPU使用率</div>
              <div class="metric-value">{{ metrics.cpuUsage }}%</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">内存使用率</div>
              <div class="metric-value">{{ metrics.memoryUsage }}%</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">网络延迟</div>
              <div class="metric-value">{{ metrics.networkLatency }}ms</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">交易次数</div>
              <div class="metric-value">{{ metrics.tradeCount }}</div>
            </div>
          </div>
        </div>

        <!-- 告警信息 -->
        <div class="panel-section">
          <h3>系统告警</h3>
          <div class="alert-list">
            <div v-for="alert in alerts" 
                 :key="alert.id"
                 class="alert-item"
                 :class="alert.severity">
              <div class="alert-header">
                <span class="alert-severity">{{ alert.severity }}</span>
                <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
              </div>
              <div class="alert-message">{{ alert.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="footer-bar">
      <div class="status-item">
        <i class="fas fa-database"></i>
        数据延迟: {{ dataLatency }}ms
      </div>
      <div class="status-item">
        <i class="fas fa-exchange-alt"></i>
        交易延迟: {{ tradeLatency }}ms
      </div>
      <div class="status-item">
        <i class="fas fa-server"></i>
        API状态: {{ apiStatus }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { formatDistanceToNow } from 'date-fns'
import { createChart } from 'lightweight-charts'

export default {
  name: 'Dashboard',
  
  setup() {
    const store = useStore()
    const chartContainer = ref(null)
    const chart = ref(null)
    const selectedTimeframe = ref('1h')
    const systemStatus = ref('running')
    const dataLatency = ref(0)
    const tradeLatency = ref(0)
    const apiStatus = ref('正常')
    
    // 策略数据
    const strategies = ref([])
    const positions = ref([])
    const alerts = ref([])
    const metrics = ref({
      cpuUsage: 0,
      memoryUsage: 0,
      networkLatency: 0,
      tradeCount: 0
    })
    
    // 图表指标
    const indicators = ref([
      { name: 'MA', enabled: true },
      { name: 'MACD', enabled: false },
      { name: 'RSI', enabled: false },
      { name: 'BB', enabled: false }
    ])
    
    // 初始化图表
    const initChart = () => {
      if (chartContainer.value) {
        chart.value = createChart(chartContainer.value, {
          width: chartContainer.value.clientWidth,
          height: chartContainer.value.clientHeight,
          layout: {
            backgroundColor: '#253248',
            textColor: '#d9d9d9',
          },
          grid: {
            vertLines: {
              color: 'rgba(70, 130, 180, 0.5)',
            },
            horzLines: {
              color: 'rgba(70, 130, 180, 0.5)',
            },
          },
          crosshair: {
            mode: 0,
          },
          rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
          },
          timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
          },
        })
        
        // 添加K线图
        const candlestickSeries = chart.value.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350'
        })
        
        // 加载数据
        loadChartData(selectedTimeframe.value)
      }
    }
    
    // 加载图表数据
    const loadChartData = async (timeframe) => {
      try {
        const data = await store.dispatch('chart/fetchData', { timeframe })
        candlestickSeries.setData(data)
      } catch (error) {
        console.error('Failed to load chart data:', error)
      }
    }
    
    // 切换指标
    const toggleIndicator = (indicator) => {
      indicator.enabled = !indicator.enabled
      updateChartIndicators()
    }
    
    // 更新图表指标
    const updateChartIndicators = () => {
      // 实现指标更新逻辑
    }
    
    // 策略操作
    const createStrategy = () => {
      store.dispatch('strategy/openCreateDialog')
    }
    
    const importStrategy = () => {
      store.dispatch('strategy/openImportDialog')
    }
    
    const selectStrategy = (strategy) => {
      store.commit('strategy/setSelectedStrategy', strategy)
    }
    
    const startStrategy = async (strategyId) => {
      try {
        await store.dispatch('strategy/startStrategy', strategyId)
      } catch (error) {
        console.error('Failed to start strategy:', error)
      }
    }
    
    const stopStrategy = async (strategyId) => {
      try {
        await store.dispatch('strategy/stopStrategy', strategyId)
      } catch (error) {
        console.error('Failed to stop strategy:', error)
      }
    }
    
    const editStrategy = (strategy) => {
      store.dispatch('strategy/openEditDialog', strategy)
    }
    
    // 格式化时间
    const formatTime = (timestamp) => {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    }
    
    // 监听数据更新
    let dataUpdateInterval
    const startDataUpdate = () => {
      dataUpdateInterval = setInterval(async () => {
        try {
          await Promise.all([
            store.dispatch('strategy/fetchStrategies'),
            store.dispatch('position/fetchPositions'),
            store.dispatch('alert/fetchAlerts'),
            store.dispatch('metrics/fetchMetrics')
          ])
        } catch (error) {
          console.error('Failed to update data:', error)
        }
      }, 5000)
    }
    
    // 生命周期钩子
    onMounted(() => {
      initChart()
      startDataUpdate()
      
      // 监听窗口大小变化
      window.addEventListener('resize', () => {
        if (chart.value) {
          chart.value.resize(
            chartContainer.value.clientWidth,
            chartContainer.value.clientHeight
          )
        }
      })
    })
    
    onUnmounted(() => {
      if (dataUpdateInterval) {
        clearInterval(dataUpdateInterval)
      }
      if (chart.value) {
        chart.value.remove()
      }
    })
    
    return {
      chartContainer,
      selectedTimeframe,
      systemStatus,
      dataLatency,
      tradeLatency,
      apiStatus,
      strategies,
      positions,
      alerts,
      metrics,
      indicators,
      createStrategy,
      importStrategy,
      selectStrategy,
      startStrategy,
      stopStrategy,
      editStrategy,
      toggleIndicator,
      formatTime
    }
  }
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a2233;
  color: #d9d9d9;
}

.status-bar,
.footer-bar {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  background-color: #253248;
  border-bottom: 1px solid #34445c;
}

.footer-bar {
  border-top: 1px solid #34445c;
  border-bottom: none;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item i {
  font-size: 12px;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.strategy-list {
  width: 300px;
  padding: 20px;
  background-color: #253248;
  border-right: 1px solid #34445c;
  overflow-y: auto;
}

.strategy-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.strategy-controls button {
  flex: 1;
  padding: 8px;
  background-color: #3c5179;
  border: none;
  border-radius: 4px;
  color: #d9d9d9;
  cursor: pointer;
}

.strategy-controls button:hover {
  background-color: #4c6491;
}

.strategy-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin-bottom: 10px;
  background-color: #2c3e50;
  border-radius: 4px;
  cursor: pointer;
}

.strategy-item:hover {
  background-color: #34495e;
}

.strategy-item.active {
  border-left: 4px solid #4CAF50;
}

.strategy-actions {
  display: flex;
  gap: 8px;
}

.strategy-actions button {
  padding: 6px;
  background: none;
  border: none;
  color: #d9d9d9;
  cursor: pointer;
}

.strategy-actions button:hover {
  color: #4CAF50;
}

.chart-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.chart-indicators {
  display: flex;
  gap: 10px;
}

.chart-indicators button {
  padding: 6px 12px;
  background-color: #3c5179;
  border: none;
  border-radius: 4px;
  color: #d9d9d9;
  cursor: pointer;
}

.chart-indicators button.active {
  background-color: #4CAF50;
}

.chart-container {
  flex: 1;
  background-color: #253248;
  border-radius: 4px;
}

.info-panel {
  width: 350px;
  padding: 20px;
  background-color: #253248;
  border-left: 1px solid #34445c;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 30px;
}

.panel-section h3 {
  margin-bottom: 15px;
  color: #4CAF50;
}

.position-item {
  padding: 15px;
  margin-bottom: 10px;
  background-color: #2c3e50;
  border-radius: 4px;
}

.position-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.position-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.metric-item {
  padding: 15px;
  background-color: #2c3e50;
  border-radius: 4px;
  text-align: center;
}

.metric-label {
  font-size: 12px;
  color: #8c9eff;
  margin-bottom: 5px;
}

.metric-value {
  font-size: 18px;
  font-weight: bold;
}

.alert-item {
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.alert-item.info {
  background-color: #2196F3;
}

.alert-item.warning {
  background-color: #FF9800;
}

.alert-item.error {
  background-color: #f44336;
}

.alert-item.critical {
  background-color: #9C27B0;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.alert-message {
  font-size: 14px;
}

.profit {
  color: #4CAF50;
}

.loss {
  color: #f44336;
}
</style> 