import React from 'react';
import { cn } from './utils';
import { X } from 'lucide-react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  closable?: boolean;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange?: (tabId: string) => void;
  onTabChange?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onClose?: (tabId: string) => void;
  onNewTab?: () => void;
  variant?: 'underline' | 'line' | 'pill' | 'editor';
  dense?: boolean;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  onTabChange,
  onCloseTab,
  onClose,
  onNewTab,
  variant = 'underline',
  dense = true,
  className,
}) => {
  const changeHandler = onTabChange || onChange || (() => {});
  const closeHandler = onCloseTab || onClose;
  const effectiveVariant = variant === 'line' ? 'underline' : variant;

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-border-subtle bg-bg-panel overflow-x-auto select-none',
        dense ? 'h-8 px-1' : 'h-10 px-2',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        if (effectiveVariant === 'editor') {
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => !tab.disabled && changeHandler(tab.id)}
              className={cn(
                'group flex items-center gap-1.5 px-3 h-full border-r border-border-subtle text-xs font-mono transition-colors cursor-pointer',
                isActive
                  ? 'bg-bg-panel-elevated text-accent-cyan border-t-2 border-t-accent-cyan font-medium'
                  : 'bg-bg-panel text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary border-t-2 border-t-transparent',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.icon && <span className="text-text-muted">{tab.icon}</span>}
              <span className="truncate max-w-[150px]">{tab.label}</span>
              {tab.badge && <span>{tab.badge}</span>}
              {tab.closable && closeHandler && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeHandler(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-severity-critical rounded p-0.5"
                  aria-label="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        }

        if (effectiveVariant === 'pill') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => changeHandler(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all duration-150',
                isActive
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/40 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                  : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary border border-transparent',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        }

        // Underline default
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => changeHandler(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 h-full text-xs font-medium transition-all duration-150 border-b-2 relative',
              isActive
                ? 'border-accent-cyan text-text-primary font-semibold shadow-[0_1px_8px_rgba(0,240,255,0.4)]'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}

      {onNewTab && (
        <button
          type="button"
          onClick={onNewTab}
          className="px-2 h-full text-text-muted hover:text-accent-cyan hover:bg-bg-panel-hover text-sm font-bold flex items-center justify-center rounded transition-colors"
          title="New Tab (Ctrl+T)"
        >
          +
        </button>
      )}
    </div>
  );
};
