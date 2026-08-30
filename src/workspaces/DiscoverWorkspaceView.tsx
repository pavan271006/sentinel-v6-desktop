import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  FolderSearch,
  Play,
  Square,
  FileCode,
  Folder,
} from 'lucide-react';

interface DiscoveredPath {
  id: number;
  path: string;
  status: number;
  length: number;
  type: 'Directory' | 'File' | 'Config' | 'Backup';
  timeMs: number;
}

export const DiscoverWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local');
  const [wordlist, setWordlist] = useState('Raft-large-directories (35,000 paths)');
  const [isDiscovering, setIsDiscovering] = useState(false);

  const [discoveredPaths, setDiscoveredPaths] = useState<DiscoveredPath[]>([
    { id: 1, path: '/admin', status: 403, length: 512, type: 'Directory', timeMs: 14 },
    { id: 2, path: '/api/v1/health', status: 200, length: 42, type: 'File', timeMs: 18 },
    { id: 3, path: '/.env', status: 200, length: 1204, type: 'Config', timeMs: 22 },
    { id: 4, path: '/backup.zip', status: 200, length: 84920, type: 'Backup', timeMs: 45 },
    { id: 5, path: '/swagger.json', status: 200, length: 18420, type: 'File', timeMs: 19 },
    { id: 6, path: '/internal', status: 401, length: 312, type: 'Directory', timeMs: 12 },
  ]);

  const handleStartDiscovery = () => {
    setIsDiscovering(true);
    addToast({ type: 'info', title: 'Content Discovery Started', description: `Probing ${targetUrl} with ${wordlist}...` });
    setTimeout(() => {
      setIsDiscovering(false);
      setDiscoveredPaths((prev) => [
        ...prev,
        { id: prev.length + 1, path: '/.git/HEAD', status: 200, length: 23, type: 'Config', timeMs: 15 },
      ]);
      addToast({ type: 'success', title: 'Discovered Exposed Git Repository', description: '/.git/HEAD found (200 OK)' });
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FolderSearch className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Discover Content & Directory Fuzzing</span>
        </div>

        <div className="flex items-center gap-2">
          {isDiscovering ? (
            <Button
              variant="danger"
              size="xs"
              leftIcon={<Square className="w-3 h-3" />}
              onClick={() => setIsDiscovering(false)}
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

      {/* Target Config Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center gap-4">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2">Target URL:</span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#9da5b4]">Wordlist:</span>
          <select
            value={wordlist}
            onChange={(e) => setWordlist(e.target.value)}
            className="bg-[#1e1f22] text-white px-2 py-1 rounded border border-[#3e4249] text-xs focus:outline-none"
          >
            <option value="Raft-large-directories (35,000 paths)">Raft Large Directories (35,000 paths)</option>
            <option value="Common-files-sensitive (12,000 paths)">Common Sensitive Files (.env, .bak, .git)</option>
            <option value="Robots-txt-and-Sitemaps">Robots.txt & Sitemaps</option>
          </select>
        </div>
      </div>

      {/* Discovered Paths Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="border border-[#3e4249] rounded-lg overflow-hidden bg-[#141517]">
          <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex justify-between">
            <span>Discovered Endpoints & Files ({discoveredPaths.length})</span>
            <span className="text-[10px] text-[#34d399] font-mono">Recursive Content Tree</span>
          </div>

          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2 w-24">Type</th>
                <th className="px-3 py-2 w-20">Status</th>
                <th className="px-3 py-2 w-24">Length</th>
                <th className="px-3 py-2 w-20">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d30]">
              {discoveredPaths.map((p) => (
                <tr key={p.id} className="hover:bg-[#1e1f22] cursor-pointer">
                  <td className="px-3 py-2 text-[#6f737a]">{p.id}</td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    {p.type === 'Directory' ? <Folder className="w-3.5 h-3.5 text-[#38bdf8]" /> : <FileCode className="w-3.5 h-3.5 text-[#f37021]" />}
                    <span className="text-white font-bold">{p.path}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.type === 'Config' ? 'bg-[#ef4444] text-white' :
                      p.type === 'Backup' ? 'bg-[#f97316] text-white' :
                      'bg-[#2b2d30] text-[#a6acb8]'
                    }`}>
                      {p.type}
                    </span>
                  </td>
                  <td className={`px-3 py-2 font-bold ${
                    p.status === 200 ? 'text-[#34d399]' : p.status === 403 ? 'text-[#eab308]' : 'text-[#ef4444]'
                  }`}>
                    {p.status}
                  </td>
                  <td className="px-3 py-2 text-[#9da5b4]">{p.length} bytes</td>
                  <td className="px-3 py-2 text-[#38bdf8]">{p.timeMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
