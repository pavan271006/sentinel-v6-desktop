import {
  PlatformInfoResponse,
  AppStatusResponse,
  ScopeDecisionResponse,
  CommandSearchItem,
  ProjectMetadata,
  RecentProjectInfo,
  ProjectState,
  ScopeResponse,
  ScopeRuleDef,
  ProjectExportResult,
  ProjectImportResult,
  WalStatusResult,
  TrafficPageQuery,
  TrafficPageResult,
  TransactionDetails,
  RawBlobResult,
  TrafficClearResult,
  TrafficDiffRequest,
  TrafficDiffResult,
  HttpqlValidationResult,
  RepeaterTabState,
  RepeaterSendRequestPayload,
  RepeaterExecutionResult,
  RepeaterDiffRequest,
  RepeaterExportPayload,
  VariableExtractPayload,
} from './contracts';
import { mockBackendBridge } from './mockBridge';

// Check if running inside Tauri Webview
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    Boolean((window as any).__TAURI_INVOKE__)
  );
}

export class SentinelIpcClient {
  private static instance: SentinelIpcClient;

  private constructor() {}

  public static getInstance(): SentinelIpcClient {
    if (!SentinelIpcClient.instance) {
      SentinelIpcClient.instance = new SentinelIpcClient();
    }
    return SentinelIpcClient.instance;
  }

