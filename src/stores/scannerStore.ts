import { create } from 'zustand';

export interface ScannerCandidateItem {
  id: string;
  title: string;
  targetUri: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  strategy: 'CONTENT_MATCH' | 'ERROR_PATTERN' | 'TIMING_DELTA' | 'DIFFERENTIAL' | 'OAST_CALLBACK' | 'RACE_CONDITION';
  status: 'CANDIDATE' | 'VERIFYING' | 'VERIFIED' | 'FALSE_POSITIVE';
  cwe: string;
  cvss?: number;
  description?: string;
  casEvidenceHash?: string;
}

export interface ScannerState {
  candidates: ScannerCandidateItem[];
  isScanning: boolean;
  activeTarget: string;
  addScanTarget: (tx: any) => void;
  addCandidate: (candidate: ScannerCandidateItem) => void;
  toggleScanning: () => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  candidates: [],
  isScanning: false,
  activeTarget: '',
  addScanTarget: (tx) => {
    const url = tx?.url || tx?.request?.url || '';
    const method = tx?.method || tx?.request?.method || 'GET';
    const newCand: ScannerCandidateItem = {
      id: `cand-${Date.now()}`,
      title: `Audit ${method} ${url}`,
      targetUri: url,
      severity: 'HIGH',
      confidence: 95,
      strategy: 'ERROR_PATTERN',
      status: 'CANDIDATE',
      cwe: 'CWE-89',
      cvss: 8.5,
      casEvidenceHash: `cas-${Math.random().toString(36).substring(2, 10)}`,
    };
    set((state) => ({
      candidates: [newCand, ...state.candidates],
      activeTarget: url,
      isScanning: true,
    }));
  },
  addCandidate: (candidate) => {
    set((state) => ({
      candidates: [candidate, ...state.candidates.filter((c) => c.id !== candidate.id)],
    }));
  },
  toggleScanning: () => set((state) => ({ isScanning: !state.isScanning })),
}));
