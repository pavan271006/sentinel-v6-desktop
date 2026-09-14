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
    xs: 'text-[10px] px-2 py-0.5 h-4.5 font-mono font-medium rounded-full',
    sm: 'text-xs px-2.5 py-0.5 h-5.5 font-mono font-medium rounded-full',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-bg-panel-elevated/80 text-text-secondary border border-border-subtle',
    neutral: 'bg-bg-panel-elevated/80 text-text-secondary border border-border-subtle',
    outline: 'bg-transparent text-text-primary border border-border-strong',
    critical: 'bg-severity-critical/15 text-severity-critical border border-severity-critical/40 font-semibold shadow-[0_0_8px_rgba(244,63,94,0.2)]',
    high: 'bg-severity-high/15 text-severity-high border border-severity-high/40 font-semibold shadow-[0_0_8px_rgba(249,115,22,0.2)]',
    medium: 'bg-severity-medium/15 text-severity-medium border border-severity-medium/40 font-semibold shadow-[0_0_8px_rgba(234,179,8,0.2)]',
    low: 'bg-severity-low/15 text-severity-low border border-severity-low/40 font-semibold shadow-[0_0_8px_rgba(56,189,248,0.2)]',
    info: 'bg-severity-info/15 text-severity-info border border-severity-info/40',
    success: 'bg-accent-green/15 text-accent-green border border-accent-green/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
    warning: 'bg-severity-medium/15 text-severity-medium border border-severity-medium/40',
    get: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 font-bold shadow-[0_0_6px_rgba(16,185,129,0.2)]',
    post: 'bg-amber-950/60 text-amber-400 border border-amber-500/40 font-bold shadow-[0_0_6px_rgba(245,158,11,0.2)]',
    put: 'bg-sky-950/60 text-sky-400 border border-sky-500/40 font-bold shadow-[0_0_6px_rgba(56,189,248,0.2)]',
    delete: 'bg-rose-950/60 text-rose-400 border border-rose-500/40 font-bold shadow-[0_0_6px_rgba(244,63,94,0.2)]',
    patch: 'bg-purple-950/60 text-purple-400 border border-purple-500/40 font-bold shadow-[0_0_6px_rgba(168,85,247,0.2)]',
    options: 'bg-bg-panel-elevated text-text-muted border border-border-subtle font-bold',
    websocket: 'bg-fuchsia-950/60 text-fuchsia-400 border border-fuchsia-500/40 font-bold shadow-[0_0_6px_rgba(217,70,239,0.2)]',
    graphql: 'bg-pink-950/60 text-pink-400 border border-pink-500/40 font-bold shadow-[0_0_6px_rgba(236,72,153,0.2)]',
    'scope-in': 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/50 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.25)]',
    'scope-out': 'bg-amber-950/70 text-amber-400 border border-amber-500/50 font-semibold',
    'scope-deny': 'bg-rose-950/70 text-rose-400 border border-rose-500/60 font-bold shadow-[0_0_8px_rgba(244,63,94,0.3)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center select-none tracking-tight transition-transform duration-100',
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
    colorClass = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40 font-bold shadow-[0_0_6px_rgba(16,185,129,0.2)]';
  } else if (status >= 300 && status < 400) {
    colorClass = 'text-sky-400 bg-sky-950/40 border-sky-500/40 font-bold shadow-[0_0_6px_rgba(56,189,248,0.2)]';
  } else if (status >= 400 && status < 500) {
    colorClass = 'text-amber-400 bg-amber-950/40 border-amber-500/40 font-bold shadow-[0_0_6px_rgba(245,158,11,0.2)]';
  } else if (status >= 500) {
    colorClass = 'text-rose-400 bg-rose-950/40 border-rose-500/40 font-bold shadow-[0_0_6px_rgba(244,63,94,0.2)]';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-mono text-[10px] px-2 py-0.5 rounded-full border tracking-tight',
        colorClass,
        className
      )}
    >
      {label || status}
    </span>
  );
};
