export type WorkspaceId =
  | 'scope'
  | 'traffic'
  | 'repeater'
  | 'scanner'
  | 'fuzzer'
  | 'identity'
  | 'authz'
  | 'apis'
  | 'browser'
  | 'oast'
  | 'findings'
  | 'notebook'
  | 'graph'
  | 'reports'
  | 'settings'
  | 'jwt'
  | 'hackvertor'
  | 'decoder'
  | 'comparer'
  | 'sequencer'
  | 'turbo'
  | 'paramminer'
  | 'logger'
  | 'organizer'
  | 'extensions'
  | 'discover'
  | 'inql'
  | 'vulnintel'
  | 'sql';

export interface WorkspaceConfig {
  id: WorkspaceId;
  label: string;
  hotkeyNumber: string;
  iconName: string;
  description: string;
  badgeKey?: 'criticalFindings' | 'runningTasks' | 'interceptCount' | 'trafficCount';
}

export type BottomDrawerTab = 'logs' | 'events' | 'tasks' | 'ipc' | 'diagnostics';

export type AppTheme = 'dark' | 'light';

export interface SplitPaneState {
  sidebarWidth: number;
  inspectorWidth: number;
  bottomDrawerHeight: number;
}
