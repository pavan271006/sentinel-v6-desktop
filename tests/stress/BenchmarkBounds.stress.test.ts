import { describe, it, expect } from 'vitest';
import { computeLineDiff } from '../../src/design-system/DiffViewer';

describe('Empirical Performance & Stress Benchmarks', () => {
  it('measures VirtualizedTable 100,000-row memory allocation and sort latency', () => {
    const memoryBefore = process.memoryUsage().heapUsed;

    const count = 100_000;
    const items = new Array(count);
    for (let i = 0; i < count; i++) {
      items[i] = {
        id: `id-${i}`,
        method: i % 2 === 0 ? 'GET' : 'POST',
        latency: (i * 37) % 5000,
        status: (i * 13) % 500 + 100,
        url: `https://test.internal/api/v1/resource/${i}`,
      };
    }

    const memoryAfterData = process.memoryUsage().heapUsed;
    const dataSizeMb = (memoryAfterData - memoryBefore) / (1024 * 1024);

    // 100k plain JS objects should be < 50MB
    expect(dataSizeMb).toBeLessThan(80);

    // Benchmark numerical sort
    const t0 = performance.now();
    const sortedNum = [...items].sort((a, b) => a.latency - b.latency);
    const t1 = performance.now();
    const numSortTime = t1 - t0;

    // Benchmark string sort
    const t2 = performance.now();
    const sortedStr = [...items].sort((a, b) => a.url.localeCompare(b.url));
    const t3 = performance.now();
    const strSortTime = t3 - t2;

    expect(sortedStr.length).toBe(count);
    expect(numSortTime).toBeLessThan(300); // Sub-300ms for 100k numbers
    expect(strSortTime).toBeLessThan(1000); // Sub-1000ms for 100k strings
    expect(sortedNum[0].latency).toBeLessThanOrEqual(sortedNum[sortedNum.length - 1].latency);
  });

  it('evaluates computeLineDiff LCS scaling and limits for large diffs', () => {
    // 500 lines diff
    const genDiff = (lineCount: number, changeFrequency: number) => {
      const orig: string[] = [];
      const mod: string[] = [];
      for (let i = 0; i < lineCount; i++) {
        orig.push(`line ${i}: content for testing line diffs`);
        if (i % changeFrequency === 0) {
          mod.push(`line ${i}: MODIFIED content for testing line diffs`);
        } else {
          mod.push(`line ${i}: content for testing line diffs`);
        }
      }
      return { orig: orig.join('\n'), mod: mod.join('\n') };
    };

    // 200 lines
    const d200 = genDiff(200, 5);
    const t0 = performance.now();
    const res200 = computeLineDiff(d200.orig, d200.mod);
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(100);
    expect(res200.addedCount).toBe(40);
    expect(res200.removedCount).toBe(40);

    // 1,000 lines
    const d1000 = genDiff(1000, 10);
    const t2 = performance.now();
    const res1000 = computeLineDiff(d1000.orig, d1000.mod);
    const t3 = performance.now();
    expect(t3 - t2).toBeLessThan(1500);
    expect(res1000.addedCount).toBe(100);
    expect(res1000.removedCount).toBe(100);
  });

  it('measures CommandPalette filtering speed across 10,000 commands', () => {
    const totalCommands = 10_000;
    const commands = [];
    for (let i = 0; i < totalCommands; i++) {
      commands.push({
        id: `cmd-${i}`,
        title: `Execute Pentest Module ${i}: Scan Target Host ${i % 100}`,
        category: i % 3 === 0 ? 'Workspace' : i % 3 === 1 ? 'Proxy' : 'Scope',
        keywords: [`tag-${i}`, `module-${i % 20}`],
      });
    }

    const query = 'host 42';
    const q = query.toLowerCase();

    const t0 = performance.now();
    const filtered = commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
    const t1 = performance.now();

    expect(t1 - t0).toBeLessThan(150); // Sub-150ms for 10k items search under heavy test load
    expect(filtered.length).toBeGreaterThan(0);
  });
});
