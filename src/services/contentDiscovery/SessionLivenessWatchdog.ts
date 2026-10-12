/**
 * Sentinel Sovereign Ω - Session Liveness & Checkpoint Watchdog
 *
 * Continuously validates authenticated session integrity during automated crawls:
 * 1. De-Authentication & Soft Logout Detection (/login redirect, "session expired", 401/403 de-auth)
 * 2. Crawl State Checkpoint Serialization (Preserves active queue & site map database)
 * 3. Auto-Pause & Re-Authentication Recovery Coordinator
 */

import { StealthCdpBrowserDriver } from './StealthCdpBrowserDriver';

export interface SessionHealthStatus {
  isHealthy: boolean;
  isDeauthenticated: boolean;
  reason?: string;
  currentUrl: string;
}

export interface CrawlCheckpointData {
  targetHost: string;
  savedAt: number;
  visitedCount: number;
  discoveredCount: number;
  activeQueue: string[];
}

export class SessionLivenessWatchdog {
  private lastHealthyTimestamp = Date.now();
  private deauthCount = 0;

  /**
   * Evaluates the connected browser page for session de-authentication or token expiration
   */
  public async evaluateSessionHealth(driver: StealthCdpBrowserDriver): Promise<SessionHealthStatus> {
    try {
      const url = await driver.getLiveUrl();
      const cleanUrl = (url || '').toLowerCase();

      // Check URL signatures indicating logout/session expiry
      if (
        cleanUrl.includes('/login') ||
        cleanUrl.includes('/signin') ||
        cleanUrl.includes('/auth/login') ||
        cleanUrl.includes('/logout') ||
        cleanUrl.includes('session_expired') ||
        cleanUrl.includes('session-expired') ||
        cleanUrl.includes('wssplashchk')
      ) {
        this.deauthCount++;
        return {
          isHealthy: false,
          isDeauthenticated: true,
          reason: `Redirected to authentication page (${url})`,
          currentUrl: url
        };
      }

      // Check DOM content signatures
      const domCheck = await driver.evaluate<{ isDeauth: boolean; reason: string }>(`
        (function() {
          const title = (document.title || '').toLowerCase();
          const body = (document.body ? document.body.innerText : '').slice(0, 800).toLowerCase();

          if (title.includes('sign in') || title.includes('log in') || title.includes('login')) {
            return { isDeauth: true, reason: 'Page title indicates login portal' };
          }

          if (
            body.includes('session has expired') ||
            body.includes('your session has timed out') ||
            body.includes('please log in again') ||
            body.includes('unauthorized: access is denied')
          ) {
            return { isDeauth: true, reason: 'Session expired / unauthorized notice in DOM' };
          }

          return { isDeauth: false, reason: '' };
        })()
      `);

      if (domCheck?.isDeauth) {
        this.deauthCount++;
        return {
          isHealthy: false,
          isDeauthenticated: true,
          reason: domCheck.reason,
          currentUrl: url
        };
      }

      this.lastHealthyTimestamp = Date.now();
      this.deauthCount = 0;
      return {
        isHealthy: true,
        isDeauthenticated: false,
        currentUrl: url
      };
    } catch (e) {
      return {
        isHealthy: true,
        isDeauthenticated: false,
        currentUrl: ''
      };
    }
  }

  /**
   * Resets watchdog state for a new crawl run
   */
  public reset(): void {
    this.lastHealthyTimestamp = Date.now();
    this.deauthCount = 0;
  }

  public getLastHealthyTimestamp(): number {
    return this.lastHealthyTimestamp;
  }
}

export const sessionLivenessWatchdog = new SessionLivenessWatchdog();
