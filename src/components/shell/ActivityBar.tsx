import React, { useEffect } from 'react';
import { cn } from '../../design-system/utils';
import { useAppShellStore } from '../../stores/appShellStore';
import { useEventBusStore } from '../../stores/eventBusStore';
import { WorkspaceConfig } from '../../types/shell';
import { Tooltip } from '../../design-system/Tooltip';
import {
  ShieldCheck,
  Activity,
  Repeat,
  Radio,
  Zap,
  KeyRound,
  ShieldAlert,
  FileCode2,
  Globe2,
  Radar,
  Bug,
  BookOpen,
  Network,
  FileText,
  Settings,
  Database,
} from 'lucide-react';

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'scope',
    label: 'Scope & Target Policy',
    hotkeyNumber: 'S',
    iconName: 'ShieldCheck',
    description: 'Fail-closed pre-socket scope rules and SSRF protections (SEC-01)',
  },
  {
    id: 'traffic',
    label: 'Traffic History',
    hotkeyNumber: '1',
    iconName: 'Activity',
    description: 'Real-time proxy HTTP/1.1 & HTTP/2 transaction stream (SUB-06)',
    badgeKey: 'trafficCount',
  },
  {
    id: 'repeater',
    label: 'Repeater',
    hotkeyNumber: '2',
    iconName: 'Repeat',
    description: 'Manual request crafting, variable injection, and diffing (SUB-08)',
  },
  {
    id: 'sql',
    label: 'SQL Security Scanner',
    hotkeyNumber: 'U',
    iconName: 'Database',
    description: 'Automated, non-destructive SQL injection differential scanner (CWE-89)',
  },
  {
    id: 'scanner',
    label: 'Scanner',
    hotkeyNumber: '3',
    iconName: 'Radio',
    description: 'Active/passive vulnerability scanner and check orchestrator (SUB-13)',
  },
  {
    id: 'fuzzer',
    label: 'Mutation Fuzzer',
    hotkeyNumber: '4',
    iconName: 'Zap',
    description: 'Boundary payload fuzzer with Delta Debugging minimizer (SUB-14)',
  },
  {
    id: 'identity',
    label: 'Identity Vault',
    hotkeyNumber: '5',
    iconName: 'KeyRound',
    description: 'Zeroized keychain (SEC-09) & JWT algorithm manipulation (SUB-12)',
  },
  {
    id: 'authz',
    label: 'IRA+ Auth Matrix',
    hotkeyNumber: 'A',
    iconName: 'ShieldAlert',
    description: 'Multi-principal BOLA/IDOR/BFLA authorization matrix (SUB-16)',
  },
  {
    id: 'apis',
    label: 'API Security',
    hotkeyNumber: '6',
    iconName: 'FileCode2',
    description: 'OpenAPI 3.x, GraphQL depth analysis, and WebSocket inspector (SUB-17)',
  },
  {
    id: 'browser',
    label: 'Browser Automation',
    hotkeyNumber: '7',
    iconName: 'Globe2',
    description: 'Playwright headless browser daemon with DOM & screenshot CAS (SUB-18)',
  },
  {
    id: 'oast',
    label: 'OAST Server',
    hotkeyNumber: 'O',
    iconName: 'Radar',
    description: 'Out-of-band AES-256 token generator & DNS/HTTP callback listener (SUB-19)',
  },
  {
    id: 'findings',
    label: 'Findings Center',
    hotkeyNumber: '8',
    iconName: 'Bug',
    description: 'Vulnerability triage with cryptographic CAS proof linking (SUB-15/21)',
    badgeKey: 'criticalFindings',
  },
  {
    id: 'graph',
    label: 'Attack Surface Graph',
    hotkeyNumber: 'G',
    iconName: 'Network',
    description: 'SQLite recursive CTE graph model & coverage visualizer (SUB-10/11)',
  },
  {
    id: 'notebook',
    label: 'Pentester Notebook',
    hotkeyNumber: 'N',
    iconName: 'BookOpen',
    description: 'Markdown scratchpad and engagement log (SUB-21)',
  },
  {
    id: 'reports',
    label: 'Reports & Retest',
    hotkeyNumber: '9',
    iconName: 'FileText',
    description: 'Executive PDF/SARIF 2.1 reporting and regression runner (SUB-21)',
  },
  {
    id: 'settings',
    label: 'Settings & Diagnostics',
    hotkeyNumber: '0',
    iconName: 'Settings',
    description: 'System diagnostics, memory metrics, and zero-leakage scrubber (SUB-27)',
  },
];

export const ActivityBar: React.FC = () => {
  const { activeWorkspace, setActiveWorkspace } = useAppShellStore();
  const { criticalFindingCount } = useEventBusStore();

  // Global Alt+1 .. Alt+0 hotkey switcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toUpperCase();
        const target = WORKSPACES.find((w) => w.hotkeyNumber === key || w.hotkeyNumber === e.key);
        if (target) {
          e.preventDefault();
          setActiveWorkspace(target.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveWorkspace]);

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5" />;
      case 'Activity':
        return <Activity className="w-5 h-5" />;
      case 'Repeat':
        return <Repeat className="w-5 h-5" />;
      case 'Radio':
        return <Radio className="w-5 h-5" />;
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'KeyRound':
        return <KeyRound className="w-5 h-5" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5" />;
      case 'FileCode2':
        return <FileCode2 className="w-5 h-5" />;
      case 'Globe2':
        return <Globe2 className="w-5 h-5" />;
      case 'Radar':
        return <Radar className="w-5 h-5" />;
      case 'Bug':
        return <Bug className="w-5 h-5" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5" />;
      case 'Network':
        return <Network className="w-5 h-5" />;
      case 'FileText':
        return <FileText className="w-5 h-5" />;
      case 'Database':
        return <Database className="w-5 h-5" />;
      case 'Settings':
        return <Settings className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <aside
      aria-label="Activity Bar"
      className="w-12 bg-bg-app border-r border-border-subtle flex flex-col items-center py-2 select-none flex-shrink-0 z-20 overflow-y-auto"
    >
      <div className="flex flex-col gap-1.5 w-full items-center">
        {WORKSPACES.map((ws) => {
          const isActive = activeWorkspace === ws.id;

          let badgeCount: number | null = null;
          if (ws.badgeKey === 'criticalFindings' && criticalFindingCount > 0) {
            badgeCount = criticalFindingCount;
          }

          return (
            <Tooltip
              key={ws.id}
              position="right"
              content={
                <div className="space-y-0.5">
                  <div className="font-semibold flex items-center justify-between gap-2">
                    <span>{ws.label}</span>
                    <span className="text-[10px] font-mono text-accent-cyan bg-bg-panel px-1 rounded">
                      Alt+{ws.hotkeyNumber}
                    </span>
                  </div>
                  <p className="text-text-muted text-[11px]">{ws.description}</p>
                </div>
              }
            >
              <button
                onClick={() => setActiveWorkspace(ws.id)}
                className={cn(
                  'relative w-10 h-10 flex items-center justify-center rounded transition-all group',
                  isActive
                    ? 'bg-bg-panel-elevated text-accent-cyan font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                )}
                aria-label={ws.label}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent-cyan rounded-r" />
                )}

                {renderIcon(ws.iconName)}

                {/* Badge if present */}
                {badgeCount !== null && (
                  <span className="absolute top-1 right-1 px-1 min-w-[14px] h-[14px] text-[9px] font-mono font-bold bg-severity-critical text-white rounded-full flex items-center justify-center">
                    {badgeCount}
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
};
