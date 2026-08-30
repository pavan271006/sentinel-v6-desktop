import React, { useEffect, useRef } from 'react';
import { cn } from './utils';

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  items,
  className = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ensure menu stays within viewport bounds
  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  return (
    <div
      ref={menuRef}
      style={{ left: `${Math.max(10, adjustedX)}px`, top: `${Math.max(10, adjustedY)}px` }}
      className={cn(
        'fixed z-50 min-w-[220px] bg-[#222428] border border-[#3e4249] rounded-md shadow-2xl py-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans',
        className
      )}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return <div key={`div-${idx}`} className="h-px bg-[#3e4249] my-1 mx-1.5" />;
        }

        return (
          <button
            key={item.id || item.label || idx}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-1.5 text-left text-[#dfdfdf] transition-colors group',
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-[#0060df] hover:text-white cursor-pointer',
              item.danger && !item.disabled ? 'text-red-400 hover:bg-red-600 hover:text-white' : ''
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center text-[#9da5b4] group-hover:text-white flex-shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="ml-4 font-mono text-[10px] text-[#6f737a] group-hover:text-white/80 flex-shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
