import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Badge, SeverityBadge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { VirtualizedTable, ColumnDef } from '../design-system/VirtualizedTable';
import { useToastStore } from '../stores/toastStore';
import { Radio, Copy, RefreshCw, Key, ShieldAlert } from 'lucide-react';

export interface OastCallbackEvent {
  id: string;
  token: string;
  protocol: 'DNS' | 'HTTP' | 'HTTPS';
  clientIp: string;
  queryOrPath: string;
  timestamp: string;
  matchedTest: string;
  isCorrelated: boolean;
}

const SAMPLE_CALLBACKS: OastCallbackEvent[] = [
  {
    id: 'cb-01',
    token: 'oast-7f8821a9c4-test',
    protocol: 'DNS',
    clientIp: '198.51.100.42',
    queryOrPath: 'oast-7f8821a9c4-test.oast.sentinel.internal (A Record)',
    timestamp: '19:54:12',
    matchedTest: 'Blind SSRF in /api/v1/webhooks',
    isCorrelated: true,
  },
  {
    id: 'cb-02',
    token: 'oast-3301ab9982-xxe',
    protocol: 'HTTP',
    clientIp: '198.51.100.42',
    queryOrPath: 'GET /dtd/payload.dtd HTTP/1.1',
    timestamp: '19:55:01',
    matchedTest: 'Out-of-Band XXE in XML Upload',
    isCorrelated: true,
  },
  {
    id: 'cb-03',
    token: 'oast-9912bc7710-ping',
    protocol: 'DNS',
    clientIp: '203.0.113.19',
    queryOrPath: 'oast-9912bc7710-ping.oast.sentinel.internal (TXT Record)',
    timestamp: '19:56:30',
    matchedTest: 'Blind Command Injection in ping utility',
    isCorrelated: true,
  },
];

export const OastWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [domain] = useState('oast.sentinel.internal');
  const [generatedToken, setGeneratedToken] = useState('oast-aes256-8812cba90124.oast.sentinel.internal');
  const [callbacks] = useState<OastCallbackEvent[]>(SAMPLE_CALLBACKS);
  const [selectedCbId, setSelectedCbId] = useState<string>('cb-01');

  const selectedCb = callbacks.find((c) => c.id === selectedCbId) || callbacks[0];

  const handleGenerateToken = () => {
    const randomHex = Math.random().toString(16).substring(2, 12);
    const newToken = `oast-${randomHex}.${domain}`;
    setGeneratedToken(newToken);
    addToast({ type: 'success', title: 'Generated stateless AES-256 OAST token' });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedToken);
    addToast({ type: 'info', title: 'Copied OAST token payload to clipboard' });
  };

  const columns: ColumnDef<OastCallbackEvent>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      width: 80,
      accessor: (r) => <span className="font-mono text-text-muted">{r.timestamp}</span>,
    },
    {
      id: 'protocol',
      header: 'Protocol',
      width: 80,
      align: 'center',
      accessor: (r) => <Badge variant={r.protocol === 'DNS' ? 'scope-in' : 'neutral'}>{r.protocol}</Badge>,
    },
    {
      id: 'queryOrPath',
      header: 'Callback Query / URI',
      width: 320,
      accessor: (r) => (
        <span className="font-mono text-xs font-semibold text-text-primary truncate block" title={r.queryOrPath}>
          {r.queryOrPath}
        </span>
      ),
    },
    {
      id: 'clientIp',
      header: 'Origin IP',
      width: 120,
      accessor: (r) => <span className="font-mono text-xs text-text-secondary">{r.clientIp}</span>,
    },
    {
      id: 'isCorrelated',
      header: 'Correlation',
      width: 110,
      align: 'center',
      accessor: (r) => (
        <Badge variant={r.isCorrelated ? 'scope-deny' : 'neutral'}>
          {r.isCorrelated ? 'PROVEN EXPLOIT' : 'UNMATCHED'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-accent-cyan animate-pulse" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Out-of-Band OAST Server & Listener</h1>
            <p className="text-xs text-text-secondary">Stateless AES-256-GCM token generator with DNS (:53) and HTTP (:80/:443) callback correlation.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="scope-in">DNS :53 ACTIVE</Badge>
          <Badge variant="scope-in">HTTP :80 ACTIVE</Badge>
        </div>
      </div>

      {/* Token Generator Strip */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-panel-elevated border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <Key className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-text-secondary uppercase">Payload Token:</span>
          <Input dense mono value={generatedToken} readOnly className="flex-1" />
        </div>
        <Button variant="secondary" size="xs" leftIcon={<Copy className="w-3 h-3" />} onClick={handleCopy}>
          Copy
        </Button>
        <Button variant="primary" size="xs" leftIcon={<RefreshCw className="w-3 h-3" />} onClick={handleGenerateToken}>
          Generate New Token
        </Button>
      </div>

      {/* Main Split: Callbacks (Left) vs Correlation Dossier (Right) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={650}
          minSize={350}
          maxSize={900}
          storageKey="oast_workspace_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-hidden">
              <div className="px-3 py-1.5 bg-bg-panel-elevated border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Real-time OAST Callbacks ({callbacks.length})
                </span>
                <Badge variant="scope-deny">{callbacks.filter((c) => c.isCorrelated).length} Correlated Exploits</Badge>
              </div>

              <div className="flex-1 min-h-0">
                <VirtualizedTable
                  data={callbacks}
                  columns={columns}
                  rowHeight={30}
                  selectedId={selectedCbId}
                  getRowId={(r) => r.id}
                  onRowClick={(r) => setSelectedCbId(r.id)}
                />
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedCb && (
                <>
                  <div className="p-3 bg-bg-panel rounded border border-danger/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-danger" /> Correlated Vulnerability Proof
                      </span>
                      <SeverityBadge severity="CRITICAL" />
                    </div>

                    <h3 className="text-sm font-bold text-text-primary">{selectedCb.matchedTest}</h3>

                    <div className="p-2 bg-bg-app rounded border border-border-subtle space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-muted">PROTOCOL:</span>
                        <span className="text-accent-cyan">{selectedCb.protocol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">SOURCE IP:</span>
                        <span className="text-text-primary">{selectedCb.clientIp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">INTERACTION TOKEN:</span>
                        <span className="text-text-secondary truncate">{selectedCb.token}</span>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => addToast({ type: 'success', title: `Promoted OAST Exploit to Verified Finding` })}
                    >
                      Promote to Finding with OAST Evidence (SEC-06)
                    </Button>
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
