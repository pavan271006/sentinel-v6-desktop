import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponseViewerPanel } from '../../../src/components/repeater/ResponseViewerPanel';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';
import { RepeaterRevisionItem } from '../../../src/types/repeater';

const MOCK_REVISION: RepeaterRevisionItem = {
  revisionId: 'rev-001',
  revisionNumber: 1,
  timestamp: '19:42:00',
  timestampMs: 1720000000000,
  method: 'GET',
  url: 'https://target.local/api/v1/auth/login',
  requestRaw: 'GET /api/v1/auth/login HTTP/1.1\r\nHost: target.local\r\n\r\n',
  requestHeaders: [{ name: 'Host', value: 'target.local' }],
  requestBody: '',
  responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"status":"success","role":"admin"}',
  responseHeaders: [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Server', value: 'SentinelShield/6.0' },
  ],
  responseBody: '{"status":"success","role":"admin"}',
  statusCode: 200,
  statusText: 'OK',
  durationMs: 42,
  sizeBytes: 35,
  tlsInfo: {
    version: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
  },
  timingBreakdown: {
    dnsMs: 1.2,
    tcpConnectMs: 4.5,
    tlsHandshakeMs: 8.3,
    ttfbMs: 20.0,
    contentDownloadMs: 8.0,
    totalDurationMs: 42,
  },
  casEvidence: {
    blobId: 'blob-001',
    sha256Hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sizeBytes: 35,
    verified: true,
    tamperDetected: false,
    timestamp: '2026-08-17T00:00:00Z',
  },
};

describe('ResponseViewerPanel Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          history: [MOCK_REVISION],
          activeRevisionIndex: 0,
          lastExecutionOutput: MOCK_REVISION,
          responseViewMode: 'parsed',
        },
      ],
      activeTabId: 'rep-1',
    });
  });

  it('renders status badge, duration, size, TLS info, and CAS proof', () => {
    render(<ResponseViewerPanel />);

    expect(screen.getByText(/200 OK/i)).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
    expect(screen.getByText('35 B')).toBeInTheDocument();
    expect(screen.getByText('TLSv1.3')).toBeInTheDocument();
    expect(screen.getByText(/CAS: e3b0c442/i)).toBeInTheDocument();
  });

  it('renders parsed headers in Headers subview', () => {
    render(<ResponseViewerPanel />);

    const headersTab = screen.getByRole('tab', { name: /Headers/i });
    fireEvent.click(headersTab);

    expect(screen.getByText('Content-Type')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();
    expect(screen.getByText('SentinelShield/6.0')).toBeInTheDocument();
  });

  it('switches sub-views (Raw, Hex Dump, JSON Tree, HTML Preview, TLS & Timing)', () => {
    render(<ResponseViewerPanel />);

    // Switch to Raw
    const rawTab = screen.getByRole('tab', { name: /Raw/i });
    fireEvent.click(rawTab);
    expect(screen.getAllByText(/200/).length).toBeGreaterThan(0);

    // Switch to TLS & Timing
    const tlsTab = screen.getByRole('tab', { name: /TLS & Timing/i });
    fireEvent.click(tlsTab);
    expect(screen.getByText('Roundtrip Timing Waterfall')).toBeInTheDocument();
    expect(screen.getByText('1.2 ms')).toBeInTheDocument();

    // Switch to Render (SEC-11)
    const previewTab = screen.getByRole('tab', { name: /Render/i });
    fireEvent.click(previewTab);
    expect(screen.getByText(/SEC-11 Sandboxed Preview/i)).toBeInTheDocument();
  });

  it('renders empty state when no execution history exists', () => {
    useRepeaterStore.setState({
      tabs: [{ ...DEFAULT_INITIAL_TAB, id: 'rep-1', history: [], lastExecutionOutput: undefined }],
    });
    render(<ResponseViewerPanel />);

    expect(screen.getByText(/No Response Captured/i)).toBeInTheDocument();
  });

  it('renders Scope Violation banner when SEC-01 blocks execution', () => {
    const errorRev: RepeaterRevisionItem = {
      ...MOCK_REVISION,
      responseRaw: undefined,
      responseBody: undefined,
      statusCode: undefined,
      error: 'SEC-01 Scope Violation: Target is out of scope: Default Deny',
    };

    useRepeaterStore.setState({
      tabs: [{ ...DEFAULT_INITIAL_TAB, id: 'rep-1', history: [errorRev], lastExecutionOutput: errorRev }],
    });
    render(<ResponseViewerPanel />);

    expect(screen.getByText(/SEC-01 Scope Enforcement Violation/i)).toBeInTheDocument();
  });
});
