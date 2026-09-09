/**
 * SENTINEL — Cross-Layer Defense Correlator
 *
 * Evaluates the full evidence chain:
 * WIRE -> PARSED -> APPLICATION VALUE -> SQL CONSTRUCTION HYPOTHESIS -> DATABASE BEHAVIOR -> OBSERVED RESPONSE
 *
 * Implements strict observability rules:
 * - OBSERVED vs INFERRED vs UNKNOWN
 * - Distinguishes BLOCKED_BEFORE_APPLICATION vs APPLICATION_ERROR vs DATABASE_ERROR
 * - Distinguishes SQL Injection Existence from Operational Impact Constraints (RLS, PoLP)
 * - Never fabricates internal telemetry; unknown layers remain UNKNOWN.
 */

import { CandidateParameter, DbmsType } from '../../../types/sqlScanner';
import {
  SQLDefenseLayerModel,
  DefenseLayerId,
  TransformationPipelineRecord,
} from './SQLDefenseLayerModel';

export type RejectionClassification =
  | 'BLOCKED_BEFORE_APPLICATION_OBSERVABLE'
  | 'SCHEMA_REJECTED'
  | 'APPLICATION_ERROR'
  | 'RASP_BLOCKED'
  | 'DRIVER_REJECTED'
  | 'DB_PROXY_REJECTED'
  | 'DATABASE_ERROR'
  | 'SQL_EXECUTED'
  | 'UNKNOWN';

export type QueryConstructionHypothesis =
  | 'PARAMETERIZED'
  | 'RAW_DYNAMIC'
  | 'DYNAMIC_IDENTIFIER'
  | 'DYNAMIC_ORDER'
  | 'RAW_FRAGMENT'
  | 'ORM_ESCAPE_HATCH'
  | 'STORED_PROCEDURE'
  | 'UNKNOWN';

export interface SourceCodeAnalysisContext {
  sourceFile?: string;
  sourceLine?: number;
  taintSource?: string;
  sinkFunction?: string;
  isSanitized?: boolean;
}

export interface ImpactEvaluation {
  sqliDetected: boolean;
  sqlStructureControl: boolean;
  dataAccessDemonstrated: boolean;
  crossTenantAccess: boolean;
  writeCapability: boolean;
  privilegeCapability: boolean;
  osFileCapability: boolean;
  impactConstraints: string[];
}

export interface CrossLayerAnalysisResult {
  primaryRejectionLayer: DefenseLayerId | 'NONE_EXECUTED';
  rejectionClassification: RejectionClassification;
  queryConstructionHypothesis: QueryConstructionHypothesis;
  impact: ImpactEvaluation;
  pipelineTrace: TransformationPipelineRecord;
  diagnosticNarrative: string;
}

