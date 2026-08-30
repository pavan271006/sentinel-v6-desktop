import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { VirtualizedTable, ColumnDef } from '../design-system/VirtualizedTable';
import { useToastStore } from '../stores/toastStore';
import { KeyRound, Eye, EyeOff, Plus } from 'lucide-react';

export interface IdentityRecord {
  id: string;
  name: string;
  role: 'ADMIN' | 'PENTESTER' | 'USER' | 'AUDITOR' | 'GUEST';
  tenantId: string;
  secretRef: string;
  maskedToken: string;
  tokenType: 'BEARER_JWT' | 'SESSION_COOKIE' | 'API_KEY' | 'MTLS';
  expiresAt: string;
  isValid: boolean;
}

const INITIAL_IDENTITIES: IdentityRecord[] = [
  {
    id: 'ident-01',
    name: 'Administrator (SuperAdmin)',
    role: 'ADMIN',
    tenantId: 'tenant-enterprise-01',
    secretRef: 'sec-ref-8812-4190-bfa1',
    maskedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...[REDACTED_SEC_09]',
    tokenType: 'BEARER_JWT',
    expiresAt: '2026-08-18T12:00:00Z',
    isValid: true,
  },
  {
    id: 'ident-02',
    name: 'Standard User (Alice)',
    role: 'USER',
    tenantId: 'tenant-enterprise-01',
    secretRef: 'sec-ref-3301-8891-cdd2',
    maskedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...[REDACTED_SEC_09]',
    tokenType: 'BEARER_JWT',
    expiresAt: '2026-08-18T14:00:00Z',
    isValid: true,
  },
  {
    id: 'ident-03',
    name: 'Tenant B User (Bob)',
    role: 'USER',
    tenantId: 'tenant-enterprise-02',
    secretRef: 'sec-ref-4419-1102-efa3',
    maskedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...[REDACTED_SEC_09]',
    tokenType: 'BEARER_JWT',
    expiresAt: '2026-08-18T10:00:00Z',
    isValid: true,
  },
  {
    id: 'ident-04',
    name: 'Unauthenticated Guest',
    role: 'GUEST',
    tenantId: 'public',
    secretRef: 'sec-ref-none',
    maskedToken: '(none)',
    tokenType: 'BEARER_JWT',
    expiresAt: 'N/A',
    isValid: true,
  },
];

