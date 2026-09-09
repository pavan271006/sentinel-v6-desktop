import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';

export class BaselineProfilingStage implements ScanStage {
  public readonly id = 'baseline_profiling';
  public readonly name = 'Baseline Profiling & Latency Calibration';

  public async execute(ctx: ScanContext): Promise<void> {
    ctx.log('info', 'Executing baseline profiling requests...');
    const samples: Array<{ status: number; durationMs: number; bodyLength: number }> = [];
    const bodies: string[] = [];

    const numSamples = 3;
    for (let i = 0; i < numSamples; i++) {
      if (ctx.isAborted) return;
      try {
        const dummyParam = ctx.candidateParameters[0] || {
          id: 'baseline',
          name: 'baseline',
          location: 'query',
          originalValue: '',
          enabled: true,
        };
        const res = await ctx.sendMutatedRequest(dummyParam, dummyParam.originalValue, { skipSafety: true });
        samples.push({
          status: res.status,
          durationMs: res.durationMs,
          bodyLength: res.body.length,
        });
        bodies.push(res.body);
      } catch (err) {
        ctx.log('warn', `Baseline sample ${i + 1} failed: ${err}`);
      }
      if (i < numSamples - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (samples.length > 0) {
      const primary = samples[0];
      const durations = samples.map(s => s.durationMs);
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      ctx.baseline = {
        status: primary.status,
        body: bodies[0] || '',
        durationMs: mean,
        contentLength: primary.bodyLength,
        samples,
        meanDurationMs: mean,
        durationStdDev: stdDev,
      };

      ctx.log('info', `Baseline established: Status ${primary.status}, Mean Latency ${mean.toFixed(1)}ms (stdDev ±${stdDev.toFixed(1)}ms), Body Length ${primary.bodyLength} bytes.`);
    } else {
      ctx.log('warn', 'Unable to retrieve baseline responses. Using default HTTP baseline.');
    }
  }
}
