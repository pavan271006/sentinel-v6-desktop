import { describe, it, expect } from 'vitest';
import { DynamicJsEvaluator } from './DynamicJsEvaluator';

describe('DynamicJsEvaluator & JS Expression Extraction Suite', () => {
  it('extracts routes from dictionary mapping tables', () => {
    const jsCode = `
      const API_ROUTES = {
        GET_USER: '/api/v1/users',
        LIST_ORDERS: '/api/v2/orders',
        CHECKOUT: '/api/v1/checkout'
      };
    `;
    const endpoints = DynamicJsEvaluator.extractDynamicRoutes('https://example.com', 'example.com', jsCode);
    expect(endpoints.some((e) => e.path === '/api/v1/users')).toBe(true);
    expect(endpoints.some((e) => e.path === '/api/v2/orders')).toBe(true);
    expect(endpoints.some((e) => e.path === '/api/v1/checkout')).toBe(true);
  });

  it('evaluates dynamic template literals into parameterized routes', () => {
    const jsCode = 'const url = `/api/v${version}/items/${itemId}/details`;';
    const endpoints = DynamicJsEvaluator.extractDynamicRoutes('https://example.com', 'example.com', jsCode);
    expect(endpoints.some((e) => e.path === '/api/v1/items/1/details')).toBe(true);
  });

  it('evaluates string concatenations into structured paths', () => {
    const jsCode = 'const fullUrl = "/api/v1/" + "reports";';
    const endpoints = DynamicJsEvaluator.extractDynamicRoutes('https://example.com', 'example.com', jsCode);
    expect(endpoints.some((e) => e.path === '/api/v1/reports')).toBe(true);
  });

  it('extracts URLSearchParams object properties as query parameters', () => {
    const jsCode = 'const params = new URLSearchParams({ search: term, category: catId, page: p });';
    const endpoints = DynamicJsEvaluator.extractDynamicRoutes('https://example.com', 'example.com', jsCode);
    expect(endpoints.some((e) => e.path.includes('search=1') && e.path.includes('category=1'))).toBe(true);
  });
});
