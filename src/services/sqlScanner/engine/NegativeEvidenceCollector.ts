/**
 * SOHE God Rail v3 — Negative Evidence Collector
 *
 * Implements the Formal Safety Certificate System.
 * When a target is deemed NOT vulnerable, this module collects the mathematical
 * proofs showing WHY it's safe (e.g., strong parameterization, WAF block, etc.)
 */

export type SafetyReason = 
  | 'PARAMETERIZED_QUERY'
  | 'TYPE_CASTING'
  | 'WAF_BLOCK'
  | 'INPUT_SANITIZATION'
  | 'NO_DB_INTERACTION';

export interface SafetyProof {
    reason: SafetyReason;
    confidence: number; // 0.0 to 1.0
    evidenceLogs: string[];
}

export class NegativeEvidenceCollector {
    private proofs: SafetyProof[] = [];

    /**
     * Asserts that a parameter uses Parameterized Queries (Prepared Statements).
     * Proof: Both structural syntax breaking (quotes) and logical injection (AND 1=1) 
     * are treated as literal strings and fail to alter the query logic.
     */
    addParameterizedProof(paramName: string, evidenceLog: string): void {
        this.proofs.push({
            reason: 'PARAMETERIZED_QUERY',
            confidence: 0.99,
            evidenceLogs: [
                `Parameter '${paramName}' safely handled injection payloads as literal strings.`,
                `Evidence: ${evidenceLog}`
            ]
        });
    }

    /**
     * Asserts that the input is being strictly type-casted (e.g. to Integer) before DB interaction.
     * Proof: Sending '5-0' fails, sending '5a' returns 400 Bad Request, sending '5' works.
     */
    addTypeCastingProof(paramName: string, evidenceLog: string): void {
         this.proofs.push({
            reason: 'TYPE_CASTING',
            confidence: 0.95,
            evidenceLogs: [
                `Parameter '${paramName}' enforces strict type checking (likely integer).`,
                `Evidence: ${evidenceLog}`
            ]
        });
    }

    /**
     * Asserts that a WAF or IPS is actively blocking the payloads.
     * Proof: Benign requests return 200, but requests with SQL keywords return 403/406.
     */
    addWafBlockProof(wafName: string, evidenceLog: string): void {
         this.proofs.push({
            reason: 'WAF_BLOCK',
            confidence: 0.90,
            evidenceLogs: [
                `Active defense mechanism detected blocking SQL payloads. (Detected: ${wafName})`,
                `Evidence: ${evidenceLog}`
            ]
        });
    }
    
    /**
     * Generates the final Safety Certificate if enough negative evidence is collected.
     */
    generateCertificate(): { isSafe: boolean; proofs: SafetyProof[] } {
        // If we have high confidence proofs, we issue a certificate
        const highConfidenceProofs = this.proofs.filter(p => p.confidence >= 0.90);
        
        return {
            isSafe: highConfidenceProofs.length > 0,
            proofs: highConfidenceProofs
        };
    }
}
