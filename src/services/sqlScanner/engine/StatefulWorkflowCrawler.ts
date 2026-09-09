/**
 * SOHE God Rail v3 — Stateful Workflow Crawler
 *
 * Implements Multi-Step Second-Order Attack Graph Orchestration.
 *
 * Real-world enterprise applications often ingest input in one request (Store Step)
 * and evaluate or display it in a completely separate, asynchronous request (Trigger Step),
 * such as:
 * - Step 1: User Registration / Profile Update (Store)
 * - Step 2: Admin Dashboard / User Audit Logs (Trigger)
 * - Step 3: Report / Invoice PDF Generation (Trigger)
 *
 * This crawler maintains session context across multi-step user journeys,
 * deposits uniquely tagged canary payloads at Store endpoints, crawls related
 * Trigger endpoints, and correlates delayed or second-order executions.
 */

import { GhostNetwork, GhostHttpRequest, GhostHttpResponse } from '../stealth/GhostNetwork';
import { DataStoreFingerprinter } from '../DataStoreFingerprinter';
import { WireCapture } from '../ProofCollector';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'store' | 'trigger';
  request: GhostHttpRequest;
  canaryParam?: string;
  canaryToken?: string;
}

export interface SecondOrderCorrelationFinding {
  storeStepId: string;
  triggerStepId: string;
  canaryToken: string;
  injectionConfirmed: boolean;
  dbmsErrorTriggered?: string;
  evidence: WireCapture[];
}

export class StatefulWorkflowCrawler {
  private network: GhostNetwork;
  private activeSteps: WorkflowStep[] = [];

  constructor(network: GhostNetwork) {
    this.network = network;
  }

  /**
   * Registers a store-and-trigger multi-step workflow.
   */
  public registerWorkflow(steps: WorkflowStep[]): void {
    this.activeSteps = steps;
  }

  /**
   * Executes the registered workflow sequentially, tracking canary flow from Store to Trigger.
   */
  public async executeWorkflow(): Promise<SecondOrderCorrelationFinding[]> {
    const findings: SecondOrderCorrelationFinding[] = [];
    const storeResponses: Map<string, GhostHttpResponse> = new Map();

    // 1. Execute all Store Steps
    const storeSteps = this.activeSteps.filter((s) => s.type === 'store');
    for (const step of storeSteps) {
      const canary = `snl_so_${Math.random().toString(36).substring(2, 8)}`;
      step.canaryToken = canary;

      // Inject canary into designated parameter if present
      if (step.canaryParam) {
        this.injectCanaryIntoRequest(step.request, step.canaryParam, canary);
      }

      const res = await this.network.executeRequest(step.request);
      storeResponses.set(step.id, res);
    }

    // 2. Execute all Trigger Steps and monitor for canary or database error reflection
    const triggerSteps = this.activeSteps.filter((s) => s.type === 'trigger');
    for (const trig of triggerSteps) {
      const res = await this.network.executeRequest(trig.request);

      for (const store of storeSteps) {
        if (!store.canaryToken) continue;

        // Check if canary caused a database error on the trigger page
        const hasDbError = DataStoreFingerprinter.containsDbError(res.body);
        const containsCanary = res.body.includes(store.canaryToken);

        if (hasDbError || containsCanary) {
          const storeRes = storeResponses.get(store.id);
          const evidence: WireCapture[] = [];

          if (storeRes) {
            evidence.push({
              requestUrl: store.request.url,
              requestMethod: store.request.method,
              requestHeaders: store.request.headers,
              requestBody: store.request.body,
              responseStatus: storeRes.status,
              responseHeaders: storeRes.headers,
              responseBodySnippet: storeRes.body.substring(0, 1000),
              highlightRegions: [store.canaryToken],
            });
          }

          evidence.push({
            requestUrl: trig.request.url,
            requestMethod: trig.request.method,
            requestHeaders: trig.request.headers,
            requestBody: trig.request.body,
            responseStatus: res.status,
            responseHeaders: res.headers,
            responseBodySnippet: res.body.substring(0, 1000),
            highlightRegions: hasDbError ? ['Database Error Detected'] : [store.canaryToken],
          });

          findings.push({
            storeStepId: store.id,
            triggerStepId: trig.id,
            canaryToken: store.canaryToken,
            injectionConfirmed: hasDbError,
            dbmsErrorTriggered: hasDbError ? 'Database error reflected on trigger sink' : undefined,
            evidence,
          });
        }
      }
    }

    return findings;
  }

  private injectCanaryIntoRequest(req: GhostHttpRequest, paramName: string, canary: string): void {
    if (req.headers['Content-Type']?.includes('json') && req.body) {
      try {
        const obj = JSON.parse(req.body);
        obj[paramName] = `${obj[paramName] || ''}' ${canary}-- `;
        req.body = JSON.stringify(obj);
        return;
      } catch {}
    }

    try {
      const u = new URL(req.url);
      if (u.searchParams.has(paramName)) {
        u.searchParams.set(paramName, `${u.searchParams.get(paramName) || ''}' ${canary}-- `);
        req.url = u.toString();
      }
    } catch {}
  }
}
