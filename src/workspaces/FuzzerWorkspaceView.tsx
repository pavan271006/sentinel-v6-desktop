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
} from 'lucide-react';
import { generateRenderablePreviewHtml } from '../utils/repeaterUtils';


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
  const [setConnectionHeader, setSetConnectionHeader] = useState(true);

  // Attack Execution Modal UI
  const [showAttackMenu, setShowAttackMenu] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [requestTabMode, setRequestTabMode] = useState<'Pretty' | 'Raw' | 'Hex'>('Pretty');
  const [responseTabMode, setResponseTabMode] = useState<'Pretty' | 'Raw' | 'Hex' | 'Render'>('Pretty');
  const abortAttackRef = useRef(false);

  // Capture Filter State
  const [showCaptureFilterModal, setShowCaptureFilterModal] = useState(false);

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

    const buildReplacedRequest = (rowPayloads: string[]) => {
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

      if (updateContentLength) {
        const p = replaced.split(/\r?\n\r?\n/);
        if (p.length > 1) {
          const bodyBytes = new TextEncoder().encode(p.slice(1).join('\r\n\r\n')).length;
          replaced = replaced.replace(/Content-Length:\s*\d+/i, `Content-Length: ${bodyBytes}`);
        }
      }

      // Ensure Connection: keep-alive is active for maximum socket reuse and pipeline throughput
      if (!replaced.toLowerCase().includes('connection:')) {
        const headerEnd = replaced.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          replaced = replaced.slice(0, headerEnd) + '\r\nConnection: keep-alive' + replaced.slice(headerEnd);
        }
      }

      return replaced;
    };

    const totalPermutations = permutations.length;
    const resultsBuffer: AttackResultItem[] = new Array(totalPermutations);
    const poolSize = Math.max(1, Math.min(concurrency || 100, 1000));
    const attackStartTime = Date.now();
    let completedCount = 0;
    let nextIndex = 0;
    let dirty = false;
    let lastFlushTime = Date.now();

    const flushResults = (force = false) => {
      const now = Date.now();
      if (!force && now - lastFlushTime < 33) return; // 30 FPS throttle to protect React rendering loop
      lastFlushTime = now;
      dirty = false;

      // Extract results in natural ID-sorted order in O(N) without O(N log N) sorting
      const activeList: AttackResultItem[] = [];
      for (let i = 0; i < totalPermutations; i++) {
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
    }, 40);

    const worker = async () => {
      while (nextIndex < totalPermutations && !abortAttackRef.current) {
        const reqIndex = nextIndex++;
        const perm = permutations[reqIndex];
        const wireReq = buildReplacedRequest(perm.payloads);
        const startMs = Date.now();
        let execResult;

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
          rawRequest: wireReq,
          rawResponse: rawRes,
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
      {/* 1. Intruder Subtabs Strip: [ 1 × ] [ 2 × ] [ + ] */}
      <div className="h-7 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                className={`flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer border-r border-[#1e1f22] transition-colors max-w-[200px] truncate ${
                  isActive
                    ? 'bg-[#1e1f22] border-b-2 border-[#f37021] text-[#f37021] font-semibold'
                    : 'bg-[#2b2d30] hover:bg-[#35383f] text-[#9da5b4] hover:text-white'
                }`}
              >
                <span className="truncate">{t.title || `${idx + 1}`}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                    className="p-0.5 rounded hover:bg-[#43474e] text-[#8c9099] hover:text-white"
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
            className="p-1 text-[#9da5b4] hover:text-white hover:bg-[#35383f] rounded transition-colors ml-1"
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
              className="w-full bg-[#2b2d30] text-white px-2.5 py-1 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none text-xs"
            >
              <option value="Sniper attack">Sniper attack</option>
              <option value="Battering ram attack">Battering ram attack</option>
              <option value="Pitchfork attack">Pitchfork attack</option>
              <option value="Cluster bomb attack">Cluster bomb attack</option>
            </select>
          </div>
        </div>

        {/* Orange Start Attack Button */}
        <button
          onClick={handleStartAttack}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white font-bold text-xs shadow-md transition-colors"
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
                        className="bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs focus:outline-none w-56 font-mono"
                      >
                        {detectedPositions.length > 0 ? (
                          detectedPositions.map((p) => (
                            <option key={p.index} value={p.index}>
                              {p.index} ({p.name})
                            </option>
                          ))
                        ) : (
                          <option value="1">1 (position 1)</option>
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
                        className="bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs focus:outline-none w-56 font-sans"
                      >
                        <option value="Simple list">Simple list</option>
                        <option value="Runtime file">Runtime file</option>
                        <option value="Custom iterator">Custom iterator</option>
                        <option value="Character substitution">Character substitution</option>
                        <option value="Case modification">Case modification</option>
                        <option value="Recursive grep">Recursive grep</option>
                        <option value="Illegal Unicode">Illegal Unicode</option>
                        <option value="Character blocks">Character blocks</option>
                        <option value="Numbers">Numbers</option>
                        <option value="Dates">Dates</option>
                        <option value="Brute forcer">Brute forcer</option>
                        <option value="Null payloads">Null payloads</option>
                        <option value="Character frobber">Character frobber</option>
                        <option value="Bit flipper">Bit flipper</option>
                        <option value="Username generator">Username generator</option>
                        <option value="ECB block shuffler">ECB block shuffler</option>
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
                          onClick={() => { setConcurrency(1000); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 1000 Workers (Turbo Engine / 30k RPS)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#ef4444]/20 hover:border-[#ef4444] border border-[#3e4249] rounded text-red-400 font-bold text-left transition-colors"
                        >
                          🔥 1000 Workers (Turbo)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(500); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 500 Workers (High Turbo)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#f37021]/20 hover:border-[#f37021] border border-[#3e4249] rounded text-orange-400 font-bold text-left transition-colors"
                        >
                          ⚡ 500 Workers (0ms)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(100); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 100 Workers (Fast)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-[#3e4249] rounded text-emerald-400 font-bold text-left transition-colors"
                        >
                          🚀 100 Workers (0ms)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(50); setDelayMs(0); addToast({ type: 'info', title: 'Intruder: 50 Workers (Standard)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-[#3e4249] rounded text-amber-400 font-bold text-left transition-colors"
                        >
                          ⚡ 50 Workers (0ms)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(15); setDelayMs(50); addToast({ type: 'info', title: 'Intruder: 15 Workers (Balanced)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-[#3e4249] rounded text-[#9da5b4] text-left transition-colors"
                        >
                          ⚖️ 15 Workers (50ms)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConcurrency(1); setDelayMs(2000); addToast({ type: 'info', title: 'Intruder: 1 Worker (Stealth / Anti-Ban)' }); }}
                          className="px-2 py-1 bg-[#141517] hover:bg-[#3e4249] border border-[#3e4249] rounded text-purple-400 text-left transition-colors"
                        >
                          🥷 1 Worker (Stealth)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Drawer */}
              {activeRightDrawer === 'settings' && (
                <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-3">
                  <span className="font-semibold text-white text-xs">Request Header Handling</span>
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
                    <span>Set Connection: close</span>
                  </label>
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
                    {filteredAttackResults.map((r) => {
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
