import { create } from 'zustand';
import { DebugEvent, createDebugEvent, filterDebugEvents, groupDebugEvents } from '../utils/debug';

interface DebugState {
  isEnabled: boolean;
  logs: DebugEvent[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  filters: {
    level?: DebugEvent['level'];
    category?: DebugEvent['category'];
    search?: string;
    startTime?: string;
    endTime?: string;
  };
  setEnabled: (enabled: boolean) => void;
  setLogLevel: (level: DebugEvent['level']) => void;
  addLog: (event: Omit<DebugEvent, 'timestamp'>) => void;
  clearLogs: () => void;
  setFilters: (filters: Partial<DebugState['filters']>) => void;
  getFilteredLogs: () => DebugEvent[];
  getGroupedLogs: () => Record<string, DebugEvent[]>;
  getLogsByLevel: (level: DebugEvent['level']) => DebugEvent[];
  getLogsByCategory: (category: DebugEvent['category']) => DebugEvent[];
  getLatestLogs: (limit?: number) => DebugEvent[];
  getSummary: () => {
    total: number;
    by_level: Record<DebugEvent['level'], number>;
    by_category: Record<DebugEvent['category'], number>;
    latest_error?: DebugEvent;
    latest_warning?: DebugEvent;
  };
}

export const useDebugStore = create<DebugState>((set, get) => ({
  isEnabled: false,
  logs: [],
  logLevel: 'info',
  filters: {},

  setEnabled: (enabled) => set({ isEnabled: enabled }),
  
  setLogLevel: (level) => set({ logLevel: level }),

  addLog: (event) => {
    const newEvent = createDebugEvent(
      event.level,
      event.category,
      event.message,
      event.data,
      event.error
    );
    set((state) => ({
      logs: [newEvent, ...state.logs].slice(0, 1000)
    }));
  },

  clearLogs: () => set({ logs: [] }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),

  getFilteredLogs: () => {
    const { logs, filters } = get();
    return filterDebugEvents(logs, filters);
  },

  getGroupedLogs: () => {
    const filteredLogs = get().getFilteredLogs();
    return groupDebugEvents(filteredLogs);
  },

  getLogsByLevel: (level) => {
    const { logs } = get();
    return logs.filter(log => log.level === level);
  },

  getLogsByCategory: (category) => {
    const { logs } = get();
    return logs.filter(log => log.category === category);
  },

  getLatestLogs: (limit) => {
    const { logs } = get();
    return limit ? logs.slice(0, limit) : logs;
  },

  getSummary: () => {
    const { logs } = get();
    const summary = {
      total: logs.length,
      by_level: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      },
      by_category: {
        system: 0,
        market: 0,
        trading: 0,
        wallet: 0
      }
    };

    logs.forEach(log => {
      summary.by_level[log.level]++;
      summary.by_category[log.category]++;
    });

    return {
      ...summary,
      latest_error: logs.find(log => log.level === 'error'),
      latest_warning: logs.find(log => log.level === 'warn')
    };
  }
}));
