import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { GrayBoxScanEngine } from '../../graybox/GrayBoxScanEngine';
import { SqlScanFinding, SqlScanEvidence } from '../../../../types/sqlScanner';

export class GrayBoxStage implements ScanStage {
  public readonly id = 'gray_box_boundary';
  public readonly name = 'Gray-Box Boundary & IAST Runtime Auditing';

  public async execute(ctx: ScanContext): Promise<void> {
    const config = ctx.target.grayBoxConfig;

    if (!config || !config.enabled) {
      ctx.log('info', 'Gray-Box boundary analysis disabled for target. Passing to next stage.');
      return;
    }

    ctx.log('info', '=== [GRAY-BOX] Initializing Gray-Box Boundary Scan Engine ===');
    ctx.progress('Gray-Box Verification', 'Analyzing air-gapped sinks, DOM encryption, and macro workflows', 72);

    try {
      const grayBoxEngine = new GrayBoxScanEngine(ctx.target);

      // Execute full hybrid assessment
      const report = await grayBoxEngine.executeHybridScan();
      // Stream Gray-Box telemetry to scan logger
      for (const logLine of report.telemetryLogs) {
        ctx.log('info', logLine);
      }

      // Convert Gray-Box findings to standard SqlScanFindings and record them
      for (const gbFinding of report.grayBoxFindings) {
        const paramName = gbFinding.evidence?.taintedParameter || ctx.candidateParameters[0]?.name || 'graybox_param';
        const param = ctx.candidateParameters.find((p) => p.name === paramName) || ctx.candidateParameters[0];

        const evidence: SqlScanEvidence = {
          id: `ev-gb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: gbFinding.title,
          timestamp: gbFinding.timestamp || Date.now(),
          injectionType: gbFinding.boundarySolved === 'air_gapped_async_sink'
            ? 'Second-Order SQLi'
            : (gbFinding.boundarySolved === 'multi_step_state' ? 'Error-based' : 'Boolean-based'),
          parameterName: paramName,
          parameterLocation: param ? param.location : 'body_json',
          payload: gbFinding.evidence?.taintedValue || "' OR 1=1--",
          baselineStatus: ctx.baseline.status,
          baselineLength: ctx.baseline.contentLength,
          baselineDurationMs: ctx.baseline.meanDurationMs,
          testStatus: 200,
          testLength: 0,
          testDurationMs: 0,
          rawRequest: ctx.target.rawRequest || `${ctx.target.method} ${ctx.target.url}`,
          rawResponse: JSON.stringify(gbFinding.evidence || {}),
          matchedPattern: gbFinding.evidence?.grammarViolation || gbFinding.evidence?.executedQuery,
          reproductionCount: 1,
          reproductionSuccessRate: '100%',
          analysisSummary: gbFinding.description,
        };

        const finding: SqlScanFinding = {
          id: gbFinding.id || `finding-gb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: gbFinding.title,
          parameterName: paramName,
          parameterLocation: param ? param.location : 'body_json',
          url: ctx.target.url,
          httpMethod: ctx.target.method,
          dbms: ctx.dbmsFingerprint.dbms || 'Generic SQL',
          detectionMethod: `Gray-Box (${gbFinding.boundarySolved})`,
          injectionType: gbFinding.boundarySolved === 'air_gapped_async_sink'
            ? 'Second-Order SQLi'
            : (gbFinding.boundarySolved === 'multi_step_state' ? 'Error-based' : 'Boolean-based'),
          severity: gbFinding.severity,
          confidence: gbFinding.confidence,
          confidenceScore: gbFinding.confidence === 'Confirmed' ? 100 : 85,
          confidenceBreakdown: {
            score: gbFinding.confidence === 'Confirmed' ? 100 : 85,
            level: gbFinding.confidence,
            factors: [
              {
                name: `Boundary Proof: ${gbFinding.boundarySolved}`,
                points: gbFinding.confidence === 'Confirmed' ? 100 : 85,
                description: gbFinding.description,
              },
            ],
          },
          evidence: [evidence],
          reproductionRequest: ctx.target.rawRequest || `${ctx.target.method} ${ctx.target.url}`,
          reproductionResponse: JSON.stringify(gbFinding.evidence || {}),
          remediation: 'Implement parameterized SQL queries / prepared statements. Never interpolate untrusted user inputs directly into internal database driver sinks.',
          cwe: 'CWE-89',
          owaspCategory: 'A03:2021-Injection',
          timestamp: gbFinding.timestamp || Date.now(),
          sqliDetected: true,
          sqlStructureControl: true,
          dataAccessDemonstrated: true,
        };

        ctx.addFinding(finding);

        // Update Defense Layer Model
        if (gbFinding.boundarySolved === 'air_gapped_async_sink') {
          ctx.defenseLayerModel.updateLayer('L3_APP_ORM', {
            observed: true,
            blocked: false,
            status: 'REJECTED',
            basis: 'IAST in-process runtime hook intercepted unescaped driver query sink',
          });
        }
      }

      ctx.log('info', `[GRAY-BOX] Boundary stage completed. Captured findings: ${report.grayBoxFindings.length}`);
    } catch (err: any) {
      ctx.log('error', `[GRAY-BOX] Error executing Gray-Box boundary stage: ${err?.message || String(err)}`);
    }
  }
}
