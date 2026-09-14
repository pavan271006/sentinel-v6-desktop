import React from 'react';
import { cn } from './utils';
import { Tooltip } from './Tooltip';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'danger' | 'ghost' | 'outline' | 'subtle' | 'cyber' | 'glass';
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
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-ring select-none rounded-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

    const sizeStyles = {
      xs: 'text-xs px-2 py-0.5 gap-1 h-6',
      sm: 'text-xs px-2.5 py-1 gap-1.5 h-7',
      md: 'text-sm px-3.5 py-1.5 gap-2 h-8',
      lg: 'text-base px-5 py-2.5 gap-2.5 h-10',
    };

    const variantStyles = {
      primary: 'bg-accent-cyan text-text-inverse hover:brightness-110 active:brightness-95 border border-transparent font-semibold shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)]',
      secondary: 'bg-bg-panel-elevated text-text-primary hover:bg-bg-panel-hover border border-border-subtle hover:border-border-strong active:border-border-strong shadow-sm',
      destructive: 'bg-severity-critical text-white hover:brightness-110 active:brightness-95 border border-transparent font-semibold shadow-[0_0_12px_rgba(244,63,94,0.3)]',
      danger: 'bg-severity-critical text-white hover:brightness-110 active:brightness-95 border border-transparent font-semibold shadow-[0_0_12px_rgba(244,63,94,0.3)]',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-panel-hover border border-transparent',
      outline: 'bg-transparent text-text-primary hover:bg-bg-panel-hover border border-border-strong hover:border-accent-cyan/50',
      subtle: 'bg-bg-panel text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-strong',
      cyber: 'bg-gradient-to-r from-accent-cyan/15 to-accent-blue/15 text-accent-cyan hover:text-white border border-accent-cyan/40 hover:border-accent-cyan rounded-md shadow-[0_0_12px_rgba(0,240,255,0.2)] font-semibold',
      glass: 'bg-bg-panel-elevated/60 backdrop-blur-md text-text-primary hover:bg-bg-panel-elevated border border-border-subtle shadow-sm',
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
