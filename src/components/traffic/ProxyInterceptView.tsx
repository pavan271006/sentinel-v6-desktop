import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  Globe,
  Edit3,
  Sliders,
  ChevronDown,
  Rows,
  Clock,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useInterceptStore, InterceptedRequestItem } from '../../stores/interceptStore';
import { useToastStore } from '../../stores/toastStore';
import { useAppShellStore } from '../../stores/appShellStore';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { useIntruderStore } from '../../stores/intruderStore';
import { ipcClient } from '../../ipc/client';
import { HttpSyntaxHighlighter } from '../common/HttpSyntaxHighlighter';
import { BurpSearchBar, countSearchMatches } from '../common/BurpSearchBar';
import { BurpInspectorPanel } from './BurpInspectorPanel';
import { BurpEditorToolbar } from '../common/BurpEditorToolbar';
import { ContextMenu } from '../../design-system/ContextMenu';
import { buildTrafficContextMenu } from '../../utils/contextMenuUtils';
import { SplitPane } from '../../design-system/SplitPane';
import { generateRenderablePreviewHtml } from '../../utils/repeaterUtils';
import { RawByteInspector } from '../../design-system/RawByteInspector';

export const ProxyInterceptView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    isInterceptOn,
    toggleIntercept,
    interceptedQueue,
    selectedQueueId,
    editedRawRequest,
    viewMode,
    setViewMode,
    inspectorOpen,
    setInspectorOpen,
    selectRequest,
    updateEditedRawRequest,
    forwardRequest,
    forwardAll,
    dropRequest,
    dropAll,
    lastResponse,
    responseHistoryMap,
  } = useInterceptStore();

  const [activeMainTab, setActiveMainTab] = useState<'request' | 'response' | 'split'>('request');
  const [responseViewMode, setResponseViewMode] = useState<'Pretty' | 'Raw' | 'Hex' | 'Render'>('Pretty');
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>(() => {
    const saved = localStorage.getItem('sentinel_intercept_split_orientation');
    if (saved === 'horizontal' || saved === 'vertical') return saved;
    return 'horizontal';
  });
  const [activeRightDrawer, setActiveRightDrawer] = useState<'none' | 'inspector' | 'notes'>('none');
  const [interceptNotes, setInterceptNotes] = useState<string>('');

  const handleToggleSplitOrientation = () => {
    setSplitOrientation((prev) => {
      const next = prev === 'vertical' ? 'horizontal' : 'vertical';
      localStorage.setItem('sentinel_intercept_split_orientation', next);
      return next;
    });
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isResSearchOpen, setIsResSearchOpen] = useState(false);
  const [resWordWrap, setResWordWrap] = useState(true);
  const [resHideBoring, setResHideBoring] = useState(false);
  const [resShowNonPrintable, setResShowNonPrintable] = useState(false);
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [resActiveMatchIndex, setResActiveMatchIndex] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [hideBoringHeaders, setHideBoringHeaders] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showNonPrintable, setShowNonPrintable] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        handleToggleSplitOrientation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [interceptSelection, setInterceptSelection] = useState<{ text: string; start: number; end: number }>({
    text: '',
    start: 0,
    end: 0,
  });
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetTx: any;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    targetTx: null,
  });

  const handleApplySelectionReplacement = (replacement: string) => {
    if (interceptSelection.start >= 0 && interceptSelection.end >= interceptSelection.start) {
      const raw = editedRawRequest || '';
      const newRaw = raw.substring(0, interceptSelection.start) + replacement + raw.substring(interceptSelection.end);
      updateEditedRawRequest(newRaw);
      setInterceptSelection({
        text: replacement,
        start: interceptSelection.start,
        end: interceptSelection.start + replacement.length,
      });
    }
  };

  const selectedItem = useMemo(() => {
    return interceptedQueue.find((q) => q.id === selectedQueueId) || interceptedQueue[0] || null;
  }, [interceptedQueue, selectedQueueId]);

  const currentResponse = useMemo(() => {
    if (selectedItem && responseHistoryMap[selectedItem.id]) {
      return responseHistoryMap[selectedItem.id];
    }
    return lastResponse;
  }, [selectedItem, responseHistoryMap, lastResponse]);

  const resTotalMatches = useMemo(() => {
    return countSearchMatches(currentResponse?.rawResponse || '', resSearchQuery);
  }, [currentResponse, resSearchQuery]);

  const handlePrevResMatch = () => {
    if (resTotalMatches === 0) return;
    setResActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : resTotalMatches - 1));
  };

  const handleNextResMatch = () => {
    if (resTotalMatches === 0) return;
    setResActiveMatchIndex((prev) => (prev < resTotalMatches - 1 ? prev + 1 : 0));
  };

  const currentRequestTx = useMemo(() => {
    if (!selectedItem && !editedRawRequest) return null;
    const raw = editedRawRequest || selectedItem?.rawRequest || '';
    const parts = raw.split(/\r?\n\r?\n/);
    const headerSection = parts[0] || '';
    const body = parts.slice(1).join('\r\n\r\n');
    const lines = headerSection.split(/\r?\n/);
    const requestLine = lines[0] || 'GET / HTTP/1.1';
    const [method = 'GET', rawPath = '/'] = requestLine.split(/\s+/);
    let host = selectedItem?.host || '';
    const headers: Array<{ name: string; value: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const name = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        headers.push({ name, value });
        if (name.toLowerCase() === 'host') {
          host = value;
        }
      }
    }
    const url = selectedItem?.url || (host ? `https://${host}${rawPath.startsWith('/') ? '' : '/'}${rawPath}` : rawPath);
    return {
      id: selectedItem?.id || 'intercept-current',
      url,
      method,
      host: host || 'unknown',
      path: rawPath,
      rawRequest: raw,
      reqHeaders: headers,
      reqBody: body,
      request: {
        method,
        url,
        headers,
        bodyText: body,
      },
      response: null,
    };
  }, [selectedItem, editedRawRequest]);

  const handleRowContextMenu = (e: React.MouseEvent, item: InterceptedRequestItem) => {
    e.preventDefault();
    e.stopPropagation();
    selectRequest(item.id);
    const txLike = {
      id: item.id,
      url: item.url,
      method: item.method,
      host: item.host,
      path: item.path,
      rawRequest: item.rawRequest,
      reqHeaders: item.headers,
      reqBody: item.body,
      request: {
        method: item.method,
        url: item.url,
        headers: item.headers,
        bodyText: item.body,
      },
      response: null,
    };
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetTx: txLike,
    });
  };

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    if (!currentRequestTx) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetTx: currentRequestTx,
    });
  };

  const totalMatches = useMemo(() => {
    return countSearchMatches(editedRawRequest || '', searchQuery);
  }, [editedRawRequest, searchQuery]);

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#141517] text-[#dfdfdf] font-sans text-xs select-none overflow-hidden min-h-0">
      {/* 1. Top Intercept Action Toolbar matching Burp Suite */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Intercept is on/off Button */}
          <button
            onClick={toggleIntercept}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold shadow-sm transition-colors ${
              isInterceptOn
                ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                : 'bg-[#3e4249] hover:bg-[#4b525d] text-[#9da5b4]'
            }`}
          >
            {isInterceptOn ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isInterceptOn ? 'Intercept is on' : 'Intercept is off'}</span>
          </button>

          {/* Forward Button */}
          <div className="flex items-center">
            <button
              onClick={() => forwardRequest()}
              disabled={interceptedQueue.length === 0}
              className={`flex items-center gap-1.5 px-4 py-1 rounded-l text-xs font-bold transition-colors ${
                interceptedQueue.length > 0
                  ? 'bg-[#f37021] hover:bg-[#e05d06] text-white shadow-md'
                  : 'bg-[#3e4249] text-[#6f737a] cursor-not-allowed'
              }`}
              title="Forward intercepted request upstream (Ctrl+F)"
            >
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Forward</span>
            </button>
            <button
              onClick={() => forwardAll()}
              disabled={interceptedQueue.length <= 1}
              className={`px-1.5 py-1 rounded-r border-l border-[#d95d13] text-xs transition-colors ${
                interceptedQueue.length > 1
                  ? 'bg-[#f37021] hover:bg-[#e05d06] text-white'
                  : 'bg-[#3e4249] text-[#6f737a] cursor-not-allowed'
              }`}
              title="Forward all intercepted requests"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drop Button */}
          <div className="flex items-center">
            <button
              onClick={() => dropRequest()}
              disabled={interceptedQueue.length === 0}
              className={`flex items-center gap-1 px-3 py-1 rounded-l text-xs font-bold transition-colors ${
                interceptedQueue.length > 0
                  ? 'bg-[#2b2d30] hover:bg-[#3e4249] text-[#ef4444] border border-[#3e4249]'
                  : 'bg-[#2b2d30] text-[#6f737a] border border-[#3e4249] cursor-not-allowed'
              }`}
              title="Drop / cancel this request"
            >
              <span>Drop</span>
            </button>
            <button
              onClick={() => dropAll()}
              disabled={interceptedQueue.length <= 1}
              className={`px-1.5 py-1 rounded-r border border-l-0 border-[#3e4249] text-xs transition-colors ${
                interceptedQueue.length > 1
                  ? 'bg-[#2b2d30] hover:bg-[#3e4249] text-[#ef4444]'
                  : 'bg-[#2b2d30] text-[#6f737a] cursor-not-allowed'
              }`}
              title="Drop all queued requests"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Request Target Address Info */}
          {selectedItem && (
            <div className="flex items-center gap-1.5 ml-2 text-xs text-[#9da5b4] font-mono truncate max-w-md">
              <span>
                Request to <strong className="text-[#dfdfdf]">{selectedItem.url.split('?')[0]}:{selectedItem.port}</strong> [{selectedItem.ip || '127.0.0.1'}]
              </span>
              <Edit3 className="w-3 h-3 text-[#6f737a] hover:text-white cursor-pointer" />
            </div>
          )}
        </div>

        {/* Right Tools: Open browser & Toggle Inspector */}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await ipcClient.launchSystemBrowser('https://www.google.com', 8085);
                addToast({ type: 'success', title: 'Proxy Browser Active (127.0.0.1:8085)' });
              } catch {
                addToast({ type: 'info', title: 'Proxy Browser Launched' });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] text-xs font-medium transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-[#f37021]" />
            <span>Open browser</span>
          </button>

          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className={`p-1 rounded border border-[#3e4249] transition-colors ${
              inspectorOpen ? 'bg-[#3e4249] text-[#f37021]' : 'text-[#9da5b4] hover:text-white'
            }`}
            title="Toggle Inspector"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Work Area: Queue Table (Top) & Request/Response (Bottom) with vertical drag */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <SplitPane
          direction="vertical"
          initialSize={140}
          minSize={36}
          maxSize={500}
          storageKey="sentinel_intercept_queue_split"
          className="w-full h-full"
          primary={
            /* Intercept Queue Table */
            <div className="w-full h-full bg-[#141517] overflow-y-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249] select-none">
                  <tr>
                    <th className="px-3 py-1 w-24">Time</th>
                    <th className="px-2 py-1 w-16">Type</th>
                    <th className="px-2 py-1 w-24">Direction</th>
                    <th className="px-2 py-1 w-20">Method</th>
                    <th className="px-2 py-1">URL</th>
                    <th className="px-2 py-1 w-24">Status code</th>
                    <th className="px-3 py-1 w-20">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232529]">
                  {interceptedQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-[#6f737a] font-sans">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-semibold text-white">No intercepted requests in queue</span>
                          <span className="text-xs">
                            {isInterceptOn
                              ? 'Requests sent by your browser will be caught here for inspection.'
                              : 'Intercept is turned off. Toggle "Intercept is on" to pause requests.'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    interceptedQueue.map((item) => {
                      const isSelected = item.id === selectedItem?.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => selectRequest(item.id)}
                          onContextMenu={(e) => handleRowContextMenu(e, item)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#282b30] text-white font-medium'
                              : 'hover:bg-[#1e1f22] text-[#c4c7c5]'
                          }`}
                        >
                          <td className="px-3 py-1 text-[#8c9099] truncate">{item.timestamp}</td>
                          <td className="px-2 py-1 text-[#38bdf8] font-bold">{item.type}</td>
                          <td className="px-2 py-1 text-[#34d399] font-medium flex items-center gap-1">
                            <span>→</span>
                            <span>Request</span>
                          </td>
                          <td className="px-2 py-1 text-[#f37021] font-bold">{item.method}</td>
                          <td className="px-2 py-1 truncate max-w-xl text-white select-text" title={item.url}>
                            {item.url}
                          </td>
                          <td className="px-2 py-1 text-[#6f737a]">—</td>
                          <td className="px-3 py-1 text-[#9da5b4]">{item.lengthBytes}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          }
          secondary={
            /* 3. Main Center Split: Request Editor (Left) & Inspector (Right) */
            <div className="w-full h-full flex min-h-0 bg-[#1e1f22] overflow-hidden">
              {/* Left: Request & Response panels horizontally or vertically resizable */}
              <div className="flex-1 min-w-0 bg-[#141517] overflow-hidden flex flex-col">
                <SplitPane
                  direction={splitOrientation}
                  initialSize={splitOrientation === 'horizontal' ? 620 : 320}
                  minSize={100}
                  maxSize={1800}
                  storageKey="sentinel_intercept_req_res"
                  className="w-full h-full"
                  primary={
              /* Request Panel */
              <div className="w-full h-full flex flex-col bg-[#141517] overflow-hidden">
                {/* Header Mode Strip: Request [Pretty | Raw | Hex] + Toolbar */}
                <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-xs">Request</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      {(['Pretty', 'Raw', 'Hex'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            viewMode === m
                              ? 'bg-[#f37021] text-white font-bold'
                              : 'text-[#9da5b4] hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {selectedItem && (
                      <span className="text-[11px] text-[#9da5b4] font-mono truncate max-w-xs">
                        {selectedItem.method} {selectedItem.path}
                      </span>
                    )}
                  </div>

                  <BurpEditorToolbar
                    splitOrientation={splitOrientation}
                    onToggleSplitOrientation={handleToggleSplitOrientation}
                    onAutoFormat={() => {
                      try {
                        if (editedRawRequest) {
                          const parts = editedRawRequest.split(/\r?\n\r?\n/);
                          if (parts.length > 1 && parts[1].trim()) {
                            const bodyJson = JSON.parse(parts[1].trim());
                            const formatted = JSON.stringify(bodyJson, null, 2);
                            updateEditedRawRequest(`${parts[0]}\r\n\r\n${formatted}`);
                            addToast({ type: 'success', title: 'Formatted Request Body' });
                          }
                        }
                      } catch {
                        addToast({ type: 'info', title: 'Body is not JSON format' });
                      }
                    }}
                    isSearchOpen={isSearchOpen || !!searchQuery}
                    onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
                    hideBoringHeaders={hideBoringHeaders}
                    onToggleHideBoringHeaders={() => setHideBoringHeaders((prev) => !prev)}
                    wordWrap={wordWrap}
                    onToggleWordWrap={() => setWordWrap((prev) => !prev)}
                    showNonPrintable={showNonPrintable}
                    onToggleShowNonPrintable={() => setShowNonPrintable((prev) => !prev)}
                    inspectorOpen={activeRightDrawer === 'inspector'}
                    onToggleInspector={() => setActiveRightDrawer(activeRightDrawer === 'inspector' ? 'none' : 'inspector')}
                  />
                </div>

                {/* Request Content */}
                <div className="flex-1 overflow-hidden p-2 relative">
                  {viewMode === 'Raw' ? (
                    <textarea
                      value={editedRawRequest}
                      onChange={(e) => updateEditedRawRequest(e.target.value)}
                      onContextMenu={handleEditorContextMenu}
                      onSelect={(e) => {
                        const el = e.currentTarget;
                        setInterceptSelection({
                          text: el.value.substring(el.selectionStart, el.selectionEnd),
                          start: el.selectionStart,
                          end: el.selectionEnd,
                        });
                      }}
                      onKeyUp={(e) => {
                        const el = e.currentTarget;
                        setInterceptSelection({
                          text: el.value.substring(el.selectionStart, el.selectionEnd),
                          start: el.selectionStart,
                          end: el.selectionEnd,
                        });
                      }}
                      onMouseUp={(e) => {
                        const el = e.currentTarget;
                        setInterceptSelection({
                          text: el.value.substring(el.selectionStart, el.selectionEnd),
                          start: el.selectionStart,
                          end: el.selectionEnd,
                        });
                      }}
                      style={{
                        whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                        wordBreak: wordWrap ? 'break-all' : 'normal',
                      }}
                      className="w-full h-full bg-[#141517] text-[#dfdfdf] font-mono text-xs p-2 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none resize-none select-text leading-relaxed"
                      spellCheck={false}
                    />
                  ) : viewMode === 'Hex' ? (
                    <div className="w-full h-full bg-[#141517] overflow-hidden rounded border border-[#2b2d30]">
                      <RawByteInspector data={editedRawRequest || ''} />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full overflow-auto bg-[#141517] p-2"
                      onContextMenu={handleEditorContextMenu}
                    >
                      <HttpSyntaxHighlighter
                        content={editedRawRequest}
                        isResponse={false}
                        showLineNumbers={true}
                        searchQuery={searchQuery}
                        activeMatchIndex={activeMatchIndex}
                        wordWrap={wordWrap}
                        hideUninterestingHeaders={hideBoringHeaders}
                        showNonPrintable={showNonPrintable}
                        onSelectionChange={(text) => setInterceptSelection({ text, start: -1, end: -1 })}
                      />
                    </div>
                  )}
                </div>

                {/* Request Bottom Search Bar */}
                <BurpSearchBar
                  searchQuery={searchQuery}
                  onSearchChange={(val) => {
                    setSearchQuery(val);
                    setActiveMatchIndex(0);
                  }}
                  activeMatchIndex={activeMatchIndex}
                  totalMatches={totalMatches}
                  onPrevMatch={handlePrevMatch}
                  onNextMatch={handleNextMatch}
                  selectionInfo={`Length: ${new TextEncoder().encode(editedRawRequest || '').length} bytes`}
                />
              </div>
            }
            secondary={
              /* Response Panel */
              <div className="w-full h-full flex flex-col bg-[#141517] overflow-hidden">
                {/* Header Mode Strip: Response [Pretty | Raw | Hex | Render] + Status badge + Toolbar */}
                <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-xs">Response</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      {(['Pretty', 'Raw', 'Hex', 'Render'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setResponseViewMode(m)}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            responseViewMode === m
                              ? 'bg-[#f37021] text-white font-bold'
                              : 'text-[#9da5b4] hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {currentResponse ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            currentResponse.statusCode >= 200 && currentResponse.statusCode < 300
                              ? 'bg-[#059669]/20 text-[#34d399] border border-[#059669]/30'
                              : currentResponse.statusCode >= 300 && currentResponse.statusCode < 400
                              ? 'bg-[#d97706]/20 text-[#fbbf24] border border-[#d97706]/30'
                              : 'bg-[#dc2626]/20 text-[#f87171] border border-[#dc2626]/30'
                          }`}
                        >
                          {currentResponse.statusCode} {currentResponse.statusText || ''}
                        </span>
                        {currentResponse.timestamp && (
                          <span className="text-[11px] text-[#6f737a] font-mono">{currentResponse.timestamp}</span>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-[#3e4249]/50 text-[#9da5b4] border border-[#3e4249]">
                        Awaiting forward
                      </span>
                    )}
                  </div>

                  <BurpEditorToolbar
                    splitOrientation={splitOrientation}
                    onToggleSplitOrientation={handleToggleSplitOrientation}
                    isSearchOpen={isResSearchOpen || !!resSearchQuery}
                    onToggleSearch={() => setIsResSearchOpen((prev) => !prev)}
                    hideBoringHeaders={resHideBoring}
                    onToggleHideBoringHeaders={() => setResHideBoring((prev) => !prev)}
                    wordWrap={resWordWrap}
                    onToggleWordWrap={() => setResWordWrap((prev) => !prev)}
                    showNonPrintable={resShowNonPrintable}
                    onToggleShowNonPrintable={() => setResShowNonPrintable((prev) => !prev)}
                    inspectorOpen={activeRightDrawer === 'inspector'}
                    onToggleInspector={() => setActiveRightDrawer(activeRightDrawer === 'inspector' ? 'none' : 'inspector')}
                  />
                </div>

                {/* Response Content */}
                <div className="flex-1 overflow-hidden relative">
                  {currentResponse ? (
                    responseViewMode === 'Render' ? (
                      <div className="w-full h-full bg-[#141517] overflow-hidden">
                        <iframe
                          title="Response Preview"
                          srcDoc={generateRenderablePreviewHtml(
                            currentResponse.rawResponse || currentResponse.body,
                            undefined,
                            currentResponse.url
                          )}
                          sandbox="allow-scripts allow-same-origin allow-forms"
                          className="w-full h-full border-none bg-[#141517]"
                        />
                      </div>
                    ) : responseViewMode === 'Raw' ? (
                      <div className="w-full h-full p-2">
                        <textarea
                          readOnly
                          value={currentResponse.rawResponse || currentResponse.body}
                          style={{
                            whiteSpace: resWordWrap ? 'pre-wrap' : 'pre',
                            wordBreak: resWordWrap ? 'break-all' : 'normal',
                          }}
                          className="w-full h-full bg-[#141517] text-[#dfdfdf] font-mono text-xs p-2 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none resize-none select-text leading-relaxed cursor-text"
                          spellCheck={false}
                        />
                      </div>
                    ) : responseViewMode === 'Hex' ? (
                      <div className="w-full h-full bg-[#141517] overflow-hidden rounded border border-[#2b2d30]">
                        <RawByteInspector data={currentResponse.rawResponse || currentResponse.body} />
                      </div>
                    ) : (
                      <div className="w-full h-full overflow-auto bg-[#141517] p-2">
                        <HttpSyntaxHighlighter
                          content={currentResponse.rawResponse || currentResponse.body}
                          isResponse={true}
                          showLineNumbers={true}
                          searchQuery={resSearchQuery}
                          activeMatchIndex={resActiveMatchIndex}
                          wordWrap={resWordWrap}
                          hideUninterestingHeaders={resHideBoring}
                          showNonPrintable={resShowNonPrintable}
                        />
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#6f737a] p-4 text-center select-none">
                      <Clock className="w-8 h-8 mb-2 opacity-40 text-[#f37021]" />
                      <span className="font-semibold text-[#c4c7c5] text-xs">Waiting for response</span>
                      <span className="text-[11px] text-[#6f737a] max-w-sm mt-1">
                        Click <strong className="text-[#f37021]">Forward</strong> in the top toolbar to send this request to the server and display its response here.
                      </span>
                    </div>
                  )}
                </div>

                {/* Response Bottom Search Bar */}
                <BurpSearchBar
                  searchQuery={resSearchQuery}
                  onSearchChange={(val) => {
                    setResSearchQuery(val);
                    setResActiveMatchIndex(0);
                  }}
                  activeMatchIndex={resActiveMatchIndex}
                  totalMatches={resTotalMatches}
                  onPrevMatch={handlePrevResMatch}
                  onNextMatch={handleNextResMatch}
                  selectionInfo={`Length: ${new TextEncoder().encode(currentResponse?.rawResponse || currentResponse?.body || '').length} bytes`}
                />
              </div>
            }
          />
        </div>

        {/* Right Slide-out Drawer: Inspector or Notes */}
        {activeRightDrawer === 'inspector' && (
          <div className="w-80 md:w-96 bg-[#1e1f22] border-l border-[#2b2d30] flex-shrink-0 h-full flex flex-col min-h-0">
            <BurpInspectorPanel
              item={selectedItem}
              rawRequest={editedRawRequest || selectedItem?.rawRequest || ''}
              rawResponse={currentResponse?.rawResponse || currentResponse?.body || ''}
              onUpdateRawRequest={(newRaw) => updateEditedRawRequest(newRaw)}
              selectionText={interceptSelection.text}
              onApplySelectionReplacement={handleApplySelectionReplacement}
              onClose={() => setActiveRightDrawer('none')}
            />
          </div>
        )}
        {activeRightDrawer === 'notes' && (
          <div className="w-72 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col p-3 text-xs overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2 mb-3">
              <span className="font-bold text-white uppercase tracking-wider text-[10px]">Intercept Notes</span>
              <button
                onClick={() => setActiveRightDrawer('none')}
                className="text-[#8c9099] hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <textarea
                placeholder="Add notes for this intercepted request..."
                value={interceptNotes}
                onChange={(e) => setInterceptNotes(e.target.value)}
                className="w-full h-36 bg-[#141517] border border-[#3e4249] rounded p-2 text-white font-sans text-xs outline-none focus:border-[#f37021]"
              />
              <span className="text-[10px] text-[#6f737a]">Notes are saved for current session.</span>
            </div>
          </div>
        )}

        {/* Far Right Vertical Dock Tabs Strip (matching media_1790936607632.png) */}
        <div className="w-7 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col items-center py-2 text-[#9da5b4] flex-shrink-0 select-none">
          <button
            onClick={() => setActiveRightDrawer(activeRightDrawer === 'inspector' ? 'none' : 'inspector')}
            className={`p-1.5 rounded hover:text-white transition-colors mb-3 relative ${
              activeRightDrawer === 'inspector' ? 'text-[#f37021] bg-[#2b2d30]' : ''
            }`}
            title="Toggle Inspector"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="[writing-mode:vertical-rl] text-[10px] tracking-wider mt-2 font-medium">
              Inspector
            </span>
          </button>

          <button
            onClick={() => setActiveRightDrawer(activeRightDrawer === 'notes' ? 'none' : 'notes')}
            className={`p-1.5 rounded hover:text-white transition-colors relative ${
              activeRightDrawer === 'notes' ? 'text-[#f37021] bg-[#2b2d30]' : ''
            }`}
            title="Toggle Notes"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="[writing-mode:vertical-rl] text-[10px] tracking-wider mt-2 font-medium">
              Notes
            </span>
          </button>
        </div>
            </div>
          }
        />
      </div>

      {/* Burp Suite Context Menu */}
      {contextMenu.isOpen && contextMenu.targetTx && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={buildTrafficContextMenu(contextMenu.targetTx, {
            onSendToRepeater: (tx) => {
              useRepeaterStore.getState().createTabFromTransaction(tx);
              useAppShellStore.getState().setActiveWorkspace('repeater');
            },
            onSendToIntruder: (tx) => {
              useIntruderStore.getState().sendToIntruder(tx);
              useAppShellStore.getState().setActiveWorkspace('fuzzer');
            },
          })}
        />
      )}
    </div>
  );
};
