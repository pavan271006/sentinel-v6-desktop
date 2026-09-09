/**
 * Sentinel SQL X — Macro & State Replay Engine
 * 
 * Boundary 4 Solution: Complex Gated Business Logic (2FA, KYC, Multi-Step State)
 * 
 * In production enterprise applications, the most critical SQL injection vulnerabilities
 * are located behind stateful multi-step business logic gates:
 * e.g., Step 1: Login -> Step 2: 2FA OTP -> Step 3: Cart / Transaction State -> Step 4: Vulnerable Query Sink.
 * 
 * Stateless fuzzers hitting Step 4 directly receive 401 Unauthorized or 400 Invalid State.
 * 
 * MacroStateReplayEngine executes prerequisite steps sequentially, extracting dynamic
 * session cookies, CSRF nonces, and JWT tokens, solving deterministic test 2FA gates,
 * and presenting fully-authenticated state context to the injection sink.
 */

import { MacroWorkflowConfig, MacroWorkflowStep } from '../../../types/sqlScanner';
import { GhostNetwork, GhostHttpRequest, GhostHttpResponse } from '../stealth/GhostNetwork';

export interface StateContext {
  cookies: Record<string, string>;
  tokens: Record<string, string>;
  sessionHeaders: Record<string, string>;
}

export interface MacroExecutionResult {
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalResponse?: GhostHttpResponse;
  extractedContext: StateContext;
  error?: string;
}

export class MacroStateReplayEngine {
  private config: MacroWorkflowConfig;
  private network: GhostNetwork;
  private stateContext: StateContext = {
    cookies: {},
    tokens: {},
    sessionHeaders: {},
  };

  constructor(config: MacroWorkflowConfig, network: GhostNetwork) {
    this.config = config;
    this.network = network;
  }

  public getConfig(): MacroWorkflowConfig {
    return this.config;
  }

  /**
   * Parses an ingested HAR (HTTP Archive) JSON string into executable MacroWorkflowSteps.
   */
  public parseHarWorkflow(harJsonString: string): MacroWorkflowStep[] {
    try {
      const har = JSON.parse(harJsonString);
      const entries = har.log?.entries || [];
      const steps: MacroWorkflowStep[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const req = entry.request;
        const headers: Record<string, string> = {};

        if (req.headers) {
          for (const h of req.headers) {
            headers[h.name] = h.value;
          }
        }

        steps.push({
          id: `har_step_${i + 1}`,
          name: `HAR Step ${i + 1}: ${req.method} ${new URL(req.url).pathname}`,
          url: req.url,
          method: req.method,
          headers,
          body: req.postData?.text,
          isInjectionTarget: i === entries.length - 1, // Default last step as target
        });
      }

      return steps;
    } catch (err: any) {
      throw new Error(`Failed to parse HAR JSON: ${err.message}`);
    }
  }

  /**
   * Replays the macro workflow up to the target sink step, injecting the SQL payload
   * while dynamically carrying forward session cookies, CSRF tokens, and 2FA auth.
   */
  public async executeWorkflowWithPayload(
    steps: MacroWorkflowStep[],
    targetParamName: string,
    payload: string
  ): Promise<MacroExecutionResult> {
    this.resetState();

    let lastResponse: GhostHttpResponse | undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isTarget = step.isInjectionTarget ?? (i === steps.length - 1);

      // 1. Prepare request with accumulated session cookies and headers
      const req = this.prepareStepRequest(step, isTarget, targetParamName, payload);

      // 2. Handle 2FA Auth Gates if configured on this step
      if (step.authGates && step.authGates.length > 0) {
        this.applyAuthGates(req, step.authGates);
      }

      // 3. Dispatch HTTP request
      const response = await this.network.executeRequest(req);
      lastResponse = response;

      // 4. Extract cookies from response
      this.extractCookiesFromResponse(response);

      // 5. Extract dynamic tokens (CSRF, JWT, nonces)
      this.extractDynamicTokens(response, step);

      // If a non-target prerequisite step failed with client/server error, abort
      if (!isTarget && response.status >= 400 && response.status !== 404) {
        return {
          success: false,
          stepsCompleted: i + 1,
          totalSteps: steps.length,
          finalResponse: response,
          extractedContext: this.stateContext,
          error: `Prerequisite Step ${step.name} failed with HTTP ${response.status}`,
        };
      }
    }

