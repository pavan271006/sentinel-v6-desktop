import React, { useState, useRef } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { Button } from '../design-system/Button';
import {
  FolderSearch,
  Play,
  Square,
  FileCode,
  Folder,
  Send,
  Database,
  Lock,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  ContentDiscoveryEngine,
  DiscoveredEndpoint,
  DiscoveryProgress,
  PathCategory,
  WORDLIST_FULL_QUICK,
  WORDLIST_ADMIN,
  WORDLIST_SENSITIVE_FILES,
  WORDLIST_BACKUPS,
  WORDLIST_API,
} from '../services/contentDiscovery/ContentDiscoveryEngine';

export const DiscoverWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { createTab } = useRepeaterStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local');
  const [wordlistChoice, setWordlistChoice] = useState<'quick' | 'admin' | 'sensitive' | 'backups' | 'api' | 'custom'>('quick');
  const [customWordlistStr, setCustomWordlistStr] = useState<string>('/admin\n/api/v1\n/.env\n/swagger.json\n/backup.zip');
  const [concurrency, setConcurrency] = useState<number>(15);
  const [enableMutations, setEnableMutations] = useState(false);

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [discoveredPaths, setDiscoveredPaths] = useState<DiscoveredEndpoint[]>([
    { id: 1, path: '/admin', url: 'https://target.local/admin', status: 403, length: 512, type: 'Directory', timeMs: 14 },
    { id: 2, path: '/api/v1/health', url: 'https://target.local/api/v1/health', status: 200, length: 42, type: 'File', timeMs: 18 },
    { id: 3, path: '/.env', url: 'https://target.local/.env', status: 200, length: 1204, type: 'Config', timeMs: 22 },
    { id: 4, path: '/backup.zip', url: 'https://target.local/backup.zip', status: 200, length: 84920, type: 'Backup', timeMs: 45 },
    { id: 5, path: '/swagger.json', url: 'https://target.local/swagger.json', status: 200, length: 18420, type: 'API', timeMs: 19 },
    { id: 6, path: '/internal', url: 'https://target.local/internal', status: 401, length: 312, type: 'Directory', timeMs: 12 },
  ]);

  const [selectedEndpoint, setSelectedEndpoint] = useState<DiscoveredEndpoint | null>(discoveredPaths[2]);
  const [filterType, setFilterType] = useState<PathCategory | 'All'>('All');

  const engineRef = useRef<ContentDiscoveryEngine | null>(null);

  const getWordlist = (): string[] => {
    let baseList: string[] = [];
    switch (wordlistChoice) {
      case 'quick':
        baseList = WORDLIST_FULL_QUICK;
        break;
      case 'admin':
        baseList = WORDLIST_ADMIN;
        break;
      case 'sensitive':
        baseList = WORDLIST_SENSITIVE_FILES;
        break;
      case 'backups':
        baseList = WORDLIST_BACKUPS;
        break;
      case 'api':
        baseList = WORDLIST_API;
        break;
      case 'custom':
        baseList = customWordlistStr
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
    }

    if (enableMutations) {
      const mutated = ContentDiscoveryEngine.generateExtensionMutations(baseList);
      return Array.from(new Set([...baseList, ...mutated]));
    }
    return baseList;
  };

  const handleMutateDiscoveredPaths = () => {
    if (discoveredPaths.length === 0) return;
    const paths = discoveredPaths.map((d) => d.path);
    const mutations = ContentDiscoveryEngine.generateExtensionMutations(paths);
    const uniqueMutations = Array.from(new Set(mutations));
    setCustomWordlistStr(uniqueMutations.join('\n'));
    setWordlistChoice('custom');
    setEnableMutations(false);
    addToast({
      type: 'info',
      title: 'Discovered Paths Mutated',
      description: `Generated ${uniqueMutations.length} backup/archive mutations into Custom Wordlist`,
    });
  };

  const handleStartDiscovery = async () => {
    if (!targetUrl.trim()) {
      addToast({ type: 'warning', title: 'Target Required', description: 'Enter a valid target URL' });
      return;
    }

    const wordlist = getWordlist();
    if (wordlist.length === 0) {
      addToast({ type: 'warning', title: 'Empty Wordlist', description: 'Selected wordlist contains no paths' });
      return;
    }

    setIsDiscovering(true);
    setDiscoveredPaths([]);
    setSelectedEndpoint(null);

    addToast({
      type: 'info',
      title: 'Content Discovery Started',
      description: `Calibrating wildcard 404 and probing ${wordlist.length} endpoints on ${targetUrl}...`,
    });

    engineRef.current = new ContentDiscoveryEngine(
      {
        targetUrl,
        wordlist,
        concurrency,
      },
      {
        onDiscovered: (item) => {
          setDiscoveredPaths((prev) => [item, ...prev]);
          if (item.type === 'Config' || item.type === 'Backup') {
            addToast({
              type: 'danger',
              title: `Critical Asset Exposed: ${item.path}`,
              description: `Status ${item.status} (${item.length} bytes)`,
            });
          }
        },
        onProgress: (p) => setProgress(p),
      }
    );

    try {
      await engineRef.current.run();
      addToast({
        type: 'success',
        title: 'Content Discovery Completed',
        description: `Discovery finished across ${wordlist.length} candidate paths`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Discovery Interrupted',
        description: err?.message || 'Error occurred during discovery',
      });
    } finally {
      setIsDiscovering(false);
      engineRef.current = null;
    }
  };

  const handleStopDiscovery = () => {
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsDiscovering(false);
    addToast({ type: 'info', title: 'Discovery Aborted', description: 'Engine stopped by user' });
  };

  const handleSendToRepeater = (item: DiscoveredEndpoint) => {
    createTab({
      title: `Disc: ${item.path}`,
      url: item.url,
      method: 'GET',
    });

    addToast({
      type: 'success',
      title: 'Dispatched to Repeater',
      description: `Loaded ${item.path} in new Repeater tab`,
    });
  };

  const filteredPaths = discoveredPaths.filter((p) => {
    if (filterType !== 'All' && p.type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FolderSearch className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Content Discovery & Directory Fuzzing</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Wildcard 404 Calibrated
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDiscovering ? (
            <Button
              variant="danger"
              size="xs"
              leftIcon={<Square className="w-3 h-3" />}
              onClick={handleStopDiscovery}
            >
              Stop Discovery
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Play className="w-3 h-3" />}
              onClick={handleStartDiscovery}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
            >
              Start Discovery
            </Button>
          )}
        </div>
      </div>

      {/* Target & Dictionaries Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex flex-col gap-2">
        <div className="flex items-center gap-3">
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
            <span className="text-[#9da5b4] font-mono text-xs">Dictionary:</span>
            <select
              value={wordlistChoice}
              onChange={(e) => setWordlistChoice(e.target.value as any)}
              style={{ colorScheme: 'dark' }}
              className="bg-[#1e1f22] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-mono"
            >
              <option value="quick" className="bg-[#2b2d30] text-[#dfdfdf]">SecLists Quick Fuzz (100 Paths)</option>
              <option value="admin" className="bg-[#2b2d30] text-[#dfdfdf]">Admin & Auth Portals (22 Paths)</option>
              <option value="sensitive" className="bg-[#2b2d30] text-[#dfdfdf]">Sensitive Configs & Keys (25 Paths)</option>
              <option value="backups" className="bg-[#2b2d30] text-[#dfdfdf]">Backups & SQL Dumps (18 Paths)</option>
              <option value="api" className="bg-[#2b2d30] text-[#dfdfdf]">API Specs & Health Endpoints (24 Paths)</option>
              <option value="custom" className="bg-[#2b2d30] text-[#dfdfdf]">Custom Wordlist</option>
            </select>

            <span className="text-[#9da5b4] font-mono text-xs ml-2">Workers:</span>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              style={{ colorScheme: 'dark' }}
              className="bg-[#1e1f22] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-mono"
            >
              <option value={5} className="bg-[#2b2d30] text-[#dfdfdf]">5 Threads</option>
              <option value={10} className="bg-[#2b2d30] text-[#dfdfdf]">10 Threads</option>
              <option value={20} className="bg-[#2b2d30] text-[#dfdfdf]">20 Threads</option>
              <option value={50} className="bg-[#2b2d30] text-[#dfdfdf]">50 Threads</option>
            </select>

            <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e1f22] border border-[#3e4249] text-xs cursor-pointer hover:border-[#38bdf8] transition-colors ml-2 select-none">
              <input
                type="checkbox"
                checked={enableMutations}
                onChange={(e) => setEnableMutations(e.target.checked)}
                className="rounded text-[#38bdf8] focus:ring-0"
              />
              <span className="text-[#38bdf8] font-bold">Extension Mutations</span>
              <span className="text-[10px] text-[#9da5b4]">(.bak, .old, .zip, .swp)</span>
            </label>
          </div>
        </div>

        {/* Custom Wordlist Drawer */}
        {wordlistChoice === 'custom' && (
          <div className="p-2 bg-[#1e1f22] rounded border border-[#3e4249] flex flex-col gap-1">
            <span className="text-[10px] text-[#9da5b4]">Custom Paths (1 per line):</span>
            <textarea
              value={customWordlistStr}
              onChange={(e) => setCustomWordlistStr(e.target.value)}
              className="w-full h-20 bg-[#141517] text-white font-mono text-xs p-2 rounded border border-[#3e4249] focus:outline-none resize-none"
            />
          </div>
        )}

        {/* Real-time Progress Bar */}
        {isDiscovering && progress && (
          <div className="bg-[#1e1f22] p-2.5 rounded border border-[#f37021]/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#f37021] animate-pulse" />
                Probing: <code className="text-[#38bdf8] font-mono">{progress.currentPath}</code>
              </span>
              <span className="font-mono text-[#34d399] font-bold">
                {progress.testedCount} / {progress.totalCount} ({progress.percent}%) — {progress.rps} RPS
              </span>
            </div>
            <div className="w-full bg-[#141517] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#f37021] to-[#34d399] h-full transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace Split: Left Discovered Paths, Right Path Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Discovered Paths Table */}
        <div className="flex-1 p-3 overflow-y-auto border-r border-[#2b2d30] flex flex-col gap-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2">
            {(['All', 'Config', 'Backup', 'API', 'Directory', 'File'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterType(cat)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  filterType === cat
                    ? 'bg-[#f37021] text-white font-bold'
                    : 'bg-[#141517] text-[#9da5b4] hover:text-white border border-[#3e4249]'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={handleMutateDiscoveredPaths}
              disabled={discoveredPaths.length === 0}
              title="Generate .bak, .old, .zip, .swp permutations from all discovered endpoints"
              className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-950/50 hover:bg-sky-900/70 text-sky-300 border border-sky-500/40 flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>⚡ Mutate Findings ({discoveredPaths.length})</span>
            </button>
            <span className="ml-auto text-[10px] text-[#9da5b4] font-mono">
              {filteredPaths.length} Endpoints Discovered
            </span>
          </div>

          <div className="border border-[#3e4249] rounded overflow-hidden bg-[#141517] flex-1">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249] sticky top-0">
                <tr>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {filteredPaths.map((item) => {
                  const isSelected = selectedEndpoint?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedEndpoint(item)}
                      className={`hover:bg-[#1e1f22] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#1e1f22] border-l-2 border-[#f37021]' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-white font-bold flex items-center gap-1.5">
                        {item.type === 'Config' ? (
                          <Lock className="w-3.5 h-3.5 text-[#ef4444]" />
                        ) : item.type === 'Backup' ? (
                          <Database className="w-3.5 h-3.5 text-[#eab308]" />
                        ) : item.type === 'API' ? (
                          <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
                        ) : item.type === 'Directory' ? (
                          <Folder className="w-3.5 h-3.5 text-[#9da5b4]" />
                        ) : (
                          <FileCode className="w-3.5 h-3.5 text-[#9da5b4]" />
                        )}
                        {item.path}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.status >= 200 && item.status < 300
                              ? 'bg-[#34d399]/20 text-[#34d399]'
                              : item.status === 403
                              ? 'bg-[#ef4444]/20 text-[#ef4444]'
                              : item.status === 401
                              ? 'bg-[#eab308]/20 text-[#eab308]'
                              : 'bg-[#38bdf8]/20 text-[#38bdf8]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#9da5b4]">{item.type}</td>
                      <td className="px-3 py-2 text-[#dfdfdf]">{item.length} B</td>
                      <td className="px-3 py-2 text-[#38bdf8]">{item.timeMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Path Evidence & Inspector */}
        <div className="w-80 bg-[#141517] p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[#2b2d30]">
            <span className="font-bold text-white text-xs">Endpoint Dossier</span>
            {selectedEndpoint && (
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                onClick={() => handleSendToRepeater(selectedEndpoint)}
              >
                Send to Repeater
              </Button>
            )}
          </div>

          {selectedEndpoint ? (
            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase">Discovered Path</label>
                <div className="text-white font-bold bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-1 break-all">
                  {selectedEndpoint.path}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase">Full Target URL</label>
                <div className="text-[#38bdf8] bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-1 break-all">
                  {selectedEndpoint.url}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                  <span className="text-[10px] text-[#9da5b4] block">HTTP Status</span>
                  <span className="font-bold text-[#34d399]">{selectedEndpoint.status}</span>
                </div>
                <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249]">
                  <span className="text-[10px] text-[#9da5b4] block">Byte Length</span>
                  <span className="font-bold text-white">{selectedEndpoint.length} B</span>
                </div>
              </div>

              {selectedEndpoint.type === 'Config' && (
                <div className="p-2.5 bg-[#ef4444]/10 border border-[#ef4444]/40 rounded text-xs text-[#ef4444]">
                  ⚠️ Potential Configuration or Key Disclosure! Contains credentials or environment secrets.
                </div>
              )}

              {selectedEndpoint.type === 'Backup' && (
                <div className="p-2.5 bg-[#eab308]/10 border border-[#eab308]/40 rounded text-xs text-[#eab308]">
                  ⚠️ Database or Archive Backup Leak! May permit full source code or database extraction.
                </div>
              )}

              {selectedEndpoint.snippet && (
                <div>
                  <label className="text-[10px] text-[#9da5b4] uppercase">Response Preview</label>
                  <pre className="text-[11px] font-mono text-[#dfdfdf] bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-1 overflow-x-auto whitespace-pre-wrap">
                    {selectedEndpoint.snippet}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-[#9da5b4] text-xs py-8">
              Select an endpoint from the table to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
