/**
 * UCMA-X — Deep Autonomous Investigation Depth Ladder (Levels 0–11)
 * Formalizes the 12 progressive depth stages from raw HTTP ingress to independent proof and impact separation.
 */

export type InvestigationDepthLevel =
  | 0  // LEVEL 0: INGEST — Parse HTTP request, discover candidate input locations
  | 1  // LEVEL 1: BASELINE — Establish latency, jitter (σ), status, and response stability
  | 2  // LEVEL 2: SQL RELEVANCE — Determine if inputs plausibly reach backend SQL query
  | 3  // LEVEL 3: SQL INJECTION — Validate relational boolean/syntax divergence
  | 4  // LEVEL 4: CONTEXT — Infer exact SQL clause/grammar semantic position
  | 5  // LEVEL 5: DBMS — Determine database engine dialect and capabilities
  | 6  // LEVEL 6: OBSERVATION CHANNEL — Select most reliable oracle (In-Band, Error, Boolean, SPRT)
  | 7  // LEVEL 7: EXPLOITABILITY / READ CAPABILITY — Determine observable data bandwidth
  | 8  // LEVEL 8: DATABASE INTELLIGENCE — Enumerate schemas, tables, and column metadata
  | 9  // LEVEL 9: AUTHORIZED DATA VALIDATION — Extract authorized sample records
  | 10 // LEVEL 10: IMPACT SEPARATION — Determine demonstrated capability vs speculative impact
  | 11; // LEVEL 11: INDEPENDENT VERIFICATION — Clean-room 3x reproduction of evidence chain

export interface DepthLevelMetadata {
  level: InvestigationDepthLevel;
  name: string;
  description: string;
  requiredEvidence: string;
}

export const DEPTH_LEVEL_DEFINITIONS: Record<InvestigationDepthLevel, DepthLevelMetadata> = {
  0: {
    level: 0,
    name: 'INGEST',
    description: 'Parse raw HTTP wire format and discover candidate parameters across all transports.',
    requiredEvidence: 'Parsed candidate parameters list with transport classifications.',
  },
  1: {
    level: 1,
    name: 'BASELINE',
    description: 'Sample unmodified requests to measure response length and latency variance.',
    requiredEvidence: 'Baseline HTTP status, mean latency, variance, and stable body structure.',
  },
  2: {
    level: 2,
    name: 'SQL_RELEVANCE',
    description: 'Determine whether candidate inputs plausibly influence backend database logic.',
    requiredEvidence: 'Parameter reflection or non-crash syntactic divergence.',
  },
  3: {
    level: 3,
    name: 'SQL_INJECTION',
    description: 'Validate database-dependent behavior via relational differential or syntax error.',
    requiredEvidence: 'Confirmed divergence between TRUE and FALSE relational predicates or SQL error.',
  },
  4: {
    level: 4,
    name: 'CONTEXT',
    description: 'Infer SQL grammar position (numeric, single-quote, ORDER BY, JSON, LIKE, etc.).',
    requiredEvidence: 'Resolved context hypothesis with Bayesian probability >= 0.85.',
  },
  5: {
    level: 5,
    name: 'DBMS',
    description: 'Identify database engine family (PostgreSQL, MySQL, MSSQL, Oracle, SQLite).',
    requiredEvidence: 'DBMS-specific function behavior, error pattern, or version string.',
  },
  6: {
    level: 6,
    name: 'OBSERVATION_CHANNEL',
    description: 'Select optimal observation channel (Canary reflection, CAST error, Boolean, SPRT).',
    requiredEvidence: 'Active high-confidence oracle identified.',
  },
  7: {
    level: 7,
    name: 'EXPLOITABILITY_READ',
    description: 'Establish in-band or out-of-band data extraction bandwidth.',
    requiredEvidence: 'Reflected canary marker or CAST type conversion error leakage.',
  },
  8: {
    level: 8,
    name: 'DATABASE_INTELLIGENCE',
    description: 'Discover database catalog, schemas, application tables, and column metadata.',
    requiredEvidence: 'Discovered table names and column schema entries.',
  },
  9: {
    level: 9,
    name: 'AUTHORIZED_DATA_VALIDATION',
    description: 'Sample authorized test records to confirm extraction completeness.',
    requiredEvidence: 'Extracted row values for discovered columns.',
  },
  10: {
    level: 10,
    name: 'IMPACT_SEPARATION',
    description: 'Strictly separate demonstrated read access from speculative auth/OS command execution.',
    requiredEvidence: 'Classified impact vector based solely on empirical proof.',
  },
  11: {
    level: 11,
    name: 'INDEPENDENT_VERIFICATION',
    description: 'Execute isolated clean-room reproduction of the primary evidence chain.',
    requiredEvidence: '100% 3/3 clean-room reproduction of finding.',
  },
};

export class DepthLadder {
  private currentLevel: InvestigationDepthLevel = 0;
  private maxReachedLevel: InvestigationDepthLevel = 0;
  private levelStatuses: Record<InvestigationDepthLevel, 'pending' | 'active' | 'completed' | 'skipped' | 'failed'>;
  private levelEvidence: Record<InvestigationDepthLevel, string[]>;

  constructor() {
    this.levelStatuses = {
      0: 'pending',
      1: 'pending',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
      11: 'pending',
    };
    this.levelEvidence = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
      10: [],
      11: [],
    };
  }

  public getCurrentLevel(): InvestigationDepthLevel {
    return this.currentLevel;
  }

  public getMaxReachedLevel(): InvestigationDepthLevel {
    return this.maxReachedLevel;
  }

  public getStatus(level: InvestigationDepthLevel) {
    return this.levelStatuses[level];
  }

  public getEvidence(level: InvestigationDepthLevel): string[] {
    return [...this.levelEvidence[level]];
  }

  public advanceLevel(level: InvestigationDepthLevel, evidence: string): void {
    if (level >= this.currentLevel) {
      if (this.levelStatuses[this.currentLevel] === 'active') {
        this.levelStatuses[this.currentLevel] = 'completed';
      }
      this.currentLevel = level;
      if (level > this.maxReachedLevel) {
        this.maxReachedLevel = level;
      }
      this.levelStatuses[level] = 'active';
    }
    this.levelEvidence[level].push(evidence);
  }

  public completeLevel(level: InvestigationDepthLevel, summary?: string): void {
    this.levelStatuses[level] = 'completed';
    if (summary) {
      this.levelEvidence[level].push(summary);
    }
  }

  public skipLevel(level: InvestigationDepthLevel, reason: string): void {
    this.levelStatuses[level] = 'skipped';
    this.levelEvidence[level].push(`Skipped: ${reason}`);
  }

  public getDepthSummary(): { maxLevel: number; maxLevelName: string; completedCount: number } {
    let completed = 0;
    for (const lvl in this.levelStatuses) {
      if (this.levelStatuses[lvl as unknown as InvestigationDepthLevel] === 'completed') {
        completed++;
      }
    }
    return {
      maxLevel: this.maxReachedLevel,
      maxLevelName: DEPTH_LEVEL_DEFINITIONS[this.maxReachedLevel]?.name || 'UNKNOWN',
      completedCount: completed,
    };
  }
}
