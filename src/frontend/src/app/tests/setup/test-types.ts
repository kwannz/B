import { createWallet, getWallet, createBot, getBotStatus, transferSOL } from '../../api/client';

export type MockedFunction<T extends (...args: any) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  mockClear: () => void;
  mockReset: () => void;
  mockImplementation: (fn: (...args: Parameters<T>) => ReturnType<T>) => MockedFunction<T>;
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => MockedFunction<T>;
  mockRejectedValue: (error: unknown) => MockedFunction<T>;
};

export type MockedAPI = {
  createWallet: MockedFunction<typeof createWallet>;
  getWallet: MockedFunction<typeof getWallet>;
  createBot: MockedFunction<typeof createBot>;
  getBotStatus: MockedFunction<typeof getBotStatus>;
  transferSOL: MockedFunction<typeof transferSOL>;
};

export const createMockFunction = <T extends (...args: any) => any>(): MockedFunction<T> => {
  const mock = jest.fn() as MockedFunction<T>;
  mock.mockClear = jest.fn();
  mock.mockReset = jest.fn();
  mock.mockImplementation = jest.fn();
  mock.mockResolvedValue = jest.fn();
  mock.mockRejectedValue = jest.fn();
  return mock;
};

export const createMockedAPI = (): MockedAPI => ({
  createWallet: createMockFunction(),
  getWallet: createMockFunction(),
  createBot: createMockFunction(),
  getBotStatus: createMockFunction(),
  transferSOL: createMockFunction()
});
