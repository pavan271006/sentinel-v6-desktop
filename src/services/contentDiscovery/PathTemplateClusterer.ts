/**
 * Sentinel Sovereign Ω - Path Template & Parameter Clustering Engine
 * src/services/contentDiscovery/PathTemplateClusterer.ts
 *
 * Provides backward-compatible delegation to the high-performance EndpointNormalizer engine.
 */

import { EndpointNormalizer, TemplateClusteringMetrics } from './EndpointNormalizer';

export type { TemplateClusteringMetrics };

export class PathTemplateClusterer {
  private normalizer: EndpointNormalizer;

  constructor(maxSamplesPerTemplate: number = 3) {
    this.normalizer = new EndpointNormalizer(maxSamplesPerTemplate);
  }

  /**
   * Resets clustering metrics for a fresh crawl session.
   */
  public reset(): void {
    this.normalizer.reset();
  }

  /**
   * Converts a concrete URL path into an invariant structural template.
   * e.g. /api/v1/users/49102/edit -> /api/v1/users/{id}/edit
   */
  public generateTemplate(urlOrPath: string): string {
    return this.normalizer.generateRouteTemplate(urlOrPath);
  }

  /**
   * Sorts query parameters and strips tracking or anti-cache parameters.
   */
  public normalizeQuery(queryString: string): string {
    return this.normalizer.normalizeQuery(queryString);
  }

  /**
   * Checks whether a candidate URL should be crawled based on template sampling quota.
   */
  public shouldCrawlUrl(url: string, maxSamples?: number): boolean {
    return this.normalizer.shouldCrawlUrl(url, maxSamples);
  }

  /**
   * Non-mutating check if a candidate URL template has remaining sample budget.
   */
  public hasCrawlCapacity(url: string, maxSamples?: number): boolean {
    return this.normalizer.hasCrawlCapacity(url, maxSamples);
  }

  /**
   * Returns the count of discovered structural templates.
   */
  public getTemplateCount(): number {
    return this.normalizer.getTemplateCount();
  }

  /**
   * Returns details for all explored templates.
   */
  public getTemplateMetrics(): TemplateClusteringMetrics[] {
    return this.normalizer.getTemplateMetrics();
  }
}

export const pathTemplateClusterer = new PathTemplateClusterer();
