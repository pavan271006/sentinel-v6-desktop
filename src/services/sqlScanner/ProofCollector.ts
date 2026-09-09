/**
 * SOHE God Rail v3 — Proof Collector
 *
 * Captures full HTTP wire traffic (Request + Response) for confirmed vulnerabilities.
 * Ensures that every finding presented to the user includes undeniable, reproducible evidence.
 */

import { GhostHttpRequest, GhostHttpResponse } from './stealth/GhostNetwork';
import { FindingSeverity, ConfidenceLevel } from '../../types/sqlScanner';

export interface WireCapture {
    requestUrl: string;
    requestMethod: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBodySnippet: string; // Truncated to relevant portion
    
    highlightRegions: string[]; // Specific strings to highlight in the UI (e.g. the error message)
}

export interface ConfirmedFinding {
    id: string;
    vulnerabilityType: string;
    severity: FindingSeverity;
    confidence: ConfidenceLevel;
    
    targetUrl: string;
    parameter: string;
    payload: string;
    
    description: string;
    impact: string;
    remediation: string;
    
    evidence: WireCapture[]; // The undeniable proof
    extractedData?: Record<string, string>;
}

export class ProofCollector {
    private findings: ConfirmedFinding[] = [];

    /**
     * Records a confirmed vulnerability along with the exact HTTP request/response that proves it.
     */
    addFinding(
        type: string,
        severity: FindingSeverity,
        req: GhostHttpRequest,
        res: GhostHttpResponse,
        parameter: string,
        payload: string,
        highlights: string[],
        description: string
    ): void {
        
        // Capture the wire data
        const capture: WireCapture = {
            requestUrl: req.url,
            requestMethod: req.method,
            requestHeaders: req.headers,
            requestBody: req.body,
            
            responseStatus: res.status,
            responseHeaders: res.headers,
            // Store only up to 5000 chars of body to save memory, ensuring highlights are included
            responseBodySnippet: this.extractRelevantSnippet(res.body, highlights),
            highlightRegions: highlights
        };

        const finding: ConfirmedFinding = {
            id: `FND-${Math.random().toString(36).substring(2, 9)}`,
            vulnerabilityType: type,
            severity,
            confidence: 'Confirmed',
            targetUrl: req.url.split('?')[0], // Base URL
            parameter,
            payload,
            description,
            impact: this.getStandardImpact(type),
            remediation: this.getStandardRemediation(type),
            evidence: [capture]
        };

        this.findings.push(finding);
    }

    getFindings(): ConfirmedFinding[] {
        return this.findings;
    }

    // ─── Internal Helpers ──────────────────────────────────────────

    /**
     * Extracts a window of text around the highlighted regions, rather than storing the whole HTML.
     */
    private extractRelevantSnippet(fullBody: string, highlights: string[]): string {
        if (!highlights || highlights.length === 0) return fullBody.substring(0, 1000);
        
        const firstHighlight = highlights[0];
        const idx = fullBody.indexOf(firstHighlight);
        
        if (idx === -1) return fullBody.substring(0, 1000);

        // Grab 200 chars before and 500 after the highlight
        const start = Math.max(0, idx - 200);
        const end = Math.min(fullBody.length, idx + 500);
        
        return (start > 0 ? '... ' : '') + fullBody.substring(start, end) + (end < fullBody.length ? ' ...' : '');
    }

    private getStandardImpact(type: string): string {
        if (type.includes('SQL')) {
            return "An attacker can read, modify, or delete database contents. In severe cases, they may achieve Remote Code Execution (RCE) on the database server.";
        }
        return "System compromise.";
    }

    private getStandardRemediation(type: string): string {
        if (type.includes('SQL')) {
            return "Use parameterized queries (Prepared Statements) for all database interactions. Do not concatenate user input directly into SQL command strings.";
        }
        return "Implement strong input validation and output encoding.";
    }
}
