import { describe, it, expect } from 'vitest';
import { HistoricalArchiveMiner } from './HistoricalArchiveMiner';

describe('HistoricalArchiveMiner & Passive Reconnaissance Suite', () => {
  it('parses Wayback Machine CDX JSON array correctly and extracts unique endpoints', () => {
    const mockCdx = [
      ['original', 'timestamp', 'mimetype', 'statuscode'],
      ['https://example.com/api/v1/users?id=123', '20230101000000', 'application/json', '200'],
      ['https://example.com/legacy/admin.php', '20220101000000', 'text/html', '200'],
      ['https://example.com/assets/logo.png', '20230101000000', 'image/png', '200'], // should be filtered
      ['https://otherdomain.com/unrelated', '20230101000000', 'text/html', '200'], // should be ignored
    ];

    const endpoints = HistoricalArchiveMiner.parseWaybackCdxResponse('example.com', mockCdx);
    expect(endpoints.length).toBe(2);
    expect(endpoints.some((e) => e.path === '/api/v1/users?id=123')).toBe(true);
    expect(endpoints.some((e) => e.path === '/legacy/admin.php')).toBe(true);
    expect(endpoints.some((e) => e.path.includes('logo.png'))).toBe(false);
  });

  it('parses AlienVault OTX indicator response correctly', () => {
    const mockOtx = {
      url_list: [
        {
          url: 'https://example.com/portal/login?redirect=/dashboard',
          result: { urlworker: { http_code: 200 } },
        },
        {
          url: 'https://sub.example.com/metrics',
          result: { urlworker: { http_code: 200 } },
        },
        {
          url: 'https://example.com/favicon.ico',
          result: { urlworker: { http_code: 200 } },
        },
      ],
    };

    const endpoints = HistoricalArchiveMiner.parseAlienVaultOtxResponse('example.com', mockOtx);
    expect(endpoints.length).toBe(2);
    expect(endpoints.some((e) => e.path.includes('/portal/login'))).toBe(true);
    expect(endpoints.some((e) => e.path === '/metrics')).toBe(true);
  });

  it('generates well-formed CDX and OTX query URLs', () => {
    const cdxUrl = HistoricalArchiveMiner.getWaybackCdxUrl('target.corp', 100);
    expect(cdxUrl).toContain('web.archive.org/cdx/search/cdx');
    expect(cdxUrl).toContain('url=target.corp/*');
    expect(cdxUrl).toContain('limit=100');

    const otxUrl = HistoricalArchiveMiner.getAlienVaultOtxUrl('target.corp', 250);
    expect(otxUrl).toContain('otx.alienvault.com/api/v1/indicators/domain/target.corp/url_list');
    expect(otxUrl).toContain('limit=250');
  });
});
