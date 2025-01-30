import { ApiError } from '../api/client';

export interface DebugEvent {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'system' | 'market' | 'trading' | 'wallet';
  message: string;
  data?: Record<string, any>;
  error?: ApiError;
}

export const createDebugEvent = (
  level: DebugEvent['level'],
  category: DebugEvent['category'],
  message: string,
  data?: Record<string, any>,
  error?: ApiError
): DebugEvent => ({
  timestamp: new Date().toISOString(),
  level,
  category,
  message,
  data,
  error
});

export const formatDebugData = (data: Record<string, any>): string => {
  try {
    return JSON.stringify(data, (key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }, 2);
  } catch (err) {
    return `[Error formatting debug data: ${err instanceof Error ? err.message : String(err)}]`;
  }
};

export const parseDebugLevel = (level: string): DebugEvent['level'] => {
  switch (level.toLowerCase()) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return level.toLowerCase() as DebugEvent['level'];
    default:
      return 'info';
  }
};

export const shouldLogDebugEvent = (
  eventLevel: DebugEvent['level'],
  configLevel: DebugEvent['level']
): boolean => {
  const levels: Record<DebugEvent['level'], number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  return levels[eventLevel] >= levels[configLevel];
};

export const createErrorEvent = (
  error: unknown,
  category: DebugEvent['category'],
  context?: Record<string, any>
): DebugEvent => {
  let message: string;
  let data: Record<string, any> = { ...context };

  if (error instanceof Error) {
    message = error.message;
    data = {
      ...data,
      name: error.name,
      stack: error.stack
    };
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'An unknown error occurred';
    data = { ...data, error };
  }

  return createDebugEvent('error', category, message, data);
};

export const sanitizeDebugData = (data: Record<string, any>): Record<string, any> => {
  const sensitiveKeys = ['privateKey', 'secret', 'password', 'token', 'key'];
  
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      acc[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      acc[key] = sanitizeDebugData(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
};

export const groupDebugEvents = (events: DebugEvent[]): Record<string, DebugEvent[]> => {
  return events.reduce((groups, event) => {
    const key = `${event.category}_${event.level}`;
    return {
      ...groups,
      [key]: [...(groups[key] || []), event]
    };
  }, {} as Record<string, DebugEvent[]>);
};

export const filterDebugEvents = (
  events: DebugEvent[],
  filters: {
    level?: DebugEvent['level'];
    category?: DebugEvent['category'];
    search?: string;
    startTime?: string;
    endTime?: string;
  }
): DebugEvent[] => {
  return events.filter(event => {
    if (filters.level && event.level !== filters.level) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.search && !event.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.startTime && event.timestamp < filters.startTime) return false;
    if (filters.endTime && event.timestamp > filters.endTime) return false;
    return true;
  });
};

export const exportDebugEvents = (
  events: DebugEvent[],
  format: 'json' | 'csv' = 'json'
): string => {
  if (format === 'json') {
    return JSON.stringify(events, null, 2);
  }

  const headers = ['timestamp', 'level', 'category', 'message', 'data'];
  const rows = events.map(event => [
    event.timestamp,
    event.level,
    event.category,
    event.message,
    formatDebugData(event.data || {})
  ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
};
