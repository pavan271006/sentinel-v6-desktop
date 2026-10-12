/**
 * Sentinel Sovereign Ω - IDOR & Hidden Endpoint Hunter
 *
 * Implements Level 6 Object Reference Auditing & LLM-Driven Hidden Endpoint Discovery:
 * 1. Automatic Parameter & Path Introspection: Identifies candidate numeric IDs, roll numbers,
 *    UUIDs, and object reference keys (e.g., student_id, user_id, reg_no, doc_id, cat_no).
 * 2. Non-Destructive Differential Probing: Tests neighbor IDs (ID +/- 1) and session peers
 *    using read-only requests, measuring content-length and structural variance against baseline.
 * 3. Groq LPU AI Prediction: Utilizes fast LPU inference to extrapolate hidden, unlinked,
 *    and framework-specific API routes (e.g., Laravel /admin/*, /api/v1/*, /ajax/*).
 * 4. Safe Verification: Validates discovered routes via non-destructive probes before logging.
 */

import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { groqService } from '../ai/GroqService';

export interface IdorFinding {
  originalUrl: string;
  probedUrl: string;
  paramName: string;
  originalValue: string;
  probedValue: string;
  status: number;
  lengthDiff: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export class IdorAndHiddenEndpointHunter {
  private auditedSignatures = new Set<string>();
  private probedHiddenEndpoints = new Set<string>();

  // Object reference parameter patterns
  private static readonly OBJECT_REF_PARAM_REGEX = /^(?:id|user_id|userid|student_id|studentid|reg_no|regno|roll_no|rollno|profile_id|doc_id|file_id|order_id|invoice_id|exam_id|cat_no|sem|semester|acc_id|account_id|uuid|ref|no|num)$/i;

  // Path segments that contain numeric identifiers (e.g. /students/1042/view, /marks/210421104001)
  private static readonly NUMERIC_PATH_SEGMENT_REGEX = /\/(\d{1,14})(?=\/|$|\?)/g;

  /**
   * Clears session cache between scans
   */
  public resetState(): void {
    this.auditedSignatures.clear();
    this.probedHiddenEndpoints.clear();
  }

  /**
   * 1. Inspects a discovered endpoint for IDOR potential and runs non-destructive differential probes
   */
  public async auditEndpointForIdor(
    item: SiteMapRequest,
    targetHost: string,
    discoveredIdentifiers: string[] = [],
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): Promise<IdorFinding | null> {
    if (!item.url || item.method !== 'GET') return null;

    try {
      const parsed = new URL(item.url.startsWith('http') ? item.url : `https://${targetHost}${item.url.startsWith('/') ? item.url : '/' + item.url}`);
      
      // 1a. Check Query Parameters for candidate IDOR keys
      for (const [key, value] of parsed.searchParams.entries()) {
        if (!IdorAndHiddenEndpointHunter.OBJECT_REF_PARAM_REGEX.test(key)) continue;

        const signature = `query:${parsed.pathname}:${key}:${value}`;
        if (this.auditedSignatures.has(signature)) continue;
        this.auditedSignatures.add(signature);

        // Generate neighbor probes
        const probes = this.generateProbeValues(value, discoveredIdentifiers);
        for (const probeVal of probes) {
          const testUrl = new URL(parsed.toString());
          testUrl.searchParams.set(key, probeVal);

          const finding = await this.executeDifferentialProbe(
            parsed.toString(),
            testUrl.toString(),
            key,
            value,
            probeVal,
            item,
            targetHost,
            onItemDiscovered
          );
          if (finding) return finding;
        }
      }

      // 1b. Check Path Segments for numeric IDs (e.g. /admin/student/210421104001/cat)
      const pathMatches = Array.from(parsed.pathname.matchAll(IdorAndHiddenEndpointHunter.NUMERIC_PATH_SEGMENT_REGEX));
      for (const match of pathMatches) {
        const origId = match[1];
        if (!origId || origId.length > 14) continue;

        const signature = `path:${parsed.pathname}:${origId}`;
        if (this.auditedSignatures.has(signature)) continue;
        this.auditedSignatures.add(signature);

        const probes = this.generateProbeValues(origId, discoveredIdentifiers);
        for (const probeVal of probes) {
          const newPath = parsed.pathname.replace(`/${origId}`, `/${probeVal}`);
          const testUrl = new URL(parsed.toString());
          testUrl.pathname = newPath;

          const finding = await this.executeDifferentialProbe(
            parsed.toString(),
            testUrl.toString(),
            'PathSegment',
            origId,
            probeVal,
            item,
            targetHost,
            onItemDiscovered
          );
          if (finding) return finding;
        }
      }
    } catch {}

    return null;
  }

  /**
   * Generates intelligent probe candidates (neighbor IDs + harvested session peers)
   */
  private generateProbeValues(currentVal: string, discoveredIdentifiers: string[]): string[] {
    const candidates: string[] = [];

    // If pure number: test +1 and -1
    if (/^\d+$/.test(currentVal)) {
      try {
        const num = BigInt(currentVal);
        candidates.push((num + 1n).toString());
        if (num > 1n) {
          candidates.push((num - 1n).toString());
        }
      } catch {}
    }

    // Add peer identifiers from the active session if different
    for (const peer of discoveredIdentifiers) {
      if (peer !== currentVal && peer.length > 2 && !candidates.includes(peer)) {
        candidates.push(peer);
        if (candidates.length >= 3) break;
      }
    }

    return candidates.slice(0, 2); // Max 2 safe read-only probes per parameter
  }

  /**
   * Executes a safe GET probe through fetch with credentials
   */
  private async executeDifferentialProbe(
    origUrl: string,
    probeUrl: string,
    paramName: string,
    origVal: string,
    probeVal: string,
    baseItem: SiteMapRequest,
    _targetHost: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): Promise<IdorFinding | null> {
    try {
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        signal: AbortSignal.timeout(3500),
      });

      // 200 OK with data indicates potential object reference access
      if (res.status === 200) {
        const text = await res.text();
        const lengthDiff = Math.abs(text.length - (baseItem.length || 0));

        // Ensure it's not a generic error/login page
        const isLogin = text.includes('name="password"') || text.includes('/login') || text.includes('Please sign in');
        if (!isLogin && text.length > 200) {
          const finding: IdorFinding = {
            originalUrl: origUrl,
            probedUrl: probeUrl,
            paramName,
            originalValue: origVal,
            probedValue: probeVal,
            status: res.status,
            lengthDiff,
            severity: 'HIGH',
            description: `Potential IDOR: Modified parameter "${paramName}" from "${origVal}" to "${probeVal}" returned HTTP 200 OK (${text.length} bytes)`,
          };

          // Register in SiteMap as an IDOR-audited endpoint
          const u = new URL(probeUrl);
          const sitemapItem: SiteMapRequest = {
            id: `idor-${paramName}-${probeVal}`,
            host: u.host,
            method: 'GET',
            url: u.pathname + u.search,
            path: u.pathname + u.search,
            params: true,
            status: 200,
            length: text.length,
            mime: text.startsWith('{') ? 'JSON' : 'HTML',
            title: `[IDOR CANDIDATE] ${paramName}=${probeVal}`,
            notes: `IDOR Auditing: Parameter "${paramName}" varied from ${origVal} -> ${probeVal}. Status 200 OK.`,
            requestRaw: `GET ${u.pathname + u.search} HTTP/1.1\r\nHost: ${u.host}\r\n`,
            responseRaw: `HTTP/1.1 200 OK\r\nContent-Length: ${text.length}\r\n\r\n${text.slice(0, 500)}`,
            reqAttributes: { Method: 'GET', Path: u.pathname, Param: paramName },
            reqHeaders: { Host: u.host },
            resAttributes: { Status: '200', Finding: 'IDOR_CANDIDATE' },
            resHeaders: {},
            isDiscovered: true,
          };

          if (onItemDiscovered) {
            onItemDiscovered(sitemapItem);
          }

          return finding;
        }
      }
    } catch {}