  private async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(command, args);
    }

    // Fallback in web/test environment
    switch (command) {
      case 'cmd_get_platform_info':
        return (await mockBackendBridge.getPlatformInfo()) as unknown as T;
      case 'cmd_get_status':
        return (await mockBackendBridge.getStatus()) as unknown as T;
      case 'cmd_toggle_proxy':
        return (await mockBackendBridge.toggleProxy()) as unknown as T;
      case 'cmd_project_new':
        return (await mockBackendBridge.createProject(
          (args?.name as string) || '',
          (args?.path as string) || '',
          args?.seedScopeRules as string[] | undefined
        )) as unknown as T;
      case 'cmd_project_open':
        return (await mockBackendBridge.openProject((args?.path as string) || '')) as unknown as T;
      case 'cmd_project_close':
        return (await mockBackendBridge.closeProject()) as unknown as T;
      case 'cmd_project_get_current':
        return (await mockBackendBridge.getCurrentProject()) as unknown as T;
      case 'cmd_project_list_recent':
        return (await mockBackendBridge.listRecentProjects()) as unknown as T;
      case 'cmd_project_export':
        return (await mockBackendBridge.exportProject(
          (args?.path as string) || '',
          (args?.destZip as string) || '',
          args?.sanitized as boolean | undefined
        )) as unknown as T;
      case 'cmd_project_import':
        return (await mockBackendBridge.importProject(
          (args?.sourceZip as string) || '',
          (args?.destDir as string) || ''
        )) as unknown as T;
      case 'cmd_project_wal_checkpoint':
        return (await mockBackendBridge.walCheckpoint()) as unknown as T;
      case 'cmd_scope_get':
        return (await mockBackendBridge.getScope()) as unknown as T;
      case 'cmd_scope_update':
        return (await mockBackendBridge.updateScope(
          (args?.includes as string[]) || [],
          (args?.excludes as string[]) || [],
          args?.rules as ScopeRuleDef[] | undefined
        )) as unknown as T;
      case 'cmd_test_scope_uri':
        return (await mockBackendBridge.testScopeUri((args?.uri as string) || '')) as unknown as T;
      case 'cmd_productivity_search':
        return (await mockBackendBridge.searchCommands((args?.query as string) || '')) as unknown as T;
      case 'cmd_traffic_get_page':
        return (await mockBackendBridge.getTrafficPage(args?.query as TrafficPageQuery)) as unknown as T;
      case 'cmd_traffic_get_details':
        return (await mockBackendBridge.getTransactionDetails(args?.id as string)) as unknown as T;
      case 'cmd_traffic_get_raw_blob':
        return (await mockBackendBridge.getRawBlob(
          args?.sha256Hex as string,
          args?.maxBytes as number | undefined
        )) as unknown as T;
      case 'cmd_traffic_clear':
        return (await mockBackendBridge.clearTraffic()) as unknown as T;
      case 'cmd_httpql_validate':
        return (await mockBackendBridge.validateHttpql(args?.query as string)) as unknown as T;
      case 'cmd_traffic_diff':
        return (await mockBackendBridge.diffTransactions(args?.req as TrafficDiffRequest)) as unknown as T;
      case 'cmd_repeater_create_tab':
        return (await mockBackendBridge.createRepeaterTab(
          args?.title as string | undefined,
          args?.targetUrl as string | undefined,
          args?.seedTransactionId as string | undefined,
          args?.initialRequest as string | undefined
        )) as unknown as T;
      case 'cmd_repeater_send_request':
        return (await mockBackendBridge.sendRepeaterRequest(
          ((args?.payload as RepeaterSendRequestPayload) || args) as RepeaterSendRequestPayload
        )) as unknown as T;
      case 'cmd_repeater_diff':
        return (await mockBackendBridge.diffRepeaterRevisions(
          ((args?.req as RepeaterDiffRequest) || args) as RepeaterDiffRequest
        )) as unknown as T;
      case 'cmd_repeater_export_curl':
        return (await mockBackendBridge.exportRepeaterCommand(
          ((args?.payload as RepeaterExportPayload) || args) as RepeaterExportPayload
        )) as unknown as T;
      case 'cmd_repeater_extract_variable':
        return (await mockBackendBridge.extractVariable(
          ((args?.payload as VariableExtractPayload) || args) as VariableExtractPayload
        )) as unknown as T;
      case 'cmd_launch_system_browser':
        const targetUrl = (args?.targetUrl as string) || 'https://www.google.com';
        if (typeof window !== 'undefined' && window.open) {
          window.open(targetUrl, '_blank');
        }
        return `Launched ${targetUrl}` as unknown as T;
      case 'cmd_ucmax_analyze_boolean':
        return null as unknown as T;
      case 'cmd_ucmax_plan_next_step':
        return {
          strategy: 'BooleanDifferential',
          expected_info_gain: 0.85,
          estimated_cost: 2,
          reason: 'Information gain optimization',
        } as unknown as T;
      case 'cmd_launch_wireshark':
        return `Launched Wireshark (filter: ${(args?.filter as string) || 'default'})` as unknown as T;
      case 'cmd_check_packet_capture_status':
        return {
          wireshark: true,
          tshark: true,
          npcap: true,
          wireshark_version: '4.6.8',
          npcap_version: '1.88',
          default_filter: 'tcp.port == 8085 or tcp.port == 8080',
        } as unknown as T;
      default:
        throw new Error(`Unhandled IPC command in fallback: ${command}`);
    }
  }

  public async getPlatformInfo(): Promise<PlatformInfoResponse> {
    return this.invoke<PlatformInfoResponse>('cmd_get_platform_info');
  }

  public async getStatus(): Promise<AppStatusResponse> {
    return this.invoke<AppStatusResponse>('cmd_get_status');
  }

  public async toggleProxy(): Promise<boolean> {
    return this.invoke<boolean>('cmd_toggle_proxy');
  }

  // Project Lifecycle Methods
  public async createProject(name: string, path: string, seedScopeRules?: string[]): Promise<ProjectMetadata> {
    return this.invoke<ProjectMetadata>('cmd_project_new', { name, path, seedScopeRules });
  }

  public async openProject(path: string): Promise<ProjectState> {
    return this.invoke<ProjectState>('cmd_project_open', { path });
  }

  public async closeProject(): Promise<void> {
    return this.invoke<void>('cmd_project_close');
  }

  public async getCurrentProject(): Promise<ProjectMetadata | null> {
    return this.invoke<ProjectMetadata | null>('cmd_project_get_current');
  }

  public async listRecentProjects(): Promise<RecentProjectInfo[]> {
    return this.invoke<RecentProjectInfo[]>('cmd_project_list_recent');
  }

  public async exportProject(path: string, destZip: string, sanitized?: boolean): Promise<ProjectExportResult> {
    return this.invoke<ProjectExportResult>('cmd_project_export', { path, destZip, sanitized });
  }

  public async importProject(sourceZip: string, destDir: string): Promise<ProjectImportResult> {
    return this.invoke<ProjectImportResult>('cmd_project_import', { sourceZip, destDir });
  }

  public async walCheckpoint(): Promise<WalStatusResult> {
    return this.invoke<WalStatusResult>('cmd_project_wal_checkpoint');
  }

  // Scope Engine Methods
  public async getScope(): Promise<ScopeResponse> {
    return this.invoke<ScopeResponse>('cmd_scope_get');
  }

  public async updateScope(includes: string[], excludes: string[], rules?: ScopeRuleDef[]): Promise<ScopeResponse> {
    return this.invoke<ScopeResponse>('cmd_scope_update', { includes, excludes, rules });
  }

  public async testScopeUri(uri: string): Promise<ScopeDecisionResponse> {
    return this.invoke<ScopeDecisionResponse>('cmd_test_scope_uri', { uri });
  }

  public async searchCommands(query: string): Promise<CommandSearchItem[]> {
    return this.invoke<CommandSearchItem[]>('cmd_productivity_search', { query });
  }

  // Phase UI-3 Traffic Methods
  public async getTrafficPage(query: TrafficPageQuery): Promise<TrafficPageResult> {
    return this.invoke<TrafficPageResult>('cmd_traffic_get_page', { query });
  }

  public async getTransactionDetails(id: string): Promise<TransactionDetails> {
    return this.invoke<TransactionDetails>('cmd_traffic_get_details', { id });
  }

  public async getRawBlob(sha256Hex: string, maxBytes?: number): Promise<RawBlobResult> {
    return this.invoke<RawBlobResult>('cmd_traffic_get_raw_blob', { sha256Hex, maxBytes });
  }

  public async clearTraffic(): Promise<TrafficClearResult> {
    return this.invoke<TrafficClearResult>('cmd_traffic_clear');
  }

  public async validateHttpql(query: string): Promise<HttpqlValidationResult> {
    return this.invoke<HttpqlValidationResult>('cmd_httpql_validate', { query });
  }

  public async diffTransactions(req: TrafficDiffRequest): Promise<TrafficDiffResult> {
    return this.invoke<TrafficDiffResult>('cmd_traffic_diff', { req });
  }

  // Phase UI-4 Repeater Methods
  public async createRepeaterTab(
    title?: string,
    targetUrl?: string,
    seedTransactionId?: string,
    initialRequest?: string
  ): Promise<RepeaterTabState> {
    return this.invoke<RepeaterTabState>('cmd_repeater_create_tab', {
      title,
      targetUrl,
      seedTransactionId,
      initialRequest,
    });
  }

  public async sendRepeaterRequest(payload: RepeaterSendRequestPayload): Promise<RepeaterExecutionResult> {
    return this.invoke<RepeaterExecutionResult>('cmd_repeater_send_request', { payload });
  }

  public async diffRepeaterRevisions(req: RepeaterDiffRequest): Promise<TrafficDiffResult> {
    return this.invoke<TrafficDiffResult>('cmd_repeater_diff', { req });
  }

  public async exportRepeaterCommand(payload: RepeaterExportPayload): Promise<string> {
    return this.invoke<string>('cmd_repeater_export_curl', { payload });
  }

  public async extractVariable(payload: VariableExtractPayload): Promise<string | null> {
    return this.invoke<string | null>('cmd_repeater_extract_variable', { payload });
  }

  public async launchSystemBrowser(targetUrl?: string, proxyPort?: number): Promise<string> {
    return this.invoke<string>('cmd_launch_system_browser', { targetUrl, proxyPort });
  }

  public async openHtmlInBrowser(htmlContent: string, baseUrl?: string, proxyPort?: number): Promise<string> {
    return this.invoke<string>('cmd_open_html_in_browser', { htmlContent, baseUrl, proxyPort });
  }

  // UCMA-X Methods
  public async ucmaxAnalyzeBoolean(params: {
    targetUrl: string;
    endpointPath: string;
    paramName: string;
    baselineBody: string;
    truePayload: string;
    trueBody: string;
    falsePayload: string;
    falseBody: string;
  }): Promise<{
    finding_id: string;
    title: string;
    state: string;
    confidence: number;
    primary_technique: string;
    reproduction_payloads: string[];
    is_causally_confirmed: boolean;
    content_hash: string;
  } | null> {
    return this.invoke('cmd_ucmax_analyze_boolean', params);
  }

  public async ucmaxPlanNextStep(params: {
    currentConfidence: number;
    executedStrategies: string[];
  }): Promise<{
    strategy: string;
    expected_info_gain: number;
    estimated_cost: number;
    reason: string;
  }> {
    return this.invoke('cmd_ucmax_plan_next_step', params);
  }

  // Wireshark & Npcap Native Forensics
  public async launchWireshark(filter?: string): Promise<string> {
    return this.invoke<string>('cmd_launch_wireshark', { filter });
  }

  public async checkPacketCaptureStatus(): Promise<{
    wireshark: boolean;
    tshark: boolean;
    npcap: boolean;
    wireshark_version: string;
    npcap_version: string;
    default_filter: string;
  }> {
    return this.invoke('cmd_check_packet_capture_status');
  }
}

export const ipcClient = SentinelIpcClient.getInstance();

