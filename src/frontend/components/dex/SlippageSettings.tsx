import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import Button from '../common/Button';
import Input from '../common/Input';

interface SlippageSettingsProps {
  defaultValue?: number;
  onChange: (value: number) => void;
  className?: string;
}

const PRESET_VALUES = [0.1, 0.5, 1.0];
const MAX_SLIPPAGE = 50;

const SlippageSettings: React.FC<SlippageSettingsProps> = ({
  defaultValue = 0.5,
  onChange,
  className
}) => {
  const [customValue, setCustomValue] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<number>(defaultValue);
  const [error, setError] = useState<string>();

  const handlePresetClick = (value: number) => {
    setCustomValue('');
    setSelectedValue(value);
    setError(undefined);
    onChange(value);
  };

  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomValue(value);

    const numValue = parseFloat(value);
    if (value && !isNaN(numValue)) {
      if (numValue <= 0) {
        setError('Slippage must be greater than 0%');
      } else if (numValue > MAX_SLIPPAGE) {
        setError(`Slippage cannot exceed ${MAX_SLIPPAGE}%`);
      } else {
        setError(undefined);
        setSelectedValue(numValue);
        onChange(numValue);
      }
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Slippage Tolerance
        </span>
        <div className="flex items-center space-x-1">
          <svg
            className="h-4 w-4 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-gray-500">
            Your transaction will revert if the price changes unfavorably by more than this percentage.
          </span>
        </div>
      </div>

      <div className="flex space-x-2">
        {PRESET_VALUES.map((value) => (
          <Button
            key={value}
            variant={selectedValue === value ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(value)}
            className="flex-1"
          >
            {value}%
          </Button>
        ))}
        <div className="flex-1">
          <Input
            type="number"
            value={customValue}
            onChange={handleCustomValueChange}
            placeholder="Custom"
            className="text-center"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      {selectedValue >= 3 && (
        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
          ⚠️ High slippage tolerance. Your trade may be front-run.
        </p>
      )}
    </div>
  );
};

export default SlippageSettings;
