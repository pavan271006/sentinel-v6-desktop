import React from 'react';
import { EyeOff, WrapText, AlignJustify, Columns, Rows, Search, Wand2 } from 'lucide-react';

export interface BurpEditorToolbarProps {
  hideBoringHeaders?: boolean;
  onToggleHideBoringHeaders?: () => void;
  wordWrap?: boolean;
  onToggleWordWrap?: () => void;
  showNonPrintable?: boolean;
  onToggleShowNonPrintable?: () => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  className?: string;
  extraActions?: React.ReactNode;
  splitOrientation?: 'horizontal' | 'vertical';
  onToggleSplitOrientation?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  onAutoFormat?: () => void;
}

/**
 * Authentic Burp Suite Professional Editor Action Toolbar
 * 1. [ Wand2 ] Format / prettify request body
 * 2. [ Columns/Rows ] Toggle split orientation (Horizontal vs Vertical)
 * 3. [ Search ] Find in editor
 * 4. [ EyeOff ] Toggle hide uninteresting / boilerplate headers
 * 5. [ WrapText ] Toggle line wrapping
 * 6. [ \n ] Toggle non-printable characters & CRLF markers
 * 7. [ ≡ ] Toggle Inspector side panel / view options
 */
export const BurpEditorToolbar: React.FC<BurpEditorToolbarProps> = ({
  hideBoringHeaders = false,
  onToggleHideBoringHeaders,
  wordWrap = true,
  onToggleWordWrap,
  showNonPrintable = false,
  onToggleShowNonPrintable,
  inspectorOpen = false,
  onToggleInspector,
  className = '',
  extraActions,
  splitOrientation = 'horizontal',
  onToggleSplitOrientation,
  isSearchOpen = false,
  onToggleSearch,
  onAutoFormat,
}) => {
  return (
    <div className={`flex items-center gap-1 text-[#9da5b4] select-none ${className}`}>
      {extraActions}

      {/* 0. Wand2: Prettify / Auto-format */}
      {onAutoFormat && (
        <button
          type="button"
          onClick={onAutoFormat}
          className="p-1 rounded-[3px] transition-colors hover:text-white hover:bg-[#35383f]"
          title="Auto-format / Prettify content"
        >
          <Wand2 className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      )}

      {/* 1. Columns/Rows: Toggle Split orientation */}
      {onToggleSplitOrientation && (
        <button
          type="button"
          onClick={onToggleSplitOrientation}
          className="p-1 rounded-[3px] transition-colors hover:text-white hover:bg-[#35383f]"
          title={`Switch to ${splitOrientation === 'horizontal' ? 'Vertical (Top/Bottom)' : 'Horizontal (Side-by-Side)'} layout (Ctrl+\\)`}
        >
          {splitOrientation === 'horizontal' ? (
            <Columns className="w-3.5 h-3.5 stroke-[2]" />
          ) : (
            <Rows className="w-3.5 h-3.5 stroke-[2]" />
          )}
        </button>
      )}

      {/* 2. Search: Toggle search bar */}
      {onToggleSearch && (
        <button
          type="button"
          onClick={onToggleSearch}
          className={`p-1 rounded-[3px] transition-colors ${
            isSearchOpen
              ? 'bg-[#0284c7] text-white shadow-sm'
              : 'hover:text-white hover:bg-[#35383f]'
          }`}
          title={isSearchOpen ? 'Hide search (Ctrl+F)' : 'Find in text (Ctrl+F)'}
        >
          <Search className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      )}

      {/* 1. EyeOff: Hide uninteresting headers */}
      {onToggleHideBoringHeaders && (
        <button
          type="button"
          onClick={onToggleHideBoringHeaders}
          className={`p-1 rounded-[3px] transition-colors ${
            hideBoringHeaders
              ? 'bg-[#0284c7] text-white shadow-sm'
              : 'hover:text-white hover:bg-[#35383f]'
          }`}
          title={hideBoringHeaders ? 'Show all headers' : 'Hide uninteresting headers'}
        >
          <EyeOff className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      )}

      {/* 2. WrapText: Line wrapping toggle */}
      {onToggleWordWrap && (
        <button
          type="button"
          onClick={onToggleWordWrap}
          className={`p-1 rounded-[3px] transition-colors ${
            wordWrap
              ? 'bg-[#0284c7] text-white shadow-sm'
              : 'hover:text-white hover:bg-[#35383f]'
          }`}
          title={wordWrap ? 'Disable line wrap' : 'Wrap lines'}
        >
          <WrapText className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      )}

      {/* 3. \n: Show non-printable characters & CRLF */}
      {onToggleShowNonPrintable && (
        <button
          type="button"
          onClick={onToggleShowNonPrintable}
          className={`px-1 py-0.5 rounded-[3px] transition-colors font-mono font-bold text-[11px] leading-none flex items-center justify-center min-w-[20px] h-[22px] ${
            showNonPrintable
              ? 'bg-[#0284c7] text-white shadow-sm'
              : 'hover:text-white hover:bg-[#35383f]'
          }`}
          title={showNonPrintable ? 'Hide non-printable characters' : 'Show non-printable characters (\\r\\n)'}
        >
          <span>\n</span>
        </button>
      )}

      {/* 4. ≡: Inspector / Options toggle */}
      {onToggleInspector && (
        <button
          type="button"
          onClick={onToggleInspector}
          className={`p-1 rounded-[3px] transition-colors ${
            inspectorOpen
              ? 'bg-[#0284c7] text-white shadow-sm'
              : 'hover:text-white hover:bg-[#35383f]'
          }`}
          title="Toggle Inspector / Options"
        >
          <AlignJustify className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      )}
    </div>
  );
};
