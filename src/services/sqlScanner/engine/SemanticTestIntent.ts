/**
 * UCMA-X — Semantic Test Intent & Safety Classification
 * Defines the 12 semantic testing intents and concurrency safety classifications.
 */

export type SemanticIntentType =
  | 'TRUE_FALSE_DIFFERENTIAL'     // Boolean invariant testing
  | 'ERROR_BEHAVIOR_TEST'          // Database error elicitation & type conversion
  | 'TIMING_BEHAVIOR_TEST'         // Latency shift measurement (SPRT)
  | 'UNION_COMPATIBILITY_TEST'     // Column count & canary reflection
  | 'ORDER_BOUNDARY_TEST'          // Dynamic ORDER BY column count & direction
  | 'ORDER_DIRECTION_TEST'         // ASC vs DESC differential
  | 'TYPE_COMPATIBILITY_TEST'      // Column data type verification
  | 'EXISTENCE_TEST'               // Entity / Table presence checking
  | 'CARDINALITY_TEST'             // Row count estimation
  | 'METADATA_DISCOVERY_TEST'      // information_schema table/column extraction
  | 'STATE_TRANSITION_TEST'        // Stacked query / session state mutation
  | 'METAMORPHIC_RELATION_TEST'    // TLP / NoREC relational invariant check
  | 'CAUSAL_CONTROL_TEST'          // Counterfactual baseline/control check
  | 'OOB_INTERACTION_TEST';        // Out-of-band collaborator callback

export type TestSafetyClass =
  | 'PARALLEL_SAFE'      // Safe for 10-50x concurrent asynchronous execution
  | 'TIMING_SENSITIVE'   // Must execute sequentially in a low-jitter timing lane
  | 'STATE_DEPENDENT'    // Must preserve strict sequence ordering (e.g. multi-step workflows)
  | 'ORDER_DEPENDENT'    // Output depends directly on prior test result
  | 'SESSION_SENSITIVE'; // Modifies or relies on session/auth cookies

export interface SemanticTestDefinition {
  intent: SemanticIntentType;
  safetyClass: TestSafetyClass;
  description: string;
  defaultCost: number; // typical HTTP request count
  baseInfoGain: number; // 0.0 - 1.0 baseline information gain
}

export const INTENT_DEFINITIONS: Record<SemanticIntentType, SemanticTestDefinition> = {
  TRUE_FALSE_DIFFERENTIAL: {
    intent: 'TRUE_FALSE_DIFFERENTIAL',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Executes TRUE/FALSE pair to establish relational differential.',
    defaultCost: 2,
    baseInfoGain: 0.85,
  },
  ERROR_BEHAVIOR_TEST: {
    intent: 'ERROR_BEHAVIOR_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Elicits syntax or runtime type conversion error from DBMS.',
    defaultCost: 1,
    baseInfoGain: 0.75,
  },
  TIMING_BEHAVIOR_TEST: {
    intent: 'TIMING_BEHAVIOR_TEST',
    safetyClass: 'TIMING_SENSITIVE',
    description: 'Sequentially evaluates latency shift using SPRT.',
    defaultCost: 3,
    baseInfoGain: 0.60,
  },
  UNION_COMPATIBILITY_TEST: {
    intent: 'UNION_COMPATIBILITY_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Probes column cardinality and string reflection canary.',
    defaultCost: 1,
    baseInfoGain: 0.90,
  },
  ORDER_BOUNDARY_TEST: {
    intent: 'ORDER_BOUNDARY_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Determines sorting column index boundaries via binary search or linear stepping.',
    defaultCost: 2,
    baseInfoGain: 0.80,
  },
  ORDER_DIRECTION_TEST: {
    intent: 'ORDER_DIRECTION_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Evaluates ASC vs DESC ordering differentials.',
    defaultCost: 2,
    baseInfoGain: 0.70,
  },
  TYPE_COMPATIBILITY_TEST: {
    intent: 'TYPE_COMPATIBILITY_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Determines individual column data type compatibility.',
    defaultCost: 1,
    baseInfoGain: 0.65,
  },
  EXISTENCE_TEST: {
    intent: 'EXISTENCE_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Validates existence of a specific table, column, or user entity.',
    defaultCost: 1,
    baseInfoGain: 0.85,
  },
  CARDINALITY_TEST: {
    intent: 'CARDINALITY_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Estimates table row count or length of a field via binary search.',
    defaultCost: 2,
    baseInfoGain: 0.75,
  },
  METADATA_DISCOVERY_TEST: {
    intent: 'METADATA_DISCOVERY_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Extracts table names, column names, or version strings.',
    defaultCost: 1,
    baseInfoGain: 0.95,
  },
  STATE_TRANSITION_TEST: {
    intent: 'STATE_TRANSITION_TEST',
    safetyClass: 'STATE_DEPENDENT',
    description: 'Evaluates stacked multi-statement execution and session persistence.',
    defaultCost: 2,
    baseInfoGain: 0.70,
  },
  METAMORPHIC_RELATION_TEST: {
    intent: 'METAMORPHIC_RELATION_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Tests relational partitioning invariants (TLP/NoREC).',
    defaultCost: 3,
    baseInfoGain: 0.80,
  },
  CAUSAL_CONTROL_TEST: {
    intent: 'CAUSAL_CONTROL_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Executes counterfactual controls to verify causality and eliminate noise.',
    defaultCost: 1,
    baseInfoGain: 0.90,
  },
  OOB_INTERACTION_TEST: {
    intent: 'OOB_INTERACTION_TEST',
    safetyClass: 'PARALLEL_SAFE',
    description: 'Triggers outbound DNS/HTTP lookup to verify blind execution.',
    defaultCost: 1,
    baseInfoGain: 0.95,
  },
};