export const IdentityVaultWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [identities] = useState<IdentityRecord[]>(INITIAL_IDENTITIES);
  const [selectedId, setSelectedId] = useState<string>('ident-01');
  const [showSecret, setShowSecret] = useState(false);
  const [jwtAlgTamper, setJwtAlgTamper] = useState<'NONE' | 'RS_TO_HS' | 'EXPIRED'>('NONE');

  const selectedIdent = identities.find((i) => i.id === selectedId) || identities[0];

  const handleTestJwtAttack = () => {
    addToast({
      type: 'warning',
      title: `Generated forged JWT with alg: "${jwtAlgTamper}" for ${selectedIdent.name}`,
    });
  };

  const columns: ColumnDef<IdentityRecord>[] = [
    {
      id: 'role',
      header: 'Role',
      width: 95,
      accessor: (r) => (
        <Badge variant={r.role === 'ADMIN' ? 'scope-deny' : r.role === 'USER' ? 'scope-in' : 'neutral'}>
          {r.role}
        </Badge>
      ),
    },
    {
      id: 'name',
      header: 'Identity Name',
      width: 220,
      accessor: (r) => (
        <div>
          <span className="font-semibold text-xs text-text-primary block">{r.name}</span>
          <span className="font-mono text-[10px] text-text-muted">{r.tenantId}</span>
        </div>
      ),
    },
    {
      id: 'tokenType',
      header: 'Auth Type',
      width: 110,
      accessor: (r) => <span className="font-mono text-xs text-text-secondary">{r.tokenType}</span>,
    },
    {
      id: 'secretRef',
      header: 'SecretReference (SEC-09)',
      width: 170,
      accessor: (r) => <span className="font-mono text-[11px] text-text-muted truncate block">{r.secretRef}</span>,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Identity Vault & Zero-Leakage Secrets (SEC-09)</h1>
            <p className="text-xs text-text-secondary">Memory-zeroized keychain storing credentials with opaque UUID references.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="scope-in">ZEROIZE ACTIVE</Badge>
          <Badge variant="neutral">{identities.length} Principals Stored</Badge>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={600}
          minSize={350}
          maxSize={850}
          storageKey="identity_vault_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-hidden">
              <div className="px-3 py-2 bg-bg-panel-elevated border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Configured Test Identities
                </span>
                <Button variant="primary" size="xs" leftIcon={<Plus className="w-3 h-3" />} onClick={() => addToast({ type: 'info', title: 'New Identity Wizard' })}>
                  Add Principal
                </Button>
              </div>

              <div className="flex-1 min-h-0">
                <VirtualizedTable
                  data={identities}
                  columns={columns}
                  rowHeight={38}
                  selectedId={selectedId}
                  getRowId={(r) => r.id}
                  onRowClick={(r) => setSelectedId(r.id)}
                />
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedIdent && (
                <>
                  <div className="p-3 bg-bg-panel rounded border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Identity Details</span>
                      <Badge variant={selectedIdent.role === 'ADMIN' ? 'scope-deny' : 'scope-in'}>{selectedIdent.role}</Badge>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted uppercase">Display Name:</span>
                      <p className="text-sm font-bold text-text-primary">{selectedIdent.name}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted uppercase">Masked Token / Header:</span>
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="text-xs text-text-muted hover:text-accent-cyan flex items-center gap-1"
                        >
                          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {showSecret ? 'Mask Secret' : 'Temporarily Reveal'}
                        </button>
                      </div>
                      <pre className="p-2 bg-bg-app rounded border border-border-subtle font-mono text-xs text-accent-cyan break-all">
                        {showSecret ? 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwidXNlciI6ImFsaWNlIn0.XYZ98124_REAL_TOKEN' : selectedIdent.maskedToken}
                      </pre>
                    </div>

                    <div className="p-2 bg-bg-panel-elevated rounded border border-border-subtle text-xs space-y-1">
                      <span className="text-[10px] text-text-muted block uppercase">Zero-Leakage Invariant (SEC-09):</span>
                      <p className="text-text-secondary text-[11px]">
                        Opaque descriptor <code className="text-accent-cyan">{selectedIdent.secretRef}</code> is stored in DB. Plaintext token is only held in zeroized memory during live HTTP transmission.
                      </p>
                    </div>
                  </div>

                  {/* JWT Alg Manipulation Prober */}
                  <div className="p-3 bg-bg-panel rounded border border-border-subtle space-y-3">
                    <span className="text-xs font-semibold text-text-primary uppercase tracking-wider block">
                      JWT Algorithm Manipulation Generator
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setJwtAlgTamper('NONE')}
                        className={`p-2 rounded border text-xs font-mono transition-colors ${
                          jwtAlgTamper === 'NONE' ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan font-bold' : 'bg-bg-app border-border-subtle text-text-secondary'
                        }`}
                      >
                        alg: "none"
                      </button>
                      <button
                        onClick={() => setJwtAlgTamper('RS_TO_HS')}
                        className={`p-2 rounded border text-xs font-mono transition-colors ${
                          jwtAlgTamper === 'RS_TO_HS' ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan font-bold' : 'bg-bg-app border-border-subtle text-text-secondary'
                        }`}
                      >
                        RS256 → HS256
                      </button>
                      <button
                        onClick={() => setJwtAlgTamper('EXPIRED')}
                        className={`p-2 rounded border text-xs font-mono transition-colors ${
                          jwtAlgTamper === 'EXPIRED' ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan font-bold' : 'bg-bg-app border-border-subtle text-text-secondary'
                        }`}
                      >
                        Expired (exp -1d)
                      </button>
                    </div>

                    <Button variant="primary" size="sm" onClick={handleTestJwtAttack}>
                      Generate Forged Token & Send to Repeater
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
