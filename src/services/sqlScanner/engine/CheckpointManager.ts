/**
 * SOHE God Rail v3 — Checkpoint Manager
 *
 * Implements serializable save/resume capabilities.
 * Allows long-running scans or slow blind extractions to survive crashes,
 * network drops, or user pauses.
 */

import { ScanTargetConfig, DbmsType } from '../../../types/sqlScanner';

export interface ScanState {
    id: string;
    target: ScanTargetConfig;
    dbmsType: DbmsType | 'Unknown';
    currentParamIndex: number;
    currentDepthLevel: number;
    extractedData: Record<string, string>;
    cookieJar: [string, string][]; // Serializable Map
    lastRequestTime: number;
    // other necessary state
}

export interface SerializedCheckpoint {
    version: number;
    timestamp: number;
    state: ScanState;
}

export class CheckpointManager {
    private currentState: ScanState | null = null;
    private readonly VERSION = 3;

    /**
     * Initializes a new state or loads an existing one.
     */
    init(target: ScanTargetConfig): ScanState {
        this.currentState = {
            id: Date.now().toString(),
            target,
            dbmsType: 'Unknown',
            currentParamIndex: 0,
            currentDepthLevel: 0,
            extractedData: {},
            cookieJar: [],
            lastRequestTime: Date.now()
        };
        return this.currentState;
    }

    /**
     * Updates the current state during a scan.
     */
    updateState(updates: Partial<ScanState>): void {
        if (this.currentState) {
            this.currentState = { ...this.currentState, ...updates };
        }
    }

    /**
     * Creates a serializable checkpoint of the current state.
     */
    createCheckpoint(): SerializedCheckpoint {
        if (!this.currentState) {
            throw new Error("No scan state initialized");
        }
        return {
            version: this.VERSION,
            timestamp: Date.now(),
            state: this.currentState
        };
    }

    /**
     * Resumes from a serialized checkpoint.
     */
    static resume(checkpoint: SerializedCheckpoint): ScanState {
        if (checkpoint.version !== 3) {
            throw new Error(`Unsupported checkpoint version: ${checkpoint.version}`);
        }
        
        // In a real implementation, you'd restore this state into the Orchestrator,
        // rebuild the SessionManager's cookie map, set the ExploitationEngine's depth, etc.
        return checkpoint.state;
    }
}
