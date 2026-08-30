import React from 'react';
import { cn } from './utils';
import { Tooltip } from './Tooltip';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'danger' | 'ghost' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabledReason?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'sm',
      loading = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabledReason,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isCurrentlyLoading = loading || isLoading;
    const isDisabled = disabled || Boolean(disabledReason) || isCurrentlyLoading;

    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-ring select-none rounded disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeStyles = {
      xs: 'text-xs px-2 py-0.5 gap-1 h-6',
      sm: 'text-xs px-2.5 py-1 gap-1.5 h-7',
      md: 'text-sm px-3 py-1.5 gap-2 h-8',
      lg: 'text-base px-4 py-2 gap-2.5 h-10',
    };

    const variantStyles = {
      primary: 'bg-accent-cyan text-text-inverse hover:brightness-110 active:brightness-95 border border-transparent font-semibold',
      secondary: 'bg-bg-panel-elevated text-text-primary hover:bg-bg-panel-hover border border-border-subtle active:border-border-strong',
      destructive: 'bg-severity-critical text-text-primary hover:brightness-110 active:brightness-95 border border-transparent',
      danger: 'bg-severity-critical text-text-primary hover:brightness-110 active:brightness-95 border border-transparent',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-panel-hover border border-transparent',
      outline: 'bg-transparent text-text-primary hover:bg-bg-panel-hover border border-border-strong',
      subtle: 'bg-bg-panel text-text-secondary hover:text-text-primary border border-border-subtle',
    };

    const buttonElement = (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isCurrentlyLoading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isCurrentlyLoading && rightIcon}
      </button>
    );

    if (disabledReason) {
      return (
        <Tooltip content={<span className="text-severity-medium">{disabledReason}</span>}>
          <span className="inline-block cursor-not-allowed">{buttonElement}</span>
        </Tooltip>
      );
    }

    return buttonElement;
  }
);

Button.displayName = 'Button';
