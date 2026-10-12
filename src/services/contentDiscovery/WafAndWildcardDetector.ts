/**
 * Sentinel V6 - WAF Challenge & Wildcard Soft-404 Detection Engine
 *
 * Eliminates false positives by identifying:
 * 1. Cloudflare Turnstile, Cloudflare RayID, AWS WAF, Akamai & Bot Verification Challenge Pages
 * 2. Catch-all / Wildcard / Soft-404 responses (e.g., servers returning 200 OK on non-existent paths)
 * 3. Natural response size jitter and dynamic nonce token variance
 */

import { ipcClient } from '../../ipc/client';

export interface CalibrationResult {
  isWafProtected: boolean;
  wafType?: string;
  wildcardStatus: number;
  wildcardLength: number;
  wildcardJitter: number;
  wildcardTitle: string;
  isCatchAll: boolean;
}

// ─── Known WAF & Bot Verification Signatures ───
const WAF_BODY_PATTERNS = [
  /Please wait while your request is being verified/i,
  /cf-turnstile/i,
  /cf-browser-verification/i,
  /checking your browser/i,
  /attention required.*cloudflare/i,
  /Just a moment\.\.\./i,
  /challenges\.cloudflare\.com/i,
  /challenge-platform/i,
  /<div id="challenge-running">/i,
  /Ray ID:\s*<strong/i,
  /x-amzn-waf/i,
  /awswaf/i,
  /akamai ghost/i,
  /incapsula_resource/i,
  /ddos-guard/i,
  /shieldsquare/i,
  /datadome/i,
];

/**
 * Checks if a response body is a WAF / Bot Verification challenge page
 */
export function isWafChallenge(body: string): { isWaf: boolean; reason?: string } {
  if (!body || typeof body !== 'string') return { isWaf: false };

  for (const pattern of WAF_BODY_PATTERNS) {
    if (pattern.test(body)) {
      let reason = 'Cloudflare / WAF Bot Challenge';
      if (/cloudflare|cf-turnstile/i.test(pattern.source)) reason = 'Cloudflare Verification Challenge';
      else if (/awswaf|x-amzn/i.test(pattern.source)) reason = 'AWS WAF Challenge';
      else if (/akamai/i.test(pattern.source)) reason = 'Akamai Bot Protection';
      return { isWaf: true, reason };
    }
  }

  return { isWaf: false };
}

/**
 * Calibrates the target host by sending two random non-existent canary probes.
 * Detects if the server returns soft-404 (e.g. 200 OK on invalid URLs) or a WAF challenge.
 */
export async function calibrateHost(targetHost: string, authHeaders?: Record<string, string>): Promise<CalibrationResult> {
  const canary1 = `/sentinel_canary_404_${Math.random().toString(36).substring(2, 10)}`;
  const canary2 = `/sentinel_canary_404_${Math.random().toString(36).substring(2, 10)}`;

  let status1 = 404, len1 = 0, body1 = '', title1 = '';
  let status2 = 404, len2 = 0, body2 = '';

  let authHeaderLines = '';
  if (authHeaders) {
    for (const [k, v] of Object.entries(authHeaders)) {
      if (v) authHeaderLines += `${k}: ${v}\r\n`;
    }
  }

  const sendCanary = async (subpath: string) => {
    const rawReq = `GET ${subpath} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 Calibration\r\nAccept: text/html,*/*\r\n${authHeaderLines}Connection: close\r\n\r\n`;
    try {
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `calib-${Date.now()}`,
        targetUrl: `https://${targetHost}${subpath}`,
        rawRequest: rawReq,
      });
      const body = res?.body || res?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
      const status = res?.statusCode || 404;
      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      return { status, length: res?.sizeBytes || body.length, body, title };
    } catch {
      return { status: 404, length: 0, body: '', title: '' };
    }
  };

  const [res1, res2] = await Promise.all([sendCanary(canary1), sendCanary(canary2)]);
  status1 = res1.status;
  len1 = res1.length;
  body1 = res1.body;
  title1 = res1.title;

  status2 = res2.status;
  len2 = res2.length;
  body2 = res2.body;

  // Check for WAF Challenge
  const wafCheck1 = isWafChallenge(body1);
  const wafCheck2 = isWafChallenge(body2);
  const isWafProtected = wafCheck1.isWaf || wafCheck2.isWaf;
  const wafType = wafCheck1.reason || wafCheck2.reason;

  // Measure natural dynamic jitter (e.g., dynamic RayIDs or timestamps)
  const wildcardJitter = Math.abs(len1 - len2);
  const wildcardLength = Math.round((len1 + len2) / 2);
  const isCatchAll = (status1 === 200 && status2 === 200) || isWafProtected;

  return {
    isWafProtected,
    wafType,
    wildcardStatus: status1,
    wildcardLength,
    wildcardJitter,
    wildcardTitle: title1,
    isCatchAll,
  };
}

/**
 * Determines if a probe response is a false positive (either soft-404, WAF challenge, or 404)
 */
export function isResponseFalsePositive(
  status: number,
  body: string,
  length: number,
  calibration?: CalibrationResult
): { isFalsePositive: boolean; reason?: string } {
  // 1. True 404 is never a valid discovered endpoint
  if (status === 404) {
    return { isFalsePositive: true, reason: '404 Not Found' };
  }

  // 2. Direct WAF challenge detection
  const waf = isWafChallenge(body);
  if (waf.isWaf) {
    return { isFalsePositive: true, reason: waf.reason };
  }

  // 3. Catch-all / Wildcard Soft-404 Calibration Check
  if (calibration && calibration.isCatchAll) {
    if (status === calibration.wildcardStatus) {
      const allowedDelta = Math.max(80, calibration.wildcardJitter * 2 + 30);
      const lengthDelta = Math.abs(length - calibration.wildcardLength);

      if (lengthDelta <= allowedDelta) {
        return {
          isFalsePositive: true,
          reason: `Wildcard Soft-${status} (matches non-existent canary page size: ${calibration.wildcardLength} ± ${allowedDelta}B)`,
        };
      }

      if (calibration.wildcardTitle && body.includes(calibration.wildcardTitle)) {
        return {
          isFalsePositive: true,
          reason: `Wildcard Soft-${status} (matches non-existent canary title: "${calibration.wildcardTitle}")`,
        };
      }
    }
  }

  return { isFalsePositive: false };
}
