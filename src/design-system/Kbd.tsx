import React from 'react';
import { cn } from './utils';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd: React.FC<KbdProps> = ({ children, className, ...props }) => {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium',
        'bg-bg-input text-text-secondary border border-border-strong rounded shadow-sm select-none',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
};
