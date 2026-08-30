import React from 'react';
import { cn } from './utils';

export type BadgeVariant =
  | 'default'
  | 'neutral'
  | 'outline'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'
  | 'success'
  | 'warning'
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'websocket'
  | 'graphql'
  | 'scope-in'
  | 'scope-out'
  | 'scope-deny';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'xs',
  children,
  className,
  ...props
}) => {
  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.2 h-4 font-mono font-medium rounded',
    sm: 'text-xs px-2 py-0.5 h-5 font-mono font-medium rounded',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-bg-panel-elevated text-text-secondary border border-border-subtle',
    neutral: 'bg-bg-panel-elevated text-text-secondary border border-border-subtle',
    outline: 'bg-transparent text-text-primary border border-border-strong',
    critical: 'bg-severity-critical-bg text-severity-critical border border-severity-critical/40 font-semibold',
    high: 'bg-severity-high-bg text-severity-high border border-severity-high/40 font-semibold',
    medium: 'bg-severity-medium-bg text-severity-medium border border-severity-medium/40 font-semibold',
    low: 'bg-severity-low-bg text-severity-low border border-severity-low/40 font-semibold',
    info: 'bg-severity-info-bg text-severity-info border border-severity-info/40',
    success: 'bg-severity-low-bg text-severity-low border border-severity-low/40',
    warning: 'bg-severity-medium-bg text-severity-medium border border-severity-medium/40',
    get: 'bg-[#00381e] text-[#00ff88] border border-[#00ff88]/30 font-bold',
    post: 'bg-[#472f00] text-[#ffaa00] border border-[#ffaa00]/30 font-bold',
    put: 'bg-[#002e47] text-[#38bdf8] border border-[#38bdf8]/30 font-bold',
    delete: 'bg-[#4a0018] text-[#ff0055] border border-[#ff0055]/30 font-bold',
    patch: 'bg-[#3b1261] text-[#bc8cff] border border-[#bc8cff]/30 font-bold',
    options: 'bg-bg-panel-elevated text-text-muted border border-border-subtle font-bold',
    websocket: 'bg-[#380d54] text-[#a855f7] border border-[#a855f7]/30 font-bold',
    graphql: 'bg-[#4a0a32] text-[#ec4899] border border-[#ec4899]/30 font-bold',
    'scope-in': 'bg-[#00381e] text-[#00ff88] border border-[#00ff88]/40 font-semibold',
    'scope-out': 'bg-[#2b1700] text-[#ffaa00] border border-[#ffaa00]/40 font-semibold',
    'scope-deny': 'bg-[#4a0018] text-[#ff0055] border border-[#ff0055]/50 font-bold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center select-none tracking-tight',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: string; className?: string }> = ({ severity, className }) => {
  const s = severity.toUpperCase();
  let variant: BadgeVariant = 'info';
  if (s === 'CRITICAL') variant = 'critical';
  else if (s === 'HIGH') variant = 'high';
  else if (s === 'MEDIUM') variant = 'medium';
  else if (s === 'LOW') variant = 'low';
  else if (s === 'INFO') variant = 'info';

  return (
    <Badge variant={variant} className={className}>
      {s}
    </Badge>
  );
};

export const MethodBadge: React.FC<{ method: string; className?: string }> = ({ method, className }) => {
  const m = method.toUpperCase();
  let variant: BadgeVariant = 'default';
  if (m === 'GET') variant = 'get';
  else if (m === 'POST') variant = 'post';
  else if (m === 'PUT') variant = 'put';
  else if (m === 'DELETE') variant = 'delete';
  else if (m === 'PATCH') variant = 'patch';
  else if (m === 'OPTIONS' || m === 'HEAD') variant = 'options';
  else if (m === 'WS' || m === 'WSS') variant = 'websocket';
  else if (m === 'GQL' || m === 'GRAPHQL') variant = 'graphql';

  return (
    <Badge variant={variant} className={className}>
      {m}
    </Badge>
  );
};

export const StatusBadge: React.FC<{ status: number; label?: string; className?: string }> = ({
  status,
  label,
  className,
}) => {
  let colorClass = 'text-text-secondary bg-bg-panel border-border-subtle';
  if (status >= 200 && status < 300) {
    colorClass = 'text-severity-low bg-severity-low-bg border-severity-low/30 font-bold';
  } else if (status >= 300 && status < 400) {
    colorClass = 'text-severity-info bg-severity-info-bg border-severity-info/30 font-bold';
  } else if (status >= 400 && status < 500) {
    colorClass = 'text-severity-medium bg-severity-medium-bg border-severity-medium/30 font-bold';
  } else if (status >= 500) {
    colorClass = 'text-severity-critical bg-severity-critical-bg border-severity-critical/30 font-bold';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-mono text-[10px] px-1.5 py-0.2 rounded border',
        colorClass,
        className
      )}
    >
      {label || status}
    </span>
  );
};