    return null;
  }

  /**
   * 2. Uses Groq LPU AI to predict unlinked & hidden API routes based on framework context
   */
  public async predictHiddenEndpointsWithGroq(
    targetHost: string,
    discoveredPaths: string[],
    onEndpointDiscovered?: (item: SiteMapRequest) => void
  ): Promise<string[]> {
    if (!groqService.isEnabled() || discoveredPaths.length === 0) return [];

    try {
      const samplePaths = discoveredPaths.slice(0, 25);
      const systemPrompt = `You are a web application architecture and reconnaissance expert.
Analyze the provided sample of discovered endpoints from a target web portal (e.g. Laravel, PHP, or SPA portal).
Infer the internal naming conventions and output a valid JSON object with a single key "predictedRoutes" containing an array of 12-18 highly probable, unlinked, hidden API endpoints, administrative routes, or export routes that likely exist on this portal.
Rules:
1. Output ONLY a valid JSON object: {"predictedRoutes": ["/path1", "/path2"]}.
2. Focus on: student/admin views, mark exports, fee receipts, timetable queries, ajax lookups, user profiles, report downloads.
3. Use paths starting with "/" relative to the host.`;

      const userPrompt = `Target Host: ${targetHost}
Discovered Paths:
${samplePaths.map(p => `- ${p}`).join('\n')}`;

      const jsonStr = await groqService.chatCompletion(userPrompt, systemPrompt);
      if (!jsonStr) return [];

      let parsed: { predictedRoutes?: string[] } = {};
      try {
        const clean = jsonStr.slice(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1);
        parsed = JSON.parse(clean);
      } catch {
        return [];
      }

      const predicted = parsed.predictedRoutes || [];
      const verifiedPaths: string[] = [];

      // Probe predicted endpoints safely with lightweight GET/HEAD requests
      for (const p of predicted) {
        if (!p || typeof p !== 'string' || !p.startsWith('/') || this.probedHiddenEndpoints.has(p)) continue;
        this.probedHiddenEndpoints.add(p);

        try {
          const testUrl = `https://${targetHost}${p}`;
          const res = await fetch(testUrl, {
            method: 'GET',
            credentials: 'include',
            signal: AbortSignal.timeout(2500),
          });

          // If status is 200, 302 (internal redirect), or 403 (exists but needs permission), it's a real endpoint!
          if (res.status === 200 || res.status === 302 || res.status === 403) {
            verifiedPaths.push(p);

            if (onEndpointDiscovered) {
              const item: SiteMapRequest = {
                id: `groq-predicted-${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
                host: targetHost,
                method: 'GET',
                url: p,
                path: p,
                params: p.includes('?'),
                status: res.status,
                length: 0,
                mime: 'HTML',
                title: `[AI Predicted Endpoint] ${p}`,
                notes: `Predicted via Groq LPU AI from portal architecture patterns. Status: ${res.status}`,
                requestRaw: `GET ${p} HTTP/1.1\r\nHost: ${targetHost}\r\n`,
                responseRaw: `HTTP/1.1 ${res.status} OK\r\n`,
                reqAttributes: { Method: 'GET', Path: p, Source: 'Groq-AI-Predictor' },
                reqHeaders: { Host: targetHost },
                resAttributes: { Status: String(res.status), Source: 'Groq-AI-Predictor' },
                resHeaders: {},
                isDiscovered: true,
              };
              onEndpointDiscovered(item);
            }
          }
        } catch {}
      }

      return verifiedPaths;
    } catch (err) {
      console.warn('[IdorAndHiddenEndpointHunter] Groq prediction error:', err);
      return [];
    }
  }
}

export const idorAndHiddenEndpointHunter = new IdorAndHiddenEndpointHunter();
