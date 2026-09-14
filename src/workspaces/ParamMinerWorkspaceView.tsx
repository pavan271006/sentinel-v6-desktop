import React, { useState, useRef } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { Button } from '../design-system/Button';
import {
  FileCode2,
  Play,
  Square,
  Copy,
  Terminal,
  AlertTriangle,
  Send,
  Sliders,
} from 'lucide-react';
import {
  ParamMinerEngine,
  ParamFinding,
  MineMode,
  MiningProgress,
} from '../services/paramMiner/ParamMinerEngine';

export const ParamMinerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { createTab } = useRepeaterStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local/api/v1/profile');
  const [mineMode, setMineMode] = useState<MineMode>('headers');
  const [batchSize, setBatchSize] = useState<number>(16);
  const [customWordlistStr, setCustomWordlistStr] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const [isMining, setIsMining] = useState<boolean>(false);
  const [progress, setProgress] = useState<MiningProgress | null>(null);
  const [findings, setFindings] = useState<ParamFinding[]>([
    {
      id: 'pm-seed-1',
      type: 'Header',
      name: 'X-Forwarded-Host',
      impact: 'Web Cache Poisoning & Host Header Injection (Unkeyed host reflected)',
      status: 'Critical',
      evidence: {
        canary: 'stnl_xfh_789a',
        baselineStatus: 200,
        probeStatus: 200,
        baselineLength: 4210,
        probeLength: 4235,
        deltaLength: 25,
        reflectedInBody: true,
        reflectedInHeaders: false,
        reflectionSnippet: '<script src="https://stnl_xfh_789a/static/app.js">',
      },
      discoveredAt: '12:00:01',
    },
    {
      id: 'pm-seed-2',
      type: 'GET Param',
      name: 'debug',
      impact: 'Internal Diagnostics / Stack Trace Information Disclosure',
      status: 'High',
      evidence: {
        canary: '1',
        baselineStatus: 200,
        probeStatus: 500,
        baselineLength: 1204,
        probeLength: 5410,
        deltaLength: 4206,
        reflectedInBody: false,
        reflectedInHeaders: false,
        reflectionSnippet: 'Exception in thread main: java.lang.NullPointerException at /app/core',
      },
      discoveredAt: '12:00:05',
    },
  ]);

  const [selectedFinding, setSelectedFinding] = useState<ParamFinding | null>(findings[0]);
  const minerRef = useRef<ParamMinerEngine | null>(null);

  const handleStartMining = async () => {
    if (!targetUrl.trim()) {
      addToast({ type: 'warning', title: 'Invalid Target', description: 'Please provide a valid target URL' });
      return;
    }

    setIsMining(true);
    const customWordlist = customWordlistStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    addToast({
      type: 'info',
      title: 'Param Miner Engine Started',
      description: `Targeting ${targetUrl} [${mineMode.toUpperCase()}] via divide-and-conquer bisection`,
    });

    minerRef.current = new ParamMinerEngine(
      {
        targetUrl,
        mode: mineMode,
        batchSize,
        customWordlist: customWordlist.length > 0 ? customWordlist : undefined,
      },
      {
        onProgress: (p) => setProgress(p),
        onFinding: (f) => {
          setFindings((prev) => [f, ...prev]);
          addToast({
            type: f.status === 'Critical' || f.status === 'High' ? 'danger' : 'info',
            title: `Discovered Hidden ${f.type}: ${f.name}`,
            description: f.impact,
          });
        },
      }
    );

    try {
      await minerRef.current.run();
      addToast({
        type: 'success',
        title: 'Mining Routine Completed',
        description: `Discovery finished for ${targetUrl}`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Mining Interrupted',
        description: err?.message || 'Error occurred during mining',
      });
    } finally {
      setIsMining(false);
      minerRef.current = null;
    }
  };

  const handleStopMining = () => {
    if (minerRef.current) {
      minerRef.current.abort();
      minerRef.current = null;
    }
    setIsMining(false);
    addToast({ type: 'info', title: 'Mining Aborted', description: 'Engine stopped by user' });
  };

  const handleSendToRepeater = (finding: ParamFinding) => {
    const isHeader = finding.type === 'Header';
    const isParam = finding.type === 'GET Param';

    let url = targetUrl;
    let headers: { id: string; name: string; value: string; enabled: boolean }[] = [
      { id: 'h-1', name: 'User-Agent', value: 'Sentinel/6.0', enabled: true },
      { id: 'h-2', name: 'Accept', value: '*/*', enabled: true },
    ];

    if (isHeader) {
      headers.push({ id: 'h-found', name: finding.name, value: finding.evidence.canary, enabled: true });
    } else if (isParam) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}${finding.name}=${encodeURIComponent(finding.evidence.canary)}`;
    }

    createTab({
      title: `Param: ${finding.name}`,
      url,
      method: isHeader ? 'GET' : 'GET',
      headers,
    });

    addToast({
      type: 'success',
      title: 'Dispatched to Repeater',
      description: `Created new tab with ${finding.type} ${finding.name}`,
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Param Miner - Unkeyed Header & Parameter Discovery</span>
          <span className="bg-[#141517] text-[#38bdf8] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Binary Bisection O(log N)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Sliders className="w-3 h-3 text-[#9da5b4]" />}
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? 'Hide Config' : 'Tuning'}
          </Button>

          {isMining ? (
            <Button
              variant="danger"
              size="xs"
              leftIcon={<Square className="w-3 h-3" />}
              onClick={handleStopMining}
            >
              Stop Mining
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Play className="w-3 h-3" />}
              onClick={handleStartMining}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
            >
              Start Mining
            </Button>
          )}
        </div>
      </div>

      {/* Target Config & Action Form */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
            <span className="text-[#9da5b4] font-mono mr-2">Target URL:</span>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://target.local/api/endpoint"
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center bg-[#1e1f22] p-0.5 rounded border border-[#3e4249]">
            {(['headers', 'params', 'json', 'cookies'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMineMode(m)}
                className={`px-3 py-1 rounded text-xs capitalize font-medium transition-colors ${
                  mineMode === m ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Tuning Options */}
        {showConfig && (
          <div className="p-2.5 bg-[#1e1f22] rounded border border-[#3e4249] grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-[#9da5b4] block mb-1">Batch Size (Bisection chunk):</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-1 text-white text-xs"
              >
                <option value={8} className="bg-[#2b2d30] text-[#dfdfdf]">8 params / request</option>
                <option value={16} className="bg-[#2b2d30] text-[#dfdfdf]">16 params / request (Recommended)</option>
                <option value={32} className="bg-[#2b2d30] text-[#dfdfdf]">32 params / request (Aggressive)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#9da5b4] block mb-1">Custom Wordlist (Comma-separated):</label>
              <input
                type="text"
                placeholder="X-Custom-Auth, internal_id, debug_token"
                value={customWordlistStr}
                onChange={(e) => setCustomWordlistStr(e.target.value)}
                className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-1 text-white text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* Real-Time Mining Progress Status */}
        {isMining && progress && (
          <div className="bg-[#1e1f22] p-2.5 rounded border border-[#f37021]/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#f37021] animate-pulse" />
                {progress.currentPhase}
              </span>
              <span className="font-mono text-[#34d399] font-bold">
                {progress.testedCount} / {progress.totalCount} ({progress.percent}%)
              </span>
            </div>
            <div className="w-full bg-[#141517] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#f37021] to-[#34d399] h-full transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {progress.currentBatch.length > 0 && (
              <p className="text-[10px] text-[#9da5b4] font-mono truncate">
                Active Probe: [{progress.currentBatch.join(', ')}]
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Workspace Split: Findings Table & Detailed Evidence Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Findings Table */}
        <div className="flex-1 p-3 overflow-y-auto border-r border-[#2b2d30]">
          <div className="border border-[#3e4249] rounded overflow-hidden bg-[#141517]">
            <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex items-center justify-between">
              <span>Discovered Unlinked / Unkeyed Parameters ({findings.length})</span>
              <span className="text-[10px] text-[#34d399] font-mono">Differential Byte Variance Correlator</span>
            </div>

            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
                <tr>
                  <th className="px-3 py-1.5">Type</th>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Impact / Behavior</th>
                  <th className="px-3 py-1.5">Variance</th>
                  <th className="px-3 py-1.5">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelectedFinding(f)}
                    className={`hover:bg-[#1e1f22] cursor-pointer transition-colors ${
                      selectedFinding?.id === f.id ? 'bg-[#1e1f22] border-l-2 border-[#f37021]' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-[#38bdf8] font-bold">{f.type}</td>
                    <td className="px-3 py-2 text-white font-bold">{f.name}</td>
                    <td className="px-3 py-2 text-[#dfdfdf] truncate max-w-xs">{f.impact}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#9da5b4]">
                      Δ {f.evidence.deltaLength > 0 ? `+${f.evidence.deltaLength}` : f.evidence.deltaLength} B
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.status === 'Critical'
                            ? 'bg-[#ef4444] text-white'
                            : f.status === 'High'
                            ? 'bg-[#f97316] text-white'
                            : f.status === 'Vulnerable'
                            ? 'bg-[#eab308] text-black font-bold'
                            : 'bg-[#3b82f6] text-white'
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Finding Forensic Evidence Drawer */}
        <div className="w-96 bg-[#141517] p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[#2b2d30]">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#f37021]" />
              Forensic Evidence Dossier
            </span>
            {selectedFinding && (
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                onClick={() => handleSendToRepeater(selectedFinding)}
              >
                Send to Repeater
              </Button>
            )}
          </div>

          {selectedFinding ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Target Parameter / Header</label>
                <div className="text-sm font-bold text-white font-mono bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between mt-1">
                  <span>{selectedFinding.name}</span>
                  <span className="text-xs text-[#38bdf8]">{selectedFinding.type}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Security Impact</label>
                <p className="text-xs text-[#dfdfdf] mt-1 bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                  {selectedFinding.impact}
                </p>
              </div>

              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Differential Metrics</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                    <span className="text-[10px] text-[#9da5b4] block">Baseline Status</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {selectedFinding.evidence.baselineStatus} ({selectedFinding.evidence.baselineLength} B)
                    </span>
                  </div>
                  <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                    <span className="text-[10px] text-[#9da5b4] block">Probe Status</span>
                    <span className="text-xs font-mono font-bold text-[#f37021]">
                      {selectedFinding.evidence.probeStatus} ({selectedFinding.evidence.probeLength} B)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Injected Canary Token</label>
                <div className="text-xs font-mono text-[#34d399] bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between mt-1">
                  <span>{selectedFinding.evidence.canary}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFinding.evidence.canary);
                      addToast({ type: 'success', title: 'Copied canary to clipboard' });
                    }}
                  >
                    <Copy className="w-3 h-3 text-[#9da5b4]" />
                  </Button>
                </div>
              </div>

              {selectedFinding.evidence.reflectionSnippet && (
                <div>
                  <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Reflection Artifact Snippet</label>
                  <pre className="text-[11px] font-mono text-[#f97316] bg-[#1e1f22] p-2 rounded border border-[#3e4249] overflow-x-auto whitespace-pre-wrap mt-1">
                    {selectedFinding.evidence.reflectionSnippet}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-[#9da5b4] text-xs py-8">
              Select a discovered parameter from the table to inspect differential evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
