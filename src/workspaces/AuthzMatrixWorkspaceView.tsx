import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { SeverityBadge } from '../design-system/Badge';
import { useToastStore } from '../stores/toastStore';
import { useTrafficStore } from '../stores/trafficStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DownloadCloud,
  Key,
  Sliders,
  Send,
} from 'lucide-react';
import {
  AuthzMatrixEngine,
  MatrixEndpoint,
  EvaluatedMatrixRow,
  PrincipalConfig,
  DEFAULT_PRINCIPALS,
} from '../services/authz/AuthzMatrixEngine';

const SAMPLE_ENDPOINTS: MatrixEndpoint[] = [
  {
    id: 'ep-1',
    endpoint: 'GET /api/v1/invoices/:id',
    method: 'GET',
    action: 'READ',
    resourceId: 'invoice_9042 (Alice)',
    url: 'https://target.local/api/v1/invoices/9042',
    adminAllowed: true,
    userAllowed: true,
    tenantBAllowed: false,
    guestAllowed: false,
  },
  {
    id: 'ep-2',
    endpoint: 'DELETE /api/v1/users/:id',
    method: 'DELETE',
    action: 'DELETE',
    resourceId: 'user_102 (Alice)',
    url: 'https://target.local/api/v1/users/102',
    adminAllowed: true,
    userAllowed: false,
    tenantBAllowed: false,
    guestAllowed: false,
  },
  {
    id: 'ep-3',
    endpoint: 'GET /api/v1/admin/audit-logs',
    method: 'GET',
    action: 'ADMIN',
    resourceId: 'system_logs',
    url: 'https://target.local/api/v1/admin/audit-logs',
    adminAllowed: true,
    userAllowed: false,
    tenantBAllowed: false,
    guestAllowed: false,
  },
  {
    id: 'ep-4',
    endpoint: 'POST /api/v1/orders/checkout',
    method: 'POST',
    action: 'WRITE',
    resourceId: 'cart_551',
    url: 'https://target.local/api/v1/orders/checkout',
    adminAllowed: true,
    userAllowed: true,
    tenantBAllowed: false,
    guestAllowed: false,
  },
  {
    id: 'ep-5',
    endpoint: 'GET /api/v1/tenant/settings',
    method: 'GET',
    action: 'READ',
    resourceId: 'tenant_settings_a',
    url: 'https://target.local/api/v1/tenant/settings',
    adminAllowed: true,
    userAllowed: true,
    tenantBAllowed: false,
    guestAllowed: false,
  },
];

