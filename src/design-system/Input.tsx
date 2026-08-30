import React from 'react';
import { cn } from './utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  dense?: boolean;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      leftIcon,
      rightIcon,
      error,
      dense = true,
      mono = false,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative inline-flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-text-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full bg-bg-input text-text-primary border border-border-subtle rounded transition-colors focus-ring',
            'placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed',
            dense ? 'h-7 text-xs px-2.5 py-1' : 'h-8 text-sm px-3 py-1.5',
            mono ? 'font-mono' : 'font-sans',
            leftIcon && (dense ? 'pl-8' : 'pl-9'),
            rightIcon && (dense ? 'pr-8' : 'pr-9'),
            error && 'border-severity-critical focus:border-severity-critical',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2.5 flex items-center text-text-muted">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
