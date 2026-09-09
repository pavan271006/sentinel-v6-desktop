/**
 * SENTINEL — Layered Input Validation & Rejection Boundary Classifier
 *
 * Classifies where in the stack a probe was rejected:
 * HTTP_PARSER | SCHEMA_VALIDATION | APPLICATION_LOGIC | FRAMEWORK_BINDING | DRIVER_LEVEL | DATABASE_EXECUTION | UNKNOWN
 *
 * Invariant: An HTTP 400/422 does NOT mean the SQL sink is safe; it indicates an input boundary barrier.
 */

export type RejectionBoundary =
  | 'HTTP_PARSER_REJECTED'     // 400 Bad Request / malformed syntax (RFC violation)
  | 'WAF_PERIMETER_BLOCKED'    // 403 Forbidden / 406 Not Acceptable / Block page
  | 'SCHEMA_REJECTED'          // 422 Unprocessable Entity / JSON Schema type violation
  | 'FRAMEWORK_REJECTED'       // Type coercion error in routing / controller binding
  | 'APPLICATION_REJECTED'     // Custom business logic / domain validation
  | 'DRIVER_REJECTED'          // Database driver unhandled parameter error
  | 'DATABASE_SYNTAX_ERROR'    // SQL syntax error reached the DB
  | 'SQL_EXECUTED'             // Successful query execution (200/500 depending on payload)
  | 'UNKNOWN';

export interface BoundaryClassificationResult {
  boundary: RejectionBoundary;
  confidence: number;
  statusCode: number;
  reason: string;
  isSqlSinkReachable: boolean;
  recommendedAdaptation: 'semantic_rewrite' | 'serialization_tweak' | 'constraint_adjustment' | 'none';
}

export class InputValidationModel {
  /**
   * Evaluates HTTP status, headers, and response body to classify the exact layer
   * where the probe was accepted, filtered, or executed.
   */
  public static classifyBoundary(
    statusCode: number,
    headers: Record<string, string>,
    responseBody: string
  ): BoundaryClassificationResult {
    const bodyLower = responseBody.toLowerCase();
    const serverHeader = (headers['server'] || '').toLowerCase();

    // 1. WAF Perimeter Block
    if (
      statusCode === 403 ||
      statusCode === 406 ||
      bodyLower.includes('access denied') ||
      bodyLower.includes('waf') ||
      bodyLower.includes('attack detected') ||
      bodyLower.includes('blocked by') ||
      serverHeader.includes('cloudflare') ||
      bodyLower.includes('cloudflare') ||
      serverHeader.includes('sucuri') ||
      bodyLower.includes('sucuri') ||
      bodyLower.includes('mod_security') ||
      bodyLower.includes('imperva') ||
      serverHeader.includes('akamai') ||
      bodyLower.includes('akamai')
    ) {
      return {
        boundary: 'WAF_PERIMETER_BLOCKED',
        confidence: 0.95,
        statusCode,
        reason: 'Response exhibits perimeter WAF/filter block characteristics (403/406 or signature banner)',
        isSqlSinkReachable: false,
        recommendedAdaptation: 'semantic_rewrite',
      };
    }

    // 2. Database Syntax Error (SQL executed and failed at DB engine)
    const dbSignatures = [
      'sql syntax',
      'mysql',
      'syntax error',
      'ora-',
      'postgresql',
      'sqlite3',
      'unclosed quotation mark',
      'quoted string not properly terminated',
      'jdbc',
      'hibernate',
      'sqlalchemy',
    ];
    if (dbSignatures.some((sig) => bodyLower.includes(sig))) {
      return {
        boundary: 'DATABASE_SYNTAX_ERROR',
        confidence: 0.98,
        statusCode,
        reason: 'Database syntax error returned directly in response body; SQL sink is 100% reachable',
        isSqlSinkReachable: true,
        recommendedAdaptation: 'none',
      };
    }

    // 3. Schema / Type Validation Rejected (e.g. JSON schema, Pydantic, Zod, Joi)
    if (
      statusCode === 422 ||
      bodyLower.includes('validation error') ||
      bodyLower.includes('invalid type') ||
      bodyLower.includes('expected integer') ||
      bodyLower.includes('schema mismatch') ||
      bodyLower.includes('pattern mismatch')
    ) {
      return {
        boundary: 'SCHEMA_REJECTED',
        confidence: 0.90,
        statusCode,
        reason: 'Input violated JSON Schema or type validation constraints before hitting database query',
        isSqlSinkReachable: false,
        recommendedAdaptation: 'constraint_adjustment',
      };
    }

    // 4. HTTP Transport / Parser Rejected
    if (statusCode === 400 && (bodyLower.includes('bad request') || bodyLower.includes('malformed'))) {
      return {
        boundary: 'HTTP_PARSER_REJECTED',
        confidence: 0.80,
        statusCode,
        reason: 'HTTP parser rejected raw wire encoding (e.g. invalid URI percent-encoding or JSON syntax)',
        isSqlSinkReachable: false,
        recommendedAdaptation: 'serialization_tweak',
      };
    }

    // 5. Successful Execution
    if (statusCode >= 200 && statusCode < 300) {
      return {
        boundary: 'SQL_EXECUTED',
        confidence: 0.85,
        statusCode,
        reason: 'Request accepted and processed cleanly through the entire application stack',
        isSqlSinkReachable: true,
        recommendedAdaptation: 'none',
      };
    }

    return {
      boundary: 'UNKNOWN',
      confidence: 0.40,
      statusCode,
      reason: 'Boundary could not be definitively determined from response signals',
      isSqlSinkReachable: false,
      recommendedAdaptation: 'semantic_rewrite',
    };
  }
}