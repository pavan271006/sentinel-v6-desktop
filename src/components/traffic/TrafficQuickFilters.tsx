import React from 'react';
import { Shield, RotateCcw, Check } from 'lucide-react';
import { QuickFilterPreset } from '../../types/traffic';

export interface TrafficQuickFiltersProps {
  scopeOnly: boolean;
  onToggleScopeOnly: (active: boolean) => void;
  selectedMethods: string[];
  onToggleMethod: (method: string) => void;
  selectedStatuses: Array<'2xx' | '3xx' | '4xx' | '5xx'>;
  onToggleStatus: (statusGroup: '2xx' | '3xx' | '4xx' | '5xx') => void;
  selectedMimes: string[];
  onToggleMime: (mime: string) => void;
  activePreset?: QuickFilterPreset;
  onSelectPreset?: (preset: QuickFilterPreset) => void;
  totalCount: number;
  filteredCount: number;
  onResetAll: () => void;
  className?: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const STATUSES: Array<'2xx' | '3xx' | '4xx' | '5xx'> = ['2xx', '3xx', '4xx', '5xx'];
const MIMES = [
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'js/css', label: 'JS/CSS' },
  { id: 'binary', label: 'Binary' },
];

export const TrafficQuickFilters: React.FC<TrafficQuickFiltersProps> = ({
  scopeOnly,
  onToggleScopeOnly,
  selectedMethods,
  onToggleMethod,
  selectedStatuses,
  onToggleStatus,
  selectedMimes,
  onToggleMime,
  activePreset = 'all',
  onSelectPreset,
  totalCount,
  filteredCount,
  onResetAll,
  className = '',
}) => {
  const hasActiveFilters =
    scopeOnly ||
    selectedMethods.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedMimes.length > 0 ||
    activePreset !== 'all';


  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-bg-panel border-b border-border-subtle text-xs select-none ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Scope Only Quick Toggle (SEC-01) */}
        <button
          onClick={() => onToggleScopeOnly(!scopeOnly)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium border transition-colors ${
            scopeOnly
              ? 'bg-status-success/15 text-status-success border-status-success/40 ring-1 ring-status-success/20'
              : 'bg-bg-app text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-muted'
          }`}
          title="Filter transactions by In-Scope rules (SEC-01)"
        >
          <Shield className="w-3 h-3" />
          <span>Scope Only</span>
          {scopeOnly && <Check className="w-2.5 h-2.5 ml-0.5" />}
        </button>

        <div className="h-4 w-px bg-border-subtle" />

        {/* Method Pills */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-text-muted font-sans mr-0.5 hidden sm:inline">Method:</span>
          {METHODS.map((method) => {
            const isSelected = selectedMethods.includes(method);
            return (
              <button
                key={method}
                onClick={() => onToggleMethod(method)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors ${
                  isSelected
                    ? method === 'GET'
                      ? 'bg-blue-900/40 text-blue-400 border-blue-500/50'
                      : method === 'POST'
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50'
                      : method === 'PUT' || method === 'PATCH'
                      ? 'bg-amber-900/40 text-amber-400 border-amber-500/50'
                      : 'bg-rose-900/40 text-rose-400 border-rose-500/50'
                    : 'bg-bg-app text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
                title={`Filter method: ${method}`}
              >
                {method}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-border-subtle" />

        {/* Status Group Pills */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-text-muted font-sans mr-0.5 hidden sm:inline">Status:</span>
          {STATUSES.map((statusGroup) => {
            const isSelected = selectedStatuses.includes(statusGroup);
            return (
              <button
                key={statusGroup}
                onClick={() => onToggleStatus(statusGroup)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors ${
                  isSelected
                    ? statusGroup === '2xx'
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50'
                      : statusGroup === '3xx'
                      ? 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50'
                      : statusGroup === '4xx'
                      ? 'bg-amber-900/40 text-amber-400 border-amber-500/50'
                      : 'bg-rose-900/40 text-rose-400 border-rose-500/50'
                    : 'bg-bg-app text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
                title={`Filter status code group: ${statusGroup}`}
              >
                {statusGroup}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-border-subtle" />

        {/* MIME Type Pills */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-text-muted font-sans mr-0.5 hidden md:inline">MIME:</span>
          {MIMES.map((mime) => {
            const isSelected = selectedMimes.includes(mime.id);
            return (
              <button
                key={mime.id}
                onClick={() => onToggleMime(mime.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-sans border transition-colors ${
                  isSelected
                    ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/50'
                    : 'bg-bg-app text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
                title={`Filter MIME type: ${mime.label}`}
              >
                {mime.label}
              </button>
            );
          })}
        </div>

        {/* Preset Selector */}
        {onSelectPreset && (
          <>
            <div className="h-4 w-px bg-border-subtle hidden lg:block" />
            <div className="hidden lg:flex items-center gap-1">
              <span className="text-[11px] text-text-muted font-sans mr-0.5">Preset:</span>
              <button
                onClick={() => onSelectPreset('errors_only')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans border transition-colors ${
                  activePreset === 'errors_only'
                    ? 'bg-rose-900/40 text-rose-300 border-rose-500/50'
                    : 'bg-bg-app text-text-muted hover:text-text-primary border-border-subtle'
                }`}
              >
                Errors Only
              </button>
              <button
                onClick={() => onSelectPreset('methods_mutating')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans border transition-colors ${
                  activePreset === 'methods_mutating'
                    ? 'bg-amber-900/40 text-amber-300 border-amber-500/50'
                    : 'bg-bg-app text-text-muted hover:text-text-primary border-border-subtle'
                }`}
              >
                Mutating
              </button>
              <button
                onClick={() => onSelectPreset('media_json')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans border transition-colors ${
                  activePreset === 'media_json'
                    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/50'
                    : 'bg-bg-app text-text-muted hover:text-text-primary border-border-subtle'
                }`}
              >
                JSON APIs
              </button>
            </div>
          </>
        )}
      </div>


      {/* Counts & Reset Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-[11px] font-mono text-text-secondary">
          <span className="text-text-muted">Filtered:</span>{' '}
          <strong className={filteredCount < totalCount ? 'text-accent-cyan font-bold' : 'text-text-primary'}>
            {filteredCount.toLocaleString()}
          </strong>{' '}
          <span className="text-text-muted">/ {totalCount.toLocaleString()}</span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetAll}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-text-muted hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
            title="Reset all active filters"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};
