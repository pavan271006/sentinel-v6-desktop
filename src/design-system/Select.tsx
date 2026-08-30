import React from 'react';
import { cn } from './utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  dense?: boolean;
  mono?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, dense = true, mono = false, disabled, className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          'bg-bg-input text-text-primary border border-border-subtle rounded transition-colors focus-ring cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          dense ? 'h-7 text-xs px-2.5 py-0.5' : 'h-8 text-sm px-3 py-1',
          mono ? 'font-mono' : 'font-sans',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';
