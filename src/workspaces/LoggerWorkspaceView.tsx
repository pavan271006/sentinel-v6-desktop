import React, { useState, useMemo } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useTrafficStore } from '../stores/trafficStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { Button } from '../design-system/Button';
import {
  Layers,
  Search,
  Trash2,
  Download,
  Send,
  Activity,
} from 'lucide-react';

export interface LogFilterRule {
  id: string;
  name: string;
  pattern: RegExp;
  colorClass: string;
  enabled: boolean;
}

const DEFAULT_COLOR_RULES: LogFilterRule[] = [
  { id: 'r1', name: 'Server Errors (5xx)', pattern: /^5\d\d$/, colorClass: 'text-[#ef4444] bg-[#ef4444]/10', enabled: true },
  { id: 'r2', name: 'Client Errors (4xx)', pattern: /^4\d\d$/, colorClass: 'text-[#f97316] bg-[#f97316]/10', enabled: true },
  { id: 'r3', name: 'Success (2xx)', pattern: /^2\d\d$/, colorClass: 'text-[#34d399] bg-[#34d399]/10', enabled: true },
  { id: 'r4', name: 'Redirects (3xx)', pattern: /^3\d\d$/, colorClass: 'text-[#38bdf8] bg-[#38bdf8]/10', enabled: true },
];

