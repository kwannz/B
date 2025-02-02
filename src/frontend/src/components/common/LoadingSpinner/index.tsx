import React from 'react';
import './styles.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  overlay = false,
  text = '加载中...'
}) => {
  const spinnerContent = (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner"></div>
      {text && <div className="spinner-text">{text}</div>}
    </div>
  );

  if (overlay) {
    return (
      <div className="loading-overlay">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};

export default LoadingSpinner; 