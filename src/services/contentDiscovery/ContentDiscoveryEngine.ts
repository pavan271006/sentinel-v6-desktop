/**
 * Sentinel V6 - High-Performance Content Discovery & Directory Fuzzing Engine
 *
 * Inspired by ffuf (joohoi), feroxbuster (epi052), and gobuster.
 * Features dynamic wildcard 404 calibration to eliminate soft-404 false positives,
 * curated SecLists-grade dictionaries (admin, config, backup, API), concurrent workers,
 * and status code classification.
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export type PathCategory = 'Directory' | 'File' | 'Config' | 'Backup' | 'API';

export interface DiscoveredEndpoint {
  id: number;
  path: string;
  url: string;
  status: number;
  length: number;
  type: PathCategory;
  timeMs: number;
  redirectUrl?: string;
  snippet?: string;
}

export interface ContentDiscoveryConfig {
  targetUrl: string;
  wordlist: string[];
  concurrency?: number;
  matchStatusCodes?: number[];
  filterLengthDelta?: number;
  delayMs?: number;
}

export interface DiscoveryProgress {
  testedCount: number;
  totalCount: number;
  discoveredCount: number;
  rps: number;
  percent: number;
  currentPath: string;
}

// ─── Curated SecLists-Grade Wordlists ────────────────────────────────────────

export const WORDLIST_ADMIN: string[] = [
  '/admin',
  '/administrator',
  '/admin/login',
  '/login',
  '/signin',
  '/dashboard',
  '/panel',
  '/portal',
  '/console',
  '/manage',
  '/management',
  '/cpanel',
  '/controlpanel',
  '/auth/admin',
  '/user/login',
  '/system/admin',
  '/wp-admin',
  '/phpmyadmin',
  '/admin.php',
  '/admin.html',
  '/adm',
  '/superadmin',
];

export const WORDLIST_SENSITIVE_FILES: string[] = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/HEAD',
  '/.git/config',
  '/.git/index',
  '/.svn/entries',
  '/web.config',
  '/.htaccess',
  '/.DS_Store',
  '/id_rsa',
  '/id_rsa.pub',
  '/docker-compose.yml',
  '/Dockerfile',
  '/package.json',
  '/composer.json',
  '/config.json',
  '/settings.json',
  '/settings.py',
  '/database.yml',
  '/credentials.xml',
  '/server.js',
  '/app.config',
  '/robots.txt',
  '/sitemap.xml',
  '/.well-known/security.txt',
];

export const WORDLIST_BACKUPS: string[] = [
  '/backup.zip',
  '/backup.tar.gz',
  '/backup.sql',
  '/dump.sql',
  '/db.sql',
  '/database.sql',
  '/site.zip',
  '/archive.tar.gz',
  '/www.zip',
  '/html.tar.gz',
  '/index.php.bak',
  '/index.html.bak',
  '/app.zip',
  '/data.sql',
  '/backup-latest.zip',
  '/db_backup.sql',
  '/old.zip',
  '/backup/',
];

export const WORDLIST_API: string[] = [
  '/swagger.json',
  '/swagger/v1/swagger.json',
  '/openapi.json',
  '/v2/api-docs',
  '/v3/api-docs',
  '/api-docs',
  '/swagger-ui.html',
  '/swagger/index.html',
  '/docs',
  '/graphql',
  '/graphiql',
  '/altair',
  '/api/v1/health',
  '/api/v1/status',
  '/api/v1/users',
  '/api/v1/auth',
  '/actuator',
  '/actuator/health',
  '/actuator/env',
  '/actuator/info',
  '/metrics',
  '/healthz',
  '/livez',
  '/readyz',
];

export const WORDLIST_DIRECTORIES: string[] = [
  '/api',
  '/api/v1',
  '/api/v2',
  '/static',
  '/public',
  '/assets',
  '/uploads',
  '/files',
  '/images',
  '/docs',
  '/test',
  '/temp',
  '/tmp',
  '/internal',
  '/private',
  '/secure',
  '/core',
  '/config',
  '/lib',
  '/src',
  '/scripts',
  '/vendor',
  '/node_modules',
];

// Combined Full Dictionaries
export const WORDLIST_FULL_QUICK: string[] = Array.from(
  new Set([
    ...WORDLIST_ADMIN,
    ...WORDLIST_SENSITIVE_FILES,
    ...WORDLIST_BACKUPS,
    ...WORDLIST_API,
    ...WORDLIST_DIRECTORIES,
  ])
);

// ─── ContentDiscoveryEngine Class ───────────────────────────────────────────

export class ContentDiscoveryEngine {
  private config: ContentDiscoveryConfig;
  private aborted: boolean = false;
  private onDiscovered?: (item: DiscoveredEndpoint) => void;
  private onProgress?: (p: DiscoveryProgress) => void;

  // Wildcard 404 Calibration Signatures
  private wildcardCalibrated: boolean = false;
  private wildcardStatus: number = 404;
  private wildcardLength: number = 0;
  private wildcardTitle: string = '';

  private completedTimestamps: number[] = [];
  private testedCount: number = 0;
  private discoveredCount: number = 0;

  constructor(
    config: ContentDiscoveryConfig,
    callbacks?: {
      onDiscovered?: (item: DiscoveredEndpoint) => void;
      onProgress?: (p: DiscoveryProgress) => void;
    }
  ) {
    this.config = {
      concurrency: 15,
      matchStatusCodes: [200, 201, 204, 301, 302, 307, 308, 401, 403],
      filterLengthDelta: 10,
      delayMs: 0,
      ...config,
    };
    this.onDiscovered = callbacks?.onDiscovered;
    this.onProgress = callbacks?.onProgress;
  }

  public abort(): void {
    this.aborted = true;
  }

  /**
   * Main discovery routine:
   * 1. Calibrate wildcard 404 / soft-404.
   * 2. Spawn concurrent worker pool across wordlist.
   * 3. Filter false positives and report discovered assets.
   */
  public async run(): Promise<DiscoveredEndpoint[]> {
    this.aborted = false;
    this.testedCount = 0;
    this.discoveredCount = 0;
    this.completedTimestamps = [];
    const discovered: DiscoveredEndpoint[] = [];

    // Step 1: Wildcard 404 Calibration
    await this.calibrateWildcard();

    const wordlist = this.config.wordlist;
    const totalCount = wordlist.length;
    const workerCount = Math.min(this.config.concurrency || 15, totalCount);

    if (totalCount === 0) return discovered;

    let currentIndex = 0;

    const rpsInterval = setInterval(() => {
      this.emitProgress(totalCount, currentIndex < totalCount ? wordlist[currentIndex] : '');
    }, 250);

    const worker = async () => {
      while (!this.aborted) {
        const idx = currentIndex++;
        if (idx >= totalCount) break;

        const path = wordlist[idx];
        const res = await this.probePath(idx + 1, path);

        if (res && this.isInteresting(res)) {
          discovered.push(res);
          this.discoveredCount++;
          this.onDiscovered?.(res);
        }

        this.testedCount++;
        this.completedTimestamps.push(performance.now());

        if (this.config.delayMs && this.config.delayMs > 0) {
          await new Promise((r) => setTimeout(r, this.config.delayMs));
        }
      }
    };

    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    clearInterval(rpsInterval);
    this.emitProgress(totalCount, 'Finished');

    return discovered;
  }

  // ─── Wildcard 404 Soft-Error Calibration ──────────────────────────────────

  private async calibrateWildcard(): Promise<void> {
    const nonces = [
      `_stnl_${Math.random().toString(36).substring(2, 9)}`,
      `_stnl_${Math.random().toString(36).substring(2, 9)}`,
      `_stnl_${Math.random().toString(36).substring(2, 9)}`,
    ];

    const results: { status: number; length: number; title: string }[] = [];

    for (const nonce of nonces) {
      const probeUrl = this.buildUrl(nonce);
      const host = this.getHost(probeUrl);
      const path = this.getPath(probeUrl);

      const rawReq = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 Sentinel-Discover/6.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

      try {
        const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
          tabId: 'discover_calib',
          targetUrl: probeUrl,
          rawRequest: rawReq,
        });

        const status = res.statusCode || 404;
        const body = res.body || '';
        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim().toLowerCase() : '';

        results.push({ status, length: body.length, title });
      } catch {
        // Skip failed calibration probe
      }
    }

    if (results.length > 0) {
      this.wildcardCalibrated = true;
      this.wildcardStatus = results[0].status;
      const totalLen = results.reduce((sum, r) => sum + r.length, 0);
      this.wildcardLength = Math.round(totalLen / results.length);
      this.wildcardTitle = results[0].title;
    } else {
      this.wildcardCalibrated = false;
    }
  }

  /**
   * Generates backup and sensitive file extension variations for discovered paths
   */
  public static generateExtensionMutations(
    basePaths: string[],
    extensions: string[] = ['.bak', '.old', '.orig', '.swp', '.tar.gz', '.zip', '.json', '.txt', '~']
  ): string[] {
    const mutated: string[] = [];
    for (const p of basePaths) {
      const clean = p.replace(/\/+$/, '');
      if (clean && clean !== '/') {
        for (const ext of extensions) {
          mutated.push(`${clean}${ext}`);
        }
      }
    }
    return mutated;
  }

  // ─── Path Probe Execution ─────────────────────────────────────────────────

  private async probePath(id: number, subpath: string): Promise<DiscoveredEndpoint | null> {
    const cleanSubpath = subpath.startsWith('/') ? subpath : `/${subpath}`;
    const url = this.buildUrl(cleanSubpath);
    const host = this.getHost(url);
    const pathWithQuery = this.getPath(url);

    const rawReq = `GET ${pathWithQuery} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 Sentinel-Discover/6.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

    const startTime = performance.now();
    try {
      const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
        tabId: `disc_${id}`,
        targetUrl: url,
        rawRequest: rawReq,
      });

      const timeMs = res.durationMs || Math.round(performance.now() - startTime);
      const status = res.statusCode || 200;
      const body = res.body || '';
      const length = body.length;

      // Check for redirect Location header
      const locationHeader = res.headers?.find(
        (h) => h.name.toLowerCase() === 'location'
      )?.value;

      return {
        id,
        path: cleanSubpath,
        url,
        status,
        length,
        type: this.categorizePath(cleanSubpath),
        timeMs,
        redirectUrl: locationHeader,
        snippet: body.slice(0, 100),
      };
    } catch {
      return null;
    }
  }

  // ─── Filter & Classification ──────────────────────────────────────────────

  private isInteresting(item: DiscoveredEndpoint): boolean {
    const allowedStatuses = this.config.matchStatusCodes || [200, 201, 204, 301, 302, 307, 401, 403];
    if (!allowedStatuses.includes(item.status)) {
      return false;
    }

    // Wildcard Soft-404 Rejection:
    // If the server returns identical status and nearly identical length to the calibrated 404 canary, reject it.
    if (this.wildcardCalibrated) {
      if (item.status === this.wildcardStatus) {
        const delta = Math.abs(item.length - this.wildcardLength);
        if (delta <= (this.config.filterLengthDelta || 10)) {
          return false;
        }
        if (this.wildcardTitle && (item.snippet || '').toLowerCase().includes(this.wildcardTitle)) {
          return false;
        }
      }
    }

    return true;
  }

  private categorizePath(path: string): PathCategory {
    const lower = path.toLowerCase();
    if (lower.includes('.env') || lower.includes('.git') || lower.includes('config') || lower.includes('.xml')) {
      return 'Config';
    }
    if (lower.includes('.zip') || lower.includes('.sql') || lower.includes('.tar') || lower.includes('.bak')) {
      return 'Backup';
    }
    if (lower.includes('swagger') || lower.includes('openapi') || lower.includes('graphql') || lower.includes('actuator')) {
      return 'API';
    }
    if (lower.endsWith('/') || !lower.includes('.')) {
      return 'Directory';
    }
    return 'File';
  }

  private buildUrl(subpath: string): string {
    const base = this.config.targetUrl.replace(/\/+$/, '');
    const clean = subpath.startsWith('/') ? subpath : `/${subpath}`;
    return `${base}${clean}`;
  }

  private getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'target.local';
    }
  }

  private getPath(url: string): string {
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}`;
    } catch {
      return '/';
    }
  }

  private emitProgress(totalCount: number, currentPath: string): void {
    const now = performance.now();
    this.completedTimestamps = this.completedTimestamps.filter((t) => now - t <= 1000);
    const rps = this.completedTimestamps.length;
    const percent = totalCount > 0 ? Math.min(100, Math.round((this.testedCount / totalCount) * 100)) : 0;

    this.onProgress?.({
      testedCount: this.testedCount,
      totalCount,
      discoveredCount: this.discoveredCount,
      rps,
      percent,
      currentPath,
    });
  }
}
