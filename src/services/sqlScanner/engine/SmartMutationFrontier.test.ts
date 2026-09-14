import { describe, it, expect } from 'vitest';
import { SmartMutationFrontier } from './SmartMutationFrontier';
import { DiscoveredEndpoint } from '../crawler/TargetSiteCrawler';

describe('SmartMutationFrontier Suite', () => {
  it('generates critical server metadata and swagger probes', () => {
    const mutations = SmartMutationFrontier.generateFrontierMutations('https://example.com', 'example.com', []);
    expect(mutations.some((m) => m.path === '/.env')).toBe(true);
    expect(mutations.some((m) => m.path === '/swagger.json')).toBe(true);
    expect(mutations.some((m) => m.path === '/actuator/health')).toBe(true);
  });

  it('generates API version flips when /v2/ or /v1/ endpoints exist', () => {
    const mockEndpoint: DiscoveredEndpoint = {
      id: 'test-1',
      host: 'example.com',
      url: 'https://example.com/api/v2/products',
      path: '/api/v2/products',
      method: 'GET',
      headers: {},
      source: 'js_endpoint',
      params: [],
      sqliScore: 50,
      isSqliCandidate: true,
      sqliReason: 'test',
      rawRequest: '',
      timestamp: Date.now(),
    };

    const mutations = SmartMutationFrontier.generateFrontierMutations('https://example.com', 'example.com', [mockEndpoint]);
    expect(mutations.some((m) => m.path === '/api/v1/products')).toBe(true);
    expect(mutations.some((m) => m.path === '/api/v3/products')).toBe(true);
  });

  it('injects unkeyed debug parameters on high-value candidate endpoints', () => {
    const mockEndpoint: DiscoveredEndpoint = {
      id: 'test-2',
      host: 'example.com',
      url: 'https://example.com/items?cat=1',
      path: '/items?cat=1',
      method: 'GET',
      headers: {},
      source: 'html_form',
      params: [{ name: 'cat', type: 'query', sampleValue: '1' }],
      sqliScore: 70,
      isSqliCandidate: true,
      sqliReason: 'test',
      rawRequest: '',
      timestamp: Date.now(),
    };

    const mutations = SmartMutationFrontier.generateFrontierMutations('https://example.com', 'example.com', [mockEndpoint]);
    expect(mutations.some((m) => m.path.includes('debug=true'))).toBe(true);
  });
});
