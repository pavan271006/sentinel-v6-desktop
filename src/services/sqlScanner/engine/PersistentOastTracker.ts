/**
 * Sentinel Autonomous SQL Engine — Persistent Asynchronous OAST Tracker & Webhook Telemetry
 *
 * Maintains long-lived OAST tokens for asynchronous/cron-driven second-order SQL injections,
 * and dispatches structured alerts via Discord, Slack, or generic webhooks upon interaction.
 */

export interface PersistentOastRecord {
  tokenId: string;
  fqdn: string;
  targetUrl: string;
  parameterName: string;
  payload: string;
  createdAt: number;
  triggeredAt?: number;
  clientIp?: string;
  interactionType?: 'DNS' | 'HTTP' | 'LDAP' | 'SMB';
  rawQuery?: string;
}

export class PersistentOastTracker {
  private static records: Map<string, PersistentOastRecord> = new Map();

  /**
   * Generates a persistent, cryptographically identifiable OAST token.
   */
  public static registerToken(
    targetUrl: string,
    parameterName: string,
    payload: string,
    oastDomain: string = 'oast.sentinel.local'
  ): { tokenId: string; fqdn: string } {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tokenId = `snt-${Date.now().toString(36)}-${randomSuffix}`;
    const fqdn = `${tokenId}.${oastDomain}`;

    const record: PersistentOastRecord = {
      tokenId,
      fqdn,
      targetUrl,
      parameterName,
      payload,
      createdAt: Date.now(),
    };

    PersistentOastTracker.records.set(tokenId, record);
    return { tokenId, fqdn };
  }

  /**
   * Correlates an incoming OAST interaction with its original injection context.
   */
  public static handleInteraction(
    tokenId: string,
    interactionType: 'DNS' | 'HTTP' | 'LDAP' | 'SMB',
    clientIp: string,
    rawQuery?: string
  ): PersistentOastRecord | null {
    const record = PersistentOastTracker.records.get(tokenId);
    if (!record) return null;

    record.triggeredAt = Date.now();
    record.interactionType = interactionType;
    record.clientIp = clientIp;
    record.rawQuery = rawQuery;

    return record;
  }

  /**
   * Formats a structured webhook payload for Slack / Discord / Custom webhooks.
   */
  public static formatWebhookPayload(record: PersistentOastRecord): {
    title: string;
    text: string;
    fields: { name: string; value: string; inline?: boolean }[];
  } {
    const latencyHours = record.triggeredAt
      ? ((record.triggeredAt - record.createdAt) / (1000 * 60 * 60)).toFixed(2)
      : '0';

    return {
      title: '🚨 Sentinel Asynchronous SQL Injection Alert (OAST Callback Confirmed)',
      text: `An asynchronous out-of-band callback was received for parameter \`${record.parameterName}\` on \`${record.targetUrl}\` after ${latencyHours} hour(s).`,
      fields: [
        { name: 'Target URL', value: record.targetUrl, inline: false },
        { name: 'Parameter', value: record.parameterName, inline: true },
        { name: 'Interaction Type', value: record.interactionType || 'DNS', inline: true },
        { name: 'Source Client IP', value: record.clientIp || 'Unknown', inline: true },
        { name: 'Injected Payload', value: `\`${record.payload}\``, inline: false },
        { name: 'OAST FQDN', value: `\`${record.fqdn}\``, inline: false },
      ],
    };
  }

  public static getRecord(tokenId: string): PersistentOastRecord | undefined {
    return PersistentOastTracker.records.get(tokenId);
  }

  public static getAllRecords(): PersistentOastRecord[] {
    return Array.from(PersistentOastTracker.records.values());
  }
}
