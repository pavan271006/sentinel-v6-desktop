/**
 * UCMA-X — Bounded Concurrent Execution Engine
 * Manages an asynchronous worker pool with safety classification routing and adaptive rate throttling.
 */

import { TestSafetyClass } from './SemanticTestIntent';

export interface ExecutionTask<T> {
  id: string;
  safetyClass: TestSafetyClass;
  run: () => Promise<T>;
}

export class ConcurrentExecutor {
  private concurrencyLimit: number;
  private maxLimit: number;
  private activeWorkers: number = 0;
  private queue: Array<() => void> = [];
  private timingLaneLock: Promise<void> = Promise.resolve();
  private isAborted: boolean = false;

  constructor(defaultConcurrency: number = 10, maxConcurrency: number = 100) {
    this.concurrencyLimit = Math.min(Math.max(1, defaultConcurrency), maxConcurrency);
    this.maxLimit = maxConcurrency;
  }

  public abort(): void {
    this.isAborted = true;
    const queuedResolvers = [...this.queue];
    this.queue = [];
    queuedResolvers.forEach((resolve) => resolve());
  }

  public reset(): void {
    this.isAborted = false;
    this.queue = [];
  }

  public getConcurrency(): number {
    return this.concurrencyLimit;
  }

  public setConcurrency(limit: number): void {
    this.concurrencyLimit = Math.min(Math.max(1, limit), this.maxLimit);
  }

  /**
   * Submits a task to the executor according to its safety class.
   */
  public async submit<T>(task: ExecutionTask<T>): Promise<T> {
    if (this.isAborted) {
      throw new Error('Concurrent execution aborted');
    }

    if (task.safetyClass === 'TIMING_SENSITIVE') {
      // Route to dedicated sequential timing lane to prevent network jitter cross-contamination
      return this.executeInTimingLane(task.run);
    }

    if (task.safetyClass === 'STATE_DEPENDENT' || task.safetyClass === 'SESSION_SENSITIVE') {
      // Route to sequential state lane
      return this.executeInTimingLane(task.run);
    }

    // PARALLEL_SAFE: Route to bounded concurrent worker pool
    return this.executeInParallelPool(task.run);
  }

  /**
   * Executes a batch of PARALLEL_SAFE tasks concurrently with bounded worker pool.
   */
  public async mapParallel<T, R>(items: T[], fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
    if (this.isAborted) {
      return [];
    }
    const results: R[] = new Array(items.length);
    const tasks = items.map((item, idx) => ({
      id: `task_${idx}`,
      safetyClass: 'PARALLEL_SAFE' as TestSafetyClass,
      run: async () => {
        if (this.isAborted) return undefined as unknown as R;
        const res = await fn(item, idx);
        results[idx] = res;
        return res;
      },
    }));

    await Promise.all(tasks.map((t) => this.submit(t).catch((err) => {
      if (this.isAborted) return undefined;
      throw err;
    })));
    return results;
  }

  private async executeInParallelPool<T>(runFn: () => Promise<T>): Promise<T> {
    if (this.isAborted) {
      throw new Error('Execution aborted');
    }
    while (this.activeWorkers >= this.concurrencyLimit && !this.isAborted) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    if (this.isAborted) {
      throw new Error('Execution aborted');
    }

    this.activeWorkers++;
    try {
      if (this.isAborted) {
        throw new Error('Execution aborted');
      }
      return await runFn();
    } finally {
      this.activeWorkers--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  private async executeInTimingLane<T>(runFn: () => Promise<T>): Promise<T> {
    if (this.isAborted) {
      throw new Error('Execution aborted');
    }
    // Chain sequentially onto the timing lane lock
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.timingLaneLock;
    this.timingLaneLock = currentLock;

    await previousLock;
    try {
      if (this.isAborted) {
        throw new Error('Execution aborted');
      }
      return await runFn();
    } finally {
      releaseLock!();
    }
  }
}
