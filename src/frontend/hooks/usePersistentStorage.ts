import { useCallback } from 'react';

type StorageType = 'local' | 'session';

interface StorageOptions {
  type?: StorageType;
  prefix?: string;
}

export const usePersistentStorage = (options: StorageOptions = {}) => {
  const { type = 'local', prefix = 'tradingbot_' } = options;
  const storage = type === 'local' ? localStorage : sessionStorage;

  const getItem = useCallback(<T>(key: string, defaultValue?: T): T | undefined => {
    try {
      const item = storage.getItem(`${prefix}${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from ${type}Storage:`, error);
      return defaultValue;
    }
  }, [storage, prefix, type]);

  const setItem = useCallback(<T>(key: string, value: T): void => {
    try {
      storage.setItem(`${prefix}${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to ${type}Storage:`, error);
      throw error;
    }
  }, [storage, prefix, type]);

  const removeItem = useCallback((key: string): void => {
    try {
      storage.removeItem(`${prefix}${key}`);
    } catch (error) {
      console.error(`Error removing ${key} from ${type}Storage:`, error);
      throw error;
    }
  }, [storage, prefix, type]);

  const clear = useCallback((): void => {
    try {
      // Only clear items with our prefix
      const keys = Object.keys(storage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          storage.removeItem(key);
        }
      });
    } catch (error) {
      console.error(`Error clearing ${type}Storage:`, error);
      throw error;
    }
  }, [storage, prefix, type]);

  return {
    getItem,
    setItem,
    removeItem,
    clear,
  };
};

export const createStorageKey = (base: string, ...parts: (string | number)[]) => {
  return [base, ...parts].join('_');
};