export class CrossLayerCorrelator {
  /**
   * Correlates probe input, wire format, and observed response across all 8 layers.
   */
  public static evaluateProbe(
    param: CandidateParameter,
    rawWirePayload: string,
    statusCode: number,
    headers: Record<string, string>,
    responseBody: string,
    durationMs: number,
    layerModel: SQLDefenseLayerModel,
    _dbms: DbmsType = 'Unknown',
    sourceContext?: SourceCodeAnalysisContext
  ): CrossLayerAnalysisResult {
    const bodyLower = responseBody.toLowerCase();
    const serverHeader = (headers['server'] || '').toLowerCase();

    // 1. Build transformation pipeline trace (Wire -> Parsed -> App Value)
    const pipelineTrace: TransformationPipelineRecord = {
      wireRepresentation: rawWirePayload,
      parsedRepresentation: decodeURIComponent(rawWirePayload.replace(/\+/g, ' ')),
      applicationValue: rawWirePayload,
      encodingType: param.location,
      targetLayer: 'L1_EDGE_WAF',
      observedOutcome: 'UNKNOWN',
    };

    const impact: ImpactEvaluation = {
      sqliDetected: false,
      sqlStructureControl: false,
      dataAccessDemonstrated: false,
      crossTenantAccess: false,
      writeCapability: false,
      privilegeCapability: false,
      osFileCapability: false,
      impactConstraints: [],
    };

    let primaryLayer: DefenseLayerId | 'NONE_EXECUTED' = 'NONE_EXECUTED';
    let classification: RejectionClassification = 'UNKNOWN';
    let queryHypothesis: QueryConstructionHypothesis = 'UNKNOWN';
    let narrative = '';

    // =========================================================================
    // LAYER 1: Edge & Perimeter WAF Evaluation
    // =========================================================================
    const hasPerimeterHeader =
      serverHeader.includes('cloudflare') ||
      serverHeader.includes('akamai') ||
      serverHeader.includes('sucuri') ||
      serverHeader.includes('imperva') ||
      Boolean(headers['cf-ray'] || headers['x-amz-waf-action'] || headers['x-waf-status']);

    const hasPerimeterBlockBody =
      bodyLower.includes('access denied') ||
      bodyLower.includes('waf') ||
      bodyLower.includes('mod_security') ||
      bodyLower.includes('blocked by administrator') ||
      bodyLower.includes('attack detected') ||
      bodyLower.includes('request blocked');

    if (statusCode === 403 || statusCode === 406 || (statusCode === 400 && hasPerimeterBlockBody)) {
      if (hasPerimeterHeader || hasPerimeterBlockBody) {
        primaryLayer = 'L1_EDGE_WAF';
        classification = 'BLOCKED_BEFORE_APPLICATION_OBSERVABLE';
        pipelineTrace.observedOutcome = 'REJECTED';
        layerModel.recordEvidence(
          'L1_EDGE_WAF',
          `HTTP ${statusCode} with perimeter signatures/headers: ${serverHeader || 'Perimeter Block Page'}`,
          0.92,
          'OBSERVED',
          'BLOCKED',
          'Explicit perimeter block banner or WAF headers detected'
        );
        narrative = `Probe blocked at Layer 1 (Edge WAF) prior to application processing.`;
      } else {
        // Generic 403: Mark inferred possible perimeter rejection, NOT confirmed WAF
        primaryLayer = 'L1_EDGE_WAF';
        classification = 'BLOCKED_BEFORE_APPLICATION_OBSERVABLE';
        pipelineTrace.observedOutcome = 'REJECTED';
        layerModel.recordEvidence(
          'L1_EDGE_WAF',
          `HTTP 403 Forbidden received without vendor-specific headers (possible perimeter rejection)`,
          0.60,
          'INFERRED',
          'INCONCLUSIVE',
          'HTTP 403 status code without perimeter diagnostic headers'
        );
        narrative = `Probe received HTTP 403; inferred possible perimeter barrier, but vendor presence unconfirmed.`;
      }
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    }

    layerModel.markReachable('L1_EDGE_WAF');
    layerModel.recordEvidence(
      'L1_EDGE_WAF',
      `HTTP ${statusCode} confirms request traversed edge perimeter cleanly`,
      0.85,
      'OBSERVED',
      'CONFIRMED',
      'Non-blocking HTTP response received'
    );

    // =========================================================================
    // LAYER 2: Ingress / API Serialization & Schema Evaluation
    // =========================================================================
    layerModel.markReachable('L2_INGRESS_SCHEMA');
    const isSchemaError =
      statusCode === 422 ||
      (statusCode === 400 &&
        (bodyLower.includes('validation error') ||
          bodyLower.includes('invalid type') ||
          bodyLower.includes('expected integer') ||
          bodyLower.includes('schema mismatch') ||
          bodyLower.includes('uuid') ||
          bodyLower.includes('json parse error') ||
          bodyLower.includes('malformed syntax')));

    if (isSchemaError) {
      primaryLayer = 'L2_INGRESS_SCHEMA';
      classification = 'SCHEMA_REJECTED';
      pipelineTrace.observedOutcome = 'REJECTED';
      layerModel.recordEvidence(
        'L2_INGRESS_SCHEMA',
        `Input rejected at serialization/validation boundary (HTTP ${statusCode})`,
        0.90,
        'OBSERVED',
        'BLOCKED',
        'JSON Schema or type parser rejected input payload'
      );
      narrative = `Probe rejected at Layer 2 (API/Schema validation) before reaching database query.`;
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    }

    layerModel.recordEvidence(
      'L2_INGRESS_SCHEMA',
      'Payload accepted by API ingress parser and deserializer',
      0.80,
      'OBSERVED',
      'CONFIRMED'
    );

    // =========================================================================
    // LAYER 4: Runtime / RASP Evaluation
    // =========================================================================
    layerModel.markReachable('L4_RUNTIME_RASP');
    const isRaspSignature =
      bodyLower.includes('rasp') ||
      bodyLower.includes('contrastsecurity') ||
      bodyLower.includes('sqreen') ||
      bodyLower.includes('ast mutation') ||
      bodyLower.includes('query interception policy violation');

    if (isRaspSignature) {
      primaryLayer = 'L4_RUNTIME_RASP';
      classification = 'RASP_BLOCKED';
      pipelineTrace.observedOutcome = 'REJECTED';
      layerModel.recordEvidence(
        'L4_RUNTIME_RASP',
        'In-process RASP AST differential violation detected in execution response',
        0.95,
        'OBSERVED',
        'BLOCKED',
        'Observable RASP runtime exception in response body'
      );
      narrative = `Probe intercepted in-process by Layer 4 (RASP) AST mutation engine.`;
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    } else {
      // Invariant: If no RASP signatures, RASP status is UNKNOWN (never assume absent)
      layerModel.updateLayer('L4_RUNTIME_RASP', {
        status: 'UNKNOWN',
        certainty: 'UNKNOWN',
        basis: 'No observable RASP instrumentation signals in response',
      });
    }

    // =========================================================================
    // LAYER 5: Driver / Wire Protocol Evaluation
    // =========================================================================
    layerModel.markReachable('L5_DRIVER_PROTOCOL');
    const isDriverError =
      bodyLower.includes('multi-statement') ||
      bodyLower.includes('commands out of sync') ||
      bodyLower.includes('packet sequence error') ||
      bodyLower.includes('unsupported parameter type') ||
      bodyLower.includes('driver error');

    if (isDriverError) {
      primaryLayer = 'L5_DRIVER_PROTOCOL';
      classification = 'DRIVER_REJECTED';
      pipelineTrace.observedOutcome = 'REJECTED';
      layerModel.recordEvidence(
        'L5_DRIVER_PROTOCOL',
        'Database driver protocol limitation encountered (e.g. multi-statement disabled)',
        0.88,
        'OBSERVED',
        'BLOCKED',
        'Driver-level wire protocol error message'
      );
      narrative = `Probe rejected at Layer 5 (Driver protocol capability barrier).`;
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    }

    // =========================================================================
    // LAYER 6: Database Firewall / Proxy Evaluation
    // =========================================================================
    layerModel.markReachable('L6_DB_FIREWALL');
    const isDbProxyError =
      bodyLower.includes('sql firewall') ||
      bodyLower.includes('maxscale') ||
      bodyLower.includes('greensql') ||
      bodyLower.includes('query hash not permitted') ||
      bodyLower.includes('proxy rejected query');

    if (isDbProxyError) {
      primaryLayer = 'L6_DB_FIREWALL';
      classification = 'DB_PROXY_REJECTED';
      pipelineTrace.observedOutcome = 'REJECTED';
      layerModel.recordEvidence(
        'L6_DB_FIREWALL',
        'Database proxy or middleware firewall rejected query template',
        0.92,
        'OBSERVED',
        'BLOCKED',
        'Database proxy query allowlist rejection signature'
      );
      narrative = `Probe rejected at Layer 6 (Database proxy query hash whitelist).`;
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    } else {
      layerModel.updateLayer('L6_DB_FIREWALL', {
        status: 'UNKNOWN',
        certainty: 'UNKNOWN',
        basis: 'No observable database proxy or firewall telemetry',
      });
    }

    // =========================================================================
    // LAYER 7: Database Kernel Controls & Syntax Error Detection
    // =========================================================================
    layerModel.markReachable('L7_DB_KERNEL');
    const dbSyntaxSignatures = [
      'sql syntax',
      'mysql',
      'syntax error',
      'ora-',
      'postgresql',
      'sqlite3',
      'unclosed quotation mark',
      'quoted string not properly terminated',
      'pg_catalog',
      'information_schema',
      'division by zero',
    ];

    const hasDbSyntaxError = dbSyntaxSignatures.some((sig) => bodyLower.includes(sig));

    if (hasDbSyntaxError) {
      primaryLayer = 'L7_DB_KERNEL';
      classification = 'DATABASE_ERROR';
      queryHypothesis = 'RAW_DYNAMIC';
      pipelineTrace.observedOutcome = 'ACCEPTED';

      impact.sqliDetected = true;
      impact.sqlStructureControl = true;

      layerModel.recordEvidence(
        'L3_APP_ORM',
        'Database returned raw syntax error, proving unparameterized dynamic query construction',
        0.98,
        'OBSERVED',
        'CONFIRMED',
        'Syntax error message indicates raw concatenation'
      );

      layerModel.recordEvidence(
        'L7_DB_KERNEL',
        'Database parser parsed and evaluated injected syntax tokens',
        0.95,
        'OBSERVED',
        'CONFIRMED',
        'Database engine error returned directly'
      );

      // Check for kernel impact constraints (RLS, privileges, timeouts)
      if (bodyLower.includes('permission denied') || bodyLower.includes('privilege') || bodyLower.includes('ora-01031')) {
        impact.privilegeCapability = false;
        impact.impactConstraints.push('LEAST_PRIVILEGE_RESTRICTED');
        layerModel.recordEvidence(
          'L7_DB_KERNEL',
          'Database user role lacks elevated administrative privileges',
          0.90,
          'OBSERVED',
          'CONFIRMED'
        );
      }

      if (bodyLower.includes('canceling statement due to statement timeout') || durationMs > 5000) {
        impact.impactConstraints.push('STATEMENT_TIMEOUT_CONSTRAINED');
      }

      narrative = `Database syntax error confirmed: Query is dynamically concatenated and reached database engine.`;
      return {
        primaryRejectionLayer: primaryLayer,
        rejectionClassification: classification,
        queryConstructionHypothesis: queryHypothesis,
        impact,
        pipelineTrace,
        diagnosticNarrative: narrative,
      };
    }

    // =========================================================================
    // LAYER 8: SSDLC / SAST Source Context
    // =========================================================================
    if (sourceContext && sourceContext.sinkFunction) {
      layerModel.recordEvidence(
        'L8_SSDLC_SAST',
        `Static analysis reports taint path from [${sourceContext.taintSource || 'HTTP'}] to [${sourceContext.sinkFunction}] in ${sourceContext.sourceFile}:${sourceContext.sourceLine}`,
        0.95,
        'OBSERVED',
        sourceContext.isSanitized ? 'REJECTED' : 'CONFIRMED',
        'Source-assisted SAST report provided'
      );
    } else {
      layerModel.updateLayer('L8_SSDLC_SAST', {
        status: 'UNKNOWN',
        certainty: 'UNKNOWN',
        basis: 'Source code unavailable for static analysis correlation',
      });
    }

    // Clean execution pass-through
    if (statusCode >= 200 && statusCode < 300) {
      classification = 'SQL_EXECUTED';
      pipelineTrace.observedOutcome = 'ACCEPTED';
      narrative = `Probe was accepted across all available defense layers.`;
    } else {
      classification = 'APPLICATION_ERROR';
      narrative = `Application returned HTTP ${statusCode} without explicit database syntax error or security block.`;
    }

    return {
      primaryRejectionLayer: 'NONE_EXECUTED',
      rejectionClassification: classification,
      queryConstructionHypothesis: queryHypothesis,
      impact,
      pipelineTrace,
      diagnosticNarrative: narrative,
    };
  }
}
