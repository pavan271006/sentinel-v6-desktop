import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { WafDetector } from '../../WafDetector';

export class WafProfilingStage implements ScanStage {
  public readonly id = 'waf_profiling';
  public readonly name = 'WAF & Perimeter Evasion Profiling';

  public async execute(ctx: ScanContext): Promise<void> {
    ctx.log('info', 'Analyzing target perimeter for WAF/CDN filtering rules...');

    const headersArray = Object.entries(ctx.baseline.samples[0] ? ctx.baseline.body : {}).map(([name, value]) => ({
      name,
      value: String(value),
    }));

    // Detect WAF from baseline
    const wafResult = WafDetector.inspect(
      headersArray,
      ctx.baseline.body,
      ctx.baseline.status
    );

    ctx.wafResult = wafResult;

    if (wafResult.detected) {
      ctx.log('warn', `WAF Detected: ${wafResult.wafName || 'Unknown WAF'} (Confidence: ${wafResult.confidence}). Arming metamorphic evasion engine.`);
      ctx.defenseLayerModel.updateLayer('L1_EDGE_WAF', {
        observed: true,
        blocked: true,
        status: 'CONFIRMED',
        basis: wafResult.wafName || 'Generic WAF detected',
      });
    } else {
      ctx.log('info', 'No perimeter WAF detected on initial baseline inspect.');
    }
  }
}
