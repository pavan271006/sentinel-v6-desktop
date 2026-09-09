import { ScanContext } from './ScanContext';
import { SqlScanReport, ScanVerdict } from '../../../types/sqlScanner';

export interface ScanStage {
  readonly id: string;
  readonly name: string;
  execute(ctx: ScanContext): Promise<void>;
  rollback?(ctx: ScanContext): Promise<void>;
}

export class ScanPipeline {
  private stages: ScanStage[] = [];

  public addStage(stage: ScanStage): this {
    this.stages.push(stage);
    return this;
  }

  public getStages(): readonly ScanStage[] {
    return this.stages;
  }

  public async execute(ctx: ScanContext): Promise<SqlScanReport> {
    ctx.startTime = Date.now();
    ctx.log('info', `=== Initializing Apex Sovereign Pipeline (${ctx.engineMode}) ===`);
    ctx.log('info', `Target: ${ctx.target.method} ${ctx.target.url} | Parameters: ${ctx.candidateParameters.length}`);

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];

      if (ctx.isAborted) {
        ctx.log('warn', `Pipeline execution terminated before stage: ${stage.name}`);
        break;
      }

      // Check pause state
      while (ctx.isPaused && !ctx.isAborted) {
        await new Promise(r => setTimeout(r, 200));
      }

      const percent = Math.round((i / this.stages.length) * 100);
      ctx.progress(stage.name, `Running ${stage.name}`, percent);
      ctx.log('info', `[Stage ${i + 1}/${this.stages.length}] Starting ${stage.name}...`);

      try {
        await stage.execute(ctx);
        if (ctx.isAborted) {
          ctx.log('warn', `Pipeline execution terminated during stage: ${stage.name}`);
          break;
        }
        const stageEndPercent = Math.round(((i + 1) / this.stages.length) * 100);
        ctx.progress(stage.name, `Completed ${stage.name}`, stageEndPercent);
        ctx.log('info', `[Stage ${i + 1}/${this.stages.length}] Completed ${stage.name}`);
      } catch (err: any) {
        if (ctx.isAborted || err?.message?.includes('aborted')) {
          ctx.log('warn', `Stage ${stage.name} halted due to scan abort.`);
          break;
        }
        ctx.log('error', `[Stage ${stage.name}] Error: ${err?.message || String(err)}`);
        if (stage.rollback) {
          try {
            await stage.rollback(ctx);
          } catch (rbErr) {
            ctx.log('error', `[Stage ${stage.name}] Rollback failed: ${rbErr}`);
          }
        }
      }
    }

    const durationMs = Math.max(10, Date.now() - ctx.startTime);
    const durationSeconds = Math.max(1, Math.floor(durationMs / 1000));
    const isVulnerable = ctx.findings.length > 0;
    const verdict: ScanVerdict = isVulnerable ? 'VULNERABLE' : 'NOT CONFIRMED VULNERABLE';
    const verdictReason = isVulnerable
      ? `Confirmed ${ctx.findings.length} SQL injection vulnerabilities with formal proofs.`
      : (ctx.isAborted
        ? 'Scan halted by operator before full assessment completion.'
        : 'No exploitable SQL injection vectors confirmed under tested constraints.');

    if (ctx.isAborted) {
      ctx.log('warn', `=== Scan Aborted by Operator in ${durationSeconds}s | Findings: ${ctx.findings.length} ===`);
    } else {
      ctx.progress('Completed', 'Scan execution finished', 100);
      ctx.log('info', `=== Scan Completed in ${durationSeconds}s | Findings: ${ctx.findings.length} | Verdict: ${verdict} ===`);
    }

    const report: SqlScanReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      generatedAt: Date.now(),
      targetUrl: ctx.target.url,
      targetMethod: ctx.target.method,
      verdict,
      verdictReason,
      durationMs,
      requestsSent: ctx.requestsSent,
      testsExecuted: ctx.testsExecuted,
      confirmedIndicators: ctx.findings.length,
      waf: ctx.wafResult,
      dbms: ctx.dbmsFingerprint,
      findings: ctx.findings,
      catalog: ctx.catalog,
      coverage: Array.from(ctx.coverageMap.values()),
      executionLogs: ctx.executionLogs,
      executiveSummary: verdictReason,
      technicalDetails: `Apex Sovereign pipeline execution (${ctx.engineMode}) finished with ${ctx.requestsSent} requests sent across ${ctx.candidateParameters.length} parameters.`,
    };

    return report;
  }
}