export const AuthzMatrixWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { transactions } = useTrafficStore();
  const { createTab } = useRepeaterStore();

  const [endpoints, setEndpoints] = useState<MatrixEndpoint[]>(SAMPLE_ENDPOINTS);
  const [evaluatedRows, setEvaluatedRows] = useState<EvaluatedMatrixRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<EvaluatedMatrixRow | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState<{ done: number; total: number } | null>(null);

  // Principals Configuration
  const [principals, setPrincipals] = useState<PrincipalConfig[]>(DEFAULT_PRINCIPALS);
  const [showConfig, setShowConfig] = useState(false);

  const handleImportFromTraffic = () => {
    if (!transactions || transactions.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Traffic Available',
        description: 'Send traffic through Sentinel Proxy to automatically import endpoints.',
      });
      return;
    }

    const imported = AuthzMatrixEngine.extractEndpointsFromTraffic(transactions);
    if (imported.length === 0) {
      addToast({
        type: 'info',
        title: 'No Endpoints Extracted',
        description: 'No HTTP API endpoints matched the extraction filter in traffic history.',
      });
      return;
    }

    setEndpoints(imported);
    setEvaluatedRows([]);
    setSelectedRow(null);
    addToast({
      type: 'success',
      title: 'Imported Endpoints',
      description: `Loaded ${imported.length} unique API endpoints from proxy stream`,
    });
  };

  const handleRunMatrixEvaluation = async () => {
    if (endpoints.length === 0) {
      addToast({ type: 'warning', title: 'Empty Matrix', description: 'Add or import endpoints first' });
      return;
    }

    setEvaluating(true);
    setEvalProgress({ done: 0, total: endpoints.length });
    addToast({
      type: 'info',
      title: 'Starting Matrix Replay',
      description: `Replaying ${endpoints.length} endpoints across 4 principals (Admin, Alice, Bob, Guest)...`,
    });

    const engine = new AuthzMatrixEngine(principals);

    try {
      const results = await engine.evaluateMatrix(endpoints, (done, total) => {
        setEvalProgress({ done, total });
      });

      setEvaluatedRows(results);
      if (results.length > 0) {
        setSelectedRow(results[0]);
      }

      const violations = results.filter((r) => r.violationType !== null);
      if (violations.length > 0) {
        addToast({
          type: 'danger',
          title: `Access Control Audit Complete: ${violations.length} Violations Detected!`,
          description: `Identified ${violations.map((v) => v.violationType).join(', ')} defects`,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Audit Complete: All Endpoints Properly Enforced',
          description: 'No cross-tenant or unauthenticated leaks detected across tested principals.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Evaluation Failed',
        description: err?.message || 'Error occurred during matrix replay',
      });
    } finally {
      setEvaluating(false);
      setEvalProgress(null);
    }
  };

  const handleSendToRepeater = (row: EvaluatedMatrixRow) => {
    const bobPrincipal = principals.find((p) => p.id === 'tenantB') || DEFAULT_PRINCIPALS[2];
    createTab({
      title: `BOLA: ${row.endpoint}`,
      url: row.url,
      method: (row.method as any) || 'GET',
      headers: [
        { id: 'h-1', name: bobPrincipal.authHeaderName || 'Authorization', value: bobPrincipal.authHeaderValue, enabled: true },
        { id: 'h-2', name: 'User-Agent', value: 'Sentinel/6.0', enabled: true },
      ],
    });

    addToast({
      type: 'success',
      title: 'Dispatched to Repeater',
      description: `Loaded cross-tenant attacker request for ${row.endpoint}`,
    });
  };

  const activeRows = evaluatedRows.length > 0 ? evaluatedRows : endpoints;

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-bold text-white text-xs">IRA+ Authorization Matrix (BOLA / IDOR / BFLA)</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Multi-Principal Differential Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<DownloadCloud className="w-3 h-3 text-[#34d399]" />}
            onClick={handleImportFromTraffic}
          >
            Import from Traffic
          </Button>

          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Sliders className="w-3 h-3 text-[#9da5b4]" />}
            onClick={() => setShowConfig(!showConfig)}
          >
            Principals ({principals.length})
          </Button>

          <Button
            variant="primary"
            size="xs"
            disabled={evaluating}
            leftIcon={<Play className="w-3 h-3" />}
            onClick={handleRunMatrixEvaluation}
            className="bg-[#38bdf8] hover:bg-[#0284c7] text-black font-bold"
          >
            {evaluating
              ? `Replaying (${evalProgress?.done || 0}/${evalProgress?.total || 0})...`
              : 'Run Matrix Evaluation'}
          </Button>
        </div>
      </div>

      {/* Principals Configuration Drawer */}
      {showConfig && (
        <div className="p-3 bg-[#141517] border-b border-[#2b2d30] grid grid-cols-4 gap-3 text-xs">
          {principals.map((p, idx) => (
            <div key={p.id} className="bg-[#1e1f22] p-2.5 rounded border border-[#3e4249] flex flex-col gap-1.5">
              <span className="font-bold text-white text-[11px] flex items-center gap-1">
                <Key className="w-3 h-3 text-[#f37021]" />
                {p.name}
              </span>
              <input
                type="text"
                placeholder="Auth Header (e.g. Authorization)"
                value={p.authHeaderName}
                onChange={(e) => {
                  const updated = [...principals];
                  updated[idx].authHeaderName = e.target.value;
                  setPrincipals(updated);
                }}
                className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-1 text-white text-[10px] font-mono"
              />
              <input
                type="text"
                placeholder="Header Value (Bearer token...)"
                value={p.authHeaderValue}
                onChange={(e) => {
                  const updated = [...principals];
                  updated[idx].authHeaderValue = e.target.value;
                  setPrincipals(updated);
                }}
                className="w-full bg-[#141517] border border-[#3e4249] rounded px-2 py-1 text-white text-[10px] font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Main Workspace Split: Matrix Table & Selected Row Findings */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Matrix Table */}
        <div className="flex-1 p-3 overflow-y-auto border-r border-[#2b2d30]">
          <div className="border border-[#3e4249] rounded overflow-hidden bg-[#141517]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
                <tr>
                  <th className="px-3 py-2">Endpoint & Action</th>
                  <th className="px-3 py-2">Resource Object</th>
                  <th className="px-3 py-2 text-center">Admin (Super)</th>
                  <th className="px-3 py-2 text-center">Alice (Tenant A)</th>
                  <th className="px-3 py-2 text-center">Bob (Tenant B)</th>
                  <th className="px-3 py-2 text-center">Guest (Unauth)</th>
                  <th className="px-3 py-2 text-center">Access Control Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {activeRows.map((row: any, idx: number) => {
                  const isEvaluated = 'adminActual' in row;
                  const isSelected = selectedRow?.endpoint === row.endpoint;

                  return (
                    <tr
                      key={row.id || idx}
                      onClick={() => setSelectedRow(row)}
                      className={`hover:bg-[#1e1f22] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#1e1f22] border-l-2 border-[#38bdf8]' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-white block">{row.endpoint}</span>
                        <span className="text-[10px] text-[#38bdf8] font-bold">{row.action}</span>
                      </td>

                      <td className="px-3 py-2.5 text-[#9da5b4]">{row.resourceId}</td>

                      {/* Admin column */}
                      <td className="px-3 py-2.5 text-center">
                        {isEvaluated ? (
                          row.adminActual.isAccessAllowed ? (
                            <span className="inline-flex items-center text-[#34d399] gap-1 font-mono text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {row.adminActual.statusCode} OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[#9da5b4] gap-1 font-mono text-xs">
                              <XCircle className="w-3.5 h-3.5" /> {row.adminActual.statusCode}
                            </span>
                          )
                        ) : (
                          <span className="text-[#9da5b4] font-mono text-[11px]">Ready</span>
                        )}
                      </td>

                      {/* Alice column */}
                      <td className="px-3 py-2.5 text-center">
                        {isEvaluated ? (
                          row.userActual.isAccessAllowed ? (
                            <span className="inline-flex items-center text-[#34d399] gap-1 font-mono text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {row.userActual.statusCode} OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[#9da5b4] gap-1 font-mono text-xs">
                              <XCircle className="w-3.5 h-3.5" /> {row.userActual.statusCode}
                            </span>
                          )
                        ) : (
                          <span className="text-[#9da5b4] font-mono text-[11px]">Ready</span>
                        )}
                      </td>

                      {/* Bob column (Cross-tenant attacker) */}
                      <td className="px-3 py-2.5 text-center">
                        {isEvaluated ? (
                          row.tenantBActual.isAccessAllowed ? (
                            <span className="inline-flex items-center text-[#ef4444] font-bold gap-1 font-mono text-xs animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" /> {row.tenantBActual.statusCode} LEAK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[#34d399] gap-1 font-mono text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {row.tenantBActual.statusCode} Blocked
                            </span>
                          )
                        ) : (
                          <span className="text-[#9da5b4] font-mono text-[11px]">Ready</span>
                        )}
                      </td>

                      {/* Guest column */}
                      <td className="px-3 py-2.5 text-center">
                        {isEvaluated ? (
                          row.guestActual.isAccessAllowed ? (
                            <span className="inline-flex items-center text-[#ef4444] font-bold gap-1 font-mono text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" /> {row.guestActual.statusCode} LEAK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[#34d399] gap-1 font-mono text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {row.guestActual.statusCode} Denied
                            </span>
                          )
                        ) : (
                          <span className="text-[#9da5b4] font-mono text-[11px]">Ready</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2.5 text-center">
                        {isEvaluated ? (
                          row.violationType ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40">
                              {row.violationType} VIOLATION
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40">
                              ENFORCED
                            </span>
                          )
                        ) : (
                          <span className="text-[#9da5b4] text-[10px]">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Row Evidence Dossier */}
        <div className="w-96 bg-[#141517] p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[#2b2d30]">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#38bdf8]" />
              Authorization Evaluation Dossier
            </span>
            {selectedRow && selectedRow.violationType && (
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                onClick={() => handleSendToRepeater(selectedRow)}
              >
                Send to Repeater
              </Button>
            )}
          </div>

          {selectedRow ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Audited Endpoint</label>
                <div className="text-xs font-bold text-white font-mono bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-1">
                  {selectedRow.endpoint}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Resource Context</label>
                <div className="text-xs font-mono text-[#38bdf8] bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-1">
                  {selectedRow.resourceId}
                </div>
              </div>

              {selectedRow.violationType ? (
                <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/40 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#ef4444] uppercase">
                      {selectedRow.violationType} Defect Detected
                    </span>
                    <SeverityBadge severity="HIGH" />
                  </div>
                  <p className="text-xs text-white">
                    {selectedRow.violationSummary ||
                      `Principal Bob accessed ${selectedRow.resourceId} without authorization.`}
                  </p>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() =>
                      addToast({
                        type: 'success',
                        title: `Promoted ${selectedRow.violationType} on ${selectedRow.endpoint} to Finding`,
                      })
                    }
                    className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold mt-1"
                  >
                    Promote to Findings Center
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-[#34d399]/10 border border-[#34d399]/40 rounded text-xs text-[#34d399]">
                  Access controls properly enforced on this endpoint across all test identities.
                </div>
              )}

              {selectedRow.adminActual && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] text-[#9da5b4] uppercase font-semibold">Principal Replay Snippets</label>
                  <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249] space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-white">Admin (Super):</span>
                      <span className="text-[#34d399] font-bold">HTTP {selectedRow.adminActual.statusCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white">Alice (Tenant A):</span>
                      <span className="text-[#34d399] font-bold">HTTP {selectedRow.userActual.statusCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white">Bob (Tenant B):</span>
                      <span className={selectedRow.tenantBActual.isAccessAllowed ? 'text-[#ef4444] font-bold' : 'text-[#34d399]'}>
                        HTTP {selectedRow.tenantBActual.statusCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white">Guest (Unauth):</span>
                      <span className={selectedRow.guestActual.isAccessAllowed ? 'text-[#ef4444] font-bold' : 'text-[#34d399]'}>
                        HTTP {selectedRow.guestActual.statusCode}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-[#9da5b4] text-xs py-8">
              Select an endpoint from the matrix to view authorization evaluation details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
