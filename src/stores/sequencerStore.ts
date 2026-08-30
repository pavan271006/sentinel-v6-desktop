import { create } from 'zustand';

export interface SequencerState {
  targetUrl: string;
  tokenLocation: string;
  tokenName: string;
  setTargetUrl: (url: string) => void;
  setTokenLocation: (loc: string) => void;
  sendToSequencer: (tx: any) => void;
}

export const useSequencerStore = create<SequencerState>((set) => ({
  targetUrl: 'https://target.local/api/v1/auth/session',
  tokenLocation: 'Cookie: session_id',
  tokenName: 'session_id',
  setTargetUrl: (targetUrl) => set({ targetUrl }),
  setTokenLocation: (tokenLocation) => set({ tokenLocation }),
  sendToSequencer: (tx) => {
    const url = tx?.url || tx?.request?.url || '';
    const headers = tx?.reqHeaders || tx?.request?.headers || [];
    const cookieHeader = Array.isArray(headers) ? headers.find((h: any) => h.name.toLowerCase() === 'cookie') : null;
    let tokenLoc = 'Cookie: session_id';
    let tokName = 'session_id';
    if (cookieHeader) {
      const match = cookieHeader.value.match(/([a-zA-Z0-9_-]+)=/);
      if (match) {
        tokName = match[1];
        tokenLoc = `Cookie: ${tokName}`;
      }
    }
    set({
      targetUrl: url,
      tokenLocation: tokenLoc,
      tokenName: tokName,
    });
  },
}));
