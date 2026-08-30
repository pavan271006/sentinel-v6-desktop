import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge, SeverityBadge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { VirtualizedTable, ColumnDef } from '../design-system/VirtualizedTable';
import { useToastStore } from '../stores/toastStore';
import { Bug, FileText, RefreshCw } from 'lucide-react';

export interface FindingRecord {
  id: string;
  title: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'CANDIDATE' | 'VERIFIED' | 'CONFIRMED' | 'REPORTED' | 'REMEDIATED' | 'REGRESSION';
  cwe: string;
  cvss: number;
  endpoint: string;
  evidenceCasHash: string;
  verificationStrategy: string;
  description: string;
  remediation: string;
}

export const FindingsWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [findings] = useState<FindingRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const selectedFinding = findings.find((f) => f.id === selectedId) || findings[0];

  const columns: ColumnDef<FindingRecord>[] = [
    {
      id: 'severity',
      header: 'Severity',
      width: 90,
      accessor: (r) => <SeverityBadge severity={r.severity} />,
    },
    {
      id: 'title',
      header: 'Finding Title & CWE',
      width: 320,
      accessor: (r) => (
        <div>
          <span className="font-semibold text-xs text-text-primary block truncate">{r.title}</span>
          <span className="font-mono text-[10px] text-text-muted">{r.cwe} • CVSS {r.cvss}</span>
        </div>
      ),
    },
    {
      id: 'endpoint',
      header: 'Vulnerable Endpoint',
      width: 220,
      accessor: (r) => <span className="font-mono text-xs text-text-secondary truncate block">{r.endpoint}</span>,
    },
    {
      id: 'status',
      header: 'Proof Lifecycle',
      width: 110,
      align: 'center',
      accessor: (r) => <Badge variant="scope-in">{r.status}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <Bug className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Findings Center & Proof Lifecycle (SEC-06)</h1>
            <p className="text-xs text-text-secondary">Strict evidence-linked finding triage with cryptographic CAS proof backing.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="scope-deny">{findings.filter((f) => f.severity === 'CRITICAL').length} CRITICAL</Badge>
          <Badge variant="neutral">{findings.length} Verified Findings</Badge>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={650}
          minSize={350}
          maxSize={900}
          storageKey="findings_workspace_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-hidden">
              <div className="px-3 py-1.5 bg-bg-panel-elevated border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Verified Vulnerabilities ({findings.length})
                </span>
              </div>

              <div className="flex-1 min-h-0">
                {findings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 p-6 text-center text-text-muted space-y-2 select-none">
                    <Bug className="w-8 h-8 text-border-subtle" />
                    <span className="text-xs font-semibold text-text-secondary">No Verified Vulnerabilities</span>
                    <span className="text-[11px] max-w-xs text-text-muted">
                      Run automated or manual security checks against captured proxy traffic to promote verified findings.
                    </span>
                  </div>
                ) : (
                  <VirtualizedTable
                    data={findings}
                    columns={columns}
                    rowHeight={38}
                    selectedId={selectedId}
                    getRowId={(r) => r.id}
                    onRowClick={(r) => setSelectedId(r.id)}
                  />
                )}
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedFinding ? (
                <>
                  <div className="p-3 bg-bg-panel rounded border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <SeverityBadge severity={selectedFinding.severity} />
                      <Badge variant="scope-in">{selectedFinding.status}</Badge>
                    </div>

                    <h2 className="text-base font-bold text-text-primary">{selectedFinding.title}</h2>
                    <p className="text-xs font-mono text-accent-cyan">{selectedFinding.endpoint}</p>

                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Description & Impact:</span>
                      <p className="text-xs text-text-secondary leading-relaxed">{selectedFinding.description}</p>
                    </div>

                    <div className="p-2.5 bg-bg-panel-elevated rounded border border-border-subtle space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-text-muted">CAS EVIDENCE HASH (SEC-07):</span>
                        <span className="text-accent-cyan font-bold">{selectedFinding.evidenceCasHash}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-text-muted">VERIFICATION STRATEGY:</span>
                        <span className="text-text-primary">{selectedFinding.verificationStrategy}</span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Remediation Guidance:</span>
                      <p className="text-xs text-success leading-relaxed">{selectedFinding.remediation}</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => addToast({ type: 'info', title: `Included finding ${selectedFinding.id} in Report Bundle` })}
                      >
                        Add to Report
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                        onClick={() => addToast({ type: 'info', title: `Scheduled automated retest for ${selectedFinding.id}` })}
                      >
                        Queue Retest
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-text-muted text-xs border border-dashed border-border-subtle rounded">
                  <span>Select a verified finding from the table to view its cryptographic CAS proof and remediation guidance.</span>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
