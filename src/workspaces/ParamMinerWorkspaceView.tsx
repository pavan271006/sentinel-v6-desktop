import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  FileCode2,
  Play,
} from 'lucide-react';

export const ParamMinerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local/api/v1/profile');
  const [mineMode, setMineMode] = useState<'params' | 'headers' | 'json' | 'cookies'>('headers');
  const [isMining, setIsMining] = useState(false);

  const [findings, setFindings] = useState([
    { id: 1, type: 'Header', name: 'X-Forwarded-Host', impact: 'Web Cache Poisoning (Unkeyed input reflected)', status: 'Vulnerable' },
    { id: 2, type: 'GET Param', name: 'debug', impact: 'Exposes internal stack trace when set to 1', status: 'Informational' },
    { id: 3, type: 'JSON Key', name: 'role_override', impact: 'Allows privilege escalation during registration', status: 'High' },
  ]);

  const handleStartMining = () => {
    setIsMining(true);
    addToast({ type: 'success', title: 'Param Miner Started', description: `Probing ${targetUrl} for unlinked parameters` });
    setTimeout(() => {
      setIsMining(false);
      setFindings((prev) => [
        ...prev,
        { id: prev.length + 1, type: 'Header', name: 'X-Original-URL', impact: 'ACL Authentication Bypass', status: 'Critical' },
      ]);
      addToast({ type: 'error', title: 'Discovered Unkeyed Param', description: 'X-Original-URL overrides path authorization' });
    }, 1500);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Param Miner Hidden Parameter & Cache Poisoning Discovery</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="xs"
            leftIcon={<Play className="w-3 h-3" />}
            onClick={handleStartMining}
            className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
          >
            {isMining ? 'Mining in Progress...' : 'Start Mining'}
          </Button>
        </div>
      </div>

      {/* Target Config & Action Form */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center gap-3">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] font-mono mr-2">Target:</span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
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

      {/* Findings Table */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="border border-[#3e4249] rounded overflow-hidden bg-[#141517]">
          <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex items-center justify-between">
            <span>Discovered Unlinked / Unkeyed Parameters ({findings.length})</span>
            <span className="text-[10px] text-[#34d399] font-mono">Real-Time Probe Correlator</span>
          </div>

          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
              <tr>
                <th className="px-3 py-1.5">Type</th>
                <th className="px-3 py-1.5">Name</th>
                <th className="px-3 py-1.5">Impact / Behavior</th>
                <th className="px-3 py-1.5">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d30]">
              {findings.map((f) => (
                <tr key={f.id} className="hover:bg-[#1e1f22] cursor-pointer">
                  <td className="px-3 py-2 text-[#38bdf8] font-bold">{f.type}</td>
                  <td className="px-3 py-2 text-white font-bold">{f.name}</td>
                  <td className="px-3 py-2 text-[#dfdfdf]">{f.impact}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      f.status === 'Critical' ? 'bg-[#ef4444] text-white' :
                      f.status === 'High' ? 'bg-[#f97316] text-white' :
                      f.status === 'Vulnerable' ? 'bg-[#eab308] text-black font-bold' :
                      'bg-[#3b82f6] text-white'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
