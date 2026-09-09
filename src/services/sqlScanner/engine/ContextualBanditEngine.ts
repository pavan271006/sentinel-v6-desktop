/**
 * SENTINEL — Contextual Multi-Armed Bandit (MAB) Transformation Selector
 *
 * Prioritizes transformation families using Upper Confidence Bound (UCB1)
 * driven by Investigation Utility Rewards (evidence gain, entropy reduction, oracle activation).
 *
 * CRITICAL INVARIANT:
 * Reward != Vulnerability Confirmation.
 * The Bandit controls test prioritization ONLY. Scope, safety limits, and causal
 * confirmation gates remain strictly deterministic.
 */

import { DbmsType, InjectionContext } from '../../../types/sqlScanner';
import { RewriteFamily } from './SemanticRewriteEngine';

export interface BanditArm {
  id: RewriteFamily | 'RAW' | 'JSON_UNICODE' | 'XML_ENTITY' | 'DOUBLE_URL';
  pullCount: number;
  totalReward: number;
  averageReward: number;
}

export interface InvestigationFeedback {
  wasAccepted: boolean;
  isWafBlocked: boolean;
  hasSchemaError: boolean;
  hasDbmsError: boolean;
  hasTimingDelta: boolean;
  hasStructuralDivergence: boolean;
  entropyReduced: number; // 0.0 - 1.0
}

export class ContextualBanditEngine {
  private static arms: Map<string, BanditArm> = new Map();
  private static totalPulls: number = 0;
  private static explorationParam: number = 1.414; // sqrt(2) UCB1 standard

  static {
    const defaultArmIds: (RewriteFamily | 'RAW' | 'JSON_UNICODE' | 'XML_ENTITY' | 'DOUBLE_URL')[] = [
      'RAW',
      'EQUIVALENT_PREDICATE',
      'EQUIVALENT_ARITHMETIC',
      'EQUIVALENT_CONDITIONAL',
      'LITERAL_REPRESENTATION',
      'DIALECT_FUNCTION',
      'PARENTHESIS_DELIMITER',
      'JSON_UNICODE',
      'XML_ENTITY',
      'DOUBLE_URL',
    ];

    for (const id of defaultArmIds) {
      this.arms.set(id, {
        id,
        pullCount: 1, // Laplace smoothing
        totalReward: 0.5,
        averageReward: 0.5,
      });
      this.totalPulls += 1;
    }
  }

  /**
   * Calculates the UCB1 score for an arm given total pulls.
   */
  private static calculateUcb(arm: BanditArm, totalPulls: number): number {
    if (arm.pullCount === 0) return Infinity;
    const exploitation = arm.averageReward;
    const exploration = this.explorationParam * Math.sqrt(Math.log(totalPulls) / arm.pullCount);
    return exploitation + exploration;
  }

  /**
   * Selects the highest expected utility transformation arm for a given context and DBMS.
   */
  public static selectBestArm(
    _context: InjectionContext,
    _dbms: DbmsType
  ): BanditArm['id'] {
    let bestArmId: BanditArm['id'] = 'RAW';
    let highestScore = -Infinity;

    for (const [id, arm] of this.arms.entries()) {
      const score = this.calculateUcb(arm, this.totalPulls);
      if (score > highestScore) {
        highestScore = score;
        bestArmId = id as BanditArm['id'];
      }
    }

    return bestArmId;
  }

  /**
   * Computes the investigation utility reward from observed multi-signal feedback.
   *
   * REWARD RULES:
   * +0.4: Database error or syntax leak (reached DB engine)
   * +0.3: Significant entropy reduction in hypothesis space
   * +0.2: Request accepted without perimeter block
   * +0.2: Statistically significant structural divergence
   * -0.3: Perimeter WAF block (penalizes blocked arm in this context)
   * -0.2: Transport/schema rejection
   */
  public static calculateUtilityReward(feedback: InvestigationFeedback): number {
    let reward = 0.0;

    if (feedback.hasDbmsError) {
      reward += 0.4;
    }
    if (feedback.entropyReduced > 0.1) {
      reward += 0.3 * Math.min(feedback.entropyReduced, 1.0);
    }
    if (feedback.wasAccepted && !feedback.isWafBlocked) {
      reward += 0.2;
    }
    if (feedback.hasStructuralDivergence) {
      reward += 0.2;
    }
    if (feedback.isWafBlocked) {
      reward -= 0.3;
    }
    if (feedback.hasSchemaError) {
      reward -= 0.2;
    }

    // Clamp between 0.0 and 1.0 for standard UCB normalization
    return Math.max(0.0, Math.min(1.0, reward + 0.3));
  }

  /**
   * Updates bandit arm statistics after an investigation probe.
   */
  public static updateArm(
    armId: BanditArm['id'],
    feedback: InvestigationFeedback
  ): void {
    const arm = this.arms.get(armId);
    if (!arm) return;

    const reward = this.calculateUtilityReward(feedback);
    arm.pullCount += 1;
    arm.totalReward += reward;
    arm.averageReward = arm.totalReward / arm.pullCount;
    this.totalPulls += 1;
  }

  /**
   * Returns live snapshot of bandit arms for telemetry UI.
   */
  public static getTelemetrySnapshot(): BanditArm[] {
    return Array.from(this.arms.values());
  }
}