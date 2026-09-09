/**
 * SENTINEL — 8-Layer SQL Defense Model
 * 
 * Explicitly models all 8 observable defense/processing layers in enterprise environments:
 * L1_EDGE_WAF           - Edge & Perimeter WAF (Anomaly scoring, signatures, libinjection)
 * L2_INGRESS_SCHEMA     - API Gateway & Serialization (Schema, types, UUID, length, encodings)
 * L3_APP_ORM            - Application / Query Builder / ORM (Parameterized vs Raw dynamic)
 * L4_RUNTIME_RASP       - Runtime Application Self-Protection (AST differential interception)
 * L5_DRIVER_PROTOCOL    - Driver & Wire Protocol (Binary binding, multi-statements disabled)
 * L6_DB_FIREWALL        - Database Proxy & Middleware (Query hash allowlisting, DAM)
 * L7_DB_KERNEL          - Database Engine Kernel (RLS, least privilege, timeouts, sandboxing)
 * L8_SSDLC_SAST         - Secure SDLC & Static Analysis (Taint tracking, source-assisted sinks)
 *
 * CRITICAL INVARIANT:
 * UNKNOWN must NEVER automatically become SAFE.
 * A layer is only CONFIRMED when corroborated by definitive causal evidence.
 */

export type DefenseLayerId =
  | 'L1_EDGE_WAF'
  | 'L2_INGRESS_SCHEMA'
  | 'L3_APP_ORM'
  | 'L4_RUNTIME_RASP'
  | 'L5_DRIVER_PROTOCOL'
  | 'L6_DB_FIREWALL'
  | 'L7_DB_KERNEL'
  | 'L8_SSDLC_SAST';

export type LayerEvaluationStatus =
  | 'CONFIRMED'
  | 'REJECTED'
  | 'INCONCLUSIVE'
  | 'BLOCKED'
  | 'UNKNOWN'
  | 'UNSUPPORTED'
  | 'NOT_APPLICABLE'
  | 'UNREACHABLE'
  | 'COVERAGE_DEBT';

export type EpistemicCertainty =
  | 'OBSERVED'   // Directly verified through explicit response headers, banners, or oracle divergence
  | 'INFERRED'   // Statistically supported by differential probe responses, status codes, or latency
  | 'UNKNOWN';   // No definitive evidence obtained; must never be assumed safe

export interface LayerState {
  layer: DefenseLayerId;
  name: string;
  observed: boolean;
  reachable: boolean;
  blocked: boolean;
  unknown: boolean;
  evidence: string[];
  confidence: number; // 0.0 - 1.0
  certainty: EpistemicCertainty;
  testable: boolean;
  not_testable: boolean;
  status: LayerEvaluationStatus;
  basis?: string;
  details?: string;
}

export interface TransformationPipelineRecord {
  wireRepresentation: string;
  parsedRepresentation: string;
  applicationValue: string;
  encodingType: string;
  transformationApplied?: string;
  targetLayer: DefenseLayerId;
  observedOutcome: 'ACCEPTED' | 'REJECTED' | 'TRANSFORMED' | 'UNKNOWN';
}

export class SQLDefenseLayerModel {
  private layers: Map<DefenseLayerId, LayerState> = new Map();
  private transformationTrace: TransformationPipelineRecord[] = [];

  constructor() {
    this.initDefaultLayers();
  }

  public static createDefault(): SQLDefenseLayerModel {
    return new SQLDefenseLayerModel();
  }

  private initDefaultLayers(): void {
    const definitions: { id: DefenseLayerId; name: string; testable: boolean }[] = [
      { id: 'L1_EDGE_WAF', name: 'Edge / Perimeter WAF', testable: true },
      { id: 'L2_INGRESS_SCHEMA', name: 'Ingress / API Serialization', testable: true },
      { id: 'L3_APP_ORM', name: 'Application / Query Builder / ORM', testable: true },
      { id: 'L4_RUNTIME_RASP', name: 'Runtime / RASP', testable: true },
      { id: 'L5_DRIVER_PROTOCOL', name: 'Driver / Wire Protocol', testable: true },
      { id: 'L6_DB_FIREWALL', name: 'Database Firewall / Proxy', testable: true },
      { id: 'L7_DB_KERNEL', name: 'Database Kernel Controls', testable: true },
      { id: 'L8_SSDLC_SAST', name: 'SSDLC / SAST Source Context', testable: false }, // testable only when source provided
    ];

    for (const def of definitions) {
      this.layers.set(def.id, {
        layer: def.id,
        name: def.name,
        observed: false,
        reachable: def.id === 'L1_EDGE_WAF', // Edge is initially reachable
        blocked: false,
        unknown: true,
        evidence: [],
        confidence: 0.0,
        certainty: 'UNKNOWN',
        testable: def.testable,
        not_testable: !def.testable,
        status: 'UNKNOWN',
        basis: 'Initial scan state; no probe traffic observed yet',
      });
    }
  }

