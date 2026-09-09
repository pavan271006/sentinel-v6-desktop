import React from 'react';
import { HelpCircle, Settings, ArrowLeft, ArrowRight, Search, X } from 'lucide-react';

export interface BurpSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeMatchIndex: number;
  totalMatches: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  selectionInfo?: string;
  placeholder?: string;
  className?: string;
}

export function countSearchMatches(text: string, query: string): number {
  if (!query || !query.trim() || !text) return 0;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  let count = 0;
  let pos = lower.indexOf(q);
  while (pos !== -1) {
    count++;
    pos = lower.indexOf(q, pos + q.length);
  }
  return count;
}

export const BurpSearchBar: React.FC<BurpSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  activeMatchIndex,
  totalMatches,
  onPrevMatch,
  onNextMatch,
  selectionInfo,
  placeholder = 'Search',
  className = '',
}) => {
  return (
    <div
      className={`h-7 bg-[#2b2d30] border-t border-[#1e1f22] flex items-center justify-between px-2 text-[11px] text-[#9da5b4] flex-shrink-0 select-none ${className}`}
    >
      <div className="flex items-center gap-1.5 flex-1 max-w-md">
        {/* Help & Settings */}
        <button className="text-[#6f737a] hover:text-white p-0.5" title="Search help">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <button className="text-[#6f737a] hover:text-white p-0.5" title="Search options">
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Previous Match (←) */}
        <button
          onClick={onPrevMatch}
          disabled={totalMatches === 0}
          className={`p-0.5 rounded border border-transparent transition-colors ${
            totalMatches > 0
              ? 'hover:text-white hover:border-[#3e4249] active:bg-[#1e1f22] text-[#dfdfdf]'
              : 'text-[#555861] cursor-not-allowed'
          }`}
          title="Previous match (Shift+Enter / ←)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        {/* Next Match (→) */}
        <button
          onClick={onNextMatch}
          disabled={totalMatches === 0}
          className={`p-0.5 rounded border border-transparent transition-colors ${
            totalMatches > 0
              ? 'hover:text-white hover:border-[#3e4249] active:bg-[#1e1f22] text-[#dfdfdf]'
              : 'text-[#555861] cursor-not-allowed'
          }`}
          title="Next match (Enter / →)"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Search Input with inline clear button */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) onPrevMatch();
                else onNextMatch();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-[#141517] text-white pl-2 pr-6 py-0.5 text-[11px] rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
            spellCheck={false}
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1 text-[#8c9099] hover:text-white p-0.5"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <Search className="w-3 h-3 absolute right-1.5 top-1.5 text-[#6f737a] pointer-events-none" />
          )}
        </div>
      </div>

      {/* Matches Counter & Optional Selection Info */}
      <div className="flex items-center gap-3 text-[10px] text-[#9da5b4] font-mono ml-2">
        <span className="text-[#dfdfdf]">
          {!searchQuery || totalMatches === 0
            ? '0 highlights'
            : `${activeMatchIndex + 1}/${totalMatches} matches`}
        </span>
        {selectionInfo && <span className="text-[#6f737a]">{selectionInfo}</span>}
      </div>
    </div>
  );
};
