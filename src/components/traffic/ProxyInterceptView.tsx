import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  Globe,
  Edit3,
  Sliders,
  ChevronDown,
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
  } = useInterceptStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [hideBoringHeaders, setHideBoringHeaders] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [showNonPrintable, setShowNonPrintable] = useState(false);
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

      {/* 2. Intercept Queue Table (Top 35%) */}
      <div className="h-44 bg-[#141517] border-b border-[#2b2d30] overflow-y-auto flex-shrink-0 font-mono text-xs">
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

      {/* 3. Main Center Split: Request Editor (Left) & Inspector (Right) */}
      <div className="flex-1 flex min-h-0 bg-[#1e1f22] overflow-hidden">
        {/* Left: Request Inspector Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#141517]">
          {/* Header Mode Strip: Request [Pretty | Raw | Hex] + [EyeOff | WrapText | \n | ≡] */}
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
            </div>

            <BurpEditorToolbar
              hideBoringHeaders={hideBoringHeaders}
              onToggleHideBoringHeaders={() => setHideBoringHeaders((prev) => !prev)}
              wordWrap={wordWrap}
              onToggleWordWrap={() => setWordWrap((prev) => !prev)}
              showNonPrintable={showNonPrintable}
              onToggleShowNonPrintable={() => setShowNonPrintable((prev) => !prev)}
              inspectorOpen={inspectorOpen}
              onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
            />
          </div>

          {/* Request Raw Editor / Pretty Viewer */}
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
            ) : (
              <div
                className="w-full h-full overflow-auto bg-[#141517] p-2"
                onContextMenu={handleEditorContextMenu}
              >
                <HttpSyntaxHighlighter
                  content={editedRawRequest}
                  isResponse={false}
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

          {/* Bottom Burp Suite Search Bar */}
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

        {/* Right: Collapsible Inspector Panel */}
        {inspectorOpen && (
          <div className="w-80 bg-[#1e1f22] flex-shrink-0 h-full flex flex-col min-h-0">
            <BurpInspectorPanel
              item={selectedItem}
              rawRequest={editedRawRequest || selectedItem?.rawRequest || ''}
              onUpdateRawRequest={(newRaw) => updateEditedRawRequest(newRaw)}
              selectionText={interceptSelection.text}
              onApplySelectionReplacement={handleApplySelectionReplacement}
              onClose={() => setInspectorOpen(false)}
            />
          </div>
        )}
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
