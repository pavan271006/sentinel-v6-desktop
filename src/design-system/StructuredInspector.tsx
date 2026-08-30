import React, { useState, useMemo } from 'react';
import { cn } from './utils';
import { Input } from './Input';
import { Button } from './Button';
import { ChevronRight, ChevronDown, Search, Copy, Check } from 'lucide-react';

export interface StructuredInspectorProps {
  data: any;
  title?: string;
  className?: string;
  initialExpandedDepth?: number;
}

interface TreeNodeProps {
  keyName: string;
  value: any;
  currentPath: string;
  depth: number;
  maxInitialDepth: number;
  filterQuery: string;
  onCopyPath: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  keyName,
  value,
  currentPath,
  depth,
  maxInitialDepth,
  filterQuery,
  onCopyPath,
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < maxInitialDepth);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const valueType = useMemo(() => {
    if (value === null) return 'null';
    if (isArray) return 'array';
    return typeof value;
  }, [value, isArray]);

  // Match filter query
  const isMatch = useMemo(() => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    if (keyName.toLowerCase().includes(q)) return true;
    if (typeof value === 'string' && value.toLowerCase().includes(q)) return true;
    if (typeof value === 'number' && value.toString().includes(q)) return true;
    return false;
  }, [filterQuery, keyName, value]);

  const renderPrimitiveValue = () => {
    if (value === null) {
      return <span className="text-severity-critical font-bold">null</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-accent-purple font-bold">{value ? 'true' : 'false'}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-accent-cyan font-bold">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-[#7ee787]">"{value}"</span>;
    }
    return <span>{String(value)}</span>;
  };

  if (filterQuery && !isMatch && !isExpandable) {
    return null;
  }

  return (
    <div className="font-mono text-xs select-text">
      <div
        className={cn(
          'flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-bg-panel-hover group transition-colors',
          depth > 0 && 'ml-4'
        )}
      >
        {isExpandable ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-text-muted hover:text-text-primary rounded"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Key Name */}
        <span
          className="text-text-primary font-medium cursor-pointer hover:underline"
          onClick={() => onCopyPath(currentPath)}
          title={`Click to copy path: ${currentPath}`}
        >
          {keyName}:
        </span>

        {/* Value preview or primitive */}
        {isExpandable ? (
          <span
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-text-muted cursor-pointer hover:text-text-secondary"
          >
            {isArray ? `Array(${value.length})` : `Object {${Object.keys(value).length}}`}
          </span>
        ) : (
          <div className="truncate max-w-xl">{renderPrimitiveValue()}</div>
        )}

        {/* Type chip and Path Copy on hover */}
        <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1.5 select-none">
          <span className="text-[10px] text-text-muted px-1 rounded bg-bg-panel border border-border-subtle">
            {valueType}
          </span>
          <button
            onClick={() => onCopyPath(currentPath)}
            className="text-text-muted hover:text-accent-cyan p-0.5 rounded"
            title="Copy Path"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Child Nodes */}
      {isExpandable && isExpanded && (
        <div className="border-l border-border-subtle/50 ml-2">
          {isArray
            ? value.map((item: any, idx: number) => (
                <TreeNode
                  key={idx}
                  keyName={`[${idx}]`}
                  value={item}
                  currentPath={`${currentPath}[${idx}]`}
                  depth={depth + 1}
                  maxInitialDepth={maxInitialDepth}
                  filterQuery={filterQuery}
                  onCopyPath={onCopyPath}
                />
              ))
            : Object.entries(value).map(([k, v]) => (
                <TreeNode
                  key={k}
                  keyName={k}
                  value={v}
                  currentPath={currentPath ? `${currentPath}.${k}` : k}
                  depth={depth + 1}
                  maxInitialDepth={maxInitialDepth}
                  filterQuery={filterQuery}
                  onCopyPath={onCopyPath}
                />
              ))}
        </div>
      )}
    </div>
  );
};

export const StructuredInspector: React.FC<StructuredInspectorProps> = ({
  data,
  title = 'Structured Tree Inspector',
  className,
  initialExpandedDepth = 2,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const parsedObject = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return { rawText: data };
      }
    }
    return data || {};
  }, [data]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedNotification(`Copied path: ${path}`);
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleCopyFullJson = () => {
    navigator.clipboard.writeText(JSON.stringify(parsedObject, null, 2));
    setCopiedNotification('Copied JSON payload');
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  return (
    <div className={cn('flex flex-col w-full h-full bg-bg-app border border-border-subtle rounded overflow-hidden', className)}>
      {/* Header & Filter Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-panel-elevated border-b border-border-subtle select-none">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <span className="text-xs font-semibold text-text-primary whitespace-nowrap">{title}</span>
          <div className="max-w-xs w-full">
            <Input
              dense
              mono
              placeholder="Filter keys/values..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {copiedNotification && (
            <span className="text-[11px] font-mono text-severity-low flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {copiedNotification}
            </span>
          )}
          <Button variant="subtle" size="xs" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={handleCopyFullJson}>
            Copy JSON
          </Button>
        </div>
      </div>

      {/* Structured Tree Container */}
      <div className="flex-1 overflow-auto p-3">
        {Object.keys(parsedObject).length === 0 ? (
          <div className="text-xs text-text-muted italic">Empty dataset</div>
        ) : (
          Object.entries(parsedObject).map(([key, value]) => (
            <TreeNode
              key={key}
              keyName={key}
              value={value}
              currentPath={key}
              depth={0}
              maxInitialDepth={initialExpandedDepth}
              filterQuery={filterQuery}
              onCopyPath={handleCopyPath}
            />
          ))
        )}
      </div>
    </div>
  );
};
