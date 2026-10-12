import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from './utils';

export interface SplitPaneProps {
  direction?: 'horizontal' | 'vertical';
  initialSize?: number; // width in px if vertical split, height if horizontal
  minSize?: number;
  maxSize?: number;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  isPrimaryFirst?: boolean;
  collapsed?: boolean;
  onSizeChange?: (size: number) => void;
  className?: string;
  storageKey?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  direction = 'horizontal',
  initialSize = 300,
  minSize = 120,
  maxSize = 800,
  primary,
  secondary,
  isPrimaryFirst = true,
  collapsed = false,
  onSizeChange,
  className,
  storageKey,
}) => {
  const actualStorageKey = storageKey ? `${storageKey}_${direction}` : undefined;

  const [size, setSize] = useState<number>(() => {
    if (actualStorageKey) {
      const saved = localStorage.getItem(`splitpane_${actualStorageKey}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          return parsed;
        }
      }
    }
    return initialSize;
  });

  // Re-sync when direction changes
  useEffect(() => {
    if (actualStorageKey) {
      const saved = localStorage.getItem(`splitpane_${actualStorageKey}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          setSize(parsed);
          return;
        }
      }
    }
    setSize(initialSize);
  }, [actualStorageKey, direction, initialSize, minSize, maxSize]);

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newSize: number;
      let effectiveMax = maxSize;

      if (direction === 'horizontal') {
        // Horizontal split = Left/Right panels
        effectiveMax = rect.width > 0 ? Math.min(maxSize, Math.max(minSize, rect.width - minSize)) : maxSize;
        if (isPrimaryFirst) {
          newSize = e.clientX - rect.left;
        } else {
          newSize = rect.right - e.clientX;
        }
      } else {
        // Vertical split = Top/Bottom panels
        effectiveMax = rect.height > 0 ? Math.min(maxSize, Math.max(minSize, rect.height - minSize)) : maxSize;
        if (isPrimaryFirst) {
          newSize = e.clientY - rect.top;
        } else {
          newSize = rect.bottom - e.clientY;
        }
      }

      const clampedSize = Math.max(minSize, Math.min(effectiveMax, newSize));
      setSize(clampedSize);
      if (onSizeChange) onSizeChange(clampedSize);
      if (actualStorageKey) {
        localStorage.setItem(`splitpane_${actualStorageKey}`, clampedSize.toString());
      }
    },
    [isDragging, direction, isPrimaryFirst, minSize, maxSize, onSizeChange, actualStorageKey]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const isHorizontal = direction === 'horizontal';

  if (collapsed) {
    return (
      <div ref={containerRef} className={cn('w-full h-full flex overflow-hidden', className)}>
        <div className="flex-1 w-full h-full overflow-hidden">{secondary}</div>
      </div>
    );
  }

  const primaryStyle: React.CSSProperties = isHorizontal
    ? { width: `${size}px`, minWidth: `${size}px`, maxWidth: `${size}px` }
    : { height: `${size}px`, minHeight: `${size}px`, maxHeight: `${size}px` };

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full flex overflow-hidden relative',
        isHorizontal ? 'flex-row' : 'flex-col',
        isDragging && (isHorizontal ? 'select-none cursor-col-resize' : 'select-none cursor-row-resize'),
        className
      )}
    >
      {isPrimaryFirst ? (
        <>
          <div style={primaryStyle} className="overflow-hidden flex-shrink-0">
            {primary}
          </div>
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'group relative flex items-center justify-center transition-colors z-10 flex-shrink-0 select-none',
              isHorizontal
                ? 'w-2 h-full cursor-col-resize hover:bg-[#f37021]/50 bg-[#2b2d30] border-x border-[#1e1f22]'
                : 'h-2 w-full cursor-row-resize hover:bg-[#f37021]/50 bg-[#2b2d30] border-y border-[#1e1f22]',
              isDragging && 'bg-[#f37021]'
            )}
            title={isHorizontal ? 'Drag left/right to resize' : 'Drag up/down to resize'}
          >
            <div
              className={cn(
                'rounded-full bg-[#5c6370] group-hover:bg-white transition-colors',
                isHorizontal ? 'w-0.5 h-7' : 'h-0.5 w-7'
              )}
            />
          </div>
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{secondary}</div>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{secondary}</div>
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'group relative flex items-center justify-center transition-colors z-10 flex-shrink-0 select-none',
              isHorizontal
                ? 'w-2 h-full cursor-col-resize hover:bg-[#f37021]/50 bg-[#2b2d30] border-x border-[#1e1f22]'
                : 'h-2 w-full cursor-row-resize hover:bg-[#f37021]/50 bg-[#2b2d30] border-y border-[#1e1f22]',
              isDragging && 'bg-[#f37021]'
            )}
            title={isHorizontal ? 'Drag left/right to resize' : 'Drag up/down to resize'}
          >
            <div
              className={cn(
                'rounded-full bg-[#5c6370] group-hover:bg-white transition-colors',
                isHorizontal ? 'w-0.5 h-7' : 'h-0.5 w-7'
              )}
            />
          </div>
          <div style={primaryStyle} className="overflow-hidden flex-shrink-0">
            {primary}
          </div>
        </>
      )}
    </div>
  );
};
