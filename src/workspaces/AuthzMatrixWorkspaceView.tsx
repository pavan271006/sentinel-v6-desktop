import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge, SeverityBadge } from '../design-system/Badge';
import { useToastStore } from '../stores/toastStore';
import { ShieldAlert, Play, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export interface MatrixCell {
  endpoint: string;
  action: 'READ' | 'WRITE' | 'DELETE' | 'ADMIN';
  resourceId: string;
  adminAllowed: boolean;
  userAllowed: boolean;
  userActual: boolean;
  tenantBActual: boolean;
  guestActual: boolean;
  violationType?: 'BOLA' | 'IDOR' | 'BFLA' | null;
}

const SAMPLE_MATRIX: MatrixCell[] = [
  {
    endpoint: 'GET /api/v1/invoices/:id',
    action: 'READ',
    resourceId: 'invoice_9042 (Alice)',
    adminAllowed: true,
    userAllowed: true,
    userActual: true,
    tenantBActual: true, // BOLA violation!
    guestActual: false,
    violationType: 'BOLA',
  },
  {
    endpoint: 'DELETE /api/v1/users/:id',
    action: 'DELETE',
    resourceId: 'user_102 (Alice)',
    adminAllowed: true,
    userAllowed: false,
    userActual: true, // IDOR / BFLA violation!
    tenantBActual: false,
    guestActual: false,
    violationType: 'BFLA',
  },
  {
    endpoint: 'GET /api/v1/admin/audit-logs',
    action: 'ADMIN',
    resourceId: 'system_logs',
    adminAllowed: true,
    userAllowed: false,
    userActual: false,
    tenantBActual: false,
    guestActual: false,
    violationType: null,
  },
  {
    endpoint: 'POST /api/v1/orders/checkout',
    action: 'WRITE',
    resourceId: 'cart_551',
    adminAllowed: true,
    userAllowed: true,
    userActual: true,
    tenantBActual: false,
    guestActual: false,
    violationType: null,
  },
  {
    endpoint: 'GET /api/v1/tenant/settings',
    action: 'READ',
    resourceId: 'tenant_settings_a',
    adminAllowed: true,
    userAllowed: true,
    userActual: true,
    tenantBActual: true, // Cross-tenant IDOR!
    guestActual: false,
    violationType: 'IDOR',
  },
];

export const AuthzMatrixWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [matrix] = useState<MatrixCell[]>(SAMPLE_MATRIX);
  const [evaluating, setEvaluating] = useState(false);
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(SAMPLE_MATRIX[0]);

  const handleRunMatrixEvaluation = () => {
    setEvaluating(true);
    addToast({ type: 'info', title: 'Running multi-principal IRA+ authorization evaluation...' });
    setTimeout(() => {
      setEvaluating(false);
      addToast({ type: 'danger', title: 'Evaluation complete: 3 Authorization Violations Verified (2 BOLA, 1 BFLA)' });
    }, 600);
  };

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">IRA+ Authorization Matrix (BOLA / IDOR / BFLA)</h1>
            <p className="text-xs text-text-secondary">Cross-principal matrix testing across Admin, Tenant A, Tenant B, and Guest.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={evaluating}
            leftIcon={<Play className="w-3.5 h-3.5" />}
            onClick={handleRunMatrixEvaluation}
          >
            {evaluating ? 'Evaluating Matrix...' : 'Run Matrix Evaluation'}
          </Button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="border border-border-subtle rounded bg-bg-panel overflow-hidden">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-bg-panel-elevated border-b border-border-subtle text-text-secondary uppercase text-[11px]">
                <th className="p-3 font-semibold">Endpoint & Action</th>
                <th className="p-3 font-semibold">Resource Object</th>
                <th className="p-3 font-semibold text-center">Admin (Super)</th>
                <th className="p-3 font-semibold text-center">Alice (Tenant A)</th>
                <th className="p-3 font-semibold text-center">Bob (Tenant B)</th>
                <th className="p-3 font-semibold text-center">Guest (Unauth)</th>
                <th className="p-3 font-semibold text-center">Access Control Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {matrix.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedCell(row)}
                  className={`hover:bg-bg-panel-elevated/80 cursor-pointer transition-colors ${
                    selectedCell?.endpoint === row.endpoint ? 'bg-bg-panel-elevated' : ''
                  }`}
                >
                  <td className="p-3">
                    <span className="font-mono font-semibold text-text-primary block">{row.endpoint}</span>
                    <Badge variant="neutral">{row.action}</Badge>
                  </td>
                  <td className="p-3 font-mono text-text-secondary">{row.resourceId}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center text-success gap-1 font-mono text-xs">
                      <CheckCircle2 className="w-4 h-4" /> 200 OK
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {row.userActual ? (
                      <span className="inline-flex items-center text-success gap-1 font-mono text-xs">
                        <CheckCircle2 className="w-4 h-4" /> 200 OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-text-muted gap-1 font-mono text-xs">
                        <XCircle className="w-4 h-4" /> 403 Forbidden
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.tenantBActual ? (
                      <span className="inline-flex items-center text-danger font-bold gap-1 font-mono text-xs animate-pulse">
                        <AlertTriangle className="w-4 h-4" /> 200 LEAK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-text-muted gap-1 font-mono text-xs">
                        <XCircle className="w-4 h-4" /> 403 Forbidden
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.guestActual ? (
                      <span className="inline-flex items-center text-danger font-bold gap-1 font-mono text-xs">
                        <AlertTriangle className="w-4 h-4" /> 200 LEAK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-text-muted gap-1 font-mono text-xs">
                        <XCircle className="w-4 h-4" /> 401 Unauth
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.violationType ? (
                      <Badge variant="scope-deny">{row.violationType} VIOLATION</Badge>
                    ) : (
                      <Badge variant="scope-in">ENFORCED</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Violation Dossier */}
        {selectedCell && selectedCell.violationType && (
          <div className="p-4 bg-bg-panel rounded border border-danger/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-danger" />
                <h3 className="text-sm font-bold text-danger uppercase tracking-wider">
                  Verified {selectedCell.violationType} Access Control Defect
                </h3>
              </div>
              <SeverityBadge severity="HIGH" />
            </div>

            <p className="text-xs text-text-primary">
              Principal <strong>Bob (Tenant B)</strong> was able to access resource <strong>{selectedCell.resourceId}</strong> belonging to Tenant A via <code>{selectedCell.endpoint}</code> with status code <strong>200 OK</strong>.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => addToast({ type: 'success', title: `Promoted ${selectedCell.violationType} on ${selectedCell.endpoint} to Finding` })}
              >
                Promote to Finding & Link CAS Evidence (SEC-06)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addToast({ type: 'info', title: `Opened differential replay in Repeater` })}
              >
                Send Cross-Tenant Replay to Repeater
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
