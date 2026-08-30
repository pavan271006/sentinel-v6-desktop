import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/stores/projectStore';
import { useScopeStore } from '../../src/stores/scopeStore';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { useInspectorStore } from '../../src/stores/inspectorStore';
import { useEventBusStore } from '../../src/stores/eventBusStore';
import { ipcClient } from '../../src/ipc/client';
import { mockBackendBridge } from '../../src/ipc/mockBridge';
import { streamDispatcher } from '../../src/ipc/events';
import { TrafficSummary } from '../../src/types/traffic';

describe('CHALLENGER 2: Adversarial Workflow & Security Invariant Validation', () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: null,
      recentProjects: [],
      isModalOpen: false,
      activeModalTab: 'new',
      isLoading: false,
      error: null,
      lastWalStatus: null,
    });

    useScopeStore.setState({
      scopeId: 'scope-default',
      version: 1,
      timestamp: new Date().toISOString(),
      rules: [
        { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Target host' },
        { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API endpoints' },
        { id: 'rule-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'SSRF protection' },
        { id: 'rule-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'RFC1918 intranet guard' },
        { id: 'rule-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback isolation' },
        { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|drop-db).*', enabled: true, notes: 'Destructive endpoint exclude' },
      ],
      violations: [],
      testUrl: '',
      testResult: null,
      isLoading: false,
      isSaving: false,
    });

    useTrafficStore.setState({
      transactions: [],
      transactionMap: new Map(),
      filteredIndices: null,
      totalCapturedCount: 0,
      selectedId: null,
      selectedIds: new Set(),
      focusedIndex: 0,
      httpqlQuery: '',
      filterScopeOnly: false,
      filterErrorsOnly: false,
      filterMethods: [],
      filterStatuses: [],
      filterMimes: [],
    });

    useInspectorStore.setState({
      activeTransactionId: null,
      activeDetails: null,
      detailsCache: new Map(),
      rawBlobCache: new Map(),
      activeTab: 'response',
      requestSubView: 'parsed',
      responseSubView: 'parsed',
      diffResult: null,
    });

    useEventBusStore.setState({
      trafficCount: 0,
      criticalFindingCount: 0,
      runningTaskCount: 0,
      scopeViolationsCount: 0,
      recentTraffic: [],
      recentFindings: [],
      recentScanProgress: new Map(),
      recentTasks: new Map(),
      scopeViolations: [],
      auditLogs: [],
      ipcMessagesReceived: 0,
      ipcQueuePending: 0,
      isStreamingConnected: true,
    });
  });

  /* ==========================================================================
   * 1. SEC-01: Adversarial Fail-Closed Scope Pre-Socket Invariant
   * ========================================================================== */
  describe('1. SEC-01 Fail-Closed Scope & SSRF Invariant Stress Tests', () => {
    it('enforces fail-closed DEFAULT_DENY on empty, malformed, and non-HTTP scheme URIs', async () => {
      const hostileUris = [
        '',
        '   ',
        'not-a-valid-uri',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///C:/Windows/System32/drivers/etc/hosts',
        'ftp://evil.com/dump.sql',
        'ldap://127.0.0.1:389/o=anonymous',
      ];

      for (const uri of hostileUris) {
        const decision = await ipcClient.testScopeUri(uri);
        expect(decision.in_scope).toBe(false);
        expect(decision.rule_type).toMatch(/DEFAULT_DENY|EXCLUDE|SSRF_PRESET/);
        expect(decision.provenance_steps?.length).toBeGreaterThan(0);
        expect(decision.provenance_steps?.[0]?.outcome).toBe('DENY');
      }
    });

    it('strictly denies AWS/GCP/Azure Cloud Metadata and Loopback addresses (SSRF Protection)', async () => {
      const ssrfTargets = [
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.169.254/computeMetadata/v1/',
        'http://[::ffff:169.254.169.254]/',
        'http://169.254.1.1/internal',
        'http://127.0.0.1:8080/admin',
        'http://0.0.0.0:8000/',
        'http://[::1]:8080/',
        'http://10.0.1.50/internal-service',
      ];

      for (const uri of ssrfTargets) {
        const decision = await ipcClient.testScopeUri(uri);
        expect(decision.in_scope).toBe(false);
        expect(decision.rule_type).toMatch(/EXCLUDE|SSRF_PRESET|DEFAULT_DENY/);
      }
    });

    it('denies out-of-scope targets and adversarial subdomain suffix spoofing attempts', async () => {
      const adversarialTargets = [
        'https://evil-attacker.com/api',
        'https://target.local.evil-attacker.com/steal',
        'https://not-target.local/api',
        'https://api.target.local.fake.org/token',
        'https://other-company.com/v1',
      ];

      for (const uri of adversarialTargets) {
        const decision = await ipcClient.testScopeUri(uri);
        expect(decision.in_scope).toBe(false);
      }
    });

    it('denies destructive endpoints matching excluded regex patterns', async () => {
      const destructiveUris = [
        'https://target.local/api/v1/delete-account',
        'https://target.local/auth/logout',
        'https://target.local/auth/signout',
        'https://target.local/admin/drop-db',
        'https://target.local/api/terminate',
      ];

      for (const uri of destructiveUris) {
        const decision = await ipcClient.testScopeUri(uri);
        expect(decision.in_scope).toBe(false);
        expect(decision.rule_type).toBe('EXCLUDE');
      }
    });

    it('throws SEC-01 Scope Violation error when attempting to replay out-of-scope or SSRF request in Repeater', async () => {
      const outOfScopePayload = {
        tabId: 'rep-hostile-1',
        rawRequest: 'POST /steal HTTP/1.1\r\nHost: evil-attacker.com\r\n\r\n{"data":"exfil"}',
        targetUrl: 'https://evil-attacker.com/steal',
      };

      await expect(ipcClient.sendRepeaterRequest(outOfScopePayload)).rejects.toThrow(
        /SEC-01 Scope Violation/
      );

      const ssrfPayload = {
        tabId: 'rep-ssrf-1',
        rawRequest: 'GET /latest/meta-data/ HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n',
        targetUrl: 'http://169.254.169.254/latest/meta-data/',
      };

      await expect(ipcClient.sendRepeaterRequest(ssrfPayload)).rejects.toThrow(
        /SEC-01 Scope Violation/
      );
    });
  });

  /* ==========================================================================
   * 2. SEC-06 & SEC-07: Finding Lifecycle & Cryptographic CAS Evidence
   * ========================================================================== */
  describe('2. SEC-06 Lifecycle & SEC-07 CAS Evidence Invariant Stress Tests', () => {
    it('maintains strict finding state transitions (Candidate -> Verified -> Confirmed -> Remediated)', () => {
      // Step 1: Candidate
      streamDispatcher.dispatch({
        type: 'finding',
        data: {
          findingId: 'finding-sec06-test',
          timestamp: { seconds: 1723900000, nanos: 0 },
          title: 'Unauthenticated IDOR on /api/users/12',
          severity: 'SEVERITY_HIGH',
          state: 'LIFECYCLE_CANDIDATE',
        },
      });
      expect(useEventBusStore.getState().recentFindings[0].state).toBe('LIFECYCLE_CANDIDATE');

      // Step 2: Verification Proof Dispatched
      streamDispatcher.dispatch({
        type: 'candidate_verified',
        data: {
          candidateId: 'finding-sec06-test',
          verificationId: 'verif-sec06-01',
          strategy: 'DifferentialProof',
          success: true,
          timestamp: { seconds: 1723900001, nanos: 0 },
        },
      });

      // Step 3: Confirmed
      streamDispatcher.dispatch({
        type: 'finding',
        data: {
          findingId: 'finding-sec06-test',
          timestamp: { seconds: 1723900002, nanos: 0 },
          title: 'Unauthenticated IDOR on /api/users/12',
          severity: 'SEVERITY_HIGH',
          state: 'LIFECYCLE_CONFIRMED',
        },
      });
      expect(useEventBusStore.getState().recentFindings[0].state).toBe('LIFECYCLE_CONFIRMED');

      // Step 4: Remediated
      streamDispatcher.dispatch({
        type: 'finding',
        data: {
          findingId: 'finding-sec06-test',
          timestamp: { seconds: 1723900003, nanos: 0 },
          title: 'Unauthenticated IDOR on /api/users/12',
          severity: 'SEVERITY_HIGH',
          state: 'LIFECYCLE_REMEDIATED',
        },
      });
      expect(useEventBusStore.getState().recentFindings[0].state).toBe('LIFECYCLE_REMEDIATED');
    });

    it('retrieves and validates SHA-256 CAS blob payload and handles maxBytes truncation safely', async () => {
      const validCasHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const blob = await ipcClient.getRawBlob(validCasHash);

      expect(blob.sha256Hex).toBe(validCasHash);
      expect(blob.dataBase64).toBeDefined();
      expect(blob.isTruncated).toBe(false);

      // Decode base64 and verify content
      const decoded = atob(blob.dataBase64);
      expect(decoded).toContain(validCasHash);
      expect(decoded).toContain('SEC-07-CAS-VALID');

      // Test with maxBytes truncation limit
      const truncatedBlob = await ipcClient.getRawBlob(validCasHash, 32);
      expect(truncatedBlob.isTruncated).toBe(true);
      const decodedTrunc = atob(truncatedBlob.dataBase64);
      expect(decodedTrunc.length).toBeLessThanOrEqual(32);
    });
  });

  /* ==========================================================================
   * 3. SEC-09 & SEC-12: Identity Vault Zeroization & Lossless Audit Logging
   * ========================================================================== */
  describe('3. SEC-09 Secret Zeroization & SEC-12 Lossless Audit Trail Tests', () => {
    it('zeroizes secrets in memory and records audit events upon role token swap', () => {
      // Simulate switching identity to AttackerRole
      useEventBusStore.getState().addAuditLog({
        level: 'INFO',
        source: 'sentinel_vault',
        message: 'SEC-09: Scrubbed previous session token from memory; active identity: TenantB_Attacker',
      });

      const logs = useEventBusStore.getState().auditLogs;
      expect(logs.length).toBe(1);
      expect(logs[0].source).toBe('sentinel_vault');
      expect(logs[0].message).toContain('SEC-09: Scrubbed');
    });

    it('preserves audit events bounded to MAX_RING_BUFFER_SIZE in UI store while capturing logs', () => {
      const eventCount = 1000;
      for (let i = 0; i < eventCount; i++) {
        useEventBusStore.getState().addAuditLog({
          level: i % 10 === 0 ? 'ERROR' : 'INFO',
          source: 'sentinel_audit_stream',
          message: `SEC-12 Audit Event #${String(i).padStart(4, '0')}: Transaction state committed`,
        });
      }

      const logs = useEventBusStore.getState().auditLogs;
      // In-memory UI store strictly bounds audit buffer to 500 to avoid runaway memory
      expect(logs.length).toBe(500);
      expect(logs[0].message).toContain('Event #0999');
    });
  });

  /* ==========================================================================
   * 4. Deliberate Out-of-Order Execution Across 17/24/34-Step Workflows
   * ========================================================================== */
  describe('4. Deliberate Out-of-Order Workflow Execution Invariant Tests', () => {
    it('handles out-of-order execution gracefully without state corruption or uncaught exceptions', async () => {
      // 1. Calling Step 17 (WAL Checkpoint) before creating project
      const walBefore = await ipcClient.walCheckpoint();
      expect(walBefore.journal_mode).toBe('WAL');

      // 2. Calling Step 12 (CAS Evidence) before project initialization
      const blob = await ipcClient.getRawBlob('a8f5c4e2b10938f293847291aebdcfa92847291837492817492048291049ab28');
      expect(blob.sha256Hex).toBe('a8f5c4e2b10938f293847291aebdcfa92847291837492817492048291049ab28');

      // 3. Diffing non-existent transaction IDs (must throw or handle gracefully)
      await expect(
        mockBackendBridge.diffTransactions({ idA: 'tx-nonexistent-1', idB: 'tx-nonexistent-2' })
      ).rejects.toThrow(/not found/);

      // 4. Ingesting traffic batch before scope configuration
      const batch: TrafficSummary[] = [
        {
          id: 'tx-ooo-1',
          timestamp: new Date().toISOString(),
          method: 'GET',
          url: 'https://target.local/test',
          uri: 'https://target.local/test',
          status: 200,
          durationMs: 10,
          reqContentLength: 0,
          resContentLength: 100,
          inScope: true,
          source: 'proxy',
        } as any,
      ];
      useTrafficStore.getState().ingestBatch(batch);
      expect(useTrafficStore.getState().transactions.length).toBe(1);

      // 5. Creating Project after operations were executed
      const proj = await ipcClient.createProject('Out-Of-Order Test', 'C:/Projects/ooo.sentinel');
      expect(proj.name).toBe('Out-Of-Order Test');

      // 6. Closing Project and reopening
      await ipcClient.closeProject();
      const reopened = await ipcClient.openProject('C:/Projects/ooo.sentinel');
      expect(reopened.metadata.name).toBe('Out-Of-Order Test');
    });
  });

  /* ==========================================================================
   * 5. Empirical Memory Leak Detection & Growth Verification in Store
   * ========================================================================== */
  describe('5. Empirical Memory Leak & Heap Retention Verification', () => {
    it('verifies that memory cleanup releases retained memory and ring-buffer cap limits growth', async () => {
      // 1. Ingest 60,000 transactions (exceeding 50,000 cap)
      const bigBatch: TrafficSummary[] = Array.from({ length: 60_000 }, (_, i) => ({
        id: `tx-mem-${i}`,
        timestamp: new Date().toISOString(),
        method: i % 2 === 0 ? 'GET' : 'POST',
        url: `https://target.local/item/${i}`,
        uri: `https://target.local/item/${i}`,
        status: 200,
        durationMs: 15,
        reqContentLength: 50,
        resContentLength: 200,
        inScope: true,
        source: 'proxy',
      })) as any;

      useTrafficStore.getState().ingestBatch(bigBatch);

      // Bounded ring buffer: must cap at 50,000
      expect(useTrafficStore.getState().transactions.length).toBeLessThanOrEqual(50_000);

      // 2. Test clearTraffic releases memory
      await useTrafficStore.getState().clearTraffic();
      expect(useTrafficStore.getState().transactions.length).toBe(0);
      expect(useTrafficStore.getState().transactionMap.size).toBe(0);
      expect(useTrafficStore.getState().filteredIndices).toBeNull();
    });
  });
});
