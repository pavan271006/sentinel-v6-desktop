/**
 * Sentinel Client-Side Storage & LocalStorage Synchronizer
 *
 * Solves client storage authentication architectures by:
 * 1. Ingesting exported window.localStorage and sessionStorage key-value dumps.
 * 2. Identifying Supabase, Firebase, Auth0, Cognito, and custom Bearer JWT tokens.
 * 3. Synthesizing valid Authorization headers and session parameters.
 */

export interface StorageDumpItem {
  storageType: 'localStorage' | 'sessionStorage';
  key: string;
  value: string;
}

export class BrowserStorageSynchronizer {
  private storageItems: Map<string, string> = new Map();

  public ingestStorage(items: StorageDumpItem[]): void {
    for (const it of items) {
      if (it.key && it.value) {
        this.storageItems.set(it.key, it.value);
      }
    }
  }

  public extractAuthTokens(): { headerName: string; headerValue: string; sourceKey: string }[] {
    const tokens: { headerName: string; headerValue: string; sourceKey: string }[] = [];

    for (const [k, v] of this.storageItems.entries()) {
      const lowerKey = k.toLowerCase();

      if (v.startsWith('ey') && v.split('.').length === 3) {
        tokens.push({ headerName: 'Authorization', headerValue: `Bearer ${v}`, sourceKey: k });
        continue;
      }

      if (v.startsWith('{') && (lowerKey.includes('auth') || lowerKey.includes('token') || lowerKey.includes('user') || lowerKey.includes('supabase') || lowerKey.includes('firebase'))) {
        try {
          const parsed = JSON.parse(v);
          const candidateToken = parsed.access_token || parsed.token || parsed.jwt || parsed.id_token || parsed.accessToken || parsed.currentSession?.accessToken?.jwtToken;
          if (candidateToken && typeof candidateToken === 'string') {
            tokens.push({ headerName: 'Authorization', headerValue: `Bearer ${candidateToken}`, sourceKey: k });
          }
        } catch {}
      }
    }

    return tokens;
  }
}
