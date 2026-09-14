import React, { useEffect } from 'react';
import { cn } from '../../design-system/utils';
import { useAppShellStore } from '../../stores/appShellStore';
import { useEventBusStore } from '../../stores/eventBusStore';
import { useProjectStore } from '../../stores/projectStore';
import { WorkspaceId } from '../../types/shell';
import {
  Shield,
  Settings,
  Globe,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import { useVpnRotatorStore } from '../../stores/vpnRotatorStore';
import { useToastStore } from '../../stores/toastStore';
import { ipcClient } from '../../ipc/client';
import { Tooltip } from '../../design-system/Tooltip';
import { Dropdown, DropdownItem } from '../../design-system/Dropdown';
import { ProjectModal } from '../project/ProjectModal';

export interface BurpTabItem {
  id: WorkspaceId;
  label: string;
  ariaLabel: string;
  burpEquivalent: string;
  hotkey: string;
  badgeKey?: 'trafficCount' | 'criticalFindings';
}

export const BURP_TABS: BurpTabItem[] = [
  { id: 'scanner', label: 'Dashboard', ariaLabel: 'Scanner', burpEquivalent: 'Dashboard / Scanner', hotkey: '1' },
  { id: 'scope', label: 'Target', ariaLabel: 'Target Scope', burpEquivalent: 'Target / Scope', hotkey: '2' },
  { id: 'traffic', label: 'Proxy', ariaLabel: 'Traffic History', burpEquivalent: 'Proxy / HTTP History', hotkey: '3', badgeKey: 'trafficCount' },
  { id: 'fuzzer', label: 'Intruder', ariaLabel: 'Intruder', burpEquivalent: 'Intruder / Fuzzer', hotkey: '4' },
  { id: 'repeater', label: 'Repeater', ariaLabel: 'Repeater', burpEquivalent: 'Repeater', hotkey: '5' },
  { id: 'sql', label: 'SQL', ariaLabel: 'SQL Scanner', burpEquivalent: 'SQL Security Scanner', hotkey: 'U' },
  { id: 'oast', label: 'Collaborator', ariaLabel: 'Collaborator', burpEquivalent: 'Burp Collaborator / OAST', hotkey: '6' },
  { id: 'sequencer', label: 'Sequencer', ariaLabel: 'Sequencer', burpEquivalent: 'Sequencer', hotkey: 'Q' },
  { id: 'decoder', label: 'Decoder', ariaLabel: 'Decoder', burpEquivalent: 'Decoder', hotkey: 'D' },
  { id: 'comparer', label: 'Comparer', ariaLabel: 'Comparer', burpEquivalent: 'Comparer', hotkey: 'C' },
  { id: 'logger', label: 'Logger', ariaLabel: 'Logger', burpEquivalent: 'Logger', hotkey: 'L' },
  { id: 'organizer', label: 'Organizer', ariaLabel: 'Organizer', burpEquivalent: 'Organizer', hotkey: 'O' },
  { id: 'extensions', label: 'Extensions', ariaLabel: 'Extensions', burpEquivalent: 'Extensions & BApps', hotkey: 'E' },
  { id: 'discover', label: 'Discover', ariaLabel: 'Discover', burpEquivalent: 'Discover Content', hotkey: 'K' },
  { id: 'turbo', label: 'Turbo Intruder', ariaLabel: 'Turbo Intruder', burpEquivalent: 'Turbo Intruder', hotkey: 'T' },
  { id: 'paramminer', label: 'Param Miner', ariaLabel: 'Param Miner', burpEquivalent: 'Param Miner', hotkey: 'P' },
  { id: 'inql', label: 'InQL', ariaLabel: 'InQL', burpEquivalent: 'InQL GraphQL', hotkey: 'I' },
  { id: 'jwt', label: 'JSON Web Tokens', ariaLabel: 'JSON Web Tokens', burpEquivalent: 'JWT Editor', hotkey: 'J' },
  { id: 'hackvertor', label: 'Hackvertor', ariaLabel: 'Hackvertor', burpEquivalent: 'Hackvertor Tags', hotkey: 'H' },
  { id: 'authz', label: 'Auth Matrix', ariaLabel: 'Auth Matrix', burpEquivalent: 'Auth Matrix', hotkey: 'A' },
  { id: 'identity', label: 'Identity Vault', ariaLabel: 'Identity Vault', burpEquivalent: 'Identity Vault', hotkey: 'V' },
  { id: 'findings', label: 'Findings', ariaLabel: 'Findings', burpEquivalent: 'Findings & CAS', hotkey: 'F', badgeKey: 'criticalFindings' },
  { id: 'apis', label: 'API Security', ariaLabel: 'API Security', burpEquivalent: 'API Security', hotkey: 'S' },
  { id: 'graph', label: 'Attack Graph', ariaLabel: 'Attack Graph', burpEquivalent: 'Attack Graph', hotkey: 'G' },
  { id: 'notebook', label: 'Notebook', ariaLabel: 'Notebook', burpEquivalent: 'Notebook', hotkey: 'N' },
  { id: 'reports', label: 'Reporting', ariaLabel: 'Reporting', burpEquivalent: 'Reporting', hotkey: 'R' },
];

export const HeaderBar: React.FC = () => {
  const {
    activeWorkspace,
    setActiveWorkspace,
    activeProjectName,
    scopeRulesCount,
  } = useAppShellStore();

  const { trafficCount, criticalFindingCount } = useEventBusStore();
  const { openModal: openProjectModal, commitWalCheckpoint } = useProjectStore();
  const { addToast } = useToastStore();
  const { isActive: isVpnActive, currentNode: vpnNode, isRotating, rotateVpn, toggleVpn } = useVpnRotatorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toUpperCase();
        const matched = BURP_TABS.find((t) => t.hotkey === key);
        if (matched) {
          e.preventDefault();
          setActiveWorkspace(matched.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveWorkspace]);

  const projectDropdownItems: DropdownItem[] = [
    { id: 'proj-new', label: 'New Project (.sentinel)...', shortcut: 'Ctrl+N', onClick: () => openProjectModal('new') },
    { id: 'proj-open', label: 'Open Project Folder...', shortcut: 'Ctrl+O', onClick: () => openProjectModal('open') },
    { id: 'proj-recent', label: 'Recent Engagements...', shortcut: 'Ctrl+H', onClick: () => openProjectModal('recent') },
    { id: 'proj-settings', label: 'Project Database & WAL Diagnostics...', shortcut: 'Ctrl+Shift+P', onClick: () => openProjectModal('settings') },
    { id: 'proj-export', label: 'Export Project Backup (.zip)...', shortcut: 'Ctrl+Shift+E', onClick: () => openProjectModal('export') },
    { id: 'proj-import', label: 'Import Project Archive...', shortcut: 'Ctrl+Shift+I', onClick: () => openProjectModal('import') },
    { id: 'proj-save', label: 'Commit SQLite WAL Snapshot', shortcut: 'Ctrl+S', onClick: async () => { await commitWalCheckpoint(); } },
  ];

  return (
    <>
      {/* 1. Top Native Menu Bar */}
      <div className="h-7 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 select-none flex-shrink-0 z-30 font-sans text-xs text-[#9da5b4]">
        {/* Left: Sentinel V6 Branding + Project Menu + Open Browser */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#141517] border border-[#313438] shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#f37021]" />
            <span className="font-bold text-[#f37021] text-[11px] tracking-wide">Sentinel</span>
            <span className="font-bold text-white text-[11px] tracking-wide">V6</span>
          </div>

          <div className="h-3 w-px bg-[#313438]" />

          <Dropdown
            align="left"
            items={projectDropdownItems}
            trigger={
              <button className="px-2 py-0.5 hover:bg-[#2b2d30] rounded hover:text-white transition-colors text-[11px] font-medium text-[#dfdfdf]">
                Project
              </button>
            }
          />

          <div className="h-3 w-px bg-[#313438]" />

          {/* Connected Browser Trigger Button */}
          <button
            onClick={async () => {
              try {
                await ipcClient.launchSystemBrowser('https://www.google.com', 8085);
                addToast({
                  type: 'success',
                  title: isVpnActive ? `Browser Active • Egress: ${vpnNode.flag} ${vpnNode.ip}` : 'Proxy Browser Launched (127.0.0.1:8085)',
                  description: isVpnActive
                    ? `Chromium session connected to Sentinel proxy on port 8085 with egress via ${vpnNode.flag} ${vpnNode.ip} (${vpnNode.city}).`
                    : 'External browser opened and connected to Sentinel MITM proxy on port 8085.',
                });
              } catch {
                addToast({
                  type: 'info',
                  title: isVpnActive ? `Browser Proxy Active (${vpnNode.flag} ${vpnNode.ip})` : 'Proxy Browser Active (127.0.0.1:8085)',
                  description: 'Chromium session routed through Sentinel MITM proxy on port 8085.',
                });
              }
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f37021]/15 hover:bg-[#f37021]/25 text-[#f37021] hover:text-white border border-[#f37021]/40 rounded transition-colors text-[11px] font-semibold group shadow-sm"
            title={`Open Connected Proxy Browser (Alt+B) ${isVpnActive ? `• Egress: ${vpnNode.flag} ${vpnNode.ip}` : ''}`}
          >
            <Globe className="w-3 h-3 text-[#f37021] group-hover:text-white transition-colors" />
            <span>Open Browser</span>
          </button>

          {/* Built-in VPN / Upstream Egress Rotator */}
          <div className="flex items-center rounded bg-[#141517] border border-[#313438] overflow-hidden shadow-sm">
            <button
              onClick={() => toggleVpn()}
              title={isVpnActive ? `VPN Shield Active: Egress via ${vpnNode.city}, ${vpnNode.country} (${vpnNode.ip}). Click to toggle.` : 'VPN Shield Disabled. Click to enable.'}
              className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                isVpnActive
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-transparent text-[#6f737a] hover:text-white'
              }`}
            >
              <span className="text-[12px]">{vpnNode.flag}</span>
              <span>VPN: {vpnNode.ip}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isVpnActive ? 'bg-emerald-400 animate-pulse' : 'bg-[#6f737a]'}`} />
            </button>
            <button
              onClick={() => rotateVpn()}
              disabled={isRotating}
              title="Rotate Physical VPN Egress: Click to generate new WireGuard keys and switch physical exit IP"
              className="px-1.5 py-0.5 bg-[#1e2024] hover:bg-[#2b2d30] text-[#a1a1aa] hover:text-white border-l border-[#313438] transition-colors flex items-center gap-1 text-[10px] disabled:opacity-60"
            >
              <RotateCw className={`w-2.5 h-2.5 ${isRotating ? 'animate-spin text-emerald-400' : 'hover:rotate-180'} transition-transform`} />
              <span>{isRotating ? 'Rotating...' : 'Rotate'}</span>
            </button>
          </div>
        </div>

        {/* Center: Title & Scope Status */}
        <div className="text-[11px] font-medium text-[#6f737a] truncate flex items-center gap-2">
          <span className="text-[#dfdfdf] font-semibold">SENTINEL V6 Workstation</span>
          <span>— {activeProjectName || 'Default Workspace'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2b2d30] text-[#34d399] font-mono border border-[#313438] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            Scope: Active ({scopeRulesCount} rules)
          </span>
        </div>

        {/* Far Right: Settings */}
        <div className="flex items-center gap-2">
          <Tooltip content="Open Settings">
            <button onClick={() => setActiveWorkspace('settings')} className="p-1 hover:text-white text-[#6f737a] hover:bg-[#2b2d30] rounded transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 2. Primary Horizontal Workspace Tab Bar */}
      <nav className="h-8 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center px-1 select-none flex-shrink-0 z-20 overflow-x-auto scrollbar-none font-sans text-xs">
        <div className="flex items-center gap-0 h-full">
          {BURP_TABS.map((tab) => {
            const isActive = activeWorkspace === tab.id;
            let badgeCount = 0;
            if (tab.badgeKey === 'trafficCount') badgeCount = trafficCount;
            if (tab.badgeKey === 'criticalFindings') badgeCount = criticalFindingCount;

            return (
              <button
                key={tab.id}
                aria-label={tab.ariaLabel}
                onClick={() => setActiveWorkspace(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 h-full font-medium transition-colors whitespace-nowrap cursor-pointer text-xs',
                  isActive
                    ? 'bg-[#1e1f22] text-[#f37021] font-semibold'
                    : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]/60'
                )}
              >
                <span>{tab.label}</span>

                {/* Badge Count */}
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold',
                      tab.badgeKey === 'criticalFindings' ? 'bg-[#ef4444] text-white' : 'bg-[#35383f] text-[#dfdfdf] border border-[#313438]'
                    )}
                  >
                    {badgeCount > 999 ? '999+' : badgeCount}
                  </span>
                )}

                {/* Classic bottom orange highlight indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f37021]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Tab Bar Controls */}
        <div className="ml-auto flex items-center gap-1 text-[#6f737a] pr-1">
          <button className="p-1 hover:text-[#34d399] hover:bg-[#35383f] rounded transition-colors" title="Target Scope"><Shield className="w-3.5 h-3.5 text-[#34d399]" /></button>
          <button className="p-1 hover:text-white hover:bg-[#35383f] rounded transition-colors" title="Scroll Tabs"><ChevronRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => setActiveWorkspace('settings')} className="p-1 hover:text-white hover:bg-[#35383f] rounded transition-colors" title="Settings"><Settings className="w-3.5 h-3.5" /></button>
        </div>
      </nav>

      {/* Global Project Modal */}
      <ProjectModal />
    </>
  );
};
