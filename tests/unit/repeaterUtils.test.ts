import { describe, it, expect } from 'vitest';
import {
  parseRawHttpRequest,
  serializeHttpRequest,
  parseRawHttpResponse,
  updateContentLengthHeader,
  extractQueryParamsFromUrl,
  updateUrlQueryParams,
  interpolateVariables,
  findUsedVariables,
  extractJsonPath,
  extractHeaderValue,
  exportRepeaterRequest,
  getUtf8ByteLength,
} from '../../src/utils/repeaterUtils';

describe('repeaterUtils Unit Tests', () => {
  describe('RFC 9112 HTTP Parsing & Serialization', () => {
    it('parses valid raw HTTP/1.1 request with headers and JSON body', () => {
      const raw = `POST /api/v1/auth/login HTTP/1.1\r\nHost: target.local\r\nContent-Type: application/json\r\n\r\n{"username":"admin"}`;
      const result = parseRawHttpRequest(raw);

      expect(result.method).toBe('POST');
      expect(result.path).toBe('/api/v1/auth/login');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headers).toHaveLength(2);
      expect(result.headers[0].name).toBe('Host');
      expect(result.headers[0].value).toBe('target.local');
      expect(result.headers[1].name).toBe('Content-Type');
      expect(result.headers[1].value).toBe('application/json');
      expect(result.body).toBe('{"username":"admin"}');
    });

    it('parses raw HTTP request with LF newlines gracefully', () => {
      const raw = `GET /users?id=42 HTTP/2\nHost: target.local\nAccept: */*\n\n`;
      const result = parseRawHttpRequest(raw);

      expect(result.method).toBe('GET');
      expect(result.path).toBe('/users?id=42');
      expect(result.protocol).toBe('HTTP/2');
      expect(result.headers).toHaveLength(2);
      expect(result.body).toBe('');
    });

    it('serializes request components back to standard CRLF HTTP text', () => {
      const headers = [
        { id: '1', name: 'Host', value: 'api.target.local', enabled: true },
        { id: '2', name: 'X-Disabled', value: 'test', enabled: false },
        { id: '3', name: 'Authorization', value: 'Bearer xyz', enabled: true },
      ];
      const serialized = serializeHttpRequest('PUT', 'https://api.target.local/resource/1', 'HTTP/1.1', headers, '{"active":true}');

      expect(serialized).toContain('PUT /resource/1 HTTP/1.1\r\n');
      expect(serialized).toContain('Host: api.target.local\r\n');
      expect(serialized).toContain('Authorization: Bearer xyz\r\n');
      expect(serialized).not.toContain('X-Disabled');
      expect(serialized).toContain('\r\n\r\n{"active":true}');
    });

    it('parses raw HTTP response text', () => {
      const raw = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nServer: Sentinel/6.0\r\n\r\n{"status":"healthy"}`;
      const result = parseRawHttpResponse(raw);

      expect(result.statusCode).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.protocol).toBe('HTTP/1.1');
      expect(result.headers).toHaveLength(2);
      expect(result.headers[0]).toEqual({ name: 'Content-Type', value: 'application/json' });
      expect(result.body).toBe('{"status":"healthy"}');
    });

    it('correctly calculates UTF-8 byte length and updates Content-Length header', () => {
      const body = '{"msg":"こんにちは世界"}'; // multi-byte characters
      const byteLen = getUtf8ByteLength(body);
      expect(byteLen).toBeGreaterThan(body.length); // UTF-8 byte length > char count

      const headers = [{ id: '1', name: 'Host', value: 'target.local', enabled: true }];
      const updated = updateContentLengthHeader(headers, body);

      const cl = updated.find((h) => h.name.toLowerCase() === 'content-length');
      expect(cl).toBeDefined();
      expect(cl?.value).toBe(byteLen.toString());
    });
  });

  describe('Query Parameter Extraction & Synchronization', () => {
    it('extracts query parameters from URL', () => {
      const url = 'https://target.local/api/search?q=security&page=2&filter=active';
      const params = extractQueryParamsFromUrl(url);

      expect(params).toHaveLength(3);
      expect(params[0].key).toBe('q');
      expect(params[0].value).toBe('security');
      expect(params[1].key).toBe('page');
      expect(params[1].value).toBe('2');
      expect(params[2].key).toBe('filter');
      expect(params[2].value).toBe('active');
    });

    it('reconstructs URL with updated query parameters', () => {
      const url = 'https://target.local/api/search?old=true';
      const params = [
        { id: '1', key: 'q', value: 'injections', enabled: true },
        { id: '2', key: 'disabled_flag', value: 'off', enabled: false },
        { id: '3', key: 'limit', value: '50', enabled: true },
      ];
      const newUrl = updateUrlQueryParams(url, params);

      expect(newUrl).toBe('https://target.local/api/search?q=injections&limit=50');
      expect(newUrl).not.toContain('disabled_flag');
    });
  });

  describe('Variable Interpolation & Built-ins', () => {
    it('interpolates user variables and preserves undefined variables', () => {
      const template = 'GET /api/v1/users?token={{auth_token}}&tenant={{tenant_id}}&unknown={{nonexistent}}';
      const vars = { auth_token: 'secret_jwt_xyz', tenant_id: 'tenant_99' };
      const output = interpolateVariables(template, vars);

      expect(output).toBe('GET /api/v1/users?token=secret_jwt_xyz&tenant=tenant_99&unknown={{nonexistent}}');
    });

    it('interpolates built-in dynamic variables', () => {
      const template = 'ID={{$uuid}}, TS={{$timestamp}}, INT={{$random_int}}, STR={{$random_str}}, DATE={{$iso_date}}';
      const output = interpolateVariables(template, {});

      // $uuid format
      expect(output).toMatch(/ID=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
      // $timestamp format (epoch seconds)
      expect(output).toMatch(/TS=\d{10}/);
      // $random_int format (1000-9999)
      expect(output).toMatch(/INT=\d{4}/);
      // $random_str format
      expect(output).toMatch(/STR=[0-9a-z]{6}/);
      // $iso_date format
      expect(output).toMatch(/DATE=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('detects all variable names in template with findUsedVariables', () => {
      const text = 'Bearer {{jwt_token}} for user {{userId}} with nonce {{$uuid}} and {{jwt_token}}';
      const used = findUsedVariables(text);

      expect(used).toContain('jwt_token');
      expect(used).toContain('userId');
      expect(used).toContain('$uuid');
      expect(used).toHaveLength(3);
    });
  });

  describe('JSON-Path and Header Extraction', () => {
    it('extracts nested values and array elements via JSON-Path', () => {
      const json = JSON.stringify({
        auth: {
          token: 'token_abc123',
          roles: ['auditor', 'admin'],
          details: {
            organization: { id: 501 },
          },
        },
      });

      expect(extractJsonPath(json, 'auth.token')).toBe('token_abc123');
      expect(extractJsonPath(json, 'auth.roles.1')).toBe('admin');
      expect(extractJsonPath(json, 'auth.roles[0]')).toBe('auditor');
      expect(extractJsonPath(json, 'auth.details.organization.id')).toBe('501');
      expect(extractJsonPath(json, 'auth.missing.field')).toBeNull();
    });

    it('extracts headers with case-insensitivity and regex capture groups', () => {
      const headers = [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
        { name: 'Set-Cookie', value: 'session_id=s%3A_9812497812; HttpOnly; Secure' },
      ];

      expect(extractHeaderValue(headers, 'content-type')).toBe('application/json; charset=utf-8');
      expect(extractHeaderValue(headers, 'SET-COOKIE', 'session_id=([^;]+)')).toBe('s%3A_9812497812');
      expect(extractHeaderValue(headers, 'X-Nonexistent')).toBeNull();
    });
  });

  describe('Command Generators Export', () => {
    const headers = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Authorization', value: 'Bearer token123' },
    ];
    const body = '{"action":"test"}';
    const url = 'https://target.local/api/v1/test';

    it('exports formatted cURL command', () => {
      const curl = exportRepeaterRequest('curl', 'POST', url, headers, body);
      expect(curl).toContain("curl -i -s -k -X POST 'https://target.local/api/v1/test'");
      expect(curl).toContain("-H 'Content-Type: application/json'");
      expect(curl).toContain("-H 'Authorization: Bearer token123'");
      expect(curl).toContain("--data-raw '{\"action\":\"test\"}'");
    });

    it('exports Python requests script', () => {
      const py = exportRepeaterRequest('python', 'POST', url, headers, body);
      expect(py).toContain('import requests');
      expect(py).toContain('url = "https://target.local/api/v1/test"');
      expect(py).toContain('"Content-Type": "application/json"');
      expect(py).toContain('requests.request("POST", url, headers=headers, data=data, verify=False)');
    });

    it('exports JavaScript fetch script', () => {
      const js = exportRepeaterRequest('javascript', 'POST', url, headers, body);
      expect(js).toContain('const response = await fetch("https://target.local/api/v1/test"');
      expect(js).toContain('method: "POST"');
      expect(js).toContain('"Authorization": "Bearer token123"');
    });

    it('exports PowerShell script', () => {
      const ps = exportRepeaterRequest('powershell', 'POST', url, headers, body);
      expect(ps).toContain('$uri = "https://target.local/api/v1/test"');
      expect(ps).toContain('Invoke-RestMethod -Uri $uri -Method POST');
    });
  });
});
