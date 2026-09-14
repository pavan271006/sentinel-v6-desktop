import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useToastStore } from '../stores/toastStore';
import {
  Play,
  Pause,
  Square,
  Search,
  HelpCircle,
  Settings as SettingsIcon,
  Clock,
  List,
  X,
  Plus,
  Filter,
  ChevronUp,
  ChevronDown,
  Minus,
  Maximize2,
  Minimize2,
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { generateRenderablePreviewHtml } from '../utils/repeaterUtils';
import { TlsFingerprintEngine } from '../services/sqlScanner/engine/TlsFingerprintEngine';


export interface AttackResultItem {
  id: number;
  payloads: string[];
  payloadSummary: string;
  statusCode: number;
  error: string;
  timeout: boolean;
  lengthBytes: number;
  timeMs: number;
  comment: string;
  rawRequest: string;
  rawResponse: string;
}

import { useIntruderStore } from '../stores/intruderStore';
import { useVpnRotatorStore } from '../stores/vpnRotatorStore';
import { ipcClient } from '../ipc/client';
import { ContextMenu, ContextMenuItem } from '../design-system/ContextMenu';
import { useAppShellStore } from '../stores/appShellStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { useComparerStore } from '../stores/comparerStore';
import { useDecoderStore } from '../stores/decoderStore';
import { useOrganizerStore } from '../stores/organizerStore';
import { HttpSyntaxHighlighter } from '../components/common/HttpSyntaxHighlighter';
import { SyntaxHighlightedEditor, SyntaxHighlightedEditorRef } from '../components/common/SyntaxHighlightedEditor';
import { BurpSearchBar, countSearchMatches } from '../components/common/BurpSearchBar';
import { PayloadConfigurationPanel } from '../components/fuzzer/PayloadConfigurationPanel';
import {
  IntruderCaptureFilterModal,
  IntruderCaptureFilterState,
  DEFAULT_INTRUDER_CAPTURE_FILTER,
} from '../components/fuzzer/IntruderCaptureFilterModal';
import {
  BurpPayloadType,
  PayloadConfigState,
  DEFAULT_PAYLOAD_CONFIG,
  generatePayloads,
} from '../utils/payloadGenerators';

export const FuzzerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTabId,
    renameTab,
    updateTab,
    targetUrl,
    setTargetUrl,
    requestText,
    setRequestText,
    attackType,
    setAttackType,
    payloadSets,
    selectedPosition,
    setSelectedPosition,
    setPayloadSetForPosition,
  } = useIntruderStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isAttackRunning = activeTab?.isAttackRunning || false;
  const showAttackModal = activeTab?.showAttackModal || false;
  const windowState = activeTab?.windowState || 'normal';
  const attackResults = activeTab?.attackResults || [];
  const selectedResultId = activeTab?.selectedResultId || null;
  const activeResultsSubtab = activeTab?.activeResultsSubtab || 'Results';
  const captureFilter = activeTab?.captureFilter || DEFAULT_INTRUDER_CAPTURE_FILTER;
  const applyCaptureFilter = activeTab?.applyCaptureFilter !== false;
  const concurrency = activeTab?.concurrency || 100;
  const delayMs = activeTab?.delayMs || 0;
  const updateHostHeader = activeTab?.updateHostHeader !== false;
  const updateContentLength = activeTab?.updateContentLength !== false;
  const stealthIpRotation = activeTab?.stealthIpRotation !== false;
  const ghostJitter = activeTab?.ghostJitter !== false;
  const browserMimicry = activeTab?.browserMimicry !== false;
  const adaptiveThrottle = activeTab?.adaptiveThrottle !== false;

  const setIsAttackRunning = (val: boolean) => updateTab(activeTabId, { isAttackRunning: val });
  const setShowAttackModal = (val: boolean) => updateTab(activeTabId, { showAttackModal: val });
  const setWindowState = (val: 'normal' | 'maximized' | 'minimized') => updateTab(activeTabId, { windowState: val });
  const setAttackResults = (val: AttackResultItem[]) => updateTab(activeTabId, { attackResults: val });
  const setSelectedResultId = (val: number | null) => updateTab(activeTabId, { selectedResultId: val });
  const setActiveResultsSubtab = (val: 'Results' | 'Positions') => updateTab(activeTabId, { activeResultsSubtab: val });
  const setCaptureFilter = (val: IntruderCaptureFilterState) => updateTab(activeTabId, { captureFilter: val });
  const setApplyCaptureFilter = (val: boolean) => updateTab(activeTabId, { applyCaptureFilter: val });
  const setConcurrency = (val: number) => updateTab(activeTabId, { concurrency: val });
  const setDelayMs = (val: number) => updateTab(activeTabId, { delayMs: val });
  const setUpdateHostHeader = (val: boolean) => updateTab(activeTabId, { updateHostHeader: val });
  const setUpdateContentLength = (val: boolean) => updateTab(activeTabId, { updateContentLength: val });
  const setStealthIpRotation = (val: boolean) => updateTab(activeTabId, { stealthIpRotation: val });
  const setGhostJitter = (val: boolean) => updateTab(activeTabId, { ghostJitter: val });
  const setBrowserMimicry = (val: boolean) => updateTab(activeTabId, { browserMimicry: val });
  const setAdaptiveThrottle = (val: boolean) => updateTab(activeTabId, { adaptiveThrottle: val });

  const editorRef = useRef<SyntaxHighlightedEditorRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editorSearch, setEditorSearch] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const totalMatches = useMemo(() => countSearchMatches(requestText, editorSearch), [requestText, editorSearch]);

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
  };

  // Right Drawer Tab: 'payloads' | 'resource_pool' | 'settings' | null
  const [activeRightDrawer, setActiveRightDrawer] = useState<'payloads' | 'resource_pool' | 'settings'>('payloads');

  // Payloads Settings
  const [payloadType, setPayloadType] = useState<BurpPayloadType>('Simple list');
  const [payloadConfig, setPayloadConfig] = useState<PayloadConfigState>(DEFAULT_PAYLOAD_CONFIG);

  // Payload Accordion States
  const [accPayloadConfig, setAccPayloadConfig] = useState(true);
  const [accPayloadEncoding, setAccPayloadEncoding] = useState(true);

  // Settings Panel Config
  const [setConnectionHeader, setSetConnectionHeader] = useState(false);

  // Attack Execution Modal UI
  const [showAttackMenu, setShowAttackMenu] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [requestTabMode, setRequestTabMode] = useState<'Pretty' | 'Raw' | 'Hex'>('Pretty');
  const [responseTabMode, setResponseTabMode] = useState<'Pretty' | 'Raw' | 'Hex' | 'Render'>('Pretty');
  const abortAttackRef = useRef(false);

  // Capture Filter State
  const [showCaptureFilterModal, setShowCaptureFilterModal] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(500);

  // Filter attack results based on capture filter settings
  const filteredAttackResults = useMemo(() => {
    if (!applyCaptureFilter) return attackResults;

    return attackResults.filter((r) => {
      // 1. Discard items without responses
      if (captureFilter.discardWithoutResponses && (r.error === 'YES' || !r.statusCode || r.statusCode === 0)) {
        return false;
      }

      // 2. Status code filter
      const code = r.statusCode;
      if (code >= 200 && code < 300 && !captureFilter.status2xx) return false;
      if (code >= 300 && code < 400 && !captureFilter.status3xx) return false;
      if (code >= 400 && code < 500 && !captureFilter.status4xx) return false;
      if (code >= 500 && !captureFilter.status5xx) return false;

      // 3. Search term filter
      if (captureFilter.searchTerm.trim()) {
        const term = captureFilter.searchTerm;
        const targetStr = `${r.payloads.join(' ')} ${r.rawResponse} ${r.statusCode} ${r.comment}`;
        let isMatch = false;

        if (captureFilter.regex) {
          try {
            const reg = new RegExp(term, captureFilter.caseSensitive ? '' : 'i');
            isMatch = reg.test(targetStr);
          } catch {
            isMatch = false;
          }
        } else {
          const textToSearch = captureFilter.caseSensitive ? targetStr : targetStr.toLowerCase();
          const queryTerm = captureFilter.caseSensitive ? term : term.toLowerCase();
          isMatch = textToSearch.includes(queryTerm);
        }

        if (captureFilter.negativeSearch ? isMatch : !isMatch) {
          return false;
        }
      }

      // 4. Annotation filter
      if (captureFilter.showOnlyNotes && (!r.comment || !r.comment.trim())) return false;

      return true;
    });
  }, [attackResults, applyCaptureFilter, captureFilter]);

  // Windowed virtual slice to guarantee 60 FPS DOM rendering during 1,000+ RPS bursts
  const visibleAttackResults = useMemo(() => {
    return filteredAttackResults.slice(0, displayLimit);
  }, [filteredAttackResults, displayLimit]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCaptureFilterModal) {
          setShowCaptureFilterModal(false);
          return;
        }
        if (showAttackModal) {
          abortAttackRef.current = true;
          setShowAttackModal(false);
          setWindowState('normal');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCaptureFilterModal, showAttackModal]);

  // Export handlers to save attack results to user's disk directory
  const handleSaveCsv = () => {
    if (attackResults.length === 0) {
      addToast({ type: 'warning', title: 'No attack results to save' });
      return;
    }
    const maxPos = Math.max(...attackResults.map((r) => r.payloads.length), 1);
    const headers = ['Request'];
    for (let i = 1; i <= maxPos; i++) headers.push(`Payload ${i}`);
    headers.push('Status code', 'Response received (ms)', 'Error', 'Timeout', 'Length (bytes)', 'Comment');

    const rows = attackResults.map((r) => {
      const row: Array<string | number | boolean> = [r.id];
      for (let i = 0; i < maxPos; i++) {
        row.push(`"${(r.payloads[i] || '').replace(/"/g, '""')}"`);
      }
      row.push(r.statusCode, r.timeMs, `"${r.error}"`, r.timeout, r.lengthBytes, `"${r.comment}"`);
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intruder_results_${targetUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Saved attack results as CSV' });
  };

  const handleSaveJson = () => {
    if (attackResults.length === 0) {
      addToast({ type: 'warning', title: 'No attack results to save' });
      return;
    }
    const jsonContent = JSON.stringify(
      {
        targetUrl,
        attackType,
        timestamp: new Date().toISOString(),
        requestTemplate: requestText,
        totalRequests: attackResults.length,
        results: attackResults,
      },
      null,
      2
    );
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intruder_results_${targetUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Saved attack results as JSON' });
  };

  const handleSaveRawTxt = () => {
    if (attackResults.length === 0) {
      addToast({ type: 'warning', title: 'No attack results to save' });
      return;
    }
    let txt = `=======================================================\r\n`;
    txt += `SENTINEL INTRUDER ATTACK DUMP\r\n`;
    txt += `Target: ${targetUrl}\r\n`;
    txt += `Date: ${new Date().toUTCString()}\r\n`;
    txt += `Requests: ${attackResults.length}\r\n`;
    txt += `=======================================================\r\n\r\n`;

    attackResults.forEach((r) => {
      txt += `\r\n============================= REQUEST #${r.id} (Status ${r.statusCode} | ${r.timeMs}ms | ${r.lengthBytes}B) =============================\r\n`;
      txt += `Payloads: ${r.payloads.join(' | ')}\r\n\r\n`;
      txt += `${r.rawRequest}\r\n\r\n`;
      txt += `----------------------------- RESPONSE #${r.id} -----------------------------\r\n`;
      txt += `${r.rawResponse}\r\n\r\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intruder_raw_dump_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Saved raw requests & responses to TXT' });
  };

  // Parse detected payload positions from request template
  const detectedPositions = useMemo(() => {
    const regex = /§([^§]*)§/g;
    const list: Array<{ index: number; name: string }> = [];
    let match: RegExpExecArray | null;
    let idx = 1;
    while ((match = regex.exec(requestText)) !== null) {
      list.push({
        index: idx,
        name: match[1] || `pos${idx}`,
      });
      idx++;
    }
    return list;
  }, [requestText]);

  const payloadPositionCount = detectedPositions.length;
  const currentPayloadList = payloadSets[selectedPosition] || payloadSets[1] || [];

  // Dynamically compute total request count based on Attack Type & Payload sets
  const computedRequestCount = useMemo(() => {
    const numPositions = detectedPositions.length;
    if (numPositions === 0) {
      return (payloadSets[1] || []).length || 0;
    }

    if (attackType === 'Sniper attack') {
      const set1Len =
        payloadSets[1] && payloadSets[1].length > 0
          ? payloadSets[1].length
          : (payloadSets[selectedPosition] || []).length;
      return numPositions * (set1Len || 0);
    }

    if (attackType === 'Battering ram attack') {
      const set1Len =
        payloadSets[1] && payloadSets[1].length > 0
          ? payloadSets[1].length
          : (payloadSets[selectedPosition] || []).length;
      return set1Len || 0;
    }

    if (attackType === 'Pitchfork attack') {
      const counts = detectedPositions.map((p) => (payloadSets[p.index] || []).length).filter((len) => len > 0);
      if (counts.length === 0) return 0;
      return Math.min(...counts);
    }

    if (attackType === 'Cluster bomb attack') {
      let product = 1;
      let hasAny = false;
      for (const p of detectedPositions) {
        const count = (payloadSets[p.index] || []).length;
        if (count > 0) {
          product *= count;
          hasAny = true;
        }
      }
      return hasAny ? product : 0;
    }

    return currentPayloadList.length;
  }, [attackType, detectedPositions, payloadSets, selectedPosition, currentPayloadList]);

  // Context Menu state
  const [editorContextMenu, setEditorContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    items: ContextMenuItem[];
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    items: [],
  });

  const handleTextareaContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const textarea = textareaRef.current;
    const val = textarea?.value || requestText;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const selectedText = val.substring(start, end);

    const items: ContextMenuItem[] = [
      {
        label: selectedText ? `Add § to selection (${selectedText.slice(0, 15)})` : `Add § markers`,
        shortcut: 'Ctrl+§',
        onClick: () => handleAddMarker(),
      },
      {
        label: 'Clear all § markers',
        onClick: () => handleClearMarkers(),
      },
      {
        label: 'Auto-detect § payload markers',
        onClick: () => handleAutoMarkers(),
      },
      { divider: true },
      {
        label: 'Send to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          const firstLine = val.split('\n')[0] || '';
          const [method] = firstLine.split(' ');
          useRepeaterStore.getState().createTabFromTransaction({
            url: targetUrl,
            method: method || 'POST',
            reqBody: val.split(/\r?\n\r?\n/)[1] || '',
            rawRequest: val,
            request: {
              method: method || 'POST',
              url: targetUrl,
              headers: [],
              bodyText: val.split(/\r?\n\r?\n/)[1] || '',
            },
          } as any);
          addToast({ type: 'success', title: 'Sent to Repeater', description: targetUrl });
        },
      },
      {
        label: 'Send to Sequencer',
        onClick: () => {
          useSequencerStore.getState().sendToSequencer({
            url: targetUrl,
            request: { method: 'POST', url: targetUrl, bodyText: val },
          });
          useAppShellStore.getState().setActiveWorkspace('sequencer');
          addToast({ type: 'info', title: 'Sent to Sequencer', description: targetUrl });
        },
      },
      {
        label: 'Send to Comparer',
        onClick: () => {
          useComparerStore.getState().sendToComparer({
            url: targetUrl,
            reqBody: val,
            rawRequest: val,
          } as any);
          useAppShellStore.getState().setActiveWorkspace('comparer');
          addToast({ type: 'info', title: 'Sent to Comparer', description: 'Populated diff buffer' });
        },
      },
      {
        label: 'Send to Decoder',
        onClick: () => {
          const textToSend = selectedText || val;
          useDecoderStore.getState().sendToDecoder(textToSend);
          useAppShellStore.getState().setActiveWorkspace('decoder');
          addToast({ type: 'info', title: 'Sent to Decoder' });
        },
      },
      {
        label: 'Send to Organizer',
        shortcut: 'Ctrl+O',
        onClick: () => {
          useOrganizerStore.getState().sendToOrganizer({
            url: targetUrl,
            method: val.split(' ')[0] || 'POST',
            reqBody: val,
          });
          useAppShellStore.getState().setActiveWorkspace('organizer');
          addToast({ type: 'success', title: 'Added to Organizer' });
        },
      },
      { divider: true },
      {
        label: 'Cut',
        shortcut: 'Ctrl+X',
        onClick: () => {
          if (selectedText) {
            navigator.clipboard.writeText(selectedText);
            const next = val.substring(0, start) + val.substring(end);
            setRequestText(next);
          }
        },
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        onClick: () => {
          navigator.clipboard.writeText(selectedText || val);
          addToast({ type: 'info', title: 'Copied to clipboard' });
        },
      },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        onClick: async () => {
          try {
            const text = await navigator.clipboard.readText();
            const next = val.substring(0, start) + text + val.substring(end);
            setRequestText(next);
          } catch (err) {
            addToast({ type: 'error', title: 'Paste failed' });
          }
        },
      },
      {
        label: 'Select all',
        shortcut: 'Ctrl+A',
        onClick: () => {
          textarea?.select();
        },
      },
    ];

    setEditorContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      items,
    });
  };

  const handleResultRowContextMenu = (e: React.MouseEvent, r: AttackResultItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedResultId(r.id);

    const items: ContextMenuItem[] = [
      {
        label: 'Send to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          const firstLine = (r.rawRequest || '').split('\n')[0] || '';
          const [method] = firstLine.split(' ');
          useRepeaterStore.getState().createTabFromTransaction({
            url: targetUrl,
            method: method || 'POST',
            rawRequest: r.rawRequest,
            reqBody: r.rawRequest.split(/\r?\n\r?\n/)[1] || '',
            request: {
              method: method || 'POST',
              url: targetUrl,
              headers: [],
              bodyText: r.rawRequest.split(/\r?\n\r?\n/)[1] || '',
            },
          } as any);
          addToast({ type: 'success', title: `Sent Request #${r.id} to Repeater` });
        },
      },
      {
        label: 'Send to Intruder',
        shortcut: 'Ctrl+I',
        onClick: () => {
          setRequestText(r.rawRequest);
          addToast({ type: 'success', title: `Loaded Request #${r.id} into Intruder` });
        },
      },
      {
        label: 'Send to Sequencer',
        onClick: () => {
          useSequencerStore.getState().sendToSequencer({
            url: targetUrl,
            request: { method: 'POST', url: targetUrl, bodyText: r.rawRequest },
          });
          useAppShellStore.getState().setActiveWorkspace('sequencer');
          addToast({ type: 'info', title: `Sent Request #${r.id} to Sequencer` });
        },
      },
      {
        label: 'Send to Comparer',
        onClick: () => {
          useComparerStore.getState().sendToComparer({
            url: targetUrl,
            rawRequest: r.rawRequest,
            rawResponse: r.rawResponse,
          } as any);
          useAppShellStore.getState().setActiveWorkspace('comparer');
          addToast({ type: 'info', title: `Sent Request #${r.id} to Comparer` });
        },
      },
      {
        label: 'Send to Decoder',
        onClick: () => {
          useDecoderStore.getState().sendToDecoder(r.payloadSummary || r.payloads.join(' '));
          useAppShellStore.getState().setActiveWorkspace('decoder');
          addToast({ type: 'info', title: `Sent Payload #${r.id} to Decoder` });
        },
      },
      {
        label: 'Send to Organizer',
        shortcut: 'Ctrl+O',
        onClick: () => {
          useOrganizerStore.getState().sendToOrganizer({
            url: targetUrl,
            method: (r.rawRequest || '').split(' ')[0] || 'POST',
            reqBody: r.rawRequest,
          });
          useAppShellStore.getState().setActiveWorkspace('organizer');
          addToast({ type: 'success', title: `Added Request #${r.id} to Organizer` });
        },
      },
      { divider: true },
      {
        label: 'Copy URL',
        onClick: () => {
          navigator.clipboard.writeText(targetUrl);
          addToast({ type: 'info', title: 'Copied Target URL' });
        },
      },
      {
        label: 'Copy raw request',
        onClick: () => {
          navigator.clipboard.writeText(r.rawRequest);
          addToast({ type: 'info', title: `Copied Request #${r.id}` });
        },
      },
      {
        label: 'Copy raw response',
        onClick: () => {
          navigator.clipboard.writeText(r.rawResponse);
          addToast({ type: 'info', title: `Copied Response #${r.id}` });
        },
      },
    ];

    setEditorContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      items,
    });
  };

  const handleInspectorContextMenu = (e: React.MouseEvent, text: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();

    const selectedText = window.getSelection()?.toString() || text;

    const items: ContextMenuItem[] = [
      {
        label: 'Send to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          const firstLine = text.split('\n')[0] || '';
          const [method] = firstLine.split(' ');
          useRepeaterStore.getState().createTabFromTransaction({
            url: targetUrl,
            method: method || 'POST',
            rawRequest: text,
            reqBody: text.split(/\r?\n\r?\n/)[1] || '',
            request: {
              method: method || 'POST',
              url: targetUrl,
              headers: [],
              bodyText: text.split(/\r?\n\r?\n/)[1] || '',
            },
          } as any);
          addToast({ type: 'success', title: 'Sent to Repeater' });
        },
      },
      {
        label: 'Send to Comparer',
        onClick: () => {
          useComparerStore.getState().sendToComparer({
            url: targetUrl,
            reqBody: selectedText,
          } as any);
          useAppShellStore.getState().setActiveWorkspace('comparer');
          addToast({ type: 'info', title: 'Sent to Comparer' });
        },
      },
      {
        label: 'Send to Decoder',
        onClick: () => {
          useDecoderStore.getState().sendToDecoder(selectedText);
          useAppShellStore.getState().setActiveWorkspace('decoder');
          addToast({ type: 'info', title: 'Sent to Decoder' });
        },
      },
      { divider: true },
      {
        label: `Copy ${label}`,
        shortcut: 'Ctrl+C',
        onClick: () => {
          navigator.clipboard.writeText(selectedText);
          addToast({ type: 'info', title: `Copied ${label}` });
        },
      },
    ];

    setEditorContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      items,
    });
  };

  // Add § to selection or cursor position
  const handleAddMarker = () => {
    const textarea = editorRef.current?.getTextarea() || textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = val.substring(start, end);
      let nextText: string;
      if (selected.startsWith('§') && selected.endsWith('§') && selected.length >= 2) {
        nextText = val.substring(0, start) + selected.slice(1, -1) + val.substring(end);
      } else {
        nextText = val.substring(0, start) + '§' + selected + '§' + val.substring(end);
      }
      setRequestText(nextText);
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start, start + selected.length + 2);
        }
      }, 10);
      addToast({ type: 'success', title: 'Added § Marker' });
      return;
    }

    // Also support window selection if user selected text with mouse
    const winSel = window.getSelection();
    const selStr = winSel ? winSel.toString() : '';
    if (selStr && requestText.includes(selStr)) {
      if (selStr.startsWith('§') && selStr.endsWith('§') && selStr.length >= 2) {
        setRequestText(requestText.replace(selStr, selStr.slice(1, -1)));
      } else {
        setRequestText(requestText.replace(selStr, `§${selStr}§`));
      }
      addToast({ type: 'success', title: `Added § to "${selStr}"` });
      return;
    }

    if (textarea) {
      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextText = val.substring(0, start) + '§§' + val.substring(end);
      setRequestText(nextText);
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start + 1, start + 1);
        }
      }, 10);
      addToast({ type: 'info', title: 'Inserted § markers at cursor' });
    }
  };

  // Clear § markers from dragged selection or clear all if none selected
  const handleClearMarkers = () => {
    const textarea = editorRef.current?.getTextarea() || textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = val.substring(start, end);
      const cleaned = selected.replace(/§/g, '');
      const nextText = val.substring(0, start) + cleaned + val.substring(end);
      setRequestText(nextText);
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start, start + cleaned.length);
        }
      }, 10);
      addToast({ type: 'info', title: 'Cleared § markers from selection' });
      return;
    }

    const winSel = window.getSelection();
    const selStr = winSel ? winSel.toString() : '';
    if (selStr && requestText.includes(selStr)) {
      const cleaned = selStr.replace(/§/g, '');
      setRequestText(requestText.replace(selStr, cleaned));
      addToast({ type: 'info', title: 'Cleared § markers from selection' });
      return;
    }

    setRequestText(requestText.replace(/§/g, ''));
    addToast({ type: 'info', title: 'Cleared all § markers' });
  };

  // Auto-place markers on query params, cookies, body values
  const handleAutoMarkers = () => {
    let text = requestText;
    // 1. Query params
    text = text.replace(/([?&][a-zA-Z0-9_-]+=)([^&\s\r\n#§]+)/g, '$1§$2§');
    // 2. Body params
    const parts = text.split(/\r?\n\r?\n/);
    if (parts.length > 1) {
      const head = parts[0];
      let body = parts.slice(1).join('\r\n\r\n');
      if (body.includes('=') && !body.includes('§')) {
        body = body.replace(/([a-zA-Z0-9_-]+=)([^&\s\r\n#§]+)/g, '$1§$2§');
      } else if (body.startsWith('{') || body.startsWith('[')) {
        body = body.replace(/"([a-zA-Z0-9_-]+)":\s*"([^"§]+)"/g, '"$1": "§$2§"');
      }
      text = `${head}\r\n\r\n${body}`;
    }
    setRequestText(text);
    addToast({ type: 'success', title: 'Auto-placed § payload markers' });
  };

  const handleStartAttack = async () => {
    const currentTabId = activeTabId;
    setDisplayLimit(500);
    updateTab(currentTabId, {
      showAttackModal: true,
      isAttackRunning: true,
      attackResults: [],
      selectedResultId: null,
    });
    abortAttackRef.current = false;

    // 1. Extract position matches
    const posRegex = /§([^§]*)§/g;
    const posList: Array<{ index: number; defaultVal: string }> = [];
    let pMatch: RegExpExecArray | null;
    let pIdx = 1;
    while ((pMatch = posRegex.exec(requestText)) !== null) {
      posList.push({ index: pIdx, defaultVal: pMatch[1] });
      pIdx++;
    }

    const numPositions = posList.length;

    // 2. Build permutations according to attackType
    interface Permutation {
      payloads: string[];
    }
    const permutations: Permutation[] = [];

    if (numPositions === 0) {
      permutations.push({ payloads: [] });
    } else if (attackType === 'Sniper attack') {
      const set1 =
        payloadSets[1] && payloadSets[1].length > 0
          ? payloadSets[1]
          : (payloadSets[selectedPosition] || ['admin', 'test']);
      for (let posI = 0; posI < numPositions; posI++) {
        for (const item of set1) {
          const rowPayloads = posList.map((p, idx) => (idx === posI ? item : p.defaultVal));
          permutations.push({ payloads: rowPayloads });
        }
      }
    } else if (attackType === 'Battering ram attack') {
      const set1 =
        payloadSets[1] && payloadSets[1].length > 0
          ? payloadSets[1]
          : (payloadSets[selectedPosition] || ['admin', 'test']);
      for (const item of set1) {
        permutations.push({ payloads: posList.map(() => item) });
      }
    } else if (attackType === 'Pitchfork attack') {
      const counts = posList.map((p) => (payloadSets[p.index] || []).length);
      const minLen = Math.min(...counts.map((c) => c || 0));
      const effectiveLen = minLen > 0 ? minLen : Math.max(...counts, 1);
      for (let step = 0; step < effectiveLen; step++) {
        const rowPayloads = posList.map((p) => {
          const pSet = payloadSets[p.index] || payloadSets[1] || [];
          return pSet[step] !== undefined ? pSet[step] : p.defaultVal;
        });
        permutations.push({ payloads: rowPayloads });
      }
    } else if (attackType === 'Cluster bomb attack') {
      let combos: string[][] = [[]];
      for (let i = 0; i < numPositions; i++) {
        const pSet =
          payloadSets[posList[i].index] && payloadSets[posList[i].index].length > 0
            ? payloadSets[posList[i].index]
            : [posList[i].defaultVal];
        const nextCombos: string[][] = [];
        for (const prevCombo of combos) {
          for (const item of pSet) {
            nextCombos.push([...prevCombo, item]);
          }
        }
        combos = nextCombos;
      }
      for (const combo of combos) {
        permutations.push({ payloads: combo });
      }
    }

    addToast({
      type: 'info',
      title: 'Intruder Attack Launched',
      description: `Dispatching ${permutations.length} HTTP requests against ${targetUrl}...`,
    });

    const buildReplacedRequest = (rowPayloads: string[], rotatedIp?: string | null) => {
      let replaced = requestText;
      let counter = 0;
      replaced = replaced.replace(/§([^§]*)§/g, () => {
        const val = rowPayloads[counter] !== undefined ? rowPayloads[counter] : '';
        counter++;
        return val;
      });

      if (updateHostHeader && targetUrl) {
        try {
          const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
          replaced = replaced.replace(/Host:\s*[^\r\n]+/i, `Host: ${u.host}`);
        } catch {}
      }

      // Stealth Mode: Per-request IP Rotation & Cooldown Egress Spoofing
      if (rotatedIp) {
        // Strip previous spoofed headers to avoid duplicates
        replaced = replaced.replace(/^(?:X-Forwarded-For|X-Real-IP|X-Client-IP|CF-Connecting-IP|True-Client-IP|X-Cluster-Client-IP|X-Forwarded-Host|Forwarded):[^\r\n]*\r?\n?/gim, '');
        
        const ipHeaders = `X-Forwarded-For: ${rotatedIp}\r\nX-Real-IP: ${rotatedIp}\r\nCF-Connecting-IP: ${rotatedIp}\r\nTrue-Client-IP: ${rotatedIp}`;
        
        if (/Host:[^\r\n]*/i.test(replaced)) {
          replaced = replaced.replace(/(Host:[^\r\n]*\r?\n?)/i, `$1${ipHeaders}\r\n`);
        } else {
          const crlfEnd = replaced.indexOf('\r\n\r\n');
          const lfEnd = replaced.indexOf('\n\n');
          if (crlfEnd !== -1) {
            replaced = replaced.slice(0, crlfEnd) + '\r\n' + ipHeaders + replaced.slice(crlfEnd);
          } else if (lfEnd !== -1) {
            replaced = replaced.slice(0, lfEnd) + '\n' + ipHeaders + replaced.slice(lfEnd);
          } else {
            replaced = replaced.trimEnd() + '\r\n' + ipHeaders + '\r\n\r\n';
          }
        }
      }

      if (updateContentLength) {
        const p = replaced.split(/\r?\n\r?\n/);
        if (p.length > 1) {
          const bodyBytes = new TextEncoder().encode(p.slice(1).join('\r\n\r\n')).length;
          replaced = replaced.replace(/Content-Length:\s*\d+/i, `Content-Length: ${bodyBytes}`);
        }
      }

      // Intelligent Connection header handling for socket pooling and maximum throughput
      if (setConnectionHeader) {
        if (replaced.toLowerCase().includes('connection:')) {
          replaced = replaced.replace(/connection:\s*[^\r\n]+/i, 'Connection: close');
        } else {
          const headerEnd = replaced.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            replaced = replaced.slice(0, headerEnd) + '\r\nConnection: close' + replaced.slice(headerEnd);
          }
        }
      } else {
        if (replaced.toLowerCase().includes('connection:')) {
          replaced = replaced.replace(/connection:\s*[^\r\n]+/i, 'Connection: keep-alive');
        } else {
          const headerEnd = replaced.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            replaced = replaced.slice(0, headerEnd) + '\r\nConnection: keep-alive' + replaced.slice(headerEnd);
          }
        }
      }

      // Modern Browser Fingerprint & Header Mimicry (Chrome 130 Profile Alignment)
      if (browserMimicry) {
        if (!/User-Agent:[^\r\n]*/i.test(replaced)) {
          replaced = replaced.replace(/(Host:[^\r\n]*\r?\n?)/i, `$1User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36\r\n`);
        }
        if (!/sec-ch-ua:[^\r\n]*/i.test(replaced)) {
          replaced = replaced.replace(/(Host:[^\r\n]*\r?\n?)/i, `$1sec-ch-ua: "Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"\r\nsec-ch-ua-mobile: ?0\r\nsec-ch-ua-platform: "Windows"\r\n`);
        }
        if (!/Sec-Fetch-Dest:[^\r\n]*/i.test(replaced)) {
          replaced = replaced.replace(/(Host:[^\r\n]*\r?\n?)/i, `$1Sec-Fetch-Site: same-origin\r\nSec-Fetch-Mode: cors\r\nSec-Fetch-Dest: empty\r\n`);
        }
      }

      return replaced;
    };

    const totalPermutations = permutations.length;
    const resultsBuffer: AttackResultItem[] = new Array(totalPermutations);
    const poolSize = Math.max(1, Math.min(concurrency || 30, 1000));
    const attackStartTime = Date.now();
    let completedCount = 0;
    let nextIndex = 0;
    let dirty = false;
    let lastFlushTime = Date.now();

    const flushResults = (force = false) => {
      const now = Date.now();
      if (!force && now - lastFlushTime < 50) return; // 20 FPS throttle to protect React rendering loop
      lastFlushTime = now;
      dirty = false;

      // Extract results in natural ID-sorted order up to current index
      const activeList: AttackResultItem[] = [];
      const limit = Math.min(totalPermutations, nextIndex + 10);
      for (let i = 0; i < limit; i++) {
        if (resultsBuffer[i] !== undefined) {
          activeList.push(resultsBuffer[i]);
        }
      }

      updateTab(currentTabId, (prev) => ({
        attackResults: activeList,
        selectedResultId: prev.selectedResultId ?? (activeList[0]?.id ?? null),
      }));
    };

    const flushInterval = setInterval(() => {
      if (dirty && !abortAttackRef.current) {
        flushResults();
      }
    }, 50);

    const worker = async () => {
      while (nextIndex < totalPermutations && !abortAttackRef.current) {
        const reqIndex = nextIndex++;
        const perm = permutations[reqIndex];
        const rotatedIp = stealthIpRotation ? useVpnRotatorStore.getState().getStealthIp(25000) : null;
        const wireReq = buildReplacedRequest(perm.payloads, rotatedIp);
        const startMs = Date.now();
        let execResult;

        if (delayMs > 0 && reqIndex > 0) {
          const effectiveDelay = ghostJitter
            ? TlsFingerprintEngine.generateGhostJitterMs(delayMs / 1000)
            : delayMs;
          await new Promise((resolve) => setTimeout(resolve, effectiveDelay));
        }

        try {
          execResult = await ipcClient.sendRepeaterRequest({
            tabId: `intruder-${currentTabId}-${reqIndex}`,
            targetUrl,
            rawRequest: wireReq,
          });
        } catch (err: any) {
          execResult = {
            statusCode: 0,
            statusText: 'Socket Error',
            durationMs: Date.now() - startMs,
            rawResponse: `HTTP/1.1 000 Network Error\r\n\r\n${String(err)}`,
            sizeBytes: 0,
            error: String(err),
          };
        }

        const dur = execResult.durationMs || (Date.now() - startMs);
        const rawRes = execResult.rawResponse || '';
        const status =
          execResult.statusCode ||
          (rawRes.match(/HTTP\/[0-9.]+\s+(\d+)/)?.[1] ? parseInt(RegExp.$1, 10) : 0);
        const length = execResult.sizeBytes || rawRes.length || 0;

        // Adaptive Backoff: If target triggers 429 Too Many Requests or 503, pause smoothly without failing
        if (adaptiveThrottle && (status === 429 || status === 503)) {
          const retryHeader = rawRes.match(/Retry-After:\s*(\d+)/i)?.[1];
          const backoffMs = retryHeader ? parseInt(retryHeader, 10) * 1000 : 2500;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }

        // Response Body Storage: Store up to 512KB per request/response so full HTML/JSON is visible without memory blowouts
        const MAX_STORED_BODY_PREVIEW = 512 * 1024;
        const pagedRawResponse =
          rawRes.length > MAX_STORED_BODY_PREVIEW
            ? rawRes.slice(0, MAX_STORED_BODY_PREVIEW) +
              `\r\n\r\n[... response body truncated (${length} bytes total, exceeding 512KB) ...]`
            : rawRes;

        const pagedRawRequest =
          wireReq.length > MAX_STORED_BODY_PREVIEW
            ? wireReq.slice(0, MAX_STORED_BODY_PREVIEW) +
              `\r\n\r\n[... request body truncated (${wireReq.length} bytes total, exceeding 512KB) ...]`
            : wireReq;

        const item: AttackResultItem = {
          id: reqIndex + 1,
          payloads: perm.payloads,
          payloadSummary: perm.payloads.join(' | ') || '(default)',
          statusCode: status,
          error: execResult.error || (status === 0 ? 'Network Error' : ''),
          timeout: !!execResult.error?.includes('timed out'),
          lengthBytes: length,
          timeMs: dur,
          comment: status === 302 ? 'Redirect' : status === 200 ? 'OK' : status === 401 ? 'Unauthorized' : '',
          rawRequest: pagedRawRequest,
          rawResponse: pagedRawResponse,
        };

        resultsBuffer[reqIndex] = item;
        completedCount++;
        dirty = true;

        if (Date.now() - lastFlushTime >= 33) {
          flushResults();
        }

        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    };

    const workers = Array.from({ length: poolSize }, () => worker());
    await Promise.all(workers);

    clearInterval(flushInterval);
    flushResults(true);

    const totalSeconds = Math.max(0.01, (Date.now() - attackStartTime) / 1000);
    const avgRps = Math.round(completedCount / totalSeconds);

    updateTab(currentTabId, { isAttackRunning: false });
    addToast({
      type: 'success',
      title: 'Intruder Attack Finished',
      description: `Dispatched ${completedCount} requests in ${totalSeconds.toFixed(1)}s (~${avgRps.toLocaleString()} RPS).`,
    });
  };

  const selectedResult = attackResults.find((r) => r.id === selectedResultId) || attackResults[0];

  // Attack Results Modal Search Bar State
  const [modalRequestSearch, setModalRequestSearch] = useState('');
  const [modalRequestActiveMatch, setModalRequestActiveMatch] = useState(0);
  const [modalResponseSearch, setModalResponseSearch] = useState('');
  const [modalResponseActiveMatch, setModalResponseActiveMatch] = useState(0);

  const modalRequestTotalMatches = useMemo(
    () => countSearchMatches(selectedResult?.rawRequest || requestText, modalRequestSearch),
    [selectedResult?.rawRequest, requestText, modalRequestSearch]
  );

  const modalResponseTotalMatches = useMemo(
    () => countSearchMatches(selectedResult?.rawResponse || '', modalResponseSearch),
    [selectedResult?.rawResponse, modalResponseSearch]
  );

  const handleModalRequestPrevMatch = () => {
    if (modalRequestTotalMatches === 0) return;
    setModalRequestActiveMatch((prev) => (prev > 0 ? prev - 1 : modalRequestTotalMatches - 1));
  };

  const handleModalRequestNextMatch = () => {
    if (modalRequestTotalMatches === 0) return;
    setModalRequestActiveMatch((prev) => (prev < modalRequestTotalMatches - 1 ? prev + 1 : 0));
  };

  const handleModalResponsePrevMatch = () => {
    if (modalResponseTotalMatches === 0) return;
    setModalResponseActiveMatch((prev) => (prev > 0 ? prev - 1 : modalResponseTotalMatches - 1));
  };

  const handleModalResponseNextMatch = () => {
    if (modalResponseTotalMatches === 0) return;
    setModalResponseActiveMatch((prev) => (prev < modalResponseTotalMatches - 1 ? prev + 1 : 0));
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* 1. Intruder Subtabs Strip */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-2.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {tabs.map((t, idx) => {
            const isActive = t.id === activeTabId;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTabId(t.id)}
                onDoubleClick={() => {
                  const newName = prompt('Rename Intruder tab:', t.title);
                  if (newName && newName.trim()) {
                    renameTab(t.id, newName.trim());
                  }
                }}
                className={`group flex items-center gap-2 px-3 py-1 text-xs rounded-md cursor-pointer transition-all duration-150 max-w-[220px] font-mono select-none ${
                  isActive
                    ? 'bg-[#1e1f22] text-[#f37021] border border-[#3e4249] shadow-sm font-semibold'
                    : 'bg-[#1e1f22]/40 text-[#9da5b4] hover:text-[#dfdfdf] hover:bg-[#1e1f22]/80 border border-transparent hover:border-[#313438]'
                }`}
              >
                <span className="truncate">{t.title || `${idx + 1}`}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                    className="p-0.5 rounded-full hover:bg-[#3e4249] text-[#6f737a] hover:text-white transition-colors"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => createTab()}
            className="p-1 text-[#9da5b4] hover:text-white hover:bg-[#1e1f22] border border-transparent hover:border-[#313438] rounded-md transition-all ml-0.5"
            title="New Intruder Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[#9da5b4]">
          <Search className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* 2. Attack Type Selector & Start Attack Bar */}
      <div className="h-10 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <HelpCircle className="w-4 h-4 text-[#8c9099] flex-shrink-0" />
          <div className="relative flex-1">
            <select
              value={attackType}
              onChange={(e) => setAttackType(e.target.value as any)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-[#2b2d30] text-white px-2.5 py-1 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none text-xs"
            >
              <option value="Sniper attack" className="bg-[#2b2d30] text-[#dfdfdf]">Sniper attack</option>
              <option value="Battering ram attack" className="bg-[#2b2d30] text-[#dfdfdf]">Battering ram attack</option>
              <option value="Pitchfork attack" className="bg-[#2b2d30] text-[#dfdfdf]">Pitchfork attack</option>
              <option value="Cluster bomb attack" className="bg-[#2b2d30] text-[#dfdfdf]">Cluster bomb attack</option>
            </select>
          </div>
        </div>

        {/* Orange Start Attack Button */}
        <button
          onClick={handleStartAttack}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white font-bold text-xs shadow-md transition-all duration-150 active:scale-95"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start attack</span>
        </button>
      </div>

      {/* 3. Target Configuration Row */}
      <div className="h-9 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center gap-4 px-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <span className="text-xs text-[#9da5b4] font-medium">Target</span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="flex-1 bg-[#141517] text-white font-mono px-2.5 py-0.5 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none text-xs"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-[#c4c7c5] cursor-pointer">
          <input
            type="checkbox"
            checked={updateHostHeader}
            onChange={(e) => setUpdateHostHeader(e.target.checked)}
            className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021] focus:ring-0"
          />
          <span>Update Host header to match target</span>
        </label>
      </div>

      {/* 4. Positions Action Bar & View Mode Selector */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white mr-1">Positions</span>
          <button
            onClick={handleAddMarker}
            className="px-2.5 py-0.5 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] text-xs font-medium transition-colors"
          >
            Add §
          </button>
          <button
            onClick={handleClearMarkers}
            className="px-2.5 py-0.5 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] text-xs font-medium transition-colors"
          >
            Clear §
          </button>
          <button
            onClick={handleAutoMarkers}
            className="px-2.5 py-0.5 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] text-xs font-medium transition-colors"
          >
            Auto §
          </button>
        </div>

        {/* Right Drawer Toggle Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveRightDrawer('payloads')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeRightDrawer === 'payloads'
                ? 'bg-[#3e4249] text-white'
                : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Payloads</span>
          </button>
          <button
            onClick={() => setActiveRightDrawer('resource_pool')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeRightDrawer === 'resource_pool'
                ? 'bg-[#3e4249] text-white'
                : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Resource pool</span>
          </button>
          <button
            onClick={() => setActiveRightDrawer('settings')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeRightDrawer === 'settings'
                ? 'bg-[#3e4249] text-white'
                : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 5. Main Center Area: Request Editor + Right Sidebar Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Request Editor Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#141517]">
          {/* Live Syntax-Highlighted + Directly Editable Request Canvas */}
          <div className="flex-1 overflow-hidden p-2">
            <SyntaxHighlightedEditor
              ref={editorRef}
              value={requestText}
              onChange={setRequestText}
              isIntruder={true}
              searchQuery={editorSearch}
              activeMatchIndex={activeMatchIndex}
              onContextMenu={handleTextareaContextMenu}
            />
          </div>

          {/* Burp Suite Exact Bottom Search Bar */}
          <BurpSearchBar
            searchQuery={editorSearch}
            onSearchChange={(val) => {
              setEditorSearch(val);
              setActiveMatchIndex(0);
            }}
            activeMatchIndex={activeMatchIndex}
            totalMatches={totalMatches}
            onPrevMatch={handlePrevMatch}
            onNextMatch={handleNextMatch}
            selectionInfo={`${payloadPositionCount} payload positions`}
          />
        </div>

        {/* Right Drawer (Payloads | Resource Pool | Settings) */}
        {activeRightDrawer && (
          <div className="w-96 bg-[#282b30] border-l border-[#1e1f22] flex flex-col flex-shrink-0 min-h-0 text-xs">
            {/* Drawer Header */}
            <div className="h-8 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3">
              <span className="font-bold text-white text-xs capitalize">
                {activeRightDrawer === 'payloads' ? 'Payloads' : activeRightDrawer === 'resource_pool' ? 'Resource pool' : 'Settings'}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setActiveRightDrawer(null as any)} className="p-1 hover:text-white text-[#9da5b4]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {activeRightDrawer === 'payloads' && (
                <>
                  {/* Payload Position & Type Selectors */}
                  <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#9da5b4]">Payload position:</span>
                      <select
                        value={selectedPosition}
                        onChange={(e) => setSelectedPosition(parseInt(e.target.value, 10))}
                        style={{ colorScheme: 'dark' }}
                        className="bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs focus:outline-none w-56 font-mono"
                      >
                        {detectedPositions.length > 0 ? (
                          detectedPositions.map((p) => (
                            <option key={p.index} value={p.index} className="bg-[#2b2d30] text-[#dfdfdf]">
                              {p.index} ({p.name})
                            </option>
                          ))
                        ) : (
                          <option value="1" className="bg-[#2b2d30] text-[#dfdfdf]">1 (position 1)</option>
                        )}
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#9da5b4]">Payload type:</span>
                      <select
                        value={payloadType}
                        onChange={(e) => {
                          const newType = e.target.value as BurpPayloadType;
                          setPayloadType(newType);
                          const generated = generatePayloads(newType, payloadConfig);
                          setPayloadSetForPosition(selectedPosition, generated);
                        }}
                        style={{ colorScheme: 'dark' }}
                        className="bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs focus:outline-none w-56 font-sans"
                      >
                        <option value="Simple list" className="bg-[#2b2d30] text-[#dfdfdf]">Simple list</option>
                        <option value="Runtime file" className="bg-[#2b2d30] text-[#dfdfdf]">Runtime file</option>
                        <option value="Custom iterator" className="bg-[#2b2d30] text-[#dfdfdf]">Custom iterator</option>
                        <option value="Character substitution" className="bg-[#2b2d30] text-[#dfdfdf]">Character substitution</option>
                        <option value="Case modification" className="bg-[#2b2d30] text-[#dfdfdf]">Case modification</option>
                        <option value="Recursive grep" className="bg-[#2b2d30] text-[#dfdfdf]">Recursive grep</option>
                        <option value="Illegal Unicode" className="bg-[#2b2d30] text-[#dfdfdf]">Illegal Unicode</option>
                        <option value="Character blocks" className="bg-[#2b2d30] text-[#dfdfdf]">Character blocks</option>
                        <option value="Numbers" className="bg-[#2b2d30] text-[#dfdfdf]">Numbers</option>
                        <option value="Dates" className="bg-[#2b2d30] text-[#dfdfdf]">Dates</option>
                        <option value="Brute forcer" className="bg-[#2b2d30] text-[#dfdfdf]">Brute forcer</option>
                        <option value="Null payloads" className="bg-[#2b2d30] text-[#dfdfdf]">Null payloads</option>
                        <option value="Character frobber" className="bg-[#2b2d30] text-[#dfdfdf]">Character frobber</option>
                        <option value="Bit flipper" className="bg-[#2b2d30] text-[#dfdfdf]">Bit flipper</option>
                        <option value="Username generator" className="bg-[#2b2d30] text-[#dfdfdf]">Username generator</option>
                        <option value="ECB block shuffler" className="bg-[#2b2d30] text-[#dfdfdf]">ECB block shuffler</option>
                      </select>
                    </div>

                    <div className="flex justify-between text-[11px] text-[#9da5b4] pt-1 font-mono">
                      <span>Payload count: <strong className="text-white">{currentPayloadList.length}</strong></span>
                      <span>Request count: <strong className="text-white">{computedRequestCount}</strong></span>
                    </div>
                  </div>

                  {/* Payload Configuration Box */}
                  <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setAccPayloadConfig(!accPayloadConfig)}
                    >
                      <span className="font-semibold text-white text-xs">Payload configuration ({payloadType})</span>
                      {accPayloadConfig ? <ChevronUp className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" />}
                    </div>

                    {accPayloadConfig && (
                      <PayloadConfigurationPanel
                        payloadType={payloadType}
                        config={payloadConfig}
                        onConfigChange={setPayloadConfig}
                        currentPayloadList={currentPayloadList}
                        onUpdatePayloadList={(newList) => setPayloadSetForPosition(selectedPosition, newList)}
                        selectedPosition={selectedPosition}
                      />
                    )}
                  </div>

                  {/* Payload Encoding */}
                  <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setAccPayloadEncoding(!accPayloadEncoding)}
                    >
                      <span className="font-semibold text-white text-xs">Payload encoding</span>
                      {accPayloadEncoding ? <ChevronUp className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" />}
                    </div>
                    {accPayloadEncoding && (
                      <div className="space-y-2 text-[11px]">
                        <label className="flex items-center gap-2 text-[#c4c7c5] cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]" />
                          <span>URL-encode special characters</span>
                        </label>
                        <input
                          type="text"
                          defaultValue={'{}[]/?:@&=+$#<>\'%"'}
                          className="w-full bg-[#141517] text-[#34d399] font-mono px-2 py-0.5 rounded border border-[#3e4249]"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Resource Pool Drawer */}
              {activeRightDrawer === 'resource_pool' && (
                <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-4">
                  <p className="text-[11px] text-[#9da5b4]">
                    Specify the resource pool for concurrency and throttled request dispatch.
                  </p>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span>Maximum concurrent requests:</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={concurrency}
                        onChange={(e) => setConcurrency(Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="w-20 bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs font-mono"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span>Throttle delay (ms):</span>
                      <input
                        type="number"
                        min="0"
                        value={delayMs}
                        onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-20 bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs font-mono"
                      />
                    </label>

                    {/* Quick Throughput Presets */}
                    <div className="pt-2 border-t border-[#3e4249]/50 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-[#8c9099] block">Execution Presets:</span>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={() => { setConcurrency(25); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 25 Workers (Cloud Lab / PortSwigger Recommended)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#38bdf8]/20 hover:border-[#38bdf8] border border-[#3e4249] rounded text-sky-400 font-bold text-left transition-colors"
                        >
                          🌐 25 Workers (Cloud Lab)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(100); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 100 Workers (Fast Turbo)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#34d399]/20 hover:border-[#34d399] border border-[#3e4249] rounded text-emerald-400 font-bold text-left transition-colors"
                        >
                          🚀 100 Workers (Fast)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(500); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 500 Workers (Max Engine)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#ef4444]/20 hover:border-[#ef4444] border border-[#3e4249] rounded text-red-400 font-bold text-left transition-colors"
                        >
                          🔥 500 Workers (Max)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(50); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 50 Workers (Standard)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#f59e0b]/20 hover:border-[#f59e0b] border border-[#3e4249] rounded text-amber-400 font-bold text-left transition-colors"
                        >
                          ⚡ 50 Workers (Standard)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(15); setDelayMs(20); addToast({ type: 'info', title: 'Intruder: 15 Workers (Balanced)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-[#3e4249] rounded text-[#9da5b4] text-left transition-colors"
                        >
                          ⚖️ 15 Workers (20ms)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConcurrency(1);
                            setDelayMs(1000);
                            setStealthIpRotation(true);
                            addToast({ type: 'info', title: 'Intruder: 1 Worker (Stealth / Anti-Ban IP Rotation Active)' });
                          }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-purple-500/40 rounded text-purple-400 text-left transition-colors flex items-center justify-between"
                        >
                          <span>🥷 1 Worker (Stealth)</span>
                          <span className="text-[9px] bg-purple-950/80 text-purple-300 px-1 rounded border border-purple-800">IP ROT</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Drawer */}
              {activeRightDrawer === 'settings' && (
                <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-4">
                  {/* Stealth Mode Section */}
                  <div className="p-2.5 bg-[#141517] rounded border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-xs">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Stealth Mode (Anti-Ban IP Rotation)</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${stealthIpRotation ? 'bg-purple-900/60 text-purple-300 border border-purple-700' : 'bg-[#2b2d30] text-[#8c9099]'}`}>
                        {stealthIpRotation ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <label className="flex items-start gap-2 text-xs text-[#c4c7c5] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={stealthIpRotation}
                        onChange={(e) => {
                          setStealthIpRotation(e.target.checked);
                          addToast({
                            type: e.target.checked ? 'success' : 'info',
                            title: e.target.checked ? 'Intruder Stealth IP Rotation Enabled' : 'Intruder Stealth IP Rotation Disabled',
                            description: e.target.checked
                              ? 'Each attack request will automatically rotate client IP headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP, True-Client-IP) with cooldown reuse policy.'
                              : 'Requests will be dispatched without client IP header rotation.',
                          });
                        }}
                        className="mt-0.5 rounded bg-[#2b2d30] border-[#3e4249] text-purple-500 focus:ring-0"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">Rotate IP per attack request</span>
                        <span className="text-[11px] text-[#8c9099] leading-tight mt-0.5">
                          Injects randomized residential/datacenter IPs into <code className="text-purple-300">X-Forwarded-For</code>, <code className="text-purple-300">X-Real-IP</code>, and <code className="text-purple-300">CF-Connecting-IP</code> with automatic cooldown to prevent bot bans.
                        </span>
                      </div>
                    </label>

                    {stealthIpRotation && (
                      <div className="mt-2 pt-2 border-t border-purple-500/20 flex items-center justify-between text-[11px] font-mono text-purple-300">
                        <span>Sample Egress: {useVpnRotatorStore.getState().currentNode.flag} {useVpnRotatorStore.getState().currentNode.ip}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = await useVpnRotatorStore.getState().rotateVpn();
                            addToast({ type: 'info', title: `Tested Stealth Node: ${next.flag} ${next.ip}` });
                          }}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700/60 text-purple-200 transition-colors"
                          title="Rotate active node now"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Test Rotation</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Advanced Evasion & Defense Research Settings */}
                  <div className="p-2.5 bg-[#141517] rounded border border-blue-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-400">🛡️ Defense-Aware Protocol Engine</span>
                      <span className="text-[9px] bg-blue-950/80 text-blue-300 px-1 rounded border border-blue-800">RESEARCH</span>
                    </div>

                    {/* Ghost Jitter */}
                    <label className="flex items-start gap-2 text-xs text-[#c4c7c5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghostJitter}
                        onChange={(e) => {
                          setGhostJitter(e.target.checked);
                          addToast({
                            type: 'info',
                            title: e.target.checked ? 'Ghost Jitter Active (Poisson Distributed Timing)' : 'Ghost Jitter Disabled',
                            description: 'Varies inter-arrival timing via Poisson distribution to prevent statistical burst detection.',
                          });
                        }}
                        className="mt-0.5 rounded bg-[#2b2d30] border-[#3e4249] text-blue-500 focus:ring-0"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">Poisson Ghost Jitter</span>
                        <span className="text-[11px] text-[#8c9099] leading-tight mt-0.5">
                          Applies mathematical exponential distribution to delay intervals (eliminating fixed-interval bot signatures).
                        </span>
                      </div>
                    </label>

                    {/* Browser Mimicry */}
                    <label className="flex items-start gap-2 text-xs text-[#c4c7c5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={browserMimicry}
                        onChange={(e) => {
                          setBrowserMimicry(e.target.checked);
                          addToast({
                            type: 'info',
                            title: e.target.checked ? 'Browser Mimicry Enabled' : 'Browser Mimicry Disabled',
                            description: 'Injects modern Sec-CH-UA, Sec-Fetch, and User-Agent headers matching Chrome 130 profile.',
                          });
                        }}
                        className="mt-0.5 rounded bg-[#2b2d30] border-[#3e4249] text-blue-500 focus:ring-0"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">Browser Header Alignment (Chrome 130)</span>
                        <span className="text-[11px] text-[#8c9099] leading-tight mt-0.5">
                          Injects standard Client Hints (`Sec-CH-UA`) and Fetch metadata headers matching modern desktop browsers.
                        </span>
                      </div>
                    </label>

                    {/* Adaptive Throttle */}
                    <label className="flex items-start gap-2 text-xs text-[#c4c7c5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adaptiveThrottle}
                        onChange={(e) => {
                          setAdaptiveThrottle(e.target.checked);
                          addToast({
                            type: 'info',
                            title: e.target.checked ? 'Adaptive Throttling Active' : 'Adaptive Throttling Disabled',
                            description: 'Automatically pauses and backs off on HTTP 429 Too Many Requests / 503 responses.',
                          });
                        }}
                        className="mt-0.5 rounded bg-[#2b2d30] border-[#3e4249] text-blue-500 focus:ring-0"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">Adaptive 429/503 Auto-Backoff</span>
                        <span className="text-[11px] text-[#8c9099] leading-tight mt-0.5">
                          Smoothly pauses execution upon receiving HTTP 429 rate-limit responses and resumes without dropping payloads.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Standard Header Settings */}
                  <div className="space-y-2 pt-1">
                    <span className="font-semibold text-white text-xs block">Request Header Handling</span>
                    <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateContentLength}
                        onChange={(e) => setUpdateContentLength(e.target.checked)}
                        className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
                      />
                      <span>Update Content-Length header automatically</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setConnectionHeader}
                        onChange={(e) => setSetConnectionHeader(e.target.checked)}
                        className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
                      />
                      <span>Set Connection: close (Disables socket reuse, slower)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Far Right Vertical Tab Strip */}
        <div className="w-8 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col items-center py-2 space-y-4 flex-shrink-0 select-none">
          <button
            onClick={() => setActiveRightDrawer(activeRightDrawer === 'payloads' ? (null as any) : 'payloads')}
            className={`flex flex-col items-center py-3 px-1 text-[11px] tracking-wider transition-colors cursor-pointer ${
              activeRightDrawer === 'payloads' ? 'text-[#f37021] font-bold border-l-2 border-[#f37021]' : 'text-[#8c9099] hover:text-white'
            }`}
            style={{ writingMode: 'vertical-rl' }}
          >
            <List className="w-3.5 h-3.5 mb-1.5 rotate-90" />
            <span>Payloads</span>
          </button>

          <button
            onClick={() => setActiveRightDrawer(activeRightDrawer === 'resource_pool' ? (null as any) : 'resource_pool')}
            className={`flex flex-col items-center py-3 px-1 text-[11px] tracking-wider transition-colors cursor-pointer ${
              activeRightDrawer === 'resource_pool' ? 'text-[#f37021] font-bold border-l-2 border-[#f37021]' : 'text-[#8c9099] hover:text-white'
            }`}
            style={{ writingMode: 'vertical-rl' }}
          >
            <Clock className="w-3.5 h-3.5 mb-1.5 rotate-90" />
            <span>Resource pool</span>
          </button>

          <button
            onClick={() => setActiveRightDrawer(activeRightDrawer === 'settings' ? (null as any) : 'settings')}
            className={`flex flex-col items-center py-3 px-1 text-[11px] tracking-wider transition-colors cursor-pointer ${
              activeRightDrawer === 'settings' ? 'text-[#38bdf8] font-bold border-l-2 border-[#38bdf8]' : 'text-[#8c9099] hover:text-white'
            }`}
            style={{ writingMode: 'vertical-rl' }}
          >
            <SettingsIcon className="w-3.5 h-3.5 mb-1.5 rotate-90" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 6. Authentic Burp Intruder Attack Results Window */}
      {showAttackModal && windowState === 'minimized' && (
        <div
          onClick={() => setWindowState('normal')}
          className="fixed bottom-4 right-4 z-50 bg-[#2b2d30] border border-[#f37021] rounded-lg shadow-2xl px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-[#35383f] transition-all"
        >
          <Play className="w-3.5 h-3.5 text-[#f37021] fill-current" />
          <span className="text-xs font-bold text-white truncate max-w-sm">
            Intruder attack — {targetUrl} ({attackResults.length} requests)
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWindowState('normal');
              }}
              className="p-1 hover:text-white text-[#9da5b4] hover:bg-[#1e1f22] rounded"
              title="Restore window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                abortAttackRef.current = true;
                setShowAttackModal(false);
                setWindowState('normal');
              }}
              className="p-1 hover:text-white text-[#9da5b4] hover:bg-[#ef4444] rounded"
              title="Close window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showAttackModal && windowState !== 'minimized' && (
        <div
          className={
            windowState === 'maximized'
              ? 'fixed inset-0 z-50 bg-[#1e1f22] flex flex-col overflow-hidden text-xs select-none'
              : 'fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6'
          }
        >
          <div
            className={
              windowState === 'maximized'
                ? 'w-full h-full flex flex-col overflow-hidden'
                : 'w-full max-w-6xl h-[90vh] bg-[#1e1f22] border border-[#3e4249] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs'
            }
          >
            {/* Top Modal Window Header Bar */}
            <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0 select-none">
              <div className="flex items-center gap-2 font-bold text-white">
                <Play className="w-3.5 h-3.5 text-[#f37021] fill-current" />
                <span className="truncate">
                  Intruder attack — {targetUrl} ({attackResults.length} requests{isAttackRunning ? ' - running...' : ' - completed'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Attack ▾ Menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowAttackMenu(!showAttackMenu);
                      setShowSaveMenu(false);
                    }}
                    className="px-2.5 py-0.5 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#dfdfdf] text-[11px] border border-[#3e4249] flex items-center gap-1"
                  >
                    <span>Attack ▾</span>
                  </button>
                  {showAttackMenu && (
                    <div className="absolute top-full right-0 mt-1 w-44 bg-[#2b2d30] border border-[#3e4249] rounded shadow-2xl py-1 z-50 text-xs font-sans">
                      <button
                        onClick={() => {
                          setIsAttackRunning(!isAttackRunning);
                          setShowAttackMenu(false);
                          addToast({ type: 'info', title: isAttackRunning ? 'Attack Paused' : 'Attack Resumed' });
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-white flex items-center gap-2"
                      >
                        {isAttackRunning ? <Pause className="w-3.5 h-3.5 text-[#eab308]" /> : <Play className="w-3.5 h-3.5 text-[#34d399]" />}
                        <span>{isAttackRunning ? 'Pause attack' : 'Resume attack'}</span>
                      </button>
                      <button
                        onClick={() => {
                          abortAttackRef.current = true;
                          setIsAttackRunning(false);
                          setShowAttackMenu(false);
                          addToast({ type: 'warning', title: 'Attack Aborted' });
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-[#ef4444] flex items-center gap-2"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Abort attack</span>
                      </button>
                      <div className="my-1 border-t border-[#3e4249]" />
                      <button
                        onClick={() => {
                          setAttackResults([]);
                          setSelectedResultId(null);
                          setShowAttackMenu(false);
                          addToast({ type: 'info', title: 'Cleared attack results' });
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-[#dfdfdf] flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear results</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Save ▾ Menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSaveMenu(!showSaveMenu);
                      setShowAttackMenu(false);
                    }}
                    className="px-2.5 py-0.5 rounded bg-[#1e1f22] hover:bg-[#35383f] text-[#dfdfdf] text-[11px] border border-[#3e4249] flex items-center gap-1 font-medium text-[#38bdf8]"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save ▾</span>
                  </button>
                  {showSaveMenu && (
                    <div className="absolute top-full right-0 mt-1 w-56 bg-[#2b2d30] border border-[#3e4249] rounded shadow-2xl py-1 z-50 text-xs font-sans">
                      <button
                        onClick={() => {
                          handleSaveCsv();
                          setShowSaveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-white flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#34d399]" />
                        <span>Save results to CSV...</span>
                      </button>
                      <button
                        onClick={() => {
                          handleSaveJson();
                          setShowSaveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-white flex items-center gap-2"
                      >
                        <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>Save results to JSON...</span>
                      </button>
                      <button
                        onClick={() => {
                          handleSaveRawTxt();
                          setShowSaveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#3e4249] text-white flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#f37021]" />
                        <span>Save raw HTTP dump (TXT)...</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-4 w-px bg-[#3e4249] mx-1" />

                {/* Window Minimize Button */}
                <button
                  onClick={() => setWindowState('minimized')}
                  className="p-1 hover:bg-[#3e4249] rounded text-[#9da5b4] hover:text-white"
                  title="Minimize window"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* Window Maximize / Restore Button */}
                <button
                  onClick={() => setWindowState(windowState === 'maximized' ? 'normal' : 'maximized')}
                  className="p-1 hover:bg-[#3e4249] rounded text-[#9da5b4] hover:text-white"
                  title={windowState === 'maximized' ? 'Restore window' : 'Maximize window'}
                >
                  {windowState === 'maximized' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                {/* Window Close Button */}
                <button
                  onClick={() => {
                    abortAttackRef.current = true;
                    setShowAttackModal(false);
                    setWindowState('normal');
                  }}
                  className="p-1 hover:bg-[#ef4444] rounded text-[#9da5b4] hover:text-white transition-colors"
                  title="Close window"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results / Positions Subtab Bar */}
            <div className="h-7 bg-[#232529] border-b border-[#1e1f22] flex items-center px-2 flex-shrink-0">
              <button
                onClick={() => setActiveResultsSubtab('Results')}
                className={`px-3 py-1 font-semibold text-xs border-b-2 transition-colors ${
                  activeResultsSubtab === 'Results' ? 'border-[#f37021] text-white' : 'border-transparent text-[#9da5b4] hover:text-white'
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveResultsSubtab('Positions')}
                className={`px-3 py-1 font-semibold text-xs border-b-2 transition-colors ${
                  activeResultsSubtab === 'Positions' ? 'border-[#f37021] text-white' : 'border-transparent text-[#9da5b4] hover:text-white'
                }`}
              >
                Positions
              </button>
            </div>

            {/* Capture Filter Bar matching Burp Suite */}
            <div
              onClick={() => setShowCaptureFilterModal(true)}
              className="h-7 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0 text-[11px] text-[#9da5b4] cursor-pointer hover:bg-[#282b30] transition-colors select-none group"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-[#f37021]" />
                <span className="group-hover:text-white font-medium">
                  {filteredAttackResults.length === attackResults.length
                    ? 'Capture filter: Capturing all items'
                    : `Capture filter: Filtered (${filteredAttackResults.length} of ${attackResults.length} items)`}
                </span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="group-hover:text-white">Apply capture filter</span>
                <input
                  type="checkbox"
                  checked={applyCaptureFilter}
                  onChange={(e) => setApplyCaptureFilter(e.target.checked)}
                  className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Main Split: Results Table (Top 50%) & Request/Response Inspector (Bottom 50%) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top: Live Attack Results Table */}
              <div className="h-1/2 overflow-y-auto border-b border-[#2b2d30] bg-[#141517]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249]">
                    <tr>
                      <th className="px-2.5 py-1 w-12">Request ^</th>
                      {detectedPositions.length > 1 ? (
                        detectedPositions.map((p) => (
                          <th key={p.index} className="px-2.5 py-1">Payload {p.index}</th>
                        ))
                      ) : (
                        <th className="px-2.5 py-1">Payload 1</th>
                      )}
                      <th className="px-2.5 py-1 w-24">Status code</th>
                      <th className="px-2.5 py-1 w-28">Response received</th>
                      <th className="px-2.5 py-1 w-20">Error</th>
                      <th className="px-2.5 py-1 w-20">Timeout</th>
                      <th className="px-2.5 py-1 w-20">Length</th>
                      <th className="px-2.5 py-1">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b2d30]">
                    {visibleAttackResults.map((r) => {
                      const isSelected = r.id === selectedResultId;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedResultId(r.id)}
                          onContextMenu={(e) => handleResultRowContextMenu(e, r)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#282b30] text-white font-medium' : 'hover:bg-[#1e1f22] text-[#dfdfdf]'
                          }`}
                        >
                          <td className="px-2.5 py-1 text-[#6f737a]">{r.id}</td>
                          {detectedPositions.length > 1 ? (
                            detectedPositions.map((p, pIdx) => (
                              <td key={p.index} className="px-2.5 py-1 text-[#38bdf8] font-bold truncate max-w-[140px]">
                                {r.payloads[pIdx] || '—'}
                              </td>
                            ))
                          ) : (
                            <td className="px-2.5 py-1 text-[#38bdf8] font-bold truncate max-w-xs">
                              {r.payloads[0] || r.payloadSummary}
                            </td>
                          )}
                          <td className={`px-2.5 py-1 font-bold ${
                            r.statusCode >= 200 && r.statusCode < 300 ? 'text-[#34d399]' :
                            r.statusCode >= 300 && r.statusCode < 400 ? 'text-[#38bdf8]' :
                            r.statusCode >= 400 && r.statusCode < 500 ? 'text-[#eab308]' :
                            'text-[#ef4444]'
                          }`}>
                            {r.statusCode || '—'}
                          </td>
                          <td className="px-2.5 py-1 text-[#9da5b4]">{r.timeMs} ms</td>
                          <td className="px-2.5 py-1 text-[#ef4444] truncate">{r.error || '—'}</td>
                          <td className="px-2.5 py-1 text-[#6f737a]">{r.timeout ? 'true' : '—'}</td>
                          <td className="px-2.5 py-1 text-[#9da5b4] font-mono">{r.lengthBytes}</td>
                          <td className="px-2.5 py-1 text-[#f37021] truncate">{r.comment}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredAttackResults.length > visibleAttackResults.length && (
                  <div className="bg-[#1e1f22] border-t border-[#3e4249] px-3 py-1.5 flex items-center justify-between text-[11px] text-[#9da5b4] sticky bottom-0">
                    <span>
                      Displaying first <strong className="text-white">{visibleAttackResults.length.toLocaleString()}</strong> of{' '}
                      <strong className="text-white">{filteredAttackResults.length.toLocaleString()}</strong> rows (Windowed for 60 FPS performance).
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDisplayLimit((prev) => prev + 500)}
                        className="px-2 py-0.5 bg-[#2b2d30] hover:bg-[#3e4249] text-white rounded text-[10px] font-mono transition-colors"
                      >
                        Load +500 More
                      </button>
                      <button
                        onClick={() => setDisplayLimit(filteredAttackResults.length)}
                        className="px-2 py-0.5 bg-[#f37021]/20 hover:bg-[#f37021]/30 text-[#f37021] border border-[#f37021]/40 rounded text-[10px] font-mono transition-colors"
                      >
                        Display All ({filteredAttackResults.length.toLocaleString()})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom: Request & Response Inspector Split */}
              <div className="h-1/2 flex min-h-0 bg-[#1e1f22] divide-x divide-[#2b2d30]">
                {/* Left: Request Pane */}
                <div className="w-1/2 flex flex-col min-h-0">
                  <div className="h-7 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2">
                    <span className="font-bold text-white text-xs">Request #{selectedResult?.id || 1}</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      {(['Pretty', 'Raw', 'Hex'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setRequestTabMode(m)}
                          className={`px-2 py-0.5 rounded ${requestTabMode === m ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    onContextMenu={(e) => handleInspectorContextMenu(e, selectedResult?.rawRequest || requestText, 'Request')}
                    className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text"
                  >
                    <HttpSyntaxHighlighter
                      content={selectedResult?.rawRequest || requestText}
                      isResponse={false}
                      searchQuery={modalRequestSearch}
                      activeMatchIndex={modalRequestActiveMatch}
                    />
                  </div>
                  <BurpSearchBar
                    searchQuery={modalRequestSearch}
                    onSearchChange={(val) => {
                      setModalRequestSearch(val);
                      setModalRequestActiveMatch(0);
                    }}
                    activeMatchIndex={modalRequestActiveMatch}
                    totalMatches={modalRequestTotalMatches}
                    onPrevMatch={handleModalRequestPrevMatch}
                    onNextMatch={handleModalRequestNextMatch}
                    selectionInfo={`Length: ${(selectedResult?.rawRequest || requestText || '').length} bytes`}
                  />
                </div>

                {/* Right: Response Pane */}
                <div className="w-1/2 flex flex-col min-h-0">
                  <div className="h-7 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2">
                    <span className="font-bold text-white text-xs">
                      Response #{selectedResult?.id || 1} ({selectedResult?.statusCode || 200})
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                      {(['Pretty', 'Raw', 'Hex', 'Render'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setResponseTabMode(m)}
                          className={`px-2 py-0.5 rounded ${responseTabMode === m ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  {responseTabMode === 'Render' ? (
                    <iframe
                      srcDoc={generateRenderablePreviewHtml(
                        selectedResult?.rawResponse?.replace(/^[\s\S]*?\r?\n\r?\n/, '') || '',
                        undefined,
                        targetUrl
                      )}
                      title="Rendered Response"
                      className="flex-1 w-full bg-white border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div
                      onContextMenu={(e) => handleInspectorContextMenu(e, selectedResult?.rawResponse || '', 'Response')}
                      className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text"
                    >
                      <HttpSyntaxHighlighter
                        content={selectedResult?.rawResponse || 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nNo response captured'}
                        isResponse={true}
                        searchQuery={modalResponseSearch}
                        activeMatchIndex={modalResponseActiveMatch}
                      />
                    </div>
                  )}
                  <BurpSearchBar
                    searchQuery={modalResponseSearch}
                    onSearchChange={(val) => {
                      setModalResponseSearch(val);
                      setModalResponseActiveMatch(0);
                    }}
                    activeMatchIndex={modalResponseActiveMatch}
                    totalMatches={modalResponseTotalMatches}
                    onPrevMatch={handleModalResponsePrevMatch}
                    onNextMatch={handleModalResponseNextMatch}
                    selectionInfo={`Length: ${(selectedResult?.rawResponse || '').length} bytes`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intruder Capture Filter Dialog matching Burp Suite */}
      <IntruderCaptureFilterModal
        isOpen={showCaptureFilterModal}
        onClose={() => setShowCaptureFilterModal(false)}
        filterState={captureFilter}
        onSave={(newFilter) => {
          setCaptureFilter(newFilter);
          setApplyCaptureFilter(true);
          addToast({ type: 'info', title: 'Applied Intruder Capture Filter' });
        }}
      />

      {/* Burp Suite Context Menu */}
      {editorContextMenu.isOpen && (
        <ContextMenu
          x={editorContextMenu.x}
          y={editorContextMenu.y}
          isOpen={editorContextMenu.isOpen}
          onClose={() => setEditorContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={editorContextMenu.items}
        />
      )}
    </div>
  );
};
