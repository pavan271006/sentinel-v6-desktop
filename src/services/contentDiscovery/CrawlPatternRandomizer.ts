/**
 * Sentinel Sovereign Ω - Crawl Pattern & Traversal Randomizer
 *
 * Counteracts server-side behavioral anomaly detection (which looks for robotic sequential crawling)
 * by randomizing candidate queues with intelligent human priority weighting.
 */

export interface CandidateAction {
  id?: string;
  type: 'link' | 'button' | 'tab' | 'accordion' | 'dropdown' | 'search' | 'form';
  priority?: number; // Higher number = executed first
  [key: string]: any;
}

export class CrawlPatternRandomizer {
  /**
   * Shuffles an array in-place using Fisher-Yates algorithm
   */
  public static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Partitions candidate actions into priority tiers and shuffles within each tier.
   * This guarantees high-value navigation (e.g. main tabs/menus) is prioritized,
   * while making the exact order within each tier unpredictable and human-like.
   */
  public static randomizeCandidateQueue<T extends CandidateAction>(items: T[]): T[] {
    if (!items || items.length <= 1) return items;

    // Group items into priority buckets
    const tiers: Record<string, T[]> = {
      primaryNav: [], // tabs, accordions, dropdowns
      interactive: [], // buttons, forms, search
      links: [],      // regular in-page links
      other: []
    };

    items.forEach((item) => {
      if (item.type === 'tab' || item.type === 'accordion' || item.type === 'dropdown') {
        tiers.primaryNav.push(item);
      } else if (item.type === 'button' || item.type === 'form' || item.type === 'search') {
        tiers.interactive.push(item);
      } else if (item.type === 'link') {
        tiers.links.push(item);
      } else {
        tiers.other.push(item);
      }
    });

    // Shuffle within each tier
    const randomized = [
      ...this.shuffle(tiers.primaryNav),
      ...this.shuffle(tiers.interactive),
      ...this.shuffle(tiers.links),
      ...this.shuffle(tiers.other),
    ];

    return randomized;
  }

  /**
   * Introduces a random human deliberation pause between page transitions
   */
  public static getRandomPauseMs(minMs: number = 200, maxMs: number = 800): number {
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
  }
}
