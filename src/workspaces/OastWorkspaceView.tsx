
import React, { useEffect, useState } from 'react';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Badge, SeverityBadge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { VirtualizedTable, ColumnDef } from '../design-system/VirtualizedTable';
import { useToastStore } from '../stores/toastStore';
import { useCollaboratorStore } from '../stores/collaboratorStore';
import { OastInteraction } from '../services/sqlScanner/engine/InteractshClient';
import { Radio, Copy, RefreshCw, Key, ShieldAlert, Globe, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const OastWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    activePayload,
    domain,
    customDomain,
    serverStatus,
    isPolling,
    interactions,
    initSession,
    generateNewPayload,
    pollNow,
    setCustomDomain,
    clearInteractions,
  } = useCollaboratorStore();

  const [selectedInteractionId, setSelectedInteractionId] = useState<string>('');
  const [customInput, setCustomInput] = useState<string>(customDomain);
  const [showCustomConfig, setShowCustomConfig] = useState<boolean>(false);

  // Initialize session on mount if idle
  useEffect(() => {
    if (serverStatus === 'idle') {
      initSession();
    }
  }, [serverStatus, initSession]);

  // Select first interaction if none selected
  useEffect(() => {
    if (!selectedInteractionId && interactions.length > 0) {
      setSelectedInteractionId(interactions[0].id);
    }
  }, [interactions, selectedInteractionId]);

  const selectedInteraction = interactions.find((i) => i.id === selectedInteractionId) || interactions[0];

  const handleGenerateToken = async () => {
    const payload = generateNewPayload();
    if (payload) {
      addToast({ type: 'success', title: 'Generated New OAST / Collaborator Payload' });
    } else {
      addToast({ type: 'info', title: 'Initializing Live OAST Session...' });
    }
  };

  const handleCopy = () => {
    if (!activePayload) return;
    navigator.clipboard.writeText(activePayload);
    addToast({ type: 'info', title: 'Copied Collaborator payload to clipboard' });
  };

  const handlePoll = async () => {
    const newItems = await pollNow();
    if (newItems.length > 0) {
      addToast({
        type: 'success',
        title: `Received ${newItems.length} New Interaction(s)!`,
        description: `Captured live DNS/HTTP callbacks from remote target.`,
      });
    } else {
      addToast({ type: 'info', title: 'Poll Completed: No new interactions.' });
    }
  };

  const handleSaveCustomDomain = () => {
    const trimmed = customInput.trim();
    setCustomDomain(trimmed);
    initSession(trimmed);
    addToast({
      type: 'success',
      title: trimmed ? 'Connected Custom Burp Collaborator Domain' : 'Reset to Built-in Public OAST (oast.fun)',
    });
  };

  const columns: ColumnDef<OastInteraction>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      width: 90,
      accessor: (r) => (
        <span className="font-mono text-text-muted text-xs">
          {new Date(r.timestamp).toLocaleTimeString()}
        </span>
      ),
    },
    {
      id: 'protocol',
      header: 'Protocol',
      width: 80,
      align: 'center',
      accessor: (r) => (
        <Badge variant={r.protocol.toUpperCase() === 'DNS' ? 'scope-in' : 'neutral'}>
          {r.protocol.toUpperCase()}
        </Badge>
      ),
    },
    {
      id: 'fullId',
      header: 'Callback Domain / Query',
      width: 320,
      accessor: (r) => (
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-mono text-xs font-semibold text-text-primary truncate block" title={r.fullId}>
            {r.fullId}
          </span>
          {r.exfiltratedData && (
            <Badge variant="scope-deny" className="text-[10px] px-1 py-0 flex-shrink-0">
              DATA: {r.exfiltratedData}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'remoteAddress',
      header: 'Target IP',
      width: 120,
      accessor: (r) => <span className="font-mono text-xs text-text-secondary">{r.remoteAddress || 'unknown'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: 120,
      align: 'center',
      accessor: () => (
        <Badge variant="scope-deny">CALLBACK VERIFIED</Badge>
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
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">Collaborator / OAST Gateway</h1>
              {serverStatus === 'active' ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent-green font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> LIVE ({domain})
                </span>
              ) : serverStatus === 'registering' ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent-cyan font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Registering...
                </span>
              ) : serverStatus === 'error' ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-danger font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Offline
                </span>
              ) : null}
            </div>
            <p className="text-xs text-text-secondary">
              Zero-knowledge encrypted DNS (:53) and HTTP (:80/:443) callback receiver. Linked directly to Sentinel SQL Scanner.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Globe className="w-3.5 h-3.5" />}
            onClick={() => setShowCustomConfig(!showCustomConfig)}
          >
            {showCustomConfig ? 'Hide Custom Domain' : 'Burp Collaborator Domain'}
          </Button>

          <Button
            variant="primary"
            size="xs"
            leftIcon={isPolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            disabled={isPolling}
            onClick={handlePoll}
          >
            {isPolling ? 'Polling...' : 'Poll Now'}
          </Button>
        </div>
      </div>

      {/* Custom Burp Collaborator Domain Configuration Drawer */}
      {showCustomConfig && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-panel-elevated border-b border-border-subtle flex-shrink-0 animate-in fade-in">
          <Globe className="w-4 h-4 text-accent-orange flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary uppercase whitespace-nowrap">
              Custom Domain (e.g. *.oastify.com):
            </span>
            <Input
              dense
              mono
              placeholder="e.g. xyz123.oastify.com (leave blank for built-in public oast.fun)"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button variant="primary" size="xs" onClick={handleSaveCustomDomain}>
            Apply Domain
          </Button>
        </div>
      )}

      {/* Token Generator Strip */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-panel-elevated border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <Key className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-text-secondary uppercase whitespace-nowrap">Payload Token:</span>
          <Input dense mono value={activePayload || 'Generating payload...'} readOnly className="flex-1" />
        </div>
        <Button variant="secondary" size="xs" leftIcon={<Copy className="w-3 h-3" />} onClick={handleCopy} disabled={!activePayload}>
          Copy Payload
        </Button>
        <Button variant="primary" size="xs" leftIcon={<RefreshCw className="w-3 h-3" />} onClick={handleGenerateToken}>
          Generate New Payload
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
                  Live Collaborator Interactions ({interactions.length})
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={interactions.length > 0 ? 'scope-deny' : 'neutral'}>
                    {interactions.length} Callbacks
                  </Badge>
                  {interactions.length > 0 && (
                    <Button variant="ghost" size="xs" leftIcon={<Trash2 className="w-3 h-3" />} onClick={clearInteractions}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0">
                {interactions.length > 0 ? (
                  <VirtualizedTable
                    data={interactions}
                    columns={columns}
                    rowHeight={32}
                    selectedId={selectedInteractionId}
                    getRowId={(r) => r.id}
                    onRowClick={(r) => setSelectedInteractionId(r.id)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                    <Radio className="w-8 h-8 text-text-muted animate-pulse" />
                    <p className="text-sm font-semibold text-text-secondary">Listening for incoming OOB interactions...</p>
                    <p className="text-xs text-text-muted max-w-sm">
                      Copy the payload above or launch a scan from the SQL tab. When the target triggers an out-of-band request, click &quot;Poll Now&quot; to inspect callbacks.
                    </p>
                  </div>
                )}
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedInteraction ? (
                <div className="p-3 bg-bg-panel rounded border border-danger/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-danger" /> Live Interaction Captured
                    </span>
                    <SeverityBadge severity="CRITICAL" />
                  </div>

                  <h3 className="text-sm font-bold text-text-primary font-mono break-all">
                    {selectedInteraction.fullId}
                  </h3>

                  {selectedInteraction.exfiltratedData && (
                    <div className="p-2.5 bg-accent-green/10 border border-accent-green/30 rounded">
                      <span className="text-xs font-bold text-accent-green uppercase block">
                        Exfiltrated Sensitive Data:
                      </span>
                      <span className="font-mono text-sm font-bold text-accent-green break-all">
                        {selectedInteraction.exfiltratedData}
                      </span>
                    </div>
                  )}

                  <div className="p-2 bg-bg-app rounded border border-border-subtle space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">PROTOCOL:</span>
                      <span className="text-accent-cyan font-bold">{selectedInteraction.protocol.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">TARGET IP:</span>
                      <span className="text-text-primary">{selectedInteraction.remoteAddress || 'unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">TOKEN:</span>
                      <span className="text-text-secondary truncate">{selectedInteraction.correlationToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">RECORDED AT:</span>
                      <span className="text-text-secondary">{new Date(selectedInteraction.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {selectedInteraction.rawRequest && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-text-secondary uppercase">Raw Request / DNS Packet:</span>
                      <pre className="p-2.5 bg-bg-panel-elevated rounded border border-border-subtle font-mono text-[11px] text-text-primary overflow-x-auto whitespace-pre-wrap max-h-48">
                        {selectedInteraction.rawRequest}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-text-muted space-y-2">
                  <ShieldAlert className="w-8 h-8 text-text-muted" />
                  <p className="text-xs">Select an interaction on the left to view detailed DNS/HTTP protocol data.</p>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};

