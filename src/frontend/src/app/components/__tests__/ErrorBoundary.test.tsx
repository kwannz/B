import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary, { withErrorBoundary, useErrorBoundary } from '../ErrorBoundary';
import { LanguageContext, type Language } from '../../contexts/LanguageContext';
import { DebugContext, type DebugContextType } from '../../contexts/DebugContext';

// 模拟上下文
const mockLanguageContext = {
  language: 'zh' as Language,
  setLanguage: jest.fn()
};

const mockDebugContext: DebugContextType = {
  isDebugMode: true,
  log: jest.fn(),
  setDebugMode: jest.fn()
};

// 包装器组件
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LanguageContext.Provider value={mockLanguageContext}>
    <DebugContext.Provider value={mockDebugContext}>
      {children}
    </DebugContext.Provider>
  </LanguageContext.Provider>
);

// 抛出错误的组件
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('测试错误');
  }
  return <div>正常渲染</div>;
};

describe('ErrorBoundary', () => {
  // 在每个测试前重置console.error以避免日志污染
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('正常渲染子组件', () => {
    render(
      <ErrorBoundary>
        <div>测试内容</div>
      </ErrorBoundary>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  it('捕获并显示错误', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('出错了!')).toBeInTheDocument();
    expect(screen.getByText('测试错误')).toBeInTheDocument();
  });

  it('显示自定义fallback', () => {
    const fallback = <div>自定义错误显示</div>;
    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError />
      </ErrorBoundary>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('自定义错误显示')).toBeInTheDocument();
  });

  it('调用错误回调', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>,
      { wrapper: Wrapper }
    );

    expect(onError).toHaveBeenCalled();
  });

  it('重置后恢复正常渲染', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary
          onReset={() => setShouldThrow(false)}
        >
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />, { wrapper: Wrapper });
    
    expect(screen.getByText('出错了!')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('重试'));
    
    expect(screen.getByText('正常渲染')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('包装组件并处理错误', () => {
    const WrappedComponent = withErrorBoundary(ThrowError);
    
    render(<WrappedComponent />, { wrapper: Wrapper });
    
    expect(screen.getByText('出错了!')).toBeInTheDocument();
  });
});

describe('useErrorBoundary Hook', () => {
  const TestComponent = () => {
    const { hasError, error, handleError, reset } = useErrorBoundary();
    
    if (hasError) {
      return (
        <div>
          <div>Hook错误: {error?.message}</div>
          <button onClick={reset}>重置</button>
        </div>
      );
    }
    
    return (
      <button onClick={() => handleError(new Error('Hook测试错误'))}>
        触发错误
      </button>
    );
  };

  it('处理和重置错误状态', () => {
    render(<TestComponent />, { wrapper: Wrapper });
    
    fireEvent.click(screen.getByText('触发错误'));
    expect(screen.getByText('Hook错误: Hook测试错误')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('重置'));
    expect(screen.getByText('触发错误')).toBeInTheDocument();
  });
});

describe('调试模式功能', () => {
  it('在调试模式下显示错误堆栈', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('错误已记录到调试日志')).toBeInTheDocument();
    expect(mockDebugContext.log).toHaveBeenCalled();
  });

  it('在非调试模式下不显示错误堆栈', () => {
    const nonDebugContext: DebugContextType = {
      ...mockDebugContext,
      isDebugMode: false
    };

    render(
      <LanguageContext.Provider value={mockLanguageContext}>
        <DebugContext.Provider value={nonDebugContext}>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        </DebugContext.Provider>
      </LanguageContext.Provider>
    );

    expect(screen.queryByText('错误已记录到调试日志')).not.toBeInTheDocument();
  });
});

describe('国际化支持', () => {
  it('支持英文显示', () => {
    const englishContext = {
      ...mockLanguageContext,
      language: 'en' as Language
    };

    render(
      <LanguageContext.Provider value={englishContext}>
        <DebugContext.Provider value={mockDebugContext}>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        </DebugContext.Provider>
      </LanguageContext.Provider>
    );

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
