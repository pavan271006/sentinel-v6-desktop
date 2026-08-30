import React, { useState } from 'react';
import { X, HelpCircle, Settings, Flame } from 'lucide-react';
import { Button } from '../../design-system/Button';

export interface HttpHistoryFilterConfig {
  // Request Type
  showOnlyInScope: boolean;
  hideNoResponse: boolean;
  showOnlyParameterized: boolean;

  // MIME Types
  mimeHtml: boolean;
  mimeScript: boolean;
  mimeXml: boolean;
  mimeCss: boolean;
  mimeOtherText: boolean;
  mimeImages: boolean;
  mimeFlash: boolean;
  mimeOtherBinary: boolean;

  // Status Codes
  status2xx: boolean;
  status3xx: boolean;
  status4xx: boolean;
  status5xx: boolean;

  // Search Term
  searchTerm: string;
  searchRegex: boolean;
  searchCaseSensitive: boolean;
  searchNegative: boolean;

  // File Extension
  filterShowOnlyExt: boolean;
  showOnlyExtList: string;
  filterHideExt: boolean;
  hideExtList: string;

  // Annotation
  showOnlyWithNotes: boolean;
  showOnlyHighlighted: boolean;

  // Listener
  listenerPort: string;
}

export const DEFAULT_FILTER_CONFIG: HttpHistoryFilterConfig = {
  showOnlyInScope: false,
  hideNoResponse: false,
  showOnlyParameterized: false,

  mimeHtml: true,
  mimeScript: true,
  mimeXml: true,
  mimeCss: false,
  mimeOtherText: true,
  mimeImages: false,
  mimeFlash: true,
  mimeOtherBinary: true,

  status2xx: true,
  status3xx: true,
  status4xx: true,
  status5xx: true,

  searchTerm: '',
  searchRegex: false,
  searchCaseSensitive: false,
  searchNegative: false,

  filterShowOnlyExt: false,
  showOnlyExtList: 'asp,aspx,jsp,php',
  filterHideExt: true,
  hideExtList: 'js,gif,jpg,png,ico,css,woff,woff2',

  showOnlyWithNotes: false,
  showOnlyHighlighted: false,

  listenerPort: '',
};

export interface HttpHistoryFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HttpHistoryFilterConfig;
  onApply: (newConfig: HttpHistoryFilterConfig) => void;
}

