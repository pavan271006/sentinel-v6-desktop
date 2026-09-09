/**
 * SOHE God Rail v3 — Plugin Interface
 *
 * Defines the contract for all extended attack modules (NoSQL, Graph, Cloud, etc.).
 * Allows the God Rail architecture to easily expand beyond traditional SQL.
 */

import { StrategyContext } from '../engine/StrategyPlanner';
import { ConfirmedFinding } from '../ProofCollector';
import { GhostNetwork } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';

export interface ModuleExecutionResult {
    findings: ConfirmedFinding[];
    evidenceLogged: string[]; // For negative safety certificates
    dataStoreHints?: Partial<DataStoreIdentity>; // If module discovered DB info
}

export interface IAttackModule {
    /**
     * Unique name of the module.
     */
    readonly name: string;

    /**
     * Brief description of what this module attacks.
     */
    readonly description: string;

    /**
     * Determines if this module should run against the current target.
     * e.g., CloudSSRF module might only run if target is known to be in AWS/GCP.
     * @param ctx The injection context
     * @param identity Known datastore identity (if any)
     */
    shouldExecute(ctx: StrategyContext, identity: DataStoreIdentity): boolean;

    /**
     * Executes the module's specific attack payloads and analyzes responses.
     * @param ctx The injection context (base request + param to attack)
     * @param network The GhostNetwork instance to send requests
     * @param oracle The Oracle to judge Boolean/Time differences
     */
    execute(
        ctx: StrategyContext, 
        network: GhostNetwork, 
        oracle: AdaptiveResponseOracle
    ): Promise<ModuleExecutionResult>;
}
