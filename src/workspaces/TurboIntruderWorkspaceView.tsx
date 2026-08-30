import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Zap,
  Play,
  Square,
} from 'lucide-react';

export const TurboIntruderWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [scriptCode, setScriptCode] = useState(
`def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=30,
                           requestsPerConnection=100,
                           pipeline=False)

    for word in open('/usr/share/wordlists/passwords.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    if req.status != 404:
        table.add(req)`
  );

  const [isRunning, setIsRunning] = useState(false);
  const reqCount = 1420;
  const rps = 3840;

  const [results, setResults] = useState([
    { id: 1, payload: 'admin', status: 200, length: 4821, timeMs: 12 },
    { id: 2, payload: 'root', status: 403, length: 1204, timeMs: 14 },
    { id: 3, payload: 'test', status: 404, length: 312, timeMs: 8 },
    { id: 4, payload: 'guest', status: 401, length: 512, timeMs: 9 },
  ]);

  const handleStart = () => {
    setIsRunning(true);
    addToast({ type: 'success', title: 'Turbo Intruder Launched', description: 'Executing async socket pipeline at 3,840 RPS' });
    setTimeout(() => {
      setResults((prev) => [
        ...prev,
        { id: prev.length + 1, payload: 'superadmin', status: 200, length: 5120, timeMs: 11 },
      ]);
    }, 1000);
  };

  const handleStop = () => {
    setIsRunning(false);
    addToast({ type: 'warning', title: 'Turbo Intruder Stopped' });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Turbo Intruder High-Speed Socket Fuzzer</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Async HTTP/1.1 Pipelining Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="danger"
              size="xs"
              leftIcon={<Square className="w-3 h-3" />}
              onClick={handleStop}
              className="bg-[#ef4444] text-white font-bold"
            >
              Halt Engine
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Play className="w-3 h-3" />}
              onClick={handleStart}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
            >
              Launch Attack
            </Button>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Python Attack Script Editor */}
        <div className="w-1/2 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#9da5b4]">
            <span>Python Attack Handler Script</span>
            <span className="font-mono text-[10px] text-[#6f737a]">Python 3.11 Embedded</span>
          </div>
          <textarea
            value={scriptCode}
            onChange={(e) => setScriptCode(e.target.value)}
            className="flex-1 w-full bg-[#1e1f22] text-[#34d399] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
          />
        </div>

        {/* Right: Real-time Stats & Attack Output Table */}
        <div className="flex-1 flex flex-col bg-[#1e1f22] p-3 space-y-3 overflow-hidden">
          {/* Performance Dashboard */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-[#141517] rounded border border-[#3e4249]">
            <div>
              <div className="text-[10px] text-[#9da5b4]">Throughput</div>
              <div className="text-sm font-bold text-[#34d399] font-mono">{isRunning ? rps : 0} RPS</div>
            </div>
            <div>
              <div className="text-[10px] text-[#9da5b4]">Requests Sent</div>
              <div className="text-sm font-bold text-white font-mono">{reqCount}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#9da5b4]">Active Sockets</div>
              <div className="text-sm font-bold text-[#38bdf8] font-mono">{isRunning ? '30 / 30' : 'Idle'}</div>
            </div>
          </div>

          {/* Results Table */}
          <div className="flex-1 border border-[#3e4249] rounded overflow-hidden flex flex-col bg-[#141517]">
            <div className="px-3 py-1.5 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-[#9da5b4] text-xs">
              Live Captured Responses ({results.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
                  <tr>
                    <th className="px-2.5 py-1">#</th>
                    <th className="px-2.5 py-1">Payload</th>
                    <th className="px-2.5 py-1">Status</th>
                    <th className="px-2.5 py-1">Length</th>
                    <th className="px-2.5 py-1">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b2d30]">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-[#282b30] cursor-pointer">
                      <td className="px-2.5 py-1 text-[#6f737a]">{r.id}</td>
                      <td className="px-2.5 py-1 text-white font-bold">{r.payload}</td>
                      <td className={`px-2.5 py-1 font-bold ${r.status === 200 ? 'text-[#34d399]' : r.status === 403 ? 'text-[#ef4444]' : 'text-[#eab308]'}`}>
                        {r.status}
                      </td>
                      <td className="px-2.5 py-1 text-[#9da5b4]">{r.length}</td>
                      <td className="px-2.5 py-1 text-[#38bdf8]">{r.timeMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
