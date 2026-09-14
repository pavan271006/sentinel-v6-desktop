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
            'absolute z-50 mt-1.5 min-w-[180px] glass-dropdown rounded-lg py-1.5 select-none animate-pop-in border border-border-strong',
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
                'w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors duration-100 rounded-md mx-auto my-0.5',
                item.danger
                  ? 'text-severity-critical hover:bg-severity-critical/15'
                  : 'text-text-primary hover:bg-bg-panel-hover hover:text-white',
                item.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && <span className="text-text-muted">{item.icon}</span>}
                <span className="font-medium">{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-[10px] font-mono text-text-muted bg-bg-app px-1.5 py-0.5 rounded border border-border-subtle">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
