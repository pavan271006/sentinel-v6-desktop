import React, { useState, useRef, useEffect } from 'react';
import { cn } from './utils';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'left',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[160px] bg-bg-panel border border-border-strong rounded shadow-dropdown py-1 select-none',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled && item.onClick) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors',
                item.danger
                  ? 'text-severity-critical hover:bg-severity-critical/10'
                  : 'text-text-primary hover:bg-bg-panel-hover',
                item.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && <span className="text-text-muted">{item.icon}</span>}
                <span>{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-[10px] font-mono text-text-muted">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
