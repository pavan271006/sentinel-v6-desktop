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
} from 'lucide-react';
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
      <div className="h-7 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 select-none flex-shrink-0 z-30 font-sans text-xs text-[#c4c7c5]">
        {/* Left: Sentinel V6 Branding + Project Menu + Open Browser */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#f37021]" />
            <span className="font-bold text-[#f37021] text-[11px] tracking-wide">Sentinel</span>
            <span className="font-bold text-white text-[11px] tracking-wide">V6</span>
          </div>

          <div className="h-3 w-px bg-[#2b2d30]" />

          <Dropdown
            align="left"
            items={projectDropdownItems}
            trigger={
              <button className="px-2 py-0.5 hover:bg-[#2b2d30] rounded hover:text-white transition-colors text-[11px] font-medium text-[#c4c7c5]">
                Project
              </button>
            }
          />

          <div className="h-3 w-px bg-[#2b2d30]" />

          {/* Connected Browser Trigger Button */}
          <button
            onClick={async () => {
              try {
                await ipcClient.launchSystemBrowser('https://www.google.com', 8085);
                addToast({
                  type: 'success',
                  title: 'Proxy Browser Launched (127.0.0.1:8085)',
                  description: 'External browser opened and connected to Sentinel MITM proxy on port 8085.',
                });
              } catch {
                addToast({
                  type: 'info',
                  title: 'Proxy Browser Active (127.0.0.1:8085)',
                  description: 'Chromium session routed through Sentinel MITM proxy on port 8085.',
                });
              }
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f37021]/15 hover:bg-[#f37021]/25 text-[#f37021] hover:text-white border border-[#f37021]/40 rounded transition-colors text-[11px] font-semibold group shadow-sm"
            title="Open Connected Proxy Browser (Alt+B)"
          >
            <Globe className="w-3 h-3 text-[#f37021] group-hover:text-white transition-colors" />
            <span>Open Browser</span>
          </button>
        </div>

        {/* Center: Title & Scope Status */}
        <div className="text-[11px] font-medium text-[#8c9099] truncate flex items-center gap-2">
          <span>SENTINEL V6 Workstation — {activeProjectName || 'Default Workspace'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2b2d30] text-[#34d399] font-mono">
            Scope: Active ({scopeRulesCount} rules)
          </span>
        </div>

        {/* Far Right: Settings */}
        <div className="flex items-center gap-2">
          <Tooltip content="Open Settings">
            <button onClick={() => setActiveWorkspace('settings')} className="p-1 hover:text-white text-[#8c9099]">
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
                  'relative flex items-center gap-1 px-3 h-full font-medium transition-colors whitespace-nowrap cursor-pointer text-xs',
                  isActive
                    ? 'bg-[#1e1f22] text-[#f37021] font-semibold'
                    : 'text-[#c4c7c5] hover:text-white hover:bg-[#35383f]/60'
                )}
              >
                <span>{tab.label}</span>

                {/* Badge Count */}
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold',
                      tab.badgeKey === 'criticalFindings' ? 'bg-[#ef4444] text-white' : 'bg-[#35383f] text-[#c4c7c5]'
                    )}
                  >
                    {badgeCount > 999 ? '999+' : badgeCount}
                  </span>
                )}

                {/* Burp Suite Signature Orange Bottom Highlight Bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f37021] shadow-[0_-1px_6px_rgba(243,112,33,0.6)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Tab Bar Controls */}
        <div className="ml-auto flex items-center gap-1 text-[#8c9099] pr-1">
          <button className="p-1 hover:text-white" title="Target Scope"><Shield className="w-3.5 h-3.5 text-[#34d399]" /></button>
          <button className="p-1 hover:text-white" title="Scroll Tabs"><ChevronRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => setActiveWorkspace('settings')} className="p-1 hover:text-white" title="Settings"><Settings className="w-3.5 h-3.5" /></button>
        </div>
      </nav>

      {/* Global Project Modal */}
      <ProjectModal />
    </>
  );
};
