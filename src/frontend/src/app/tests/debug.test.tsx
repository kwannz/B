import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebugPanel } from '../components/DebugPanel';
import { DebugToolbar } from '../components/DebugToolbar';
import { DebugMetrics } from '../components/DebugMetrics';
import { DebugProvider, useDebug } from '../contexts/DebugContext';
import { useDebugStore } from '../stores/debugStore';
import { debugService } from '../services/DebugService';

jest.mock('../services/DebugService', () => ({
  debugService: {
    sendDebugEvent: jest.fn(),
    enableRealTimeDebugging: jest.fn(),
    disableRealTimeDebugging: jest.fn()
  }
}));

const TestComponent = () => {
  const { isDebugMode, toggleDebugMode, addDebugLog } = useDebug();
  
  return (
    <div>
      <button onClick={toggleDebugMode}>
        Toggle Debug
      </button>
      <button onClick={() => addDebugLog({
        level: 'error',
        category: 'system',
        message: 'Test error',
        data: { test: true }
      })}>
        Add Log
      </button>
      <div data-testid="debug-status">
        {isDebugMode ? 'Debug On' : 'Debug Off'}
      </div>
    </div>
  );
};

describe('Debug System', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: false,
      logs: [],
      logLevel: 'info',
      filters: {}
    });
  });

  it('should toggle debug mode', () => {
    render(
      <DebugProvider>
        <TestComponent />
      </DebugProvider>
    );

    expect(screen.getByTestId('debug-status')).toHaveTextContent('Debug Off');
    
    fireEvent.click(screen.getByText('Toggle Debug'));
    expect(screen.getByTestId('debug-status')).toHaveTextContent('Debug On');
    
    fireEvent.click(screen.getByText('Toggle Debug'));
    expect(screen.getByTestId('debug-status')).toHaveTextContent('Debug Off');
  });

  it('should add and display debug logs', () => {
    render(
      <DebugProvider>
        <TestComponent />
        <DebugPanel />
      </DebugProvider>
    );

    fireEvent.click(screen.getByText('Toggle Debug'));
    fireEvent.click(screen.getByText('Add Log'));

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should filter logs by level', () => {
    const { result } = renderHook(() => useDebugStore());

    act(() => {
      result.current.addLog({
        level: 'error',
        category: 'system',
        message: 'Error log',
        data: {}
      });
      result.current.addLog({
        level: 'info',
        category: 'system',
        message: 'Info log',
        data: {}
      });
      result.current.setFilters({ level: 'error' });
    });

    const filteredLogs = result.current.getFilteredLogs();
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].message).toBe('Error log');
  });

  it('should update metrics in real-time', async () => {
    render(
      <DebugProvider>
        <DebugMetrics />
      </DebugProvider>
    );

    fireEvent.click(screen.getByText('Toggle Debug'));

    await act(async () => {
      useDebugStore.setState(state => ({
        logs: [
          ...state.logs,
          {
            timestamp: new Date().toISOString(),
            level: 'warn',
            category: 'system',
            message: 'High CPU usage',
            data: { cpu_usage: 0.9 }
          }
        ]
      }));
    });

    expect(screen.getByText(/High CPU usage/)).toBeInTheDocument();
  });

  it('should handle WebSocket events', () => {
    const mockWebSocket = {
      send: jest.fn(),
      close: jest.fn()
    };

    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

    render(
      <DebugProvider>
        <DebugToolbar />
      </DebugProvider>
    );

    fireEvent.click(screen.getByText('Toggle Debug'));
    fireEvent.click(screen.getByText('Refresh'));

    expect(debugService.enableRealTimeDebugging).toHaveBeenCalled();
  });

  it('should export debug logs', () => {
    const { result } = renderHook(() => useDebugStore());

    act(() => {
      result.current.addLog({
        level: 'error',
        category: 'system',
        message: 'Test error',
        data: { test: true }
      });
    });

    const logs = result.current.getLatestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Test error');

    const jsonExport = result.current.exportLogs('json');
    expect(JSON.parse(jsonExport)).toHaveLength(1);
  });
});