export const LoggerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { transactions, clearTraffic } = useTrafficStore();
  const { createTab } = useRepeaterStore();

  const [selectedTool, setSelectedTool] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Map proxy transactions into rich Logger entries
  const logEntries = useMemo(() => {
    return transactions.map((tx: any, idx) => {
      const url = 'request' in tx && tx.request?.url ? tx.request.url : (tx as any).url || '';
      const method = ('request' in tx && tx.request?.method ? tx.request.method : (tx as any).method || 'GET').toUpperCase();
      const status = 'response' in tx && tx.response?.statusCode ? tx.response.statusCode : (tx as any).status || 200;
      const host = ('host' in tx && tx.host) ? tx.host : (url ? new URL(url).host : 'target.local');
      const length = ('sizeBytes' in tx && tx.sizeBytes) ? tx.sizeBytes : 0;
      const timeMs = ('durationMs' in tx && tx.durationMs) ? tx.durationMs : 12;
      const timestamp = ('timestamp' in tx && tx.timestamp) ? tx.timestamp : new Date().toLocaleTimeString();

      // Tool origin classification
      let tool: 'Proxy' | 'Repeater' | 'Scanner' | 'Intruder' = 'Proxy';
      const idStr = tx.id || '';
      if (idStr.includes('rep') || idStr.includes('repeater')) tool = 'Repeater';
      else if (idStr.includes('scan') || idStr.includes('sql')) tool = 'Scanner';
      else if (idStr.includes('turbo') || idStr.includes('fuzz')) tool = 'Intruder';

      const reqBody = 'request' in tx && tx.request?.bodyText ? tx.request.bodyText : (tx as any).reqBody || '';
      const resBody = 'response' in tx && tx.response?.bodyText ? tx.response.bodyText : (tx as any).resBody || '';

      const reqHeadersStr = ('reqHeaders' in tx && tx.reqHeaders)
        ? tx.reqHeaders.map((h: any) => `${h.name}: ${h.value}`).join('\r\n')
        : 'User-Agent: Sentinel/6.0';

      const resHeadersStr = ('resHeaders' in tx && tx.resHeaders)
        ? tx.resHeaders.map((h: any) => `${h.name}: ${h.value}`).join('\r\n')
        : 'Content-Type: text/html';

      const requestRaw = `${method} ${url} HTTP/1.1\r\n${reqHeadersStr}\r\n\r\n${reqBody}`;
      const responseRaw = `HTTP/1.1 ${status}\r\n${resHeadersStr}\r\n\r\n${resBody}`;

      return {
        id: tx.id || `log-${idx + 1}`,
        seq: idx + 1,
        tool,
        host,
        method,
        url,
        status,
        length,
        timeMs,
        timestamp,
        requestRaw,
        responseRaw,
      };
    });
  }, [transactions]);

  const filteredLogs = useMemo(() => {
    return logEntries.filter((l) => {
      if (selectedTool !== 'All' && l.tool !== selectedTool) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchUrl = l.url.toLowerCase().includes(q);
        const matchHost = l.host.toLowerCase().includes(q);
        const matchMethod = l.method.toLowerCase().includes(q);
        const matchStatus = String(l.status).includes(q);
        if (!matchUrl && !matchHost && !matchMethod && !matchStatus) return false;
      }
      return true;
    });
  }, [logEntries, selectedTool, searchQuery]);

  const selectedLog = useMemo(() => {
    if (!selectedTxId) return filteredLogs[0] || null;
    return logEntries.find((l) => l.id === selectedTxId) || filteredLogs[0] || null;
  }, [selectedTxId, logEntries, filteredLogs]);

  const handleSendToRepeater = (entry: typeof logEntries[0]) => {
    createTab({
      title: `Log: ${entry.method} ${entry.url.slice(0, 16)}`,
      url: entry.url,
      method: (entry.method as any) || 'GET',
    });

    addToast({
      type: 'success',
      title: 'Dispatched to Repeater',
      description: `Loaded transaction #${entry.seq} in new Repeater tab`,
    });
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-logger-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Exported Logs', description: `Saved ${filteredLogs.length} transactions as JSON` });
  };

  const getStatusColor = (status: number) => {
    const rule = DEFAULT_COLOR_RULES.find((r) => r.pattern.test(String(status)));
    return rule ? rule.colorClass : 'text-[#9da5b4]';
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-bold text-white text-xs">Logger++ Real-Time Protocol Inspector & SQLite Store</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            {transactions.length} Transactions Tracked
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Download className="w-3 h-3 text-[#34d399]" />}
            onClick={handleExportJson}
          >
            Export Logs (JSON)
          </Button>

          <Button
            variant="danger"
            size="xs"
            leftIcon={<Trash2 className="w-3 h-3" />}
            onClick={() => {
              clearTraffic();
              addToast({ type: 'info', title: 'Cleared Logger Traffic' });
            }}
          >
            Clear History
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-2.5 bg-[#141517] border-b border-[#2b2d30] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1 flex-1">
            <Search className="w-3.5 h-3.5 text-[#9da5b4] mr-2" />
            <input
              type="text"
              placeholder="Regex or substring search across URL, host, method, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            {(['All', 'Proxy', 'Repeater', 'Scanner', 'Intruder'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTool(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedTool === t
                    ? 'bg-[#38bdf8] text-black font-bold'
                    : 'bg-[#1e1f22] text-[#9da5b4] hover:text-white border border-[#3e4249]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#9da5b4]">
          <Activity className="w-3.5 h-3.5 text-[#34d399] animate-pulse" />
          <span>Showing {filteredLogs.length} / {transactions.length}</span>
        </div>
      </div>

      {/* Main Split: Log Stream Virtual Table (Top/Left) vs Raw Request/Response (Bottom/Right) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Logs Table */}
        <div className="h-1/2 border-b border-[#2b2d30] overflow-y-auto bg-[#141517]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249] sticky top-0">
              <tr>
                <th className="px-2.5 py-1.5 w-12">#</th>
                <th className="px-2.5 py-1.5 w-20">Tool</th>
                <th className="px-2.5 py-1.5 w-16">Method</th>
                <th className="px-2.5 py-1.5">Host & Path</th>
                <th className="px-2.5 py-1.5 w-20">Status</th>
                <th className="px-2.5 py-1.5 w-20">Length</th>
                <th className="px-2.5 py-1.5 w-20">Time</th>
                <th className="px-2.5 py-1.5 w-24">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d30]">
              {filteredLogs.map((entry) => {
                const isSelected = selectedLog?.id === entry.id;
                return (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedTxId(entry.id)}
                    className={`hover:bg-[#1e1f22] cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#1e1f22] border-l-2 border-[#38bdf8]' : ''
                    }`}
                  >
                    <td className="px-2.5 py-1 text-[#6f737a]">{entry.seq}</td>
                    <td className="px-2.5 py-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1e1f22] border border-[#3e4249] text-white">
                        {entry.tool}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 font-bold text-[#38bdf8]">{entry.method}</td>
                    <td className="px-2.5 py-1 text-white truncate max-w-md">
                      <span className="text-[#9da5b4]">{entry.host}</span>
                      <span>{entry.url.replace(`https://${entry.host}`, '').replace(`http://${entry.host}`, '')}</span>
                    </td>
                    <td className="px-2.5 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusColor(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-[#9da5b4]">{entry.length} B</td>
                    <td className="px-2.5 py-1 text-[#38bdf8]">{entry.timeMs}ms</td>
                    <td className="px-2.5 py-1 text-[#6f737a]">{entry.timestamp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Inspector Split: Request (Left) vs Response (Right) */}
        <div className="flex-1 flex min-h-0 bg-[#1e1f22]">
          {/* Request Panel */}
          <div className="flex-1 flex flex-col border-r border-[#2b2d30] p-2.5 bg-[#141517]">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2b2d30] text-xs font-semibold text-[#38bdf8]">
              <span>Request Wire Stream</span>
              {selectedLog && (
                <Button
                  variant="secondary"
                  size="xs"
                  leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                  onClick={() => handleSendToRepeater(selectedLog)}
                >
                  Send to Repeater
                </Button>
              )}
            </div>
            <textarea
              readOnly
              value={selectedLog?.requestRaw || ''}
              className="flex-1 w-full bg-[#1e1f22] text-[#34d399] font-mono text-[11px] p-2.5 rounded border border-[#313438] focus:outline-none resize-none leading-4 mt-2 select-all"
            />
          </div>

          {/* Response Panel */}
          <div className="flex-1 flex flex-col p-2.5 bg-[#1e1f22]">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2b2d30] text-xs font-semibold text-[#34d399]">
              <span>Response Wire Stream</span>
              <span className="text-[10px] text-[#9da5b4] font-mono">
                {selectedLog?.length || 0} bytes
              </span>
            </div>
            <textarea
              readOnly
              value={selectedLog?.responseRaw || ''}
              className="flex-1 w-full bg-[#141517] text-[#dfdfdf] font-mono text-[11px] p-2.5 rounded border border-[#313438] focus:outline-none resize-none leading-4 mt-2 select-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
