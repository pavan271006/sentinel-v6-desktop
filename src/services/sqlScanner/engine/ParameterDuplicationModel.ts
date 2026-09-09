/**
 * SENTINEL — HTTP Parameter Duplication Model (HPP)
 *
 * Models how backend web frameworks resolve duplicate parameter names:
 * FIRST | LAST | ARRAY | CONCATENATED | REJECTED | CUSTOM
 *
 * Uses probe marker reflection or differential execution to infer parameter binding.
 */

export type DuplicationResolutionHypothesis =
  | 'FIRST'        // e.g. Apache/Tomcat, mod_jk
  | 'LAST'         // e.g. PHP/Apache, Python/Werkzeug
  | 'ARRAY'        // e.g. Node.js/Express, Python/Django (getlist)
  | 'CONCATENATED' // e.g. ASP.NET (comma-separated: a,b)
  | 'REJECTED'     // e.g. Strict API schemas, WAF rejection
  | 'CUSTOM'       // Custom framework binding
  | 'UNKNOWN';

export interface ParameterDuplicationProbe {
  key: string;
  markerA: string;
  markerB: string;
  combinedQuery: string;
}

export class ParameterDuplicationModel {
  /**
   * Constructs a safe differential probe to determine how the target resolves duplicate parameters.
   */
  public static createResolutionProbe(paramName: string): ParameterDuplicationProbe {
    const markerA = `sentinelA_${Math.floor(Math.random() * 10000)}`;
    const markerB = `sentinelB_${Math.floor(Math.random() * 10000)}`;
    const combinedQuery = `${encodeURIComponent(paramName)}=${markerA}&${encodeURIComponent(paramName)}=${markerB}`;

    return {
      key: paramName,
      markerA,
      markerB,
      combinedQuery,
    };
  }

  /**
   * Infers parameter resolution behavior from target response body and status code.
   */
  public static inferResolution(
    probe: ParameterDuplicationProbe,
    statusCode: number,
    responseBody: string
  ): {
    hypothesis: DuplicationResolutionHypothesis;
    confidence: number;
    reason: string;
  } {
    if (statusCode === 400 || statusCode === 422) {
      return {
        hypothesis: 'REJECTED',
        confidence: 0.85,
        reason: 'Target returned 400/422 when duplicate parameter was provided',
      };
    }

    const hasA = responseBody.includes(probe.markerA);
    const hasB = responseBody.includes(probe.markerB);
    const hasBothConcat = responseBody.includes(`${probe.markerA},${probe.markerB}`) ||
                          responseBody.includes(`${probe.markerA}, ${probe.markerB}`);

    if (hasBothConcat) {
      return {
        hypothesis: 'CONCATENATED',
        confidence: 0.95,
        reason: 'Both markers reflected as comma-concatenated value (typical of ASP.NET/IIS)',
      };
    }

    if (hasA && !hasB) {
      return {
        hypothesis: 'FIRST',
        confidence: 0.90,
        reason: 'First parameter value was processed/reflected while second was discarded',
      };
    }

    if (!hasA && hasB) {
      return {
        hypothesis: 'LAST',
        confidence: 0.90,
        reason: 'Last parameter value was processed/reflected while first was overwritten (typical of PHP/Flask)',
      };
    }

    if (hasA && hasB) {
      return {
        hypothesis: 'ARRAY',
        confidence: 0.85,
        reason: 'Both parameters were parsed and accessible (typical of Node.js/Express query parser)',
      };
    }

    return {
      hypothesis: 'UNKNOWN',
      confidence: 0.30,
      reason: 'No parameter reflections observed; resolution behavior unconfirmed',
    };
  }
}