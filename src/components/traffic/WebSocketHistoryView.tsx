import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  HelpCircle,
  Send,
  Trash2,
  Copy,
  WrapText,
  Pilcrow,
  RefreshCw,
} from 'lucide-react';
import { useWebSocketStore, WebSocketMessageItem } from '../../stores/websocketStore';
import { useToastStore } from '../../stores/toastStore';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { useIntruderStore } from '../../stores/intruderStore';
import { useDecoderStore } from '../../stores/decoderStore';
import { useComparerStore } from '../../stores/comparerStore';
import { useAppShellStore } from '../../stores/appShellStore';
import { ContextMenu, ContextMenuItem } from '../../design-system/ContextMenu';
import { SplitPane } from '../../design-system/SplitPane';
import { BurpSearchBar, countSearchMatches } from '../common/BurpSearchBar';
import { HttpSyntaxHighlighter } from '../common/HttpSyntaxHighlighter';

function renderHexView(text: string) {
  const bytes = new TextEncoder().encode(text);
  const rows: { offset: string; hex: string; ascii: string }[] = [];

  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, '0');
    let hexStr = '';
    let asciiStr = '';

    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        hexStr += chunk[j].toString(16).padStart(2, '0') + ' ';
        const charCode = chunk[j];
        asciiStr += charCode >= 32 && charCode <= 126 ? String.fromCharCode(charCode) : '.';
      } else {
        hexStr += '   ';
      }
      if (j === 7) hexStr += ' ';
    }

    rows.push({ offset, hex: hexStr, ascii: asciiStr });
  }

  if (rows.length === 0) {
    return <div className="text-[#6f737a] p-4 text-xs">Empty payload</div>;
  }

  return (
    <div className="font-mono text-xs p-2 leading-5 select-text">
      {rows.map((r, idx) => (
        <div key={idx} className="flex gap-4 hover:bg-[#202226]">
          <span className="text-[#38bdf8] select-none w-20">{r.offset}</span>
          <span className="text-[#dfdfdf] tracking-wider font-mono">{r.hex}</span>
          <span className="text-[#34d399] select-none border-l border-[#313438] pl-3 font-mono">{r.ascii}</span>
        </div>
      ))}
    </div>
  );
}

