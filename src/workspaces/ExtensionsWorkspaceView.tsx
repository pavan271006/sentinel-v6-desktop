import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Puzzle,
  Download,
  CheckCircle,
  Search,
  Star,
} from 'lucide-react';

interface ExtensionItem {
  id: string;
  name: string;
  version: string;
  author: string;
  rating: number;
  category: string;
  description: string;
  installed: boolean;
  enabled: boolean;
}

const BAPP_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'turbo',
    name: 'Turbo Intruder',
    version: '1.42',
    author: 'James Kettle (PortSwigger)',
    rating: 5,
    category: 'Fuzzing & Attacks',
    description: 'High-speed socket fuzzer built on async Python HTTP pipelining for race conditions & massive lists.',
    installed: true,
    enabled: true,
  },
  {
    id: 'hackvertor',
    name: 'Hackvertor',
    version: '2.3.0',
    author: 'Gareth Heyes',
    rating: 5,
    category: 'Encoding & Payload Crafting',
    description: 'Tag-based conversion tool that supports nested encoding, decoding, encryption, and custom functions.',
    installed: true,
    enabled: true,
  },
  {
    id: 'paramminer',
    name: 'Param Miner',
    version: '1.28',
    author: 'PortSwigger Research',
    rating: 5,
    category: 'Information Gathering',
    description: 'Discovers unlinked parameters and unkeyed headers for finding web cache poisoning vulnerabilities.',
    installed: true,
    enabled: true,
  },
  {
    id: 'jwt',
    name: 'JSON Web Tokens (JWT Editor)',
    version: '2.1.1',
    author: 'Corey Ball',
    rating: 5,
    category: 'Authentication',
    description: 'Decode, manipulate claims, test signature bypass algorithms (alg: none), and sign with custom keys.',
    installed: true,
    enabled: true,
  },
  {
    id: 'inql',
    name: 'InQL GraphQL Security Scanner',
    version: '4.0.2',
    author: 'Doyensec',
    rating: 5,
    category: 'API Security',
    description: 'GraphQL security testing tool with query generator, schema introspection, and authorization matrix.',
    installed: true,
    enabled: true,
  },
  {
    id: 'autorize',
    name: 'Autorize (BOLA / IDOR Matrix)',
    version: '3.1.0',
    author: 'Barak Tawily',
    rating: 5,
    category: 'Authorization',
    description: 'Automates detection of authorization bypasses and IDORs by repeating requests with low-privilege tokens.',
    installed: true,
    enabled: true,
  },
];

export const ExtensionsWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [subTab, setSubTab] = useState<'installed' | 'bapp' | 'options'>('installed');
  const [extensions, setExtensions] = useState<ExtensionItem[]>(BAPP_EXTENSIONS);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExtension = (id: string) => {
    setExtensions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
    const item = extensions.find((e) => e.id === id);
    addToast({
      type: 'info',
      title: `${item?.name} ${item?.enabled ? 'Disabled' : 'Enabled'}`,
    });
  };

  const installExtension = (id: string) => {
    setExtensions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, installed: true, enabled: true } : e))
    );
    const item = extensions.find((e) => e.id === id);
    addToast({
      type: 'success',
      title: `Installed ${item?.name}`,
      description: 'Loaded extension into Sentinel runtime.',
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Extensions & BApp Store Management</span>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-1">
          {(['installed', 'bapp', 'options'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                subTab === tab ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              {tab === 'bapp' ? 'BApp Store' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* 1. Installed Subtab */}
        {subTab === 'installed' && (
          <div className="border border-[#3e4249] rounded-lg overflow-hidden bg-[#141517]">
            <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex justify-between">
              <span>Active Extensions ({extensions.filter((e) => e.installed).length})</span>
              <span className="text-[10px] text-[#34d399] font-mono">Runtime: Embedded Python & Java IPC</span>
            </div>

            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
                <tr>
                  <th className="px-3 py-2 w-16">Loaded</th>
                  <th className="px-3 py-2">Extension Name</th>
                  <th className="px-3 py-2 w-24">Version</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2 w-32">Category</th>
                  <th className="px-3 py-2 w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {extensions.filter((e) => e.installed).map((ext) => (
                  <tr key={ext.id} className="hover:bg-[#1e1f22]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={ext.enabled}
                        onChange={() => toggleExtension(ext.id)}
                        className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white font-bold">{ext.name}</div>
                      <div className="text-[11px] text-[#9da5b4] font-sans truncate max-w-md">{ext.description}</div>
                    </td>
                    <td className="px-3 py-2 text-[#38bdf8] font-bold">v{ext.version}</td>
                    <td className="px-3 py-2 text-[#dfdfdf]">{ext.author}</td>
                    <td className="px-3 py-2">
                      <span className="bg-[#1e1f22] px-2 py-0.5 rounded text-[10px] text-[#a6acb8] border border-[#3e4249]">
                        {ext.category}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleExtension(ext.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                          ext.enabled ? 'bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30' : 'bg-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/30'
                        }`}
                      >
                        {ext.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. BApp Store Subtab */}
        {subTab === 'bapp' && (
          <div className="space-y-4">
            <div className="flex items-center bg-[#141517] rounded border border-[#3e4249] px-3 py-1.5 max-w-md">
              <Search className="w-4 h-4 text-[#6f737a] mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search BApp Store..."
                className="w-full bg-transparent text-white text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {extensions.map((ext) => (
                <div key={ext.id} className="p-3 bg-[#141517] rounded-lg border border-[#3e4249] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">{ext.name}</h3>
                      <div className="flex items-center gap-1 text-[#eab308]">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[11px] font-bold">{ext.rating}.0</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#38bdf8] font-mono">By {ext.author} • v{ext.version}</span>
                    <p className="text-xs text-[#a6acb8] mt-2 font-sans">{ext.description}</p>
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-[#2b2d30]">
                    <span className="text-[10px] text-[#6f737a]">{ext.category}</span>
                    {ext.installed ? (
                      <span className="flex items-center gap-1 text-[#34d399] font-bold text-xs">
                        <CheckCircle className="w-3.5 h-3.5" /> Installed
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="xs"
                        leftIcon={<Download className="w-3 h-3" />}
                        onClick={() => installExtension(ext.id)}
                        className="bg-[#f37021] hover:bg-[#e05d06] text-white"
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Options Subtab */}
        {subTab === 'options' && (
          <div className="p-4 bg-[#141517] rounded-lg border border-[#3e4249] space-y-4 max-w-2xl">
            <span className="text-sm font-bold text-white block">Python & Java Extension Environment</span>
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[11px] text-[#9da5b4] block mb-1">Embedded Python Environment (Jython / CPython)</label>
                <input
                  type="text"
                  readOnly
                  value="C:\Program Files\Sentinel\bin\python311.dll (Embedded)"
                  className="w-full bg-[#1e1f22] text-[#34d399] px-2.5 py-1 rounded border border-[#3e4249]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#9da5b4] block mb-1">Java Runtime (JDK 21 LTS)</label>
                <input
                  type="text"
                  readOnly
                  value="C:\Program Files\Java\jdk-21\bin\server\jvm.dll (Verified)"
                  className="w-full bg-[#1e1f22] text-[#34d399] px-2.5 py-1 rounded border border-[#3e4249]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
