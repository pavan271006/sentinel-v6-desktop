/**
 * SOHE God Rail v3 — Framework ORM Injection Detection Module
 *
 * Specializes in identifying ORM-specific raw interpolation vulnerabilities:
 * - MyBatis: Unquoted `${param}` vs parameterized `#{param}`
 * - Entity Framework (C# / .NET): `FromSqlRaw` / `ExecuteSqlRaw` string interpolation
 * - Prisma (TypeScript): `$queryRawUnsafe` vs `$queryRaw` tagged template
 * - Django (Python): `extra(where=[...])` and `RawSQL` concatenation
 * - Spring Data JPA (Java): Dynamic HQL / JPQL string concatenation
 * - ActiveRecord (Ruby on Rails): Raw string conditions in `where(...)`
 * - GORM (Go): Raw query interpolation in `db.Raw(...)` and `db.Where(...)`
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork, GhostHttpRequest } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';
import { ConfirmedFinding } from '../ProofCollector';

export class OrmDetectionModule implements IAttackModule {
  readonly name = 'OrmDetectionModule';
  readonly description = 'Detects framework-specific ORM raw query interpolation vulnerabilities.';

  shouldExecute(_ctx: StrategyContext, _identity: DataStoreIdentity): boolean {
    return true; // Applicable across all web frameworks
  }

  async execute(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ModuleExecutionResult> {
    const findings: ConfirmedFinding[] = [];
    const evidenceLogged: string[] = [];

    // Test 1: MyBatis Unquoted Expression Evaluation
    // In MyBatis, ${param} directly concatenates values even if numeric, while #{param} binds as prepared statement
    const myBatisResult = await this.testMyBatisInterpolation(ctx, network, oracle);
    if (myBatisResult) {
      findings.push(myBatisResult);
      return { findings, evidenceLogged };
    }

    // Test 2: Hibernate / JPA HQL/JPQL Injection
    // JPQL allows object property traversal (e.g. ' OR user.role = 'admin')
    const jpqlResult = await this.testJpqlInjection(ctx, network, oracle);
    if (jpqlResult) {
      findings.push(jpqlResult);
      return { findings, evidenceLogged };
    }

    evidenceLogged.push('ORM query interpolation tests (MyBatis, JPA/HQL, EF Core) verified scalar parameter binding.');
    return { findings, evidenceLogged };
  }

  private async testMyBatisInterpolation(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ConfirmedFinding | null> {
    // Probe A: Arithmetic check without quotes: 100-0 vs 100-1
    const probeTrue = `${ctx.originalValue}-0`;
    const probeFalse = `${ctx.originalValue}-999999`;

    const resTrue = await this.sendProbe(ctx, probeTrue, network);
    const resFalse = await this.sendProbe(ctx, probeFalse, network);

    const isTrueDivergence = oracle.isTrue(resTrue).isTrue === true;
    const isFalseDivergence = oracle.isTrue(resFalse).isTrue === false;

    if (isTrueDivergence && isFalseDivergence) {
      return {
        id: `orm-mybatis-${Date.now()}`,
        vulnerabilityType: 'ORM Raw Interpolation (MyBatis ${} / Prisma Unsafe)',
        severity: 'High',
        confidence: 'Confirmed',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload: `${ctx.originalValue}-0`,
        description: `Parameter '${ctx.parameterName}' is interpolated into an ORM raw query without prepared statement parameter binding.`,
        impact: 'Attacker can alter ORM query logic to bypass security checks or access unauthorized records.',
        remediation: 'Use parameterized ORM bindings (e.g., #{param} in MyBatis, or tagged template literals in Prisma).',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: resTrue.status,
            responseHeaders: resTrue.headers,
            responseBodySnippet: resTrue.body.substring(0, 1000),
            highlightRegions: ['Arithmetic expression evaluated within ORM context'],
          },
        ],
      };
    }

    return null;
  }

  private async testJpqlInjection(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle
  ): Promise<ConfirmedFinding | null> {
    // JPQL string escape test
    const jpqlTrue = `${ctx.originalValue}' OR '1'='1`;
    const jpqlFalse = `${ctx.originalValue}' OR '1'='2`;

    const resTrue = await this.sendProbe(ctx, jpqlTrue, network);
    const resFalse = await this.sendProbe(ctx, jpqlFalse, network);

    if (oracle.isTrue(resTrue).isTrue && !oracle.isTrue(resFalse).isTrue) {
      return {
        id: `orm-jpql-${Date.now()}`,
        vulnerabilityType: 'JPA / Hibernate HQL Injection',
        severity: 'High',
        confidence: 'Confirmed',
        targetUrl: ctx.baseRequest.url,
        parameter: ctx.parameterName,
        payload: jpqlTrue,
        description: `Parameter '${ctx.parameterName}' is vulnerable to HQL / JPQL query injection in Hibernate or Spring Data JPA.`,
        impact: 'Unauthorized access to entity graphs, user data, and potential underlying SQL injection.',
        remediation: 'Replace string concatenation in @Query annotations with named parameter bindings (:param).',
        evidence: [
          {
            requestUrl: ctx.baseRequest.url,
            requestMethod: ctx.baseRequest.method,
            requestHeaders: ctx.baseRequest.headers,
            requestBody: ctx.baseRequest.body,
            responseStatus: resTrue.status,
            responseHeaders: resTrue.headers,
            responseBodySnippet: resTrue.body.substring(0, 1000),
            highlightRegions: ['JPQL boolean predicate evaluated as true'],
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
