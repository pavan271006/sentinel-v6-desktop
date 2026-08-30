import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from './utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  width?: number; // default width in px
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface VirtualizedTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  rowHeight?: number;
  overscan?: number;
  selectedId?: string;
  selectedIds?: Set<string>;
  getRowId: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  onRowContextMenu?: (row: T, index: number, event: React.MouseEvent) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  emptyMessage?: string;
  className?: string;
  enableKeyboardNavigation?: boolean;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 26,
  overscan = 15,
  selectedId,
  selectedIds: controlledSelectedIds,
  getRowId,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  onSelectionChange,
  emptyMessage = 'No records found',
  className,
  enableKeyboardNavigation = true,
}: VirtualizedTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  // Column width resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    columns.forEach((col) => {
      initial[col.id] = col.width || 120;
    });
    return initial;
  });

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Internal selection if uncontrolled
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const activeSelectedIds = controlledSelectedIds || internalSelectedIds;

  // Selected row index for keyboard nav
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Sync viewport height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Sort data if sortable column is active
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    const col = columns.find((c) => c.id === sortColumn);
    if (!col) return data;

    const extractSortKey = (item: T): any => {
      if (col.sortValue) {
        return col.sortValue(item);
      }
      const direct = (item as any)[col.id];
      if (direct !== undefined && direct !== null && typeof direct !== 'object') {
        return direct;
      }
      if (col.accessor) {
        const rendered = col.accessor(item);
        if (typeof rendered === 'string' || typeof rendered === 'number' || typeof rendered === 'boolean') {
          return rendered;
        }
        if (React.isValidElement(rendered)) {
          const children = (rendered.props as any)?.children;
          if (typeof children === 'string' || typeof children === 'number') {
            return children;
          }
        }
      }
      return direct ?? '';
    };

    return [...data].sort((a, b) => {
      const aVal = extractSortKey(a);
      const bVal = extractSortKey(b);

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null || aVal === '') return 1;
      if (bVal === undefined || bVal === null || bVal === '') return -1;

      let comp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comp = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comp = aVal < bVal ? -1 : 1;
      }

      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const totalRows = sortedData.length;
  const totalHeight = totalRows * rowHeight;

  // Compute virtualization window
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 2 * overscan;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  const visibleRows = useMemo(() => {
    const rows = [];
    for (let i = startIndex; i < endIndex; i++) {
      rows.push({
        index: i,
        item: sortedData[i],
      });
    }
    return rows;
  }, [sortedData, startIndex, endIndex]);

  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  const handleRowSelect = useCallback(
    (item: T, index: number, isMulti = false) => {
      const id = getRowId(item, index);
      setFocusedIndex(index);

      if (isMulti) {
        const next = new Set(activeSelectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setInternalSelectedIds(next);
        if (onSelectionChange) onSelectionChange(next);
      } else {
        const next = new Set([id]);
        setInternalSelectedIds(next);
        if (onSelectionChange) onSelectionChange(next);
      }

      if (onRowClick) onRowClick(item, index);
    },
    [getRowId, activeSelectedIds, onSelectionChange, onRowClick]
  );

  // Column Resizing logic
  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[colId] || 120;
    const col = columns.find((c) => c.id === colId);
    const minW = col?.minWidth || 50;
    const maxW = col?.maxWidth || 600;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(minW, Math.min(maxW, startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [colId]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Keyboard navigation (j, k, gg, G, Space, Enter)
  useEffect(() => {
    if (!enableKeyboardNavigation || totalRows === 0) return;

    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const now = Date.now();
      const isDoubleG = lastKey === 'g' && e.key === 'g' && now - lastKeyTime < 400;
      lastKey = e.key;
      lastKeyTime = now;

      let newIndex = focusedIndex;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        newIndex = Math.min(totalRows - 1, focusedIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        newIndex = Math.max(0, focusedIndex - 1);
      } else if (e.key === 'Home' || isDoubleG) {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End' || (e.key === 'G' && e.shiftKey)) {
        e.preventDefault();
        newIndex = totalRows - 1;
      } else if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < totalRows) {
        e.preventDefault();
        handleRowSelect(sortedData[focusedIndex], focusedIndex, true);
        return;
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < totalRows) {
        e.preventDefault();
        if (onRowDoubleClick) onRowDoubleClick(sortedData[focusedIndex], focusedIndex);
        return;
      } else {
        return;
      }

      if (newIndex !== focusedIndex && newIndex >= 0 && newIndex < totalRows) {
        handleRowSelect(sortedData[newIndex], newIndex, false);

        // Auto scroll if row is out of view
        const rowTop = newIndex * rowHeight;
        const rowBottom = rowTop + rowHeight;
        if (containerRef.current) {
          if (rowTop < containerRef.current.scrollTop) {
            containerRef.current.scrollTop = rowTop;
          } else if (rowBottom > containerRef.current.scrollTop + viewportHeight) {
            containerRef.current.scrollTop = rowBottom - viewportHeight;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardNavigation,
    focusedIndex,
    totalRows,
    rowHeight,
    viewportHeight,
    sortedData,
    handleRowSelect,
    onRowDoubleClick,
  ]);

  return (
    <div className={cn('flex flex-col w-full h-full bg-bg-app border border-border-subtle overflow-hidden', className)}>
      {/* Sticky Table Header */}
      <div className="flex bg-bg-panel-elevated border-b border-border-subtle text-text-secondary text-xs font-semibold select-none flex-shrink-0">
        {columns.map((col) => {
          const width = columnWidths[col.id] || col.width || 120;
          const isSorted = sortColumn === col.id;

          return (
            <div
              key={col.id}
              style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
              className={cn(
                'relative flex items-center justify-between px-2.5 py-1.5 border-r border-border-subtle group truncate',
                col.sortable && 'cursor-pointer hover:text-text-primary hover:bg-bg-panel-hover'
              )}
              onClick={() => col.sortable && handleSort(col.id)}
            >
              <div className="flex items-center gap-1 truncate">
                <span className="truncate">{col.header}</span>
                {isSorted && (
                  <span className="text-accent-cyan flex-shrink-0">
                    {sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                )}
              </div>

              {/* Column Resize Handle */}
              <div
                onMouseDown={(e) => handleResizeStart(e, col.id)}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-cyan/80 z-10"
              />
            </div>
          );
        })}
      </div>

      {/* Virtual Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 w-full h-full overflow-auto relative font-mono text-xs focus:outline-none"
        tabIndex={0}
      >
        {totalRows === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs italic">
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
            {visibleRows.map(({ index, item }) => {
              const rowId = getRowId(item, index);
              const isSelected = selectedId === rowId || activeSelectedIds.has(rowId);
              const isFocused = focusedIndex === index;

              return (
                <div
                  key={rowId}
                  onClick={(e) => handleRowSelect(item, index, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(item, index)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleRowSelect(item, index, false);
                    onRowContextMenu && onRowContextMenu(item, index, e);
                  }}
                  style={{
                    position: 'absolute',
                    top: `${index * rowHeight}px`,
                    left: 0,
                    right: 0,
                    height: `${rowHeight}px`,
                  }}
                  className={cn(
                    'flex items-center border-b border-border-subtle/50 transition-colors cursor-pointer select-none',
                    isSelected
                      ? 'bg-accent-cyan/15 text-text-primary font-medium'
                      : index % 2 === 0
                      ? 'bg-bg-panel hover:bg-bg-panel-hover'
                      : 'bg-bg-app hover:bg-bg-panel-hover',
                    isFocused && 'ring-1 ring-inset ring-accent-cyan/60'
                  )}
                >
                  {columns.map((col) => {
                    const width = columnWidths[col.id] || col.width || 120;
                    const value = col.accessor ? col.accessor(item) : (item as any)[col.id];

                    return (
                      <div
                        key={col.id}
                        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                        className={cn(
                          'dense-cell border-r border-border-subtle/30',
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                          col.className
                        )}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
