/**
 * SOHE God Rail v3 — Attack Module Registry
 *
 * Central registry and dispatcher for all extended modules:
 * 1. NoSqlModule (MongoDB operator injection, SSJS)
 * 2. GraphQueryModule (Cypher/Neo4j graph injection)
 * 3. OrmDetectionModule (MyBatis, Prisma, EF Core, JPA)
 * 4. IdentifierInjectionModule (ORDER BY, GROUP BY, dynamic columns)
 * 5. CloudSsrfModule (pg_net, aws_s3, UTL_HTTP database outbound extensions)
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { NoSqlModule } from './NoSqlModule';
import { GraphQueryModule } from './GraphQueryModule';
import { OrmDetectionModule } from './OrmDetectionModule';
import { IdentifierInjectionModule } from './IdentifierInjectionModule';
import { CloudSsrfModule } from './CloudSsrfModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';
import { ConfirmedFinding } from '../ProofCollector';

export class ModuleRegistry {
  private static readonly MODULES: IAttackModule[] = [
    new NoSqlModule(),
    new GraphQueryModule(),
    new OrmDetectionModule(),
    new IdentifierInjectionModule(),
    new CloudSsrfModule(),
  ];

  /**
   * Dispatches all applicable extended modules against the target parameter.
   */
  public static async executeAll(
    ctx: StrategyContext,
    network: GhostNetwork,
    oracle: AdaptiveResponseOracle,
    identity: DataStoreIdentity
  ): Promise<ModuleExecutionResult> {
    const combinedFindings: ConfirmedFinding[] = [];
    const combinedEvidence: string[] = [];

    for (const mod of this.MODULES) {
      if (mod.shouldExecute(ctx, identity)) {
        try {
          const res = await mod.execute(ctx, network, oracle);
          combinedFindings.push(...res.findings);
          combinedEvidence.push(...res.evidenceLogged);
        } catch {
          // Individual module failure should never halt the audit
        }
      }
    }

    return {
      findings: combinedFindings,
      evidenceLogged: combinedEvidence,
    };
  }

  public static getRegisteredModules(): string[] {
    return this.MODULES.map((m) => m.name);
  }
}
