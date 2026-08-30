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
    const payload = `'||'${token}'||'`;

    // 1. Dispatch Source Injection Request
    const sourceInjected = RequestParser.injectPayload(sourceParsed, sourceParam, payload, true);
    const sourceRes = await sendRequestFn(sourceInjected.rawRequest, sourceInjected.targetUrl);

    // 2. Dispatch Sink Retrieval Request
    const sinkRaw = config.sinkRawRequest || sourceParsed.body ? sourceInjected.rawRequest : sourceParsed.body;
    const sinkUrl = config.sinkUrl || sourceParsed.url;
    const sinkRes = await sendRequestFn(sinkRaw, sinkUrl);

    // 3. Evaluate if canary or error is present in Sink response
    const canaryReflected = sinkRes.body.includes(token);
    const isVulnerable = canaryReflected;

    const evidence = isVulnerable
      ? `Second-order SQL injection confirmed: Injected token [${token}] in source parameter "${sourceParam.name}" was executed and rendered in sink response (${sinkUrl})`
      : 'No second-order state reflection detected in sink response';

    return {
      isVulnerable,
      canaryReflected,
      evidence,
      sourceRequest: sourceRes.rawRequest,
      sourceResponse: sourceRes.rawResponse,
      sinkRequest: sinkRes.rawRequest,
      sinkResponse: sinkRes.rawResponse,
    };
  }
}
