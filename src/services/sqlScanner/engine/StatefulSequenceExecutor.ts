/**
 * Sentinel Stateful Sequence & Business Workflow Runner
 *
 * Solves multi-step state machine enforcement by:
 * 1. Defining ordered workflow chains (e.g. Step 1: Cart -> Step 2: Shipping -> Step 3: Checkout -> Step 4: Confirm).
 * 2. Extracting response variables (cart_id, session_nonce, order_token) from intermediate steps.
 * 3. Chaining state variables into downstream requests so state-gated endpoints can be tested.
 */

import { ipcClient } from '../../../ipc/client';

export interface WorkflowStep {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  extractVariables?: { variableName: string; regex: string }[];
  expectedStatusCode?: number;
}

export interface WorkflowSequence {
  id: string;
  title: string;
  steps: WorkflowStep[];
}

export class StatefulSequenceExecutor {
  /**
   * Executes a multi-step sequence against the target host, chaining state variables between steps.
   */
  public static async executeSequence(
    origin: string,
    host: string,
    sequence: WorkflowSequence,
    baseHeaders: Record<string, string> = {}
  ): Promise<{ success: boolean; extractedVariables: Record<string, string>; lastStatusCode?: number; error?: string }> {
    const state: Record<string, string> = {};

    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i];
      let path = step.path;
      let body = step.body || '';

      for (const [k, v] of Object.entries(state)) {
        path = path.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, 'g'), v);
        body = body.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, 'g'), v);
      }

      const headers = { ...baseHeaders, ...(step.headers || {}) };
      if (body) {
        headers['Content-Length'] = `${body.length}`;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = body.trim().startsWith('{') ? 'application/json' : 'application/x-www-form-urlencoded';
        }
      }

      const rawRequest =
        `${step.method} ${path} HTTP/1.1\r\nHost: ${host}\r\n` +
        Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        `\r\n\r\n${body}`;

      try {
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `seq-${sequence.id}-${i}`,
          targetUrl: `${origin}${path}`,
          rawRequest,
        });

        if (!res || (step.expectedStatusCode && res.statusCode !== step.expectedStatusCode && (res.statusCode ?? 0) >= 400)) {
          return {
            success: false,
            extractedVariables: state,
            lastStatusCode: res?.statusCode,
            error: `Step "${step.name}" failed with status ${res?.statusCode || 'null'}`,
          };
        }

        if (step.extractVariables && res.body) {
          for (const ev of step.extractVariables) {
            const rx = new RegExp(ev.regex, 'i');
            const match = res.body.match(rx);
            if (match && match[1]) {
              state[ev.variableName] = match[1];
            }
          }
        }
      } catch (err: any) {
        return { success: false, extractedVariables: state, error: err?.message || 'Sequence execution error' };
      }
    }

    return { success: true, extractedVariables: state };
  }
}
