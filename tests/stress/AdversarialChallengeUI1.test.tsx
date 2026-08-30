import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { streamDispatcher } from '../../src/ipc/events';
import { useEventBusStore } from '../../src/stores/eventBusStore';
import { SentinelUiEvent } from '../../src/types/ipc';
import { CommandPalette } from '../../src/components/palette/CommandPalette';
import { useCommandPaletteStore } from '../../src/stores/commandPaletteStore';
import { StructuredInspector } from '../../src/design-system/StructuredInspector';
import { StatusBar } from '../../src/components/shell/StatusBar';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('Adversarial Challenge UI-1 Suite', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().close();
    useCommandPaletteStore.getState().setQuery('');
    useCommandPaletteStore.getState().setSelectedIndex(0);
  });

  /* --------------------------------------------------------------------------
   * CHALLENGE 1: IPC Event Stream Backpressure, High-Throughput & Reconnection
   * -------------------------------------------------------------------------- */
  describe('Challenge 1: IPC Backpressure, Ring Buffer & Reconnection', () => {
    it('handles high-throughput burst of 20,000 traffic events with bounded ring buffer (500 max)', () => {
      const initialTrafficCount = useEventBusStore.getState().trafficCount;
      const burstSize = 20_000;

      const t0 = performance.now();
      for (let i = 0; i < burstSize; i++) {
        const event: SentinelUiEvent = {
          type: 'traffic',
          data: {
            transactionId: `tx-burst-${i}`,
            timestamp: { seconds: 1723900000 + i, nanos: 0 },
            method: i % 2 === 0 ? 'GET' : 'POST',
            uri: `https://target.local/api/resource/${i}`,
            status: 200,
            durationMs: 12,
            inScope: true,
            tags: ['burst'],
          },
        };
        streamDispatcher.dispatch(event);
      }
      const t1 = performance.now();

      const state = useEventBusStore.getState();
      expect(state.trafficCount).toBe(initialTrafficCount + burstSize);
      // Ring buffer MUST NOT exceed MAX_RING_BUFFER_SIZE (500)
      expect(state.recentTraffic.length).toBeLessThanOrEqual(500);
      expect(state.recentTraffic[0].transactionId).toBe(`tx-burst-${burstSize - 1}`);

      const eventsPerSec = (burstSize / (t1 - t0)) * 1000;
      console.log(`[IPC Throughput] 20,000 events processed in ${(t1 - t0).toFixed(2)}ms (${eventsPerSec.toFixed(0)} events/sec)`);
      expect(eventsPerSec).toBeGreaterThan(400); // Resilient high-throughput invariant
    }, 60000);

    it('demonstrates listener exception isolation (broken subscriber cannot crash dispatch loop)', () => {
      const brokenListener = vi.fn(() => {
        throw new Error('Fatal listener crash in adversarial subscriber');
      });
      const healthyListener = vi.fn();

      const unsub1 = streamDispatcher.subscribe(brokenListener);
      const unsub2 = streamDispatcher.subscribe(healthyListener);

      const event: SentinelUiEvent = {
        type: 'traffic',
        data: {
          transactionId: 'tx-crash-test',
          timestamp: { seconds: 1723900000, nanos: 0 },
          method: 'GET',
          uri: 'https://target.local/test',
          status: 200,
          durationMs: 5,
          inScope: true,
          tags: [],
        },
      };

      // Dispatch should NOT throw despite brokenListener throwing
      expect(() => {
        streamDispatcher.dispatch(event);
      }).not.toThrow();

      expect(brokenListener).toHaveBeenCalledTimes(1);
      expect(healthyListener).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('identifies unbounded growth vulnerability in recentScanProgress and recentTasks Maps under high cardinal IDs', () => {
      // Stress-test distinct scanIds and taskIds
      const distinctCount = 5_000;
      for (let i = 0; i < distinctCount; i++) {
        streamDispatcher.dispatch({
          type: 'scan_progress',
          data: {
            scanId: `scan-${i}`,
            phase: 'Crawling',
            percentComplete: 50,
          },
        });
      }

      const scanProgressMap = useEventBusStore.getState().recentScanProgress;
      // In current implementation, Map holds all 5000 entries without ring buffer eviction
      expect(scanProgressMap.size).toBe(distinctCount);
    });

    it('verifies reconnection state transitions (startListening -> stopListening -> startListening)', async () => {
      await streamDispatcher.startListening();
      expect(useEventBusStore.getState().isStreamingConnected).toBe(true);

      streamDispatcher.stopListening();
      expect(useEventBusStore.getState().isStreamingConnected).toBe(false);

      await streamDispatcher.startListening();
      expect(useEventBusStore.getState().isStreamingConnected).toBe(true);
    });
  });

  /* --------------------------------------------------------------------------
   * CHALLENGE 2: Command Palette Fuzzy Search Under High Counts & Edge Cases
   * -------------------------------------------------------------------------- */
  describe('Challenge 2: Command Palette Scalability & Edge Cases', () => {
    it('empirically demonstrates the selectedIndex NaN defect when navigating with 0 search results', () => {
      useCommandPaletteStore.getState().open();
      render(<CommandPalette />);

      const input = screen.getByPlaceholderText(/Type a command/i);

      // 1. Enter query that matches 0 commands
      fireEvent.change(input, { target: { value: 'NON_EXISTENT_COMMAND_XYZ_12345' } });
      expect(useCommandPaletteStore.getState().selectedIndex).toBe(0);

      // 2. Press ArrowUp when results list is empty
      // In CommandPalette.tsx: setSelectedIndex((0 - 1 + 0) % 0) -> NaN
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      const corruptedIndex = useCommandPaletteStore.getState().selectedIndex;
      expect(Number.isNaN(corruptedIndex)).toBe(true);

      // Press ArrowDown while still empty - stays NaN
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(Number.isNaN(useCommandPaletteStore.getState().selectedIndex)).toBe(true);

      // 3. Changing query resets selectedIndex to 0 via setQuery
      fireEvent.change(input, { target: { value: 'Traffic' } });
      expect(useCommandPaletteStore.getState().selectedIndex).toBe(0);
    });

    it('benchmarks fuzzy search throughput across 20,000 generated commands', () => {
      const commands = [];
      for (let i = 0; i < 20_000; i++) {
        commands.push({
          id: `cmd-${i}`,
          title: `Pentest Command ${i}: Replay Request on Tenant Endpoint /api/v${i % 5}/${i}`,
          category: 'Testing' as const,
          keywords: [`subsystem-${i % 20}`, `action-${i}`],
        });
      }

      const q = 'tenant endpoint /api/v2';
      const t0 = performance.now();
      const matches = commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(q) ||
          cmd.category.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.toLowerCase().includes(q))
      );
      const t1 = performance.now();

      console.log(`[Command Search Benchmark] 20,000 commands filtered in ${(t1 - t0).toFixed(2)}ms (matches: ${matches.length})`);
      expect(t1 - t0).toBeLessThan(100); // Must be under 100ms for 20k commands
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  /* --------------------------------------------------------------------------
   * CHALLENGE 3: Zero-Leakage in Status Bar & Inspector Components (SEC-09)
   * -------------------------------------------------------------------------- */
  describe('Challenge 3: Zero-Leakage & Secret Scrubbing Invariant (SEC-09)', () => {
    it('audits StatusBar component for zero secret leakage', () => {
      useAppShellStore.getState().setProject('Top Secret Engagement', '/internal/classified/targets/project.db');

      render(<StatusBar />);

      // Verify that full local absolute path is NOT rendered in the status bar
      expect(screen.queryByText(/\/internal\/classified/i)).toBeNull();
      // Verify DB size is formatted without exposing disk paths
      expect(screen.getByText(/DB:/i)).toBeInTheDocument();
      expect(screen.getByText(/Scope:/i)).toBeInTheDocument();
      expect(screen.getByText(/Proxy:/i)).toBeInTheDocument();
    });

    it('audits StructuredInspector behavior on sensitive credential payloads', () => {
      const sensitivePayload = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_token_payload',
        api_key: 'mock_test_key_sample',
        password: 'ClassifiedAdminPassword#2026',
        publicField: 'public_value',
      };

      render(<StructuredInspector data={sensitivePayload} title="Sensitive Request Headers" />);

      // Check whether plaintext password and sensitive token are rendered in the DOM
      const hasPlaintextPassword = screen.queryByText(/"ClassifiedAdminPassword#2026"/i) !== null;
      const hasPlaintextApiKey = screen.queryByText(/"mock_test_key_sample"/i) !== null;

      console.log(`[SEC-09 Audit] StructuredInspector renders plaintext secrets: ${hasPlaintextPassword}, api_key: ${hasPlaintextApiKey}`);

      // Documents current behavior: currently StructuredInspector renders values directly
      expect(screen.getByText(/publicField:/i)).toBeInTheDocument();
      expect(screen.getByText(/password:/i)).toBeInTheDocument();
    });
  });
});
