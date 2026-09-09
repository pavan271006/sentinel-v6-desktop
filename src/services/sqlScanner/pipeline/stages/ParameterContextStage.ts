import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { ContextDetector } from '../../ContextDetector';

export class ParameterContextStage implements ScanStage {
  public readonly id = 'parameter_context';
  public readonly name = 'AST Boundary & Context Inference';

  public async execute(ctx: ScanContext): Promise<void> {
    ctx.log('info', `Inferring injection context for ${ctx.candidateParameters.length} parameters...`);

    const rawReq = ctx.parsedRequest.body ? `${ctx.parsedRequest.method} ${ctx.parsedRequest.url}\n\n${ctx.parsedRequest.body}` : `${ctx.parsedRequest.method} ${ctx.parsedRequest.url}`;

    for (const param of ctx.candidateParameters) {
      if (ctx.isAborted) return;
      if (!param.enabled) continue;

      const detected = ContextDetector.detectContext(param, rawReq);
      param.detectedContext = detected;
      ctx.log('info', `Parameter "${param.name}" (${param.location}) inferred context: ${detected}`);
    }
  }
}
