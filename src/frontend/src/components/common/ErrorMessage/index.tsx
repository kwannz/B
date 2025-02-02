import React from 'react';
import './styles.css';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  description?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  description
}) => {
  return (
    <div className="error-message">
      <div className="error-icon">❌</div>
      <h3 className="error-title">{message}</h3>
      {description && (
        <p className="error-description">{description}</p>
      )}
      {onRetry && (
        <button 
          className="retry-button"
          onClick={onRetry}
        >
          重试
        </button>
      )}
    </div>
  );
};

export default ErrorMessage; 