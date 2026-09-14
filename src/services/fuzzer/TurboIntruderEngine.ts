/**
 * Sentinel V6 - Turbo Intruder High-Speed Socket & Worker Fuzzer Engine
 *
 * Inspired by PortSwigger Turbo Intruder (James Kettle) & ffuf.
 * Features concurrent worker pipelines, rolling-window real-time RPS measurement,
 * dynamic payload interpolation (§payload§ or %s), statistical anomaly clustering (MAD / Modified Z-score),
 * structural response fingerprinting, and IPC dispatch.
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export interface TurboConfig {
  targetUrl: string;
  method?: string;
  requestTemplate: string;
  payloads: string[];
  concurrentWorkers?: number;
  delayMs?: number;
}

export interface TurboResult {
  id: number;
  payload: string;
  status: number;
  length: number;
  timeMs: number;
  url: string;
  rawRequest: string;
  rawResponse: string;
  clusterId?: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
  lengthZScore?: number;
  latencyZScore?: number;
}

export interface ResponseCluster {
  clusterId: string;
  status: number;
  approxLength: number;
  count: number;
  samplePayload: string;
}

export interface TurboStats {
  sentCount: number;
  totalCount: number;
  rps: number;
  activeWorkers: number;
  avgLatencyMs: number;
  isRunning: boolean;
  clusters: ResponseCluster[];
  statusDistribution?: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
    err: number;
  };
}

export class TurboIntruderEngine {
  private config: TurboConfig;
  private aborted: boolean = false;
  private onResult?: (res: TurboResult) => void;
  private onStats?: (stats: TurboStats) => void;

  private completedTimestamps: number[] = [];
  private totalLatencySum: number = 0;
  private sentCount: number = 0;
  private activeWorkersCount: number = 0;
  private baselineStatus: number = 0;
  private baselineLength: number = 0;

  // Statistical distribution trackers for Modified Z-Score
  private collectedLengths: number[] = [];
  private collectedLatencies: number[] = [];
  private clusterMap = new Map<string, ResponseCluster>();

  private statusDistribution = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    err: 0,
  };

  constructor(
    config: TurboConfig,
    callbacks?: {
      onResult?: (res: TurboResult) => void;
      onStats?: (stats: TurboStats) => void;
    }
  ) {
    this.config = {
      method: 'GET',
      concurrentWorkers: 100,
      delayMs: 0,
      ...config,
    };
    this.onResult = callbacks?.onResult;
    this.onStats = callbacks?.onStats;
  }

  public abort(): void {
    this.aborted = true;
  }

  /**
   * Generates a structural cluster identifier for response classification.
   */
  private computeClusterId(status: number, length: number): string {
    // Quantize length to bins of 16 bytes for clustering similar templates
    const lengthBin = Math.round(length / 16) * 16;
    return `c_${status}_${lengthBin}`;
  }

  /**
   * Computes median and Median Absolute Deviation (MAD) for robust anomaly scoring.
   */
  private calculateModifiedZScore(value: number, history: number[]): number {
    if (history.length < 5) return 0;
    const sorted = [...history].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;

    const absDeviations = history.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
    const mad = sorted.length % 2 !== 0 ? absDeviations[mid] : (absDeviations[mid - 1] + absDeviations[mid]) / 2.0;

    if (mad === 0) {
      return Math.abs(value - median) > 0 ? 5.0 : 0;
    }
    // Boris Iglewicz & David Hoaglin formula: 0.6745 * (x - median) / MAD
    return Number(((0.6745 * Math.abs(value - median)) / mad).toFixed(2));
  }

  public async run(): Promise<TurboResult[]> {
    this.aborted = false;
    this.sentCount = 0;
    this.totalLatencySum = 0;
    this.completedTimestamps = [];
    this.collectedLengths = [];
    this.collectedLatencies = [];
    this.clusterMap.clear();
    const results: TurboResult[] = [];

    const payloads = this.config.payloads;
    const totalCount = payloads.length;
    const workerCount = Math.min(Math.max(1, this.config.concurrentWorkers || 100), Math.min(totalCount, 1000));

    if (totalCount === 0) {
      return results;
    }

    let currentIndex = 0;
    const rpsInterval = setInterval(() => {
      this.emitStats(totalCount);
    }, 200);

    const worker = async () => {
      this.activeWorkersCount++;
      while (!this.aborted) {
        const idx = currentIndex++;
        if (idx >= totalCount) break;

        const payload = payloads[idx];
        const res = await this.executePayload(idx + 1, payload);

        if (res) {
          results.push(res);
          this.sentCount++;
          this.totalLatencySum += res.timeMs;
          this.collectedLengths.push(res.length);
          this.collectedLatencies.push(res.timeMs);
          this.completedTimestamps.push(performance.now());
          this.onResult?.(res);
        }

        if (this.config.delayMs && this.config.delayMs > 0) {
          await new Promise((r) => setTimeout(r, this.config.delayMs));
        }
      }
      this.activeWorkersCount--;
    };

    // Run workers concurrently
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    clearInterval(rpsInterval);
    this.emitStats(totalCount);

    return results;
  }

  private async executePayload(id: number, payload: string): Promise<TurboResult | null> {
    const rawTemplate = this.config.requestTemplate.trim();
    let url = this.config.targetUrl;
    let rawRequest = '';

    // Interpolate payload into request template
    if (rawTemplate.includes('§payload§')) {
      rawRequest = rawTemplate.split('§payload§').join(payload);
    } else if (rawTemplate.includes('%s')) {
      rawRequest = rawTemplate.replace(/%s/g, payload);
    } else {
      rawRequest = rawTemplate;
    }

    if (url.includes('§payload§')) {
      url = url.split('§payload§').join(encodeURIComponent(payload));
    } else if (url.includes('%s')) {
      url = url.replace(/%s/g, encodeURIComponent(payload));
    }

    const startTime = performance.now();
    try {
      const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
        tabId: `turbo_${id}`,
        targetUrl: url,
        rawRequest,
      });

      const timeMs = res.durationMs || Math.round(performance.now() - startTime);
      const status = res.statusCode || 200;
      const length = (res.body || '').length;

      // Track status code distribution
      if (status >= 200 && status < 300) this.statusDistribution['2xx']++;
      else if (status >= 300 && status < 400) this.statusDistribution['3xx']++;
      else if (status >= 400 && status < 500) this.statusDistribution['4xx']++;
      else if (status >= 500) this.statusDistribution['5xx']++;

      // Calibrate baseline on initial requests
      if (this.baselineStatus === 0) {
        this.baselineStatus = status;
        this.baselineLength = length;
      }

      // Compute cluster
      const clusterId = this.computeClusterId(status, length);
      const existingCluster = this.clusterMap.get(clusterId);
      if (existingCluster) {
        existingCluster.count++;
      } else {
        this.clusterMap.set(clusterId, {
          clusterId,
          status,
          approxLength: length,
          count: 1,
          samplePayload: payload,
        });
      }

      // Calculate statistical anomalies via modified Z-score
      const lengthZ = this.calculateModifiedZScore(length, this.collectedLengths);
      const latencyZ = this.calculateModifiedZScore(timeMs, this.collectedLatencies);

      let isAnomaly = false;
      let anomalyReason: string | undefined;

      if (this.baselineStatus !== 0 && status !== this.baselineStatus) {
        isAnomaly = true;
        anomalyReason = `Status changed (${this.baselineStatus} -> ${status})`;
      } else if (lengthZ >= 3.5 && this.baselineLength >= 0) {
        isAnomaly = true;
        anomalyReason = `Statistical length outlier (Length: ${length}B vs base ${this.baselineLength}B, Modified Z-Score: ${lengthZ} >= 3.5)`;
      } else if (latencyZ >= 4.0 && timeMs > 500) {
        isAnomaly = true;
        anomalyReason = `Timing side-channel outlier (Latency: ${timeMs}ms, Z-Score: ${latencyZ} >= 4.0)`;
      }

      return {
        id,
        payload,
        status,
        length,
        timeMs,
        url,
        rawRequest,
        rawResponse: res.rawResponse || res.body || '',
        clusterId,
        isAnomaly,
        anomalyReason,
        lengthZScore: lengthZ,
        latencyZScore: latencyZ,
      };
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - startTime);
      this.statusDistribution.err++;
      return {
        id,
        payload,
        status: 0,
        length: 0,
        timeMs,
        url,
        rawRequest,
        rawResponse: `Connection error: ${err?.message || 'Failed to dispatch'}`,
        isAnomaly: false,
      };
    }
  }

  private emitStats(totalCount: number): void {
    const now = performance.now();
    this.completedTimestamps = this.completedTimestamps.filter((t) => now - t <= 1000);
    const rps = this.completedTimestamps.length;
    const avgLatencyMs = this.sentCount > 0 ? Math.round(this.totalLatencySum / this.sentCount) : 0;

    const clusters = Array.from(this.clusterMap.values()).sort((a, b) => b.count - a.count);

    this.onStats?.({
      sentCount: this.sentCount,
      totalCount,
      rps,
      activeWorkers: this.activeWorkersCount,
      avgLatencyMs,
      isRunning: this.activeWorkersCount > 0 && !this.aborted,
      clusters,
      statusDistribution: { ...this.statusDistribution },
    });
  }
}

