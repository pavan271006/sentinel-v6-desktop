/**
 * Sentinel V7 — Driver Inspection Engine
 *
 * Distinguishes between:
 * 1. Client-Side Emulated Prepared Statements (e.g. PHP PDO with PDO::ATTR_EMULATE_PREPARES=true,
 *    legacy Node.js mysql/mysql2 default escaping) where stacked queries and multibyte injection succeed.
 * 2. Server-Side Binary Protocol Prepares (true parameterized queries with binary protocol markers).
 * 3. Direct String Interpolation / Concatenation in application code.
 */

export type DriverPrepareMode =
  | 'CLIENT_EMULATED_PREPARES'
  | 'SERVER_BINARY_PREPARED'
  | 'RAW_CONCATENATION'
  | 'UNKNOWN';

export interface DriverInspectionProbe {
  id: string;
  name: string;
  targetBehavior: 'stacked_queries' | 'multibyte_backslash' | 'type_coercion';
  payload: string;
  description: string;
}

export interface DriverInspectionResult {
  inferredMode: DriverPrepareMode;
  stackedQueriesSupported: boolean;
  multibyteSmugglingVulnerable: boolean;
  confidence: number;
  evidence: string[];
  recommendation: string;
}

export class DriverInspectionEngine {
  public static readonly PROBES: DriverInspectionProbe[] = [
    {
      id: 'DRV_STACKED_STATEMENT_CHECK',
      name: 'Stacked Query Multi-Statement Probe',
      targetBehavior: 'stacked_queries',
      payload: "'; SELECT 1;-- ",
      description: 'Tests whether database driver allows multiple semicolons in a single execute() call.',
    },
    {
      id: 'DRV_MULTIBYTE_BACKSLASH_CHECK',
      name: 'GBK Multibyte Backslash Smuggling Probe',
      targetBehavior: 'multibyte_backslash',
      payload: "%bf%27 OR 1=1-- ",
      description: 'Tests whether client-side escaping consumes 0x5C backslash into a valid multibyte character.',
    },
    {
      id: 'DRV_TYPE_COERCION_CHECK',
      name: 'Driver Type Binding Inference Probe',
      targetBehavior: 'type_coercion',
      payload: "1-0",
      description: 'Tests whether integer parameters permit arithmetic subtraction without type enforcement.',
    },
  ];

  /**
   * Analyzes probe execution indicators to infer driver prepare architecture
   */
  public static evaluateDriverBehavior(signals: {
    stackedQueryExecuted: boolean;
    multibyteQuoteBroken: boolean;
    arithmeticEvaluated: boolean;
    rawSyntaxErrorObserved: boolean;
  }): DriverInspectionResult {
    const evidence: string[] = [];
    let stackedQueriesSupported = false;
    let multibyteSmugglingVulnerable = false;
    let inferredMode: DriverPrepareMode = 'UNKNOWN';
    let confidence = 70;

    if (signals.stackedQueryExecuted) {
      stackedQueriesSupported = true;
      evidence.push('Stacked multi-statement execution succeeded: Semicolon delimiter accepted by driver protocol.');
    }

    if (signals.multibyteQuoteBroken) {
      multibyteSmugglingVulnerable = true;
      evidence.push('Multibyte character collision succeeded: Client driver escaping backslash was absorbed (%bf%27).');
    }

    if (signals.stackedQueryExecuted && signals.multibyteQuoteBroken) {
      inferredMode = 'CLIENT_EMULATED_PREPARES';
      confidence = 95;
      evidence.push('Definitive indicators of client-side statement emulation (e.g. PDO::ATTR_EMULATE_PREPARES=true).');
    } else if (signals.stackedQueryExecuted) {
      inferredMode = 'CLIENT_EMULATED_PREPARES';
      confidence = 85;
      evidence.push('Driver permits batch statement execution; indicates emulated parameterization or dynamic statement builder.');
    } else if (signals.rawSyntaxErrorObserved && !signals.stackedQueryExecuted) {
      inferredMode = 'RAW_CONCATENATION';
      confidence = 80;
      evidence.push('Unescaped quotes reach database engine directly; raw string concatenation in application layer.');
    } else if (!signals.stackedQueryExecuted && !signals.rawSyntaxErrorObserved && signals.arithmeticEvaluated) {
      inferredMode = 'RAW_CONCATENATION';
      confidence = 75;
      evidence.push('Arithmetic evaluated in unquoted literal; input dynamically inserted into query AST.');
    } else {
      inferredMode = 'SERVER_BINARY_PREPARED';
      confidence = 70;
      evidence.push('Stacked queries rejected and quote delimiters preserved; consistent with native server binary prepares.');
    }

    let recommendation = 'Maintain native server-side prepared statements with binary parameter bindings.';
    if (inferredMode === 'CLIENT_EMULATED_PREPARES') {
      recommendation = 'CRITICAL: Disable client-side statement emulation in database driver (e.g. set PDO::ATTR_EMULATE_PREPARES to false in PHP, or use query() with explicit binary bindings in Node/Python).';
    } else if (inferredMode === 'RAW_CONCATENATION') {
      recommendation = 'CRITICAL: Replace direct string interpolation/concatenation with parameterized queries and bound variables.';
    }

    return {
      inferredMode,
      stackedQueriesSupported,
      multibyteSmugglingVulnerable,
      confidence,
      evidence,
      recommendation,
    };
  }
}