    return {
      success: true,
      stepsCompleted: steps.length,
      totalSteps: steps.length,
      finalResponse: lastResponse,
      extractedContext: this.stateContext,
    };
  }

  /**
   * Builds the GhostHttpRequest for a given step, substituting dynamic tokens
   * and injecting the SQL payload if this is the designated target step.
   */
  private prepareStepRequest(
    step: MacroWorkflowStep,
    isTarget: boolean,
    targetParamName: string,
    payload: string
  ): GhostHttpRequest {
    const headers = { ...step.headers, ...this.stateContext.sessionHeaders };

    // Inject active cookies
    if (Object.keys(this.stateContext.cookies).length > 0) {
      const cookieStr = Object.entries(this.stateContext.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      headers['Cookie'] = cookieStr;
    }

    // Inject CSRF or Bearer token if present
    if (this.stateContext.tokens['csrf_token']) {
      headers['X-CSRF-Token'] = this.stateContext.tokens['csrf_token'];
    }
    if (this.stateContext.tokens['access_token']) {
      headers['Authorization'] = `Bearer ${this.stateContext.tokens['access_token']}`;
    }

    let body = step.body || '';
    let url = step.url;

    // Perform dynamic token substitution in body (e.g. {{csrf_token}})
    for (const [tokenName, tokenValue] of Object.entries(this.stateContext.tokens)) {
      body = body.split(`{{${tokenName}}}`).join(tokenValue);
      url = url.split(`{{${tokenName}}}`).join(encodeURIComponent(tokenValue));
    }

    // If this is the injection target, inject the SQL payload into the target parameter
    if (isTarget && targetParamName) {
      if (step.method.toUpperCase() === 'GET') {
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.set(targetParamName, payload);
        url = parsedUrl.toString();
      } else if (body) {
        // Try JSON body
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed === 'object' && targetParamName in parsed) {
            parsed[targetParamName] = payload;
            body = JSON.stringify(parsed);
          }
        } catch {
          // URL-encoded form body
          if (body.includes(`${targetParamName}=`)) {
            const regex = new RegExp(`(${encodeURIComponent(targetParamName)}=)([^&]*)`);
            body = body.replace(regex, `$1${encodeURIComponent(payload)}`);
          }
        }
      }
    }

    return {
      url,
      method: step.method,
      headers,
      body,
    };
  }

  /**
   * Applies deterministic 2FA / OTP credentials configured for authorized test environments.
   */
  private applyAuthGates(
    req: GhostHttpRequest,
    authGates: NonNullable<MacroWorkflowStep['authGates']>
  ): void {
    for (const gate of authGates) {
      if (gate.type === 'static_otp' || gate.type === 'totp') {
        if (req.body) {
          try {
            const parsed = JSON.parse(req.body);
            parsed[gate.paramName] = gate.secretOrToken;
            req.body = JSON.stringify(parsed);
          } catch {
            req.body += (req.body ? '&' : '') + `${encodeURIComponent(gate.paramName)}=${encodeURIComponent(gate.secretOrToken)}`;
          }
        }
      }
    }
  }

  /**
   * Extracts Set-Cookie headers into session state.
   */
  private extractCookiesFromResponse(res: GhostHttpResponse): void {
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'];
    if (!setCookie) return;

    const cookieLines = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const line of cookieLines) {
      const parts = line.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.stateContext.cookies[name] = value;
      }
    }
  }

  /**
   * Extracts CSRF tokens, JWT tokens, and custom nonces from response bodies and headers.
   */
  private extractDynamicTokens(res: GhostHttpResponse, step: MacroWorkflowStep): void {
    const body = res.body;

    // 1. Common CSRF token patterns in HTML
    const csrfMatches = [
      /name="csrf[-_]?token"\s+value="([^"]+)"/i,
      /name="_csrf"\s+value="([^"]+)"/i,
      /value="([^"]+)"\s+name="csrf[-_]?token"/i,
      /value="([^"]+)"\s+name="_csrf"/i,
      /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/i,
      /<meta[^>]*content="([^"]+)"[^>]*name="csrf-token"/i,
      /"csrfToken":\s*"([^"]+)"/i,
      /"csrf[-_]?token":\s*"([^"]+)"/i,
    ];

    for (const re of csrfMatches) {
      const m = body.match(re);
      if (m && m[1]) {
        this.stateContext.tokens['csrf_token'] = m[1];
        break;
      }
    }

    // 2. Common JSON JWT Auth responses
    if (res.headers['content-type']?.includes('json') || body.startsWith('{')) {
      try {
        const parsed = JSON.parse(body);
        if (parsed.token) this.stateContext.tokens['access_token'] = parsed.token;
        if (parsed.access_token) this.stateContext.tokens['access_token'] = parsed.access_token;
        if (parsed.csrfToken) this.stateContext.tokens['csrf_token'] = parsed.csrfToken;
      } catch {
        // Not valid JSON
      }
    }

    // 3. Step-specific token extractors
    if (step.extractTokens) {
      for (const rule of step.extractTokens) {
        if (rule.source === 'body_regex') {
          const m = body.match(new RegExp(rule.pattern));
          if (m && m[1]) {
            this.stateContext.tokens[rule.name] = m[1];
          }
        } else if (rule.source === 'header') {
          const val = res.headers[rule.pattern.toLowerCase()];
          if (val) this.stateContext.tokens[rule.name] = val;
        }
      }
    }
  }

  public getState(): StateContext {
    return {
      cookies: { ...this.stateContext.cookies },
      tokens: { ...this.stateContext.tokens },
      sessionHeaders: { ...this.stateContext.sessionHeaders },
    };
  }

  public resetState(): void {
    this.stateContext = {
      cookies: {},
      tokens: {},
      sessionHeaders: {},
    };
  }
}
