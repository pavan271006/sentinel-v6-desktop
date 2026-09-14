import { describe, it, expect, vi } from 'vitest';
import { NucleiTemplateEngine, BUILTIN_NUCLEI_TEMPLATES } from './NucleiTemplateEngine';
import { ipcClient } from '../../ipc/client';

describe('NucleiTemplateEngine', () => {
  it('loads built-in zero-day and security misconfiguration templates', () => {
    const engine = new NucleiTemplateEngine();
    const templates = engine.getTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(6);
    expect(templates.some((t) => t.id === 'git-config-exposure')).toBe(true);
    expect(templates.some((t) => t.id === 'env-file-disclosure')).toBe(true);
    expect(templates.some((t) => t.id === 'cors-wildcard-origin-reflection')).toBe(true);
  });

  it('correctly matches exposed .git/config', async () => {
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (params: any) => {
      if (params.targetUrl.includes('.git/config')) {
        return {
          tabId: params.tabId,
          statusCode: 200,
          body: '[core]\nrepositoryformatversion = 0\nfilemode = true',
          rawResponse: 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n[core]\nrepositoryformatversion = 0',
        } as any;
      }
      return { tabId: params.tabId, statusCode: 404, body: 'Not Found' } as any;
    });

    const engine = new NucleiTemplateEngine();
    const gitTemplate = BUILTIN_NUCLEI_TEMPLATES.find((t) => t.id === 'git-config-exposure')!;
    const result = await engine.executeTemplate('https://target.local', gitTemplate);

    expect(result.matched).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.evidence).toContain('.git/config');
  });

  it('correctly reports non-match when target returns 404', async () => {
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (params: any) => {
      return { tabId: params.tabId, statusCode: 404, body: 'Not Found' } as any;
    });

    const engine = new NucleiTemplateEngine();
    const envTemplate = BUILTIN_NUCLEI_TEMPLATES.find((t) => t.id === 'env-file-disclosure')!;
    const result = await engine.executeTemplate('https://target.local', envTemplate);

    expect(result.matched).toBe(false);
  });
});
