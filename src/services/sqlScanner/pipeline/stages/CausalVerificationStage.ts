import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { CausalVerifier } from '../../engine/CausalVerifier';

export class CausalVerificationStage implements ScanStage {
  public readonly id = 'causal_verification';
  public readonly name = 'Causal Counterfactual Verification & TLP Proofs';

  public async execute(ctx: ScanContext): Promise<void> {
    if (ctx.findings.length === 0) {
      ctx.log('info', 'No unverified candidate vulnerabilities detected. Skipping causal verification.');
      return;
    }

    ctx.log('info', `Running 5-Step Causal Verification Protocol across ${ctx.findings.length} findings...`);

    for (const finding of ctx.findings) {
      if (ctx.isAborted) return;
      const param = ctx.candidateParameters.find(p => p.name === finding.parameterName);
      if (!param) continue;

      if (finding.injectionType === 'Boolean-based' && finding.evidence.length > 0) {
        const parts = finding.evidence[0].payload.split(' vs ');
        const truePayload = parts[0] || "' AND '1'='1";
        const falsePayload = parts[1] || "' AND '1'='2";

        const result = await CausalVerifier.verifyCausality(
          param,
          async (payload: string, append: boolean) => {
            const actualPayload = append ? `${param.originalValue}${payload}` : (payload || param.originalValue);
            const res = await ctx.sendMutatedRequest(param, actualPayload, { skipSafety: true });
            return { status: res.status, body: res.body, durationMs: res.durationMs };
          },
          truePayload,
          falsePayload,
          (stepEvent) => {
            ctx.log('info', `[Causal Step ${stepEvent.stepIndex}/5] ${stepEvent.stepName}: ${stepEvent.description} (${stepEvent.state})`);
          }
        );

        if (result.isConfirmed) {
          finding.confidence = 'Confirmed';
          finding.confidenceScore = 100;
          finding.evidence[0].analysisSummary += `\n[MATHEMATICAL PROOF] ${result.reason}`;
          ctx.log('success', `[CAUSAL PROOF COMPLETE] Finding on "${param.name}" certified 100% true-positive.`);
        }
      }
    }
  }
}
