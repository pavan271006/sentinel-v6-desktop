/**
 * Sentinel GraphQL Persisted Query & Hash Harvester
 *
 * Solves persisted GraphQL query gateways by:
 * 1. Mining client JS bundles for Apollo Automatic Persisted Queries (APQ) and Relay SHA256 hashes.
 * 2. Extracting operation names, variable signatures, and query IDs.
 * 3. Formatting valid persisted query request bodies for fuzz testing.
 */

export interface PersistedQueryMeta {
  operationName: string;
  sha256Hash: string;
  variables?: Record<string, any>;
}

export class PersistedQueryExtractor {
  public static extractPersistedQueriesFromJs(jsContent: string): PersistedQueryMeta[] {
    const queries: PersistedQueryMeta[] = [];
    if (!jsContent || jsContent.length < 20) return queries;

    const apqRegex = /["']?sha256Hash["']?\s*:\s*["']([a-f0-9]{64})["']/gi;
    let match: RegExpExecArray | null;

    while ((match = apqRegex.exec(jsContent)) !== null) {
      const hash = match[1];
      const nearbyWindow = jsContent.substring(Math.max(0, match.index - 120), Math.min(jsContent.length, match.index + 120));
      const opMatch = nearbyWindow.match(/["']?operationName["']?\s*:\s*["']([a-zA-Z0-9_]+)["']/i);
      const opName = opMatch ? opMatch[1] : `Query_${hash.substring(0, 8)}`;

      queries.push({
        operationName: opName,
        sha256Hash: hash,
        variables: { id: 1, filter: 'admin' },
      });
    }

    const relayRegex = /["']id["']\s*:\s*["']([a-f0-9]{32,64})["']\s*,\s*["']name["']\s*:\s*["']([a-zA-Z0-9_]+)["']/gi;
    while ((match = relayRegex.exec(jsContent)) !== null) {
      queries.push({
        operationName: match[2],
        sha256Hash: match[1],
        variables: { id: 1 },
      });
    }

    return queries;
  }

  public static formatPersistedQueryBody(
    meta: PersistedQueryMeta,
    variablesOverride?: Record<string, any>
  ): string {
    return JSON.stringify({
      operationName: meta.operationName,
      variables: variablesOverride || meta.variables || {},
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: meta.sha256Hash,
        },
      },
    });
  }
}