  public getLayer(layer: DefenseLayerId): LayerState {
    const state = this.layers.get(layer);
    if (!state) {
      throw new Error(`Layer ${layer} not found in SQLDefenseLayerModel`);
    }
    return { ...state, evidence: [...state.evidence] };
  }

  public getAllLayers(): LayerState[] {
    return Array.from(this.layers.values()).map((l) => ({ ...l, evidence: [...l.evidence] }));
  }

  public updateLayer(layer: DefenseLayerId, updates: Partial<LayerState>): void {
    const current = this.layers.get(layer);
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      unknown: updates.status ? updates.status === 'UNKNOWN' : current.unknown,
    };

    // Strict invariant: UNKNOWN must never automatically become SAFE
    if (updated.status === 'UNKNOWN') {
      updated.blocked = false;
      updated.observed = false;
    }

    this.layers.set(layer, updated);
  }

  public recordEvidence(
    layer: DefenseLayerId,
    evidence: string,
    confidence: number,
    certainty: EpistemicCertainty,
    status?: LayerEvaluationStatus,
    basis?: string
  ): void {
    const current = this.layers.get(layer);
    if (!current) return;

    const newEvidenceList = [...current.evidence, evidence];
    const newStatus = status || current.status;

    this.layers.set(layer, {
      ...current,
      evidence: newEvidenceList,
      confidence: Math.max(current.confidence, confidence),
      certainty,
      observed: certainty === 'OBSERVED',
      unknown: newStatus === 'UNKNOWN',
      status: newStatus,
      basis: basis || current.basis,
    });
  }

  public markBlocked(layer: DefenseLayerId, reason: string, basis?: string): void {
    const current = this.layers.get(layer);
    if (!current) return;

    this.layers.set(layer, {
      ...current,
      blocked: true,
      reachable: true,
      unknown: false,
      status: 'BLOCKED',
      details: reason,
      basis: basis || current.basis,
      confidence: Math.max(current.confidence, 0.85),
    });

    // Mark downstream layers as UNREACHABLE for this probe path
    this.propagateUnreachability(layer);
  }

  public markReachable(layer: DefenseLayerId): void {
    const current = this.layers.get(layer);
    if (!current) return;

    this.layers.set(layer, {
      ...current,
      reachable: true,
    });
  }

  private propagateUnreachability(fromLayer: DefenseLayerId): void {
    const layerOrder: DefenseLayerId[] = [
      'L1_EDGE_WAF',
      'L2_INGRESS_SCHEMA',
      'L3_APP_ORM',
      'L4_RUNTIME_RASP',
      'L5_DRIVER_PROTOCOL',
      'L6_DB_FIREWALL',
      'L7_DB_KERNEL',
    ];

    const idx = layerOrder.indexOf(fromLayer);
    if (idx >= 0 && idx < layerOrder.length - 1) {
      for (let i = idx + 1; i < layerOrder.length; i++) {
        const downstream = layerOrder[i];
        const state = this.layers.get(downstream);
        if (state && state.status === 'UNKNOWN') {
          this.layers.set(downstream, {
            ...state,
            reachable: false,
            status: 'UNREACHABLE',
            details: `Unreachable because upstream layer [${fromLayer}] blocked delivery`,
          });
        }
      }
    }
  }

  public recordTransformation(record: TransformationPipelineRecord): void {
    this.transformationTrace.push(record);
  }

  public getTransformationTrace(): TransformationPipelineRecord[] {
    return [...this.transformationTrace];
  }

  /**
   * Safety verification: Prevents declaring a target "SAFE" if critical layers
   * were merely blocking probes or remained unreached.
   */
  public hasCoverageDebt(): boolean {
    for (const state of this.layers.values()) {
      if (state.status === 'COVERAGE_DEBT' || state.status === 'UNREACHABLE' || state.status === 'BLOCKED') {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates a forensic summary of the 8-layer model evaluation.
   */
  public getForensicSummary(): {
    summary: string;
    layersObserved: number;
    layersBlocked: number;
    layersUnknown: number;
    layersReachable: number;
  } {
    let observed = 0;
    let blocked = 0;
    let unknown = 0;
    let reachable = 0;

    for (const state of this.layers.values()) {
      if (state.observed) observed++;
      if (state.blocked) blocked++;
      if (state.unknown) unknown++;
      if (state.reachable) reachable++;
    }

    return {
      summary: `8-Layer Defense Evaluation: ${observed} observed, ${blocked} blocked, ${unknown} unknown, ${reachable} reachable`,
      layersObserved: observed,
      layersBlocked: blocked,
      layersUnknown: unknown,
      layersReachable: reachable,
    };
  }
}
