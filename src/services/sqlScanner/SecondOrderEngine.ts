/**
 * SOHE God Rail v3 — Second Order Engine
 *
 * Implements multi-endpoint taint tracking.
 * Phase 1 (Store): Injects payloads with unique canary markers into endpoints (e.g. Profile update).
 * Phase 2 (Trigger): Crawls/requests other endpoints (e.g. View Profile, Admin Dashboard).
 * Phase 3 (Detect): Analyzes responses for the canary or execution side-effects.
 */

import { GhostNetwork } from './stealth/GhostNetwork';
import { DataStoreFingerprinter } from './DataStoreFingerprinter';

export interface TaintMarker {
    id: string; // Unique canary (e.g. 'snl_8f2a')
    sourceEndpoint: string;
    sourceParameter: string;
    payloadType: 'Error' | 'Boolean' | 'Time' | 'OOB';
    injectedAt: number;
}

export class SecondOrderEngine {
    private network: GhostNetwork;
    private activeTaints: Map<string, TaintMarker> = new Map();

    constructor(network: GhostNetwork) {
        this.network = network;
    }

    getNetwork(): GhostNetwork {
        return this.network;
    }

    /**
     * Generates a unique canary string to identify this specific injection path.
     */
    generateCanary(): string {
        return `snl_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Phase 1: Store
     * Records that a payload containing a specific canary was injected.
     */
    registerTaint(
        canary: string, 
        sourceEndpoint: string, 
        sourceParameter: string, 
        payloadType: 'Error' | 'Boolean' | 'Time' | 'OOB'
    ): void {
        this.activeTaints.set(canary, {
            id: canary,
            sourceEndpoint,
            sourceParameter,
            payloadType,
            injectedAt: Date.now()
        });
    }

    /**
     * Phase 2 & 3: Trigger and Detect
     * Analyzes a response from ANY endpoint to see if a stored payload was executed.
     */
    analyzeTriggerResponse(response: { body: string; url: string }): TaintMarker | null {
        // 1. Look for raw canary reflection (Stored XSS / Data Leakage)
        for (const [canary, taint] of this.activeTaints.entries()) {
            if (response.body.includes(canary)) {
                // If the canary is reflected inside a DB error message, it's Second-Order SQLi
                if (DataStoreFingerprinter.containsDbError(response.body)) {
                    return taint; // Confirmed Second-Order SQLi
                }
            }
        }

        // Note: Time-based and OOB second-order detections are handled 
        // by the overarching scanner event loop (checking interactsh, or measuring response time)
        // rather than direct response body analysis.

        return null;
    }
    
    getActiveTaints(): TaintMarker[] {
        return Array.from(this.activeTaints.values());
    }
}