export const HttpHistoryFilterModal: React.FC<HttpHistoryFilterModalProps> = ({
  isOpen,
  onClose,
  config,
  onApply,
}) => {
  const [draft, setDraft] = useState<HttpHistoryFilterConfig>(config);

  // Sync draft when opened
  React.useEffect(() => {
    if (isOpen) {
      setDraft(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleShowAll = () => {
    setDraft({
      ...draft,
      showOnlyInScope: false,
      hideNoResponse: false,
      showOnlyParameterized: false,
      mimeHtml: true,
      mimeScript: true,
      mimeXml: true,
      mimeCss: true,
      mimeOtherText: true,
      mimeImages: true,
      mimeFlash: true,
      mimeOtherBinary: true,
      status2xx: true,
      status3xx: true,
      status4xx: true,
      status5xx: true,
      filterShowOnlyExt: false,
      filterHideExt: false,
      showOnlyWithNotes: false,
      showOnlyHighlighted: false,
      searchTerm: '',
    });
  };

  const handleHideAll = () => {
    setDraft({
      ...draft,
      mimeHtml: false,
      mimeScript: false,
      mimeXml: false,
      mimeCss: false,
      mimeOtherText: false,
      mimeImages: false,
      mimeFlash: false,
      mimeOtherBinary: false,
      status2xx: false,
      status3xx: false,
      status4xx: false,
      status5xx: false,
    });
  };

  const handleRevert = () => {
    setDraft(DEFAULT_FILTER_CONFIG);
  };

  const handleApplyAndClose = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] select-none p-4 font-sans text-xs">
      <div className="w-[840px] max-w-full bg-[#1e1f22] border border-[#3e4249] rounded-md shadow-2xl flex flex-col overflow-hidden text-[#c4c7c5]">
        {/* Header Bar */}
        <div className="h-8 bg-[#2b2d30] border-b border-[#3e4249] flex items-center justify-between px-3">
          <div className="flex items-center gap-1.5 font-medium text-white text-xs">
            <Flame className="w-4 h-4 text-[#f37021]" />
            <span>HTTP history filter</span>
          </div>
          <div className="flex items-center gap-2 text-[#9da5b4]">
            <button className="hover:text-white" title="Help">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <button className="hover:text-white" title="Filter settings">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="hover:text-white ml-1" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Indicator */}
        <div className="px-3 pt-2.5 pb-0.5 flex items-center">
          <span className="bg-[#0284c7] text-white font-medium text-[11px] px-2.5 py-0.5 rounded shadow-sm select-none">
            Settings mode
          </span>
        </div>

        {/* Main Form Area */}
        <div className="p-3 space-y-3">
          {/* Row 1: Request Type | MIME Type | Status Code */}
          <div className="grid grid-cols-12 gap-3">
            {/* Filter by request type (col 4) */}
            <fieldset className="col-span-4 border border-[#35383f] rounded px-3 py-2 text-[11px] space-y-2">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by request type</legend>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyInScope}
                  onChange={(e) => setDraft({ ...draft, showOnlyInScope: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only in-scope items</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.hideNoResponse}
                  onChange={(e) => setDraft({ ...draft, hideNoResponse: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Hide items without responses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyParameterized}
                  onChange={(e) => setDraft({ ...draft, showOnlyParameterized: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only parameterized requests</span>
              </label>
            </fieldset>

            {/* Filter by MIME type (col 5) */}
            <fieldset className="col-span-5 border border-[#35383f] rounded px-3 py-2 text-[11px]">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by MIME type</legend>
              <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeHtml}
                    onChange={(e) => setDraft({ ...draft, mimeHtml: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>HTML</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeOtherText}
                    onChange={(e) => setDraft({ ...draft, mimeOtherText: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Other text</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeScript}
                    onChange={(e) => setDraft({ ...draft, mimeScript: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Script</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeImages}
                    onChange={(e) => setDraft({ ...draft, mimeImages: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Images</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeXml}
                    onChange={(e) => setDraft({ ...draft, mimeXml: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>XML</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeFlash}
                    onChange={(e) => setDraft({ ...draft, mimeFlash: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Flash</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeCss}
                    onChange={(e) => setDraft({ ...draft, mimeCss: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>CSS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.mimeOtherBinary}
                    onChange={(e) => setDraft({ ...draft, mimeOtherBinary: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Other binary</span>
                </label>
              </div>
            </fieldset>

            {/* Filter by status code (col 3) */}
            <fieldset className="col-span-3 border border-[#35383f] rounded px-3 py-2 text-[11px] space-y-2">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by status code</legend>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status2xx}
                  onChange={(e) => setDraft({ ...draft, status2xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>2xx [success]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status3xx}
                  onChange={(e) => setDraft({ ...draft, status3xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>3xx [redirection]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status4xx}
                  onChange={(e) => setDraft({ ...draft, status4xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>4xx [request error]</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.status5xx}
                  onChange={(e) => setDraft({ ...draft, status5xx: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>5xx [server error]</span>
              </label>
            </fieldset>
          </div>

          {/* Row 2: Search Term | File Extension | Annotation | Listener */}
          <div className="grid grid-cols-12 gap-3">
            {/* Filter by search term (col 4) */}
            <fieldset className="col-span-4 border border-[#35383f] rounded px-3 py-2 text-[11px] space-y-2">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by search term</legend>
              <input
                type="text"
                value={draft.searchTerm}
                onChange={(e) => setDraft({ ...draft, searchTerm: e.target.value })}
                placeholder=""
                className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-0.5 text-xs text-white focus:border-[#0284c7] focus:outline-none"
              />
              <div className="flex items-center gap-3 pt-0.5 text-[10px]">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.searchRegex}
                    onChange={(e) => setDraft({ ...draft, searchRegex: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3 h-3"
                  />
                  <span>Regex</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.searchCaseSensitive}
                    onChange={(e) => setDraft({ ...draft, searchCaseSensitive: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3 h-3"
                  />
                  <span>Case sensitive</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={draft.searchNegative}
                    onChange={(e) => setDraft({ ...draft, searchNegative: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3 h-3"
                  />
                  <span>Negative search</span>
                </label>
              </div>
            </fieldset>

            {/* Filter by file extension (col 4) */}
            <fieldset className="col-span-4 border border-[#35383f] rounded px-3 py-2 text-[11px] space-y-2">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by file extension</legend>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={draft.filterShowOnlyExt}
                    onChange={(e) => setDraft({ ...draft, filterShowOnlyExt: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Show only:</span>
                </label>
                <input
                  type="text"
                  value={draft.showOnlyExtList}
                  onChange={(e) => setDraft({ ...draft, showOnlyExtList: e.target.value })}
                  className="flex-1 bg-[#141517] border border-[#3e4249] rounded px-2 py-0.5 text-xs text-white focus:border-[#0284c7] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={draft.filterHideExt}
                    onChange={(e) => setDraft({ ...draft, filterHideExt: e.target.checked })}
                    className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Hide:</span>
                </label>
                <input
                  type="text"
                  value={draft.hideExtList}
                  onChange={(e) => setDraft({ ...draft, hideExtList: e.target.value })}
                  className="flex-1 bg-[#141517] border border-[#3e4249] rounded px-2 py-0.5 text-xs text-white focus:border-[#0284c7] focus:outline-none"
                />
              </div>
            </fieldset>

            {/* Filter by annotation (col 2.5) */}
            <fieldset className="col-span-2 border border-[#35383f] rounded px-3 py-2 text-[11px] space-y-2">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by annotation</legend>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyWithNotes}
                  onChange={(e) => setDraft({ ...draft, showOnlyWithNotes: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only items with notes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={draft.showOnlyHighlighted}
                  onChange={(e) => setDraft({ ...draft, showOnlyHighlighted: e.target.checked })}
                  className="rounded bg-[#141517] border-[#4b5563] text-[#0284c7] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Show only highlighted items</span>
              </label>
            </fieldset>

            {/* Filter by listener (col 2) */}
            <fieldset className="col-span-2 border border-[#35383f] rounded px-3 py-2 text-[11px] flex flex-col justify-between">
              <legend className="px-1 text-[#9da5b4] font-medium text-[11px]">Filter by listener</legend>
              <div className="flex items-center gap-2">
                <span className="text-[#9da5b4] font-medium">Port</span>
                <input
                  type="text"
                  value={draft.listenerPort}
                  onChange={(e) => setDraft({ ...draft, listenerPort: e.target.value })}
                  placeholder="8080"
                  className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-0.5 text-xs text-white focus:border-[#0284c7] focus:outline-none"
                />
              </div>
              <div className="text-[10px] text-[#6f737a] pt-1">
                {draft.listenerPort ? `Port: ${draft.listenerPort}` : 'All ports'}
              </div>
            </fieldset>
          </div>
        </div>

        {/* Bottom Action Buttons Bar */}
        <div className="h-10 bg-[#2b2d30] border-t border-[#3e4249] flex items-center justify-between px-3 text-xs">
          {/* Left Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleShowAll}
              className="bg-[#35383f] hover:bg-[#3e4249] text-[#dfdfdf] px-3 font-medium"
            >
              Show all
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={handleHideAll}
              className="bg-[#35383f] hover:bg-[#3e4249] text-[#dfdfdf] px-3 font-medium"
            >
              Hide all
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={handleRevert}
              className="bg-[#35383f] hover:bg-[#3e4249] text-[#dfdfdf] px-3 font-medium"
            >
              Revert changes
            </Button>
          </div>

          {/* Right Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={onClose}
              className="bg-[#35383f] hover:bg-[#3e4249] text-[#dfdfdf] px-3 font-medium"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => onApply(draft)}
              className="bg-[#35383f] hover:bg-[#3e4249] text-[#dfdfdf] px-3 font-medium"
            >
              Apply
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={handleApplyAndClose}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold px-4 shadow-sm"
            >
              Apply & close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
