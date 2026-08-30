import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Zap } from 'lucide-react';

export interface IntruderCaptureFilterState {
  discardWithoutResponses: boolean;
  searchTerm: string;
  regex: boolean;
  caseSensitive: boolean;
  negativeSearch: boolean;
  status2xx: boolean;
  status3xx: boolean;
  status4xx: boolean;
  status5xx: boolean;
  showOnlyNotes: boolean;
  showOnlyHighlighted: boolean;
}

export const DEFAULT_INTRUDER_CAPTURE_FILTER: IntruderCaptureFilterState = {
  discardWithoutResponses: false,
  searchTerm: '',
  regex: false,
  caseSensitive: false,
  negativeSearch: false,
  status2xx: true,
  status3xx: true,
  status4xx: true,
  status5xx: true,
  showOnlyNotes: false,
  showOnlyHighlighted: false,
};

export interface IntruderCaptureFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: IntruderCaptureFilterState;
  onSave: (newState: IntruderCaptureFilterState) => void;
}

export const IntruderCaptureFilterModal: React.FC<IntruderCaptureFilterModalProps> = ({
  isOpen,
  onClose,
  filterState,
  onSave,
}) => {
  const [draft, setDraft] = useState<IntruderCaptureFilterState>(filterState);

  useEffect(() => {
    if (isOpen) {
      setDraft(filterState);
    }
  }, [isOpen, filterState]);

  if (!isOpen) return null;

  const handleShowAll = () => {
    setDraft({
      discardWithoutResponses: false,
      searchTerm: '',
      regex: false,
      caseSensitive: false,
      negativeSearch: false,
      status2xx: true,
      status3xx: true,
      status4xx: true,
      status5xx: true,
      showOnlyNotes: false,
      showOnlyHighlighted: false,
    });
  };

  const handleHideAll = () => {
    setDraft((prev) => ({
      ...prev,
      status2xx: false,
      status3xx: false,
      status4xx: false,
      status5xx: false,
    }));
  };

  const handleRevert = () => {
    setDraft(filterState);
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl overflow-hidden font-sans text-xs select-none animate-in fade-in zoom-in-95 duration-150">
        {/* Title Bar */}
        <div className="h-8 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Zap className="w-3.5 h-3.5 text-[#f37021] fill-current" />
            <span>Intruder capture filter</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-[#8c9099] cursor-pointer hover:text-white" />
            <button
              onClick={onClose}
              className="text-[#8c9099] hover:text-white hover:bg-[#ef4444] rounded p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Form Body - 4 Grouped Fieldsets matching Burp Suite */}
        <div className="p-3 grid grid-cols-4 gap-3 bg-[#1e1f22] text-[#dfdfdf]">
          {/* 1. Capture by response type */}
          <fieldset className="border border-[#3e4249] rounded p-2.5 flex flex-col justify-start">
            <legend className="text-[11px] text-[#c4c7c5] px-1 font-medium">
              Capture by response type
            </legend>
            <label className="flex items-center gap-2 mt-2 cursor-pointer hover:text-white text-[11px]">
              <input
                type="checkbox"
                checked={draft.discardWithoutResponses}
                onChange={(e) => setDraft({ ...draft, discardWithoutResponses: e.target.checked })}
                className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
              />
              <span>Discard items without responses</span>
            </label>
          </fieldset>

          {/* 2. Capture by search term */}
          <fieldset className="border border-[#3e4249] rounded p-2.5 flex flex-col justify-start">
            <legend className="text-[11px] text-[#c4c7c5] px-1 font-medium">
              Capture by search term [Pro only]
            </legend>
            <input
              type="text"
              value={draft.searchTerm}
              onChange={(e) => setDraft({ ...draft, searchTerm: e.target.value })}
              placeholder=""
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-[11px] outline-none focus:border-[#f37021]"
            />
            <div className="mt-2 space-y-1.5 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.regex}
                  onChange={(e) => setDraft({ ...draft, regex: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Regex</span>
              </label>
              <div className="flex items-center justify-between gap-1">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.caseSensitive}
                    onChange={(e) => setDraft({ ...draft, caseSensitive: e.target.checked })}
                    className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Case sensitive</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.negativeSearch}
                    onChange={(e) => setDraft({ ...draft, negativeSearch: e.target.checked })}
                    className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Negative search</span>
                </label>
              </div>
            </div>
          </fieldset>

          {/* 3. Capture by status code */}
          <fieldset className="border border-[#3e4249] rounded p-2.5 flex flex-col justify-start">
            <legend className="text-[11px] text-[#c4c7c5] px-1 font-medium">
              Capture by status code
            </legend>
            <div className="mt-1 space-y-1.5 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status2xx}
                  onChange={(e) => setDraft({ ...draft, status2xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>2xx [success]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status3xx}
                  onChange={(e) => setDraft({ ...draft, status3xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>3xx [redirection]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status4xx}
                  onChange={(e) => setDraft({ ...draft, status4xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>4xx [request error]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status5xx}
                  onChange={(e) => setDraft({ ...draft, status5xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>5xx [server error]</span>
              </label>
            </div>
          </fieldset>

          {/* 4. Capture by annotation */}
          <fieldset className="border border-[#3e4249] rounded p-2.5 flex flex-col justify-start">
            <legend className="text-[11px] text-[#c4c7c5] px-1 font-medium">
              Capture by annotation
            </legend>
            <div className="mt-1 space-y-1.5 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyNotes}
                  onChange={(e) => setDraft({ ...draft, showOnlyNotes: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only items with notes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyHighlighted}
                  onChange={(e) => setDraft({ ...draft, showOnlyHighlighted: e.target.checked })}
                  className="rounded bg-[#141517] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only highlighted items</span>
              </label>
            </div>
          </fieldset>
        </div>

        {/* Footer Action Buttons matching Burp Suite */}
        <div className="h-11 bg-[#2b2d30] border-t border-[#1e1f22] flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleShowAll}
              className="px-3 py-1 rounded bg-[#1e1f22] hover:bg-[#35383f] text-white text-xs border border-[#3e4249] font-medium transition-colors"
            >
              Show all
            </button>
            <button
              onClick={handleHideAll}
              className="px-3 py-1 rounded bg-[#1e1f22] hover:bg-[#35383f] text-white text-xs border border-[#3e4249] font-medium transition-colors"
            >
              Hide all
            </button>
            <button
              onClick={handleRevert}
              className="px-3 py-1 rounded bg-[#1e1f22] hover:bg-[#35383f] text-white text-xs border border-[#3e4249] font-medium transition-colors"
            >
              Revert changes
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1 rounded bg-[#1e1f22] hover:bg-[#35383f] text-white text-xs border border-[#3e4249] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1 rounded bg-[#f37021] hover:bg-[#e06010] text-white text-xs font-semibold shadow-md transition-colors"
            >
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
