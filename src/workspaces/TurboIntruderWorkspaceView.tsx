import React, { useState, useRef } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { Button } from '../design-system/Button';
import {
  Zap,
  Play,
  Square,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  TurboIntruderEngine,
  TurboResult,
  TurboStats,
} from '../services/fuzzer/TurboIntruderEngine';

const PRESET_USERNAMES = [
  'admin', 'root', 'user', 'guest', 'test', 'administrator', 'operator',
  'api', 'superadmin', 'dev', 'developer', 'master', 'support', 'backup',
  'manager', 'service', 'system', 'sysadmin', 'internal', 'staging',
];

const PRESET_PASSWORDS = [
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345',
  'admin', 'welcome', 'login', 'pass', 'letmein', 'monkey', '111111',
  'secret', 'default', 'root', 'master', 'iloveyou', 'starwars', 'access',
];

const PRESET_PATHS = [
  'admin', 'api', 'v1', 'v2', 'dashboard', 'login', 'logout', 'profile',
  'settings', 'config', 'health', 'metrics', 'env', 'git', 'swagger',
  'openapi', 'graphql', 'auth', 'oauth', 'token', 'register', 'keys',
];

export const TurboIntruderWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { createTab } = useRepeaterStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local/api/v1/auth/login');
  const [concurrency, setConcurrency] = useState<number>(100);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [presetMode, setPresetMode] = useState<'usernames' | 'passwords' | 'paths' | 'custom'>('usernames');
  const [customPayloadsStr, setCustomPayloadsStr] = useState<string>('admin\nroot\ntest\nuser\nguest');

  const [requestTemplate, setRequestTemplate] = useState(
`POST /api/v1/auth/login HTTP/1.1
Host: target.local
User-Agent: Sentinel-TurboIntruder/6.0
Content-Type: application/json
Accept: application/json

{"username": "§payload§", "password": "Password123!"}`
  );

  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<TurboStats>({
    sentCount: 0,
    totalCount: 0,
    rps: 0,
    activeWorkers: 0,
    avgLatencyMs: 0,
    isRunning: false,
    clusters: [],
  });

  const [results, setResults] = useState<TurboResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TurboResult | null>(null);

  // Filters
  const [filterHide404, setFilterHide404] = useState(false);
  const [filterHide403, setFilterHide403] = useState(false);
  const [filterAnomalyOnly, setFilterAnomalyOnly] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const engineRef = useRef<TurboIntruderEngine | null>(null);

  const getActivePayloads = (): string[] => {
    switch (presetMode) {
      case 'usernames':
        return PRESET_USERNAMES;
      case 'passwords':
        return PRESET_PASSWORDS;
      case 'paths':
        return PRESET_PATHS;
      case 'custom':
        return customPayloadsStr
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
    }
  };

  const handleStart = async () => {
    const payloads = getActivePayloads();
    if (payloads.length === 0) {
      addToast({ type: 'warning', title: 'No Payloads', description: 'Provide at least one payload to launch attack' });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setSelectedResult(null);
    setSelectedCluster(null);

    addToast({
      type: 'info',
      title: 'Turbo Intruder Launched',
      description: `Starting ${concurrency} parallel workers for ${payloads.length} payloads against ${targetUrl}...`,
    });

    const pendingResults: TurboResult[] = [];
    const flushTurboResults = () => {
      if (pendingResults.length === 0) return;
      const batch = pendingResults.splice(0, pendingResults.length);
      setResults((prev) => [...batch.reverse(), ...prev].slice(0, 5000));
    };

    const flushInterval = setInterval(flushTurboResults, 50);

    engineRef.current = new TurboIntruderEngine(
      {
        targetUrl,
        requestTemplate,
        payloads,
        concurrentWorkers: concurrency,
        delayMs,
      },
      {
        onResult: (res) => {
          pendingResults.push(res);
        },
        onStats: (st) => {
          setStats(st);
        },
      }
    );

    try {
      await engineRef.current.run();
      clearInterval(flushInterval);
      flushTurboResults();
      addToast({
        type: 'success',
        title: 'Turbo Attack Finished',
        description: `Dispatched ${payloads.length} requests successfully`,
      });
    } catch (err: any) {
      clearInterval(flushInterval);
      flushTurboResults();
      addToast({
        type: 'danger',
        title: 'Attack Interrupted',
        description: err?.message || 'Error occurred during fuzzing',
      });
    } finally {
      clearInterval(flushInterval);
      flushTurboResults();
      setIsRunning(false);
      engineRef.current = null;
    }
  };

  const handleStop = () => {
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsRunning(false);
    addToast({ type: 'warning', title: 'Turbo Intruder Halted', description: 'Stopped by user' });
  };

  const handleSendToRepeater = (res: TurboResult) => {
    createTab({
      title: `Turbo: ${res.payload}`,
      url: res.url,
      method: 'POST',
      body: res.rawRequest.split('\r\n\r\n')[1] || '',
    });

    addToast({
      type: 'success',
      title: 'Sent to Repeater',
      description: `Loaded payload '${res.payload}' in Repeater tab`,
    });
  };

  const filteredResults = results.filter((r) => {
    if (selectedCluster && r.clusterId !== selectedCluster) return false;
    if (filterAnomalyOnly && !r.isAnomaly) return false;
    if (filterHide404 && r.status === 404) return false;
    if (filterHide403 && r.status === 403) return false;
    if (filterText && !r.payload.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const progressPercent = stats.totalCount > 0
    ? Math.min(100, Math.round((stats.sentCount / stats.totalCount) * 100))
    : 0;

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Turbo Intruder High-Speed Socket & Worker Pipeline</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            {concurrency} Workers Concurrency
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

      {/* Target Config & Preset Bar */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2 font-mono">Target:</span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9da5b4]">Workers:</span>
          <select
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            style={{ colorScheme: 'dark' }}
            className="bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-mono"
          >
            <option value={5} className="bg-[#2b2d30] text-[#dfdfdf]">5 Workers</option>
            <option value={10} className="bg-[#2b2d30] text-[#dfdfdf]">10 Workers</option>
            <option value={20} className="bg-[#2b2d30] text-[#dfdfdf]">20 Workers</option>
            <option value={50} className="bg-[#2b2d30] text-[#dfdfdf]">50 Workers</option>
            <option value={100} className="bg-[#2b2d30] text-[#dfdfdf]">100 Workers (Fast)</option>
            <option value={200} className="bg-[#2b2d30] text-[#dfdfdf]">200 Workers (High Turbo)</option>
            <option value={500} className="bg-[#2b2d30] text-[#dfdfdf]">500 Workers (Hyper-Max)</option>
            <option value={1000} className="bg-[#2b2d30] text-[#dfdfdf]">1000 Workers (Unthrottled Socket Burst)</option>
          </select>

          <span className="text-[11px] text-[#9da5b4] ml-2">Delay:</span>
          <select
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            style={{ colorScheme: 'dark' }}
            className="bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-mono"
          >
            <option value={0} className="bg-[#2b2d30] text-[#dfdfdf]">0 ms (Max Speed)</option>
            <option value={20} className="bg-[#2b2d30] text-[#dfdfdf]">20 ms</option>
            <option value={50} className="bg-[#2b2d30] text-[#dfdfdf]">50 ms</option>
            <option value={100} className="bg-[#2b2d30] text-[#dfdfdf]">100 ms</option>
          </select>

          <span className="text-[11px] text-[#9da5b4] ml-2">Payloads:</span>
          <select
            value={presetMode}
            onChange={(e) => setPresetMode(e.target.value as any)}
            style={{ colorScheme: 'dark' }}
            className="bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-mono capitalize"
          >
            <option value="usernames" className="bg-[#2b2d30] text-[#dfdfdf]">Top Usernames (20)</option>
            <option value="passwords" className="bg-[#2b2d30] text-[#dfdfdf]">Top Passwords (20)</option>
            <option value="paths" className="bg-[#2b2d30] text-[#dfdfdf]">Common Paths (22)</option>
            <option value="custom" className="bg-[#2b2d30] text-[#dfdfdf]">Custom Textarea</option>
          </select>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Center Results Table, Right Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Request Template & Payloads */}
        <div className="w-1/3 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3 gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9da5b4]">
            <span>Request Template (<code className="text-[#f37021]">§payload§</code>)</span>
            <span className="text-[10px] text-[#34d399] font-mono">Marker Interpolation</span>
          </div>

          <textarea
            value={requestTemplate}
            onChange={(e) => setRequestTemplate(e.target.value)}
            className="flex-1 w-full bg-[#1e1f22] text-[#34d399] font-mono text-[11px] p-2.5 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-4"
          />

          {presetMode === 'custom' && (
            <div className="h-28 flex flex-col gap-1">
              <span className="text-[10px] text-[#9da5b4] font-semibold">Custom Payloads (1 per line):</span>
              <textarea
                value={customPayloadsStr}
                onChange={(e) => setCustomPayloadsStr(e.target.value)}
                className="flex-1 w-full bg-[#1e1f22] text-white font-mono text-[11px] p-2 rounded border border-[#313438] focus:outline-none resize-none"
              />
            </div>
          )}
        </div>

        {/* Center: Live Performance Dashboard & Virtualized Results Table */}
        <div className="flex-1 flex flex-col bg-[#1e1f22] p-3 space-y-2.5 overflow-hidden">
          {/* Performance Dashboard */}
          <div className="grid grid-cols-4 gap-2.5 p-2.5 bg-[#141517] rounded border border-[#3e4249]">
            <div>
              <div className="text-[10px] text-[#9da5b4]">Rolling Speed</div>
              <div className="text-sm font-bold text-[#34d399] font-mono">{isRunning ? stats.rps : 0} RPS</div>
            </div>
            <div>
              <div className="text-[10px] text-[#9da5b4]">Requests Sent</div>
              <div className="text-sm font-bold text-white font-mono">
                {stats.sentCount} / {stats.totalCount} ({progressPercent}%)
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#9da5b4]">Active Workers</div>
              <div className="text-sm font-bold text-[#38bdf8] font-mono">
                {isRunning ? `${stats.activeWorkers} / ${concurrency}` : 'Idle'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#9da5b4]">Avg Latency</div>
              <div className="text-sm font-bold text-[#f97316] font-mono">{stats.avgLatencyMs} ms</div>
            </div>
          </div>

          {/* Real-time Status Distribution & Anomaly Strip */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141517] rounded border border-[#3e4249] text-[11px] font-mono flex-wrap">
            <span className="text-[#9da5b4] text-[10px] uppercase font-bold">Responses:</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 font-semibold">
              2xx: {stats.statusDistribution ? stats.statusDistribution['2xx'] : results.filter((r) => r.status >= 200 && r.status < 300).length}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-500/40 font-semibold">
              3xx: {stats.statusDistribution ? stats.statusDistribution['3xx'] : results.filter((r) => r.status >= 300 && r.status < 400).length}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/40 font-semibold">
              4xx: {stats.statusDistribution ? stats.statusDistribution['4xx'] : results.filter((r) => r.status >= 400 && r.status < 500).length}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-500/40 font-semibold">
              5xx: {stats.statusDistribution ? stats.statusDistribution['5xx'] : results.filter((r) => r.status >= 500 && r.status < 600).length}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/40 font-semibold ml-auto flex items-center gap-1">
              <span>🚨 Outliers:</span>
              <strong className="text-white">{results.filter((r) => r.isAnomaly).length}</strong>
            </span>
          </div>

          {/* Response Cluster Groups Strip */}
          {stats.clusters && stats.clusters.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#18191c] rounded border border-[#3e4249] text-[11px] font-mono overflow-x-auto">
              <span className="text-[#9da5b4] text-[10px] font-bold uppercase whitespace-nowrap">Clusters:</span>
              <button
                onClick={() => setSelectedCluster(null)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  selectedCluster === null
                    ? 'bg-[#f37021] text-white'
                    : 'bg-[#1e1f22] text-[#9da5b4] border border-[#3e4249] hover:text-white'
                }`}
              >
                All ({results.length})
              </button>
              {stats.clusters.map((c) => {
                const isSelected = selectedCluster === c.clusterId;
                return (
                  <button
                    key={c.clusterId}
                    onClick={() => setSelectedCluster(isSelected ? null : c.clusterId)}
                    className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-mono flex items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-[#38bdf8] text-black font-bold'
                        : 'bg-[#1e1f22] text-[#dfdfdf] border border-[#3e4249] hover:border-[#38bdf8]'
                    }`}
                  >
                    <span>Status {c.status} (~{c.approxLength}B)</span>
                    <span className="bg-[#141517] text-[#34d399] px-1 rounded text-[9px] font-bold">
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Table Filters Bar */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter payload..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-[#141517] border border-[#3e4249] rounded px-2 py-0.5 text-[11px] text-white font-mono"
              />
              <label className="flex items-center gap-1 text-[11px] text-[#9da5b4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterHide404}
                  onChange={(e) => setFilterHide404(e.target.checked)}
                />
                Hide 404
              </label>
              <label className="flex items-center gap-1 text-[11px] text-[#9da5b4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterHide403}
                  onChange={(e) => setFilterHide403(e.target.checked)}
                />
                Hide 403
              </label>
              <label className="flex items-center gap-1 text-[11px] text-rose-400 font-bold cursor-pointer bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-500/30">
                <input
                  type="checkbox"
                  checked={filterAnomalyOnly}
                  onChange={(e) => setFilterAnomalyOnly(e.target.checked)}
                />
                Anomalies Only
              </label>
            </div>
            <span className="text-[10px] text-[#9da5b4] font-mono">
              Showing {filteredResults.length} / {results.length}
            </span>
          </div>

          {/* Results Table */}
          <div className="flex-1 border border-[#3e4249] rounded overflow-hidden flex flex-col bg-[#141517]">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249] sticky top-0">
                  <tr>
                    <th className="px-2.5 py-1.5">#</th>
                    <th className="px-2.5 py-1.5">Payload</th>
                    <th className="px-2.5 py-1.5">Status</th>
                    <th className="px-2.5 py-1.5">Length</th>
                    <th className="px-2.5 py-1.5">Latency</th>
                    <th className="px-2.5 py-1.5">Cluster / Z-Score</th>
                    <th className="px-2.5 py-1.5">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b2d30]">
                  {filteredResults.map((r) => {
                    const isSelected = selectedResult?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedResult(r)}
                        className={`hover:bg-[#282b30] cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#282b30] border-l-2 border-[#f37021]' : ''
                        }`}
                      >
                        <td className="px-2.5 py-1 text-[#6f737a]">{r.id}</td>
                        <td className="px-2.5 py-1 text-white font-bold">{r.payload}</td>
                        <td
                          className={`px-2.5 py-1 font-bold ${
                            r.status >= 200 && r.status < 300
                              ? 'text-[#34d399]'
                              : r.status === 403
                              ? 'text-[#ef4444]'
                              : r.status === 404
                              ? 'text-[#6f737a]'
                              : 'text-[#eab308]'
                          }`}
                        >
                          {r.status || 'ERR'}
                        </td>
                        <td className="px-2.5 py-1 text-[#9da5b4]">{r.length} B</td>
                        <td className="px-2.5 py-1 text-[#38bdf8]">{r.timeMs}ms</td>
                        <td className="px-2.5 py-1 text-[10px] text-[#9da5b4]">
                          {r.lengthZScore !== undefined && r.lengthZScore > 0 ? (
                            <span className={r.lengthZScore >= 3.5 ? 'text-rose-400 font-bold' : 'text-[#6f737a]'}>
                              Z_len: {r.lengthZScore}
                            </span>
                          ) : (
                            <span className="text-[#6f737a]">{r.clusterId || '-'}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1">
                          {r.isAnomaly ? (
                            <span
                              title={r.anomalyReason || 'Statistical length/status anomaly'}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse inline-flex items-center gap-1"
                            >
                              🚨 OUTLIER
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#6f737a]">NORMAL</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Selected Response Inspector */}
        <div className="w-80 bg-[#141517] border-l border-[#2b2d30] p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[#2b2d30]">
            <span className="font-bold text-white text-xs">Response Inspector</span>
            {selectedResult && (
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                onClick={() => handleSendToRepeater(selectedResult)}
              >
                Send to Repeater
              </Button>
            )}
          </div>

          {selectedResult ? (
            <div className="space-y-2 text-xs font-mono">
              {selectedResult.isAnomaly && (
                <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Statistical Anomaly Detected
                  </div>
                  <div className="text-[10px] text-[#dfdfdf] leading-4">
                    {selectedResult.anomalyReason || 'Response length or status deviated significantly from baseline.'}
                  </div>
                </div>
              )}
              <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                <div className="text-[10px] text-[#9da5b4]">Injected Payload:</div>
                <div className="text-white font-bold">{selectedResult.payload}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                  <div className="text-[10px] text-[#9da5b4]">Status:</div>
                  <div className="text-[#34d399] font-bold">{selectedResult.status}</div>
                </div>
                <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                  <div className="text-[10px] text-[#9da5b4]">Size:</div>
                  <div className="text-white font-bold">{selectedResult.length} B</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#9da5b4] mb-1">Raw Response Body:</div>
                <textarea
                  readOnly
                  value={selectedResult.rawResponse}
                  className="w-full h-64 bg-[#1e1f22] text-[#dfdfdf] text-[10px] font-mono p-2 rounded border border-[#3e4249] focus:outline-none resize-none leading-4"
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-[#9da5b4] text-xs py-8">
              Click any result row from the table to view the raw response.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
