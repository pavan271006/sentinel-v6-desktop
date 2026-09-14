import { create } from 'zustand';
import {
  UiTrafficEvent,
  UiFindingEvent,
  UiScanProgressEvent,
  UiTaskStatusEvent,
  UiScopeViolationEvent,
  SentinelUiEvent,
} from '../types/ipc';
import { AuditLogEntry } from '../types/models';

interface EventBusState {
  // Counters
  trafficCount: number;
  criticalFindingCount: number;
  runningTaskCount: number;
  scopeViolationsCount: number;

  // Event buffers (bounded ring buffers)
  recentTraffic: UiTrafficEvent[];
  recentFindings: UiFindingEvent[];
  recentScanProgress: Map<string, UiScanProgressEvent>;
  recentTasks: Map<string, UiTaskStatusEvent>;
  scopeViolations: UiScopeViolationEvent[];
  auditLogs: AuditLogEntry[];

  // IPC Health
  ipcMessagesReceived: number;
  ipcQueuePending: number;
  isStreamingConnected: boolean;

  // Actions
  handleIncomingEvent: (event: SentinelUiEvent) => void;
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  setStreamingConnected: (connected: boolean) => void;
  clearAuditLogs: () => void;
}

const MAX_RING_BUFFER_SIZE = 500;

export const useEventBusStore = create<EventBusState>((set) => ({
  trafficCount: 0,
  criticalFindingCount: 0,
  runningTaskCount: 0,
  scopeViolationsCount: 0,

  recentTraffic: [],
  recentFindings: [],
  recentScanProgress: new Map(),
  recentTasks: new Map(),
  scopeViolations: [],
  auditLogs: [],

  ipcMessagesReceived: 0,
  ipcQueuePending: 0,
  isStreamingConnected: true,

  handleIncomingEvent: (event) => {
    set((state) => {
      const msgs = state.ipcMessagesReceived + 1;

      switch (event.type) {
        case 'traffic': {
          const nextTraffic = [event.data, ...state.recentTraffic].slice(0, MAX_RING_BUFFER_SIZE);
          return {
            trafficCount: state.trafficCount + 1,
            recentTraffic: nextTraffic,
            ipcMessagesReceived: msgs,
          };
        }
        case 'finding': {
          const isCritical = event.data.severity === 'SEVERITY_CRITICAL';
          const nextFindings = [event.data, ...state.recentFindings].slice(0, MAX_RING_BUFFER_SIZE);
          return {
            criticalFindingCount: isCritical ? state.criticalFindingCount + 1 : state.criticalFindingCount,
            recentFindings: nextFindings,
            ipcMessagesReceived: msgs,
          };
        }
        case 'scan_progress': {
          const nextMap = new Map(state.recentScanProgress);
          nextMap.set(event.data.scanId, event.data);
          return { recentScanProgress: nextMap, ipcMessagesReceived: msgs };
        }
        case 'task_status': {
          const nextTasks = new Map(state.recentTasks);
          nextTasks.set(event.data.taskId, event.data);
          let running = 0;
          nextTasks.forEach((t) => {
            if (t.state === 'TASK_STATE_RUNNING') running++;
          });
          return { recentTasks: nextTasks, runningTaskCount: running, ipcMessagesReceived: msgs };
        }
        case 'scope_violation': {
          const nextViolations = [event.data, ...state.scopeViolations].slice(0, MAX_RING_BUFFER_SIZE);
          return {
            scopeViolationsCount: state.scopeViolationsCount + 1,
            scopeViolations: nextViolations,
            ipcMessagesReceived: msgs,
          };
        }
        default:
          return { ipcMessagesReceived: msgs };
      }
    });
  },

  addAuditLog: (entry) => {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    set((state) => ({
      auditLogs: [newLog, ...state.auditLogs].slice(0, MAX_RING_BUFFER_SIZE),
    }));
  },

  setStreamingConnected: (connected) => set({ isStreamingConnected: connected }),
  clearAuditLogs: () => set({ auditLogs: [] }),
}));
