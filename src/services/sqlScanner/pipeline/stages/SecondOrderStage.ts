import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { SecondOrderTester } from '../../SecondOrderTester';
import { SqlScanFinding, SqlScanEvidence } from '../../../../types/sqlScanner';
import { ThreatConsequenceEngine } from '../../engine/ThreatConsequenceEngine';
import { ipcClient } from '../../../../ipc/client';

export class SecondOrderStage implements ScanStage {
  public readonly id = 'second_order_detection';
  public readonly name = 'Second-Order Stateful Injection & Sink Correlation';

  public async execute(ctx: ScanContext): Promise<void> {
    const soConfig = ctx.target.secondOrderConfig;
    if (!soConfig || !soConfig.enabled) {
      ctx.updateCoverage('second_order', {
        status: 'passed',
        testedCount: 1,
        positiveCount: 0,
        reason: 'Second-order testing disabled in target configuration.',
      });
      return;
    }

    const enabledParams = ctx.candidateParameters.filter((p) => p.enabled);
    if (enabledParams.length === 0) {
      return;
    }

    ctx.log('info', `=== [SECOND-ORDER] Initiating Stateful Source-to-Sink Evaluation across ${enabledParams.length} parameter(s) ===`);
    ctx.progress('Second-Order Detection', 'Injecting canary tokens and probing secondary sinks', 74);

    let anyVulnerable = false;

    for (const param of enabledParams) {
      if (ctx.isAborted) return;

      try {
        const soResult = await SecondOrderTester.executeSecondOrderTest(
          ctx.parsedRequest,
          param,
          soConfig,
          async (raw, url) => {
            if (ctx.isAborted) {
              return { status: 0, body: '', durationMs: 0, rawRequest: '', rawResponse: '' };
            }
            const res = await ipcClient.sendRepeaterRequest({
              tabId: 'sql_so_probe',
              targetUrl: url,
              rawRequest: raw,
            });
            return {
              status: res.statusCode || 200,
              body: res.body || '',
              durationMs: res.durationMs || 0,
              rawRequest: raw,
              rawResponse: res.rawResponse || '',
            };
          }
        );

        if (soResult.isVulnerable) {
          anyVulnerable = true;
          ctx.log('success', `[SECOND-ORDER] Confirmed asynchronous execution on "${param.name}": ${soResult.evidence}`);

          const ev: SqlScanEvidence = {
            id: `ev-so-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title: `Second-Order Execution Triggered on Parameter ${param.name}`,
            timestamp: Date.now(),
            injectionType: 'Second-Order SQLi',
            parameterName: param.name,
            parameterLocation: param.location,
            payload: soResult.evidence,
            baselineStatus: ctx.baseline.status,
            baselineLength: ctx.baseline.contentLength,
            baselineDurationMs: ctx.baseline.durationMs,
            testStatus: 200,
            testLength: 0,
            testDurationMs: 0,
            rawRequest: soResult.sourceRequest || '',
            rawResponse: soResult.sourceResponse || '',
            analysisSummary: `Second-order SQL injection execution confirmed across sink endpoint: ${soResult.evidence}`,
          };

          const finding: SqlScanFinding = {
            id: `finding-so-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title: `Second-Order SQL Injection (${ctx.dbmsFingerprint.dbms || 'Generic SQL'})`,
            parameterName: param.name,
            parameterLocation: param.location,
            url: ctx.target.url,
            httpMethod: ctx.target.method,
            dbms: ctx.dbmsFingerprint.dbms || 'Generic SQL',
            detectionMethod: 'Asynchronous State Transition Invariant Oracle',
            injectionType: 'Second-Order SQLi',
            severity: 'High',
            confidence: 'Confirmed',
            confidenceScore: 95,
            confidenceBreakdown: {
              score: 95,
              level: 'Confirmed',
              factors: [
                { name: 'Asynchronous State Transition Reflection', points: 95, description: soResult.evidence },
              ],
            },
            evidence: [ev],
            reproductionRequest: soResult.sinkRequest || soResult.sourceRequest || '',
            reproductionResponse: soResult.sinkResponse || soResult.sourceResponse || '',
            remediation: 'Sanitize untrusted inputs at storage boundaries and use parameterized queries in all downstream sink queries.',
            cwe: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
            timestamp: Date.now(),
            sqliDetected: true,
            sqlStructureControl: true,
          };

          ThreatConsequenceEngine.enrichFinding(finding, param);
          ctx.addFinding(finding);
          ctx.verifiedVector = 'SECOND_ORDER';
          ctx.verifiedParamId = param.id;
        }
      } catch (err: any) {
        if (ctx.isAborted) return;
        ctx.log('warn', `Second-order probing error on "${param.name}": ${err?.message || err}`);
      }
    }

    ctx.updateCoverage('second_order', {
      status: anyVulnerable ? 'vulnerable' : 'passed',
      testedCount: enabledParams.length,
      positiveCount: anyVulnerable ? 1 : 0,
      reason: anyVulnerable
        ? 'Second-order state transition confirmed in sink response'
        : 'Source-to-sink evaluation complete — no second-order execution detected',
    });
  }
}