export const WebSocketHistoryView: React.FC = () => {
  const { addToast } = useToastStore();
  const { setActiveWorkspace } = useAppShellStore();

  const {
    messages,
    selectedMessageId,
    filterSettings,
    filterOn,
    viewMode,
    selectMessage,
    clearMessages,
    setFilterOn,
    setViewMode,
    sendCustomWebSocketMessage,
  } = useWebSocketStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [sortField, setSortField] = useState<keyof WebSocketMessageItem>('seqNumber');
  const [sortAsc, setSortAsc] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [customMsgInput, setCustomMsgInput] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetMsg: WebSocketMessageItem | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    targetMsg: null,
  });

  // Filter messages
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (filterOn) {
      if (!filterSettings.showToServer) {
        result = result.filter((m) => m.direction !== 'To server');
      }
      if (!filterSettings.showToClient) {
        result = result.filter((m) => m.direction !== 'To client');
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        result = result.filter(
          (m) =>
            m.payload.toLowerCase().includes(q) ||
            m.url.toLowerCase().includes(q) ||
            m.notes.toLowerCase().includes(q) ||
            m.seqNumber.toString().includes(q)
        );
      }
    }

    // Sort
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [messages, filterOn, filterSettings, searchFilter, sortField, sortAsc]);

  const activeMessage = useMemo(() => {
    if (!selectedMessageId) return filteredMessages[0] || null;
    return messages.find((m) => m.id === selectedMessageId) || filteredMessages[0] || null;
  }, [messages, filteredMessages, selectedMessageId]);

  const totalMatches = useMemo(() => {
    return countSearchMatches(activeMessage?.payload || '', editorSearchQuery);
  }, [activeMessage, editorSearchQuery]);

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
  };

  const handleSort = (field: keyof WebSocketMessageItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSendPing = () => {
    const url = activeMessage?.url || 'https://0a68003d033b87c3807eda3900a2004e.web-security-academy.net/chat';
    sendCustomWebSocketMessage(url, 'PING');
    addToast({
      type: 'info',
      title: 'Dispatched WebSocket PING Frame',
      description: 'Sent keepalive PING frame; received PONG echo',
    });
  };

  const handleSendCustom = () => {
    if (!customMsgInput.trim()) return;
    const url = activeMessage?.url || 'https://0a68003d033b87c3807eda3900a2004e.web-security-academy.net/chat';
    sendCustomWebSocketMessage(url, customMsgInput.trim());
    setCustomMsgInput('');
    setShowSendModal(false);
    addToast({
      type: 'success',
      title: 'WebSocket Frame Sent',
      description: `Sent payload to ${url}`,
    });
  };

  const buildWsContextMenuItems = (msg: WebSocketMessageItem): ContextMenuItem[] => {
    return [
      {
        label: 'Send to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          let host = 'target.local';
          try {
            host = new URL(msg.url).host;
          } catch {}
          const rawRequest = `GET /ws HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n${msg.payload}`;
          useRepeaterStore.getState().createTab({
            title: `WS ${msg.direction === 'To server' ? '→' : '←'} #${msg.seqNumber}`,
            url: msg.url,
            method: 'GET',
            body: msg.payload,
            rawRequest,
          });
          setActiveWorkspace('repeater');
          addToast({ type: 'success', title: 'Sent to Repeater', description: msg.url });
        },
      },
      {
        label: 'Send to Intruder',
        shortcut: 'Ctrl+I',
        onClick: () => {
          useIntruderStore.getState().sendToIntruder({
            url: msg.url,
            method: 'GET',
            reqBody: msg.payload,
          });
          setActiveWorkspace('fuzzer');
          addToast({ type: 'success', title: 'Sent to Intruder', description: msg.url });
        },
      },
      {
        label: 'Send to Decoder',
        onClick: () => {
          useDecoderStore.getState().sendToDecoder(msg.payload);
          setActiveWorkspace('decoder');
          addToast({ type: 'info', title: 'Sent to Decoder', description: 'Transferred frame payload' });
        },
      },
      {
        label: 'Send to Comparer',
        onClick: () => {
          useComparerStore.getState().sendToComparer({
            id: msg.id,
            url: msg.url,
            method: 'GET',
            reqBody: msg.payload,
            response: null,
          });
          setActiveWorkspace('comparer');
          addToast({ type: 'info', title: 'Sent to Comparer', description: 'Added payload to comparer buffer' });
        },
      },
      { divider: true },
      {
        label: 'Copy message',
        onClick: () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(msg.payload);
            addToast({ type: 'success', title: 'Copied Message', description: `${msg.payload.length} characters` });
          }
        },
      },
      {
        label: 'Copy URL',
        onClick: () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(msg.url);
            addToast({ type: 'success', title: 'Copied URL', description: msg.url });
          }
        },
      },
    ];
  };

  const handleRowContextMenu = (e: React.MouseEvent, item: WebSocketMessageItem) => {
    e.preventDefault();
    e.stopPropagation();
    selectMessage(item.id);
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetMsg: item,
    });
  };

  const handleInspectorContextMenu = (e: React.MouseEvent) => {
    if (!activeMessage) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetMsg: activeMessage,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#141517] text-[#dfdfdf] font-sans text-xs select-none overflow-hidden min-h-0">
      {/* 1. Filter Bar matching Burp Suite */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-2 gap-2 flex-shrink-0 text-xs">
        {/* Filter Summary Pill */}
        <div
          onClick={() => setFilterOn(!filterOn)}
          className="flex-1 flex items-center bg-[#1e1f22] border border-[#3e4249] rounded px-2.5 py-1 text-[#c4c7c5] hover:border-[#f37021] cursor-pointer transition-colors group"
        >
          <span className="text-[#f37021] font-bold mr-2 text-[12px]">Y</span>
          <span className="truncate text-[11px]">
            {filterOn
              ? searchFilter
                ? `Filter settings: matching "${searchFilter}"`
                : 'Filter settings: Showing all items'
              : 'Filter settings: Filter is off (Showing all)'}
          </span>
          <Search className="w-3 h-3 text-[#6f737a] ml-auto flex-shrink-0 group-hover:text-white" />
        </div>

        {/* Quick Search Field */}
        <div className="w-80 relative flex items-center">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search WebSocket messages..."
            className="w-full bg-[#1e1f22] border border-[#3e4249] rounded px-2 py-0.5 text-[11px] text-[#dfdfdf] placeholder-[#6f737a] focus:border-[#f37021] focus:outline-none pr-8"
          />
          <Search className="w-3.5 h-3.5 text-[#6f737a] absolute right-2 pointer-events-none" />
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {/* Filter On Toggle Switch */}
          <div
            onClick={() => setFilterOn(!filterOn)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none border border-[#3e4249] text-[#c4c7c5]"
          >
            <div
              className={`w-6 h-3 flex items-center rounded-full p-0.5 transition-colors ${
                filterOn ? 'bg-[#38bdf8]' : 'bg-[#3e4249]'
              }`}
            >
              <div
                className={`bg-white w-2 h-2 rounded-full shadow-md transform transition-transform ${
                  filterOn ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </div>
            <span>Filter on</span>
            <HelpCircle className="w-3 h-3 text-[#6f737a]" />
          </div>

          {/* Quick Action: Send Ping */}
          <button
            onClick={handleSendPing}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#38bdf8] border border-[#3e4249] text-xs font-medium transition-colors"
            title="Send Keepalive PING Frame"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Send PING</span>
          </button>

          {/* Quick Action: Send Custom WS Frame */}
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#f37021] hover:bg-[#e05d06] text-white font-medium text-xs transition-colors"
            title="Send Custom WebSocket Frame"
          >
            <Send className="w-3 h-3" />
            <span>Send Frame</span>
          </button>

          {/* Clear History */}
          <button
            onClick={clearMessages}
            className="p-1 text-[#9da5b4] hover:text-[#ef4444] border border-[#3e4249] rounded bg-[#1e1f22]"
            title="Clear all WebSocket history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Vertical Split: WebSocket Table (Top) & Message Viewer (Bottom) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="vertical"
          initialSize={280}
          minSize={120}
          maxSize={700}
          storageKey="burp_ws_history_split"
          primary={
            /* WebSockets History Table */
            <div className="w-full h-full bg-[#141517] overflow-auto select-none font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249] z-10 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('seqNumber')}
                      className="px-2.5 py-1.5 w-12 cursor-pointer hover:text-white"
                    >
                      # {sortField === 'seqNumber' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('url')}
                      className="px-2 py-1.5 cursor-pointer hover:text-white"
                    >
                      URL {sortField === 'url' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('direction')}
                      className="px-2 py-1.5 w-28 cursor-pointer hover:text-white"
                    >
                      Direction {sortField === 'direction' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('edited')}
                      className="px-2 py-1.5 w-16 cursor-pointer hover:text-white"
                    >
                      Edited {sortField === 'edited' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('lengthBytes')}
                      className="px-2 py-1.5 w-20 cursor-pointer hover:text-white"
                    >
                      Length {sortField === 'lengthBytes' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('notes')}
                      className="px-2 py-1.5 w-24 cursor-pointer hover:text-white"
                    >
                      Notes {sortField === 'notes' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('tls')}
                      className="px-2 py-1.5 w-14 cursor-pointer hover:text-white text-center"
                    >
                      TLS {sortField === 'tls' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('time')}
                      className="px-2 py-1.5 w-36 cursor-pointer hover:text-white"
                    >
                      Time {sortField === 'time' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('listenerPort')}
                      className="px-2 py-1.5 w-24 cursor-pointer hover:text-white"
                    >
                      Listener port {sortField === 'listenerPort' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('webSocketId')}
                      className="px-2.5 py-1.5 w-28 cursor-pointer hover:text-white"
                    >
                      WebSocket ID {sortField === 'webSocketId' ? (sortAsc ? '^' : 'v') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232529]">
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-[#6f737a] font-sans">
                        No WebSocket messages match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.map((item) => {
                      const isSelected = item.id === activeMessage?.id;
                      const isToServer = item.direction === 'To server';

                      return (
                        <tr
                          key={item.id}
                          onClick={() => selectMessage(item.id)}
                          onContextMenu={(e) => handleRowContextMenu(e, item)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#1e4976] text-white font-medium'
                              : 'hover:bg-[#1e1f22] text-[#c4c7c5]'
                          }`}
                        >
                          <td className="px-2.5 py-1 text-[#8c9099] font-mono">{item.seqNumber}</td>
                          <td className="px-2 py-1 truncate max-w-sm select-text" title={item.url}>
                            {item.url}
                          </td>
                          <td className="px-2 py-1 font-medium flex items-center gap-1.5">
                            {isToServer ? (
                              <span className="flex items-center gap-1 text-[#38bdf8]">
                                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                                <span>To server</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[#34d399]">
                                <ArrowLeft className="w-3 h-3 stroke-[2.5]" />
                                <span>To client</span>
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-[#6f737a]">{item.edited ? '✓' : ''}</td>
                          <td className="px-2 py-1 text-[#dfdfdf]">{item.lengthBytes}</td>
                          <td className="px-2 py-1 text-[#8c9099] truncate">{item.notes}</td>
                          <td className="px-2 py-1 text-center text-[#38bdf8] font-bold">
                            {item.tls ? <Check className="w-3.5 h-3.5 mx-auto text-[#38bdf8]" /> : ''}
                          </td>
                          <td className="px-2 py-1 text-[#8c9099] truncate">{item.time}</td>
                          <td className="px-2 py-1 text-[#dfdfdf]">{item.listenerPort}</td>
                          <td className="px-2.5 py-1 text-[#dfdfdf]">{item.webSocketId}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          }
          secondary={
            /* Lower Message Inspector Pane matching Burp Suite */
            <div className="w-full h-full flex flex-col bg-[#141517] overflow-hidden">
              {/* Message Header & Mode Bar */}
              <div className="h-7 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-white text-xs">Message</span>
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

                {/* Right Viewer Icons matching Burp Suite */}
                <div className="flex items-center gap-2 text-[#9da5b4]">
                  <button
                    onClick={() => setWordWrap(!wordWrap)}
                    className={`p-1 rounded hover:text-white ${wordWrap ? 'text-[#f37021]' : 'text-[#6f737a]'}`}
                    title="Toggle Word Wrap"
                  >
                    <WrapText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowWhitespace(!showWhitespace)}
                    className={`p-1 rounded hover:text-white ${showWhitespace ? 'text-[#f37021]' : 'text-[#6f737a]'}`}
                    title="Toggle Newlines / Whitespace"
                  >
                    <Pilcrow className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (activeMessage) {
                        navigator.clipboard.writeText(activeMessage.payload);
                        addToast({ type: 'info', title: 'Copied WebSocket message payload' });
                      }
                    }}
                    className="p-1 rounded hover:text-white text-[#6f737a]"
                    title="Copy Payload"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Message Content Body */}
              <div
                className="flex-1 overflow-auto p-2 bg-[#141517] relative"
                onContextMenu={handleInspectorContextMenu}
              >
                {activeMessage ? (
                  viewMode === 'Hex' ? (
                    renderHexView(activeMessage.payload)
                  ) : viewMode === 'Pretty' ? (
                    <div className="font-mono text-xs p-2 text-[#dfdfdf]">
                      <HttpSyntaxHighlighter
                        content={activeMessage.payload}
                        isResponse={activeMessage.direction === 'To client'}
                        searchQuery={editorSearchQuery}
                        activeMatchIndex={activeMatchIndex}
                      />
                    </div>
                  ) : (
                    <div className="flex font-mono text-xs h-full">
                      {/* Line Numbers */}
                      <div className="select-none text-[#555861] pr-3 text-right leading-relaxed border-r border-[#2b2d30] pl-1">
                        {activeMessage.payload.split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      {/* Text content */}
                      <div
                        className={`flex-1 pl-3 text-[#dfdfdf] select-text leading-relaxed outline-none ${
                          wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                        }`}
                      >
                        {showWhitespace
                          ? activeMessage.payload.replace(/ /g, '·').replace(/\n/g, '↵\n')
                          : activeMessage.payload}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-[#6f737a] text-xs">
                    Select a WebSocket message from above to view its contents.
                  </div>
                )}
              </div>

              {/* Bottom Search Bar */}
              <BurpSearchBar
                searchQuery={editorSearchQuery}
                onSearchChange={(val) => {
                  setEditorSearchQuery(val);
                  setActiveMatchIndex(0);
                }}
                activeMatchIndex={activeMatchIndex}
                totalMatches={totalMatches}
                onPrevMatch={handlePrevMatch}
                onNextMatch={handleNextMatch}
                selectionInfo={
                  activeMessage
                    ? `Length: ${activeMessage.lengthBytes} bytes | Socket ID: ${activeMessage.webSocketId}`
                    : undefined
                }
              />
            </div>
          }
        />
      </div>

      {/* Modal: Send Custom WebSocket Frame */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg shadow-2xl w-full max-w-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#313438] pb-2">
              <span className="font-bold text-white text-sm">Send Custom WebSocket Frame</span>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-[#9da5b4] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#9da5b4] block">Target WebSocket URL</label>
              <input
                type="text"
                disabled
                value={activeMessage?.url || ''}
                placeholder="wss://target.local/chat"
                className="w-full bg-[#141517] text-[#9da5b4] text-xs p-2 rounded border border-[#313438] font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#dfdfdf] font-medium block">Payload (Text / JSON)</label>
              <textarea
                value={customMsgInput}
                onChange={(e) => setCustomMsgInput(e.target.value)}
                placeholder='{"message": "Hello WebSocket", "action": "test"}'
                className="w-full h-32 bg-[#141517] text-white text-xs p-2.5 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#313438]">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-3 py-1.5 rounded bg-[#2b2d30] text-[#9da5b4] hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCustom}
                disabled={!customMsgInput.trim()}
                className="px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                Send Frame
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebSocket Right-Click Context Menu */}
      {contextMenu.isOpen && contextMenu.targetMsg && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={buildWsContextMenuItems(contextMenu.targetMsg)}
        />
      )}
    </div>
  );
};
