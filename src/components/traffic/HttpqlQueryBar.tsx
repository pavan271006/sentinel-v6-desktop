import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, CheckCircle2, AlertTriangle, History, Sparkles, CornerDownLeft } from 'lucide-react';
import { getHttpqlSuggestions, validateHttpql } from '../../utils/httpql';
import { HttpqlAutocompleteSuggestion, HttpqlValidationResult } from '../../types/httpql';


export interface HttpqlQueryBarProps {
  value: string;
  onChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onClear?: () => void;
  queryHistory?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onValidate?: (isValid: boolean, error?: string) => void;
}

const PRESET_QUERIES = [
  { label: 'In-Scope Errors', query: 'tx.in_scope == true and res.status >= 400' },
  { label: 'Mutating JSON APIs', query: 'req.method in ["POST", "PUT", "PATCH"] and res.header.Content-Type contains "json"' },
  { label: 'Auth & OAuth Tokens', query: 'req.path contains "/auth" or req.path contains "/oauth" or req.path contains "/token"' },
  { label: 'Slow Transactions (>500ms)', query: 'res.time_ms > 500' },
  { label: '5xx Server Faults', query: 'res.status >= 500' },
  { label: 'GraphQL Endpoints', query: 'req.path contains "graphql"' },
];

export const HttpqlQueryBar: React.FC<HttpqlQueryBarProps> = ({
  value,
  onChange,
  onSubmit,
  onClear,
  queryHistory = [],
  placeholder = "Filter traffic with HTTPQL (e.g. req.method == 'POST' and res.status >= 400)...",
  disabled = false,
  className = '',
  onValidate,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState<number>(value.length);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);
  const [validation, setValidation] = useState<HttpqlValidationResult>({
    valid: true,
    referencedFields: [],
  });

  // Re-validate on query change
  useEffect(() => {
    const res = validateHttpql(value);
    setValidation(res);
    if (onValidate) {
      onValidate(res.valid, res.error?.message);
    }
  }, [value, onValidate]);

  // Compute autocomplete suggestions
  const suggestions = useMemo<HttpqlAutocompleteSuggestion[]>(() => {
    if (!isSuggestionsOpen) return [];
    return getHttpqlSuggestions(value, cursorPos).slice(0, 10);
  }, [value, cursorPos, isSuggestionsOpen]);

  // Reset selected suggestion index when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [suggestions]);

  // Global keydown for '/' shortcut to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (e.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsSuggestionsOpen(false);
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const pos = e.target.selectionStart || newVal.length;
    setCursorPos(pos);
    onChange(newVal);
    setIsSuggestionsOpen(true);
    setIsHistoryOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSuggestionsOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && selectedSuggestionIndex >= 0 && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSuggestionsOpen(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      setIsSuggestionsOpen(false);
      setIsHistoryOpen(false);
      onSubmit(value);
    }
    if (e.key === 'Escape') {
      setIsSuggestionsOpen(false);
      setIsHistoryOpen(false);
    }
  };

  const applySuggestion = (suggestion: HttpqlAutocompleteSuggestion) => {
    if (!suggestion) return;
    const textBefore = value.substring(0, cursorPos);
    const textAfter = value.substring(cursorPos);
    const lastWordMatch = textBefore.match(/[\w.:-]+$/);

    let prefix = textBefore;
    if (lastWordMatch) {
      prefix = textBefore.substring(0, textBefore.length - lastWordMatch[0].length);
    }

    const inserted = `${prefix}${suggestion.insertText}`;
    const newCursor = inserted.length;
    const finalValue = `${inserted}${textAfter}`;

    onChange(finalValue);
    setCursorPos(newCursor);
    setIsSuggestionsOpen(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const handleSelectHistory = (query: string) => {
    onChange(query);
    setIsHistoryOpen(false);
    onSubmit(query);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleClear = () => {
    onChange('');
    setCursorPos(0);
    setIsSuggestionsOpen(false);
    setIsHistoryOpen(false);
    if (onClear) onClear();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      {/* Input container */}
      <div
        className={`flex items-center w-full h-8 px-2 bg-bg-app border rounded transition-colors text-xs font-mono ${
          !validation.valid && value.trim()
            ? 'border-status-error focus-within:border-status-error ring-1 ring-status-error/30'
            : 'border-border-subtle focus-within:border-accent-cyan ring-1 ring-accent-cyan/20'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-text-muted mr-1.5 flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setCursorPos(inputRef.current?.selectionStart || value.length);
            if (value.trim()) setIsSuggestionsOpen(true);
          }}
          onClick={() => {
            setCursorPos(inputRef.current?.selectionStart || value.length);
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="HTTPQL Filter Query"
          aria-autocomplete="list"
          aria-expanded={isSuggestionsOpen}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none min-w-0"
        />

        {/* Validation Status Indicator */}
        {value.trim() && (
          <div className="flex items-center gap-1 ml-1 flex-shrink-0">
            {validation.valid ? (
              <span className="flex items-center text-status-success text-[10px]" title="Valid HTTPQL Query">
                <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />
                <span className="hidden sm:inline">Valid</span>
              </span>
            ) : (
              <span
                className="flex items-center text-status-error text-[10px] cursor-help bg-status-error/10 px-1 py-0.5 rounded"
                title={validation.error?.message}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-0.5" />
                <span className="hidden sm:inline font-sans truncate max-w-[150px]">
                  {validation.error?.message || 'Syntax error'}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Clear Button */}
        {value && (
          <button
            onClick={handleClear}
            className="p-1 text-text-muted hover:text-text-primary rounded ml-1 transition-colors"
            title="Clear Query (Esc)"
            aria-label="Clear Query"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* History Dropdown Toggle */}
        <button
          onClick={() => {
            setIsHistoryOpen(!isHistoryOpen);
            setIsSuggestionsOpen(false);
          }}
          className={`p-1 rounded ml-1 transition-colors ${
            isHistoryOpen ? 'text-accent-cyan bg-accent-cyan/10' : 'text-text-muted hover:text-text-primary'
          }`}
          title="Recent Queries & Presets"
          aria-label="Recent Queries and Presets"
        >
          <History className="w-3.5 h-3.5" />
        </button>

        {/* Submit Enter Indicator */}
        <button
          onClick={() => onSubmit(value)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 ml-1 text-[10px] bg-bg-panel hover:bg-bg-panel-elevated text-text-secondary hover:text-text-primary border border-border-subtle rounded transition-colors"
          title="Execute Query (Enter)"
        >
          <CornerDownLeft className="w-2.5 h-2.5" />
          <span className="hidden md:inline">Enter</span>
        </button>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isSuggestionsOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute left-0 top-full mt-1 w-full max-w-xl bg-bg-panel-elevated border border-border-subtle rounded-md shadow-2xl z-50 overflow-hidden font-mono text-xs"
        >
          <div className="px-2.5 py-1 bg-bg-panel border-b border-border-subtle text-[10px] text-text-muted flex justify-between items-center select-none">
            <span>HTTPQL Auto-Complete Suggestions</span>
            <span className="font-sans">Navigate: ↑↓ • Accept: Tab/Enter • Close: Esc</span>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedSuggestionIndex;
              return (
                <div
                  key={`${item.category}-${item.label}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(item);
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                  className={`flex items-center justify-between px-2.5 py-1 cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-text-primary hover:bg-bg-panel'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[9px] uppercase px-1 py-0.2 rounded font-sans font-bold ${
                        item.category === 'field'
                          ? 'bg-blue-900/60 text-blue-300'
                          : item.category === 'operator'
                          ? 'bg-purple-900/60 text-purple-300'
                          : item.category === 'value'
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-amber-900/60 text-amber-300'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="font-semibold truncate">{item.label}</span>
                  </div>

                  <span className="text-[11px] font-sans text-text-muted ml-3 truncate text-right">
                    {item.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History & Presets Popover */}
      {isHistoryOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 w-96 bg-bg-panel-elevated border border-border-subtle rounded-md shadow-2xl z-50 overflow-hidden font-sans text-xs"
        >
          {/* Preset Queries */}
          <div className="p-2 border-b border-border-subtle bg-bg-panel">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary uppercase mb-1.5">
              <Sparkles className="w-3 h-3 text-accent-cyan" />
              <span>Recommended Filter Presets</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {PRESET_QUERIES.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleSelectHistory(preset.query)}
                  className="text-left px-2 py-1 rounded bg-bg-app hover:bg-accent-cyan/10 border border-border-subtle/50 hover:border-accent-cyan/40 transition-colors group"
                >
                  <div className="text-[11px] font-medium text-text-primary group-hover:text-accent-cyan">
                    {preset.label}
                  </div>
                  <div className="text-[10px] font-mono text-text-muted truncate mt-0.5">
                    {preset.query}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Query History */}
          <div className="p-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase mb-1.5">
              <span className="flex items-center gap-1.5">
                <History className="w-3 h-3 text-text-muted" />
                <span>Recent Queries ({queryHistory.length})</span>
              </span>
              {queryHistory.length > 0 && (
                <span className="text-[10px] text-text-muted font-normal">Click to apply</span>
              )}
            </div>

            {queryHistory.length === 0 ? (
              <div className="text-center py-3 text-text-muted text-[11px]">
                No query history yet. Valid queries will be remembered here.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {queryHistory.map((q, idx) => (
                  <button
                    key={`${q}-${idx}`}
                    onClick={() => handleSelectHistory(q)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-bg-panel font-mono text-[11px] text-text-primary hover:text-accent-cyan truncate block border border-transparent hover:border-border-subtle transition-colors"
                    title={q}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
