import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Layers,
  Search,
  Trash2,
} from 'lucide-react';

interface LogEntry {
  id: number;
  tool: 'Proxy' | 'Repeater' | 'Intruder' | 'Scanner' | 'Extensions';
  host: string;
  method: string;
  url: string;
  status: number;
  length: number;
  mime: string;
  timeMs: number;
  timestamp: string;
  requestRaw: string;
  responseRaw: string;
}

const SAMPLE_LOGS: LogEntry[] = [
  {
    id: 1,
    tool: 'Proxy',
    host: 'target.local',
    method: 'GET',
    url: '/api/v1/user/profile',
    status: 200,
    length: 1042,
    mime: 'JSON',
    timeMs: 24,
    timestamp: '20:38:12',
    requestRaw: 'GET /api/v1/user/profile HTTP/1.1\r\nHost: target.local\r\nAuthorization: Bearer token123',
    responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"id": 42, "username": "pentester", "role": "admin"}',
  },
  {
    id: 2,
    tool: 'Repeater',
    host: 'target.local',
    method: 'POST',
    url: '/api/v1/auth/login',
    status: 200,
    length: 481,
    mime: 'JSON',
    timeMs: 38,
    timestamp: '20:38:14',
    requestRaw: 'POST /api/v1/auth/login HTTP/1.1\r\nHost: target.local\r\n\r\n{"user": "admin", "pass": "admin"}',
    responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"status": "authenticated", "token": "jwt_tok_982"}',
  },
  {
    id: 3,
    tool: 'Intruder',
    host: 'target.local',
    method: 'POST',
    url: '/api/v1/search',
    status: 500,
    length: 9412,
    mime: 'HTML',
    timeMs: 82,
    timestamp: '20:38:16',
    requestRaw: "POST /api/v1/search HTTP/1.1\r\nHost: target.local\r\n\r\nq=' OR 1=1--",
    responseRaw: 'HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/html\r\n\r\n<h1>SQL Syntax Error: unclosed quotation mark</h1>',
  },
  {
    id: 4,
    tool: 'Scanner',
    host: 'target.local',
    method: 'GET',
    url: '/.git/config',
    status: 404,
    length: 124,
    mime: 'HTML',
    timeMs: 12,
    timestamp: '20:38:18',
    requestRaw: 'GET /.git/config HTTP/1.1\r\nHost: target.local',
    responseRaw: 'HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\nCannot find requested resource',
  },
];

export const LoggerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [logs, setLogs] = useState<LogEntry[]>(SAMPLE_LOGS);
  const [selectedTool, setSelectedTool] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<number>(1);

  const filteredLogs = logs.filter((l) => {
    if (selectedTool !== 'All' && l.tool !== selectedTool) return false;
    if (searchQuery && !l.url.toLowerCase().includes(searchQuery.toLowerCase()) && !l.host.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedLog = logs.find((l) => l.id === selectedLogId) || logs[0];

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Unified Request Logger</span>
          <span className="bg-[#141517] text-[#38bdf8] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Lossless Audit Capture
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Trash2 className="w-3 h-3" />}
            onClick={() => {
              setLogs([]);
              addToast({ type: 'info', title: 'Cleared Logger Stream' });
            }}
          >
            Clear Logger
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-2 bg-[#141517] border-b border-[#2b2d30] flex items-center gap-3">
        <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2 py-0.5 flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#6f737a] mr-1.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter logger requests..."
            className="w-full bg-transparent text-white text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[#9da5b4] text-[11px] mr-1">Source:</span>
          {(['All', 'Proxy', 'Repeater', 'Intruder', 'Scanner', 'Extensions'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTool(t)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedTool === t ? 'bg-[#f37021] text-white font-bold' : 'bg-[#1e1f22] text-[#9da5b4] hover:text-white border border-[#3e4249]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Logger Grid (Top) + Request / Response Inspector (Bottom) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Table */}
        <div className="h-1/2 overflow-y-auto border-b border-[#2b2d30] bg-[#141517]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249]">
              <tr>
                <th className="px-2.5 py-1 w-10">#</th>
                <th className="px-2.5 py-1 w-20">Tool</th>
                <th className="px-2.5 py-1 w-28">Host</th>
                <th className="px-2.5 py-1 w-16">Method</th>
                <th className="px-2.5 py-1">URL</th>
                <th className="px-2.5 py-1 w-16">Status</th>
                <th className="px-2.5 py-1 w-16">Length</th>
                <th className="px-2.5 py-1 w-16">MIME</th>
                <th className="px-2.5 py-1 w-16">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d30]">
              {filteredLogs.map((log) => {
                const isSelected = log.id === selectedLogId;
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#282b30] text-white font-medium' : 'hover:bg-[#1e1f22] text-[#dfdfdf]'
                    }`}
                  >
                    <td className="px-2.5 py-1 text-[#6f737a]">{log.id}</td>
                    <td className="px-2.5 py-1">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        log.tool === 'Proxy' ? 'bg-[#3b82f6] text-white' :
                        log.tool === 'Repeater' ? 'bg-[#34d399] text-black font-bold' :
                        log.tool === 'Intruder' ? 'bg-[#f37021] text-white' :
                        'bg-[#a855f7] text-white'
                      }`}>
                        {log.tool}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-[#a6acb8]">{log.host}</td>
                    <td className="px-2.5 py-1 text-[#34d399] font-bold">{log.method}</td>
                    <td className="px-2.5 py-1 text-white truncate max-w-md">{log.url}</td>
                    <td className={`px-2.5 py-1 font-bold ${
                      log.status === 200 ? 'text-[#34d399]' : log.status === 500 ? 'text-[#ef4444]' : 'text-[#eab308]'
                    }`}>
                      {log.status}
                    </td>
                    <td className="px-2.5 py-1 text-[#9da5b4]">{log.length}</td>
                    <td className="px-2.5 py-1 text-[#9da5b4]">{log.mime}</td>
                    <td className="px-2.5 py-1 text-[#38bdf8]">{log.timeMs}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Request / Response Inspector */}
        <div className="h-1/2 flex min-h-0 bg-[#1e1f22]">
          {/* Left: Request */}
          <div className="flex-1 flex flex-col border-r border-[#2b2d30] p-2">
            <div className="text-[11px] font-semibold text-[#34d399] pb-1">Request #{selectedLog?.id} ({selectedLog?.tool})</div>
            <pre className="flex-1 bg-[#141517] p-2 rounded border border-[#3e4249] font-mono text-[11px] text-[#dfdfdf] overflow-auto whitespace-pre-wrap select-all">
              {selectedLog?.requestRaw || 'No request'}
            </pre>
          </div>

          {/* Right: Response */}
          <div className="flex-1 flex flex-col p-2">
            <div className="text-[11px] font-semibold text-[#38bdf8] pb-1">Response #{selectedLog?.id} ({selectedLog?.status})</div>
            <pre className="flex-1 bg-[#141517] p-2 rounded border border-[#3e4249] font-mono text-[11px] text-[#dfdfdf] overflow-auto whitespace-pre-wrap select-all">
              {selectedLog?.responseRaw || 'No response'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
