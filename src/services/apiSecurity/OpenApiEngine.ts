/**
 * Sentinel V6 - Property-Based API Security & OpenAPI/Swagger Fuzzer Engine
 *
 * Inspired by Schemathesis (Dmitry Dygalo) and Kiterunner (Assetnote).
 * Parses OpenAPI 2.0 (Swagger) and OpenAPI 3.0 specifications, extracts operations and schemas,
 * automatically generates boundary edge-cases (type confusion, numeric extremes, missing fields,
 * injection canaries), and classifies RFC conformance vs unhandled server crashes (HTTP 500).
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export type ApiType = 'REST' | 'GRAPHQL' | 'WEBSOCKET';

export interface ApiParamSpec {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  type: string;
  required: boolean;
  description?: string;
  schema?: any;
}

export interface ApiOperation {
  id: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  type: ApiType;
  authRequired: boolean;
  parameters: ApiParamSpec[];
  requestBodySchema?: any;
  responses?: Record<string, any>;
}

export interface ApiDependencyRelation {
  producerOpId: string;
  producerPath: string;
  producerMethod: string;
  consumerOpId: string;
  consumerPath: string;
  consumerMethod: string;
  paramName: string;
  expectedField: string;
}

export type FuzzFaultCategory =
  | 'BASELINE'
  | 'TYPE_CONFUSION'
  | 'BOUNDARY_EXTREME'
  | 'MISSING_REQUIRED'
  | 'SECURITY_CANARY';

export interface ApiFuzzTestCase {
  id: string;
  name: string;
  category: FuzzFaultCategory;
  description: string;
  targetPath: string;
  method: string;
  pathParams: Record<string, any>;
  queryParams: Record<string, any>;
  headers: Record<string, string>;
  body?: string;
}

export type ConformanceVerdict =
  | 'COMPLIANT_VALID'       // 200 OK on valid data
  | 'COMPLIANT_REJECTED'    // 400 Bad Request or 422 Unprocessable on invalid input
  | 'UNHANDLED_CRASH_500'   // 500 Internal Server Error (Schemathesis Critical Defect)
  | 'INFO_DISCLOSURE'       // Stack trace or internal leak disclosed
  | 'AUTH_BYPASS_WARNING'   // 200 OK on unauthenticated protected resource
  | 'CONNECTION_ERROR';

export interface ApiFuzzResult {
  testCase: ApiFuzzTestCase;
  statusCode: number;
  durationMs: number;
  verdict: ConformanceVerdict;
  bodySnippet: string;
  errorDetail?: string;
  rawResponse: string;
}

// ─── Default Sample OpenAPI Spec ────────────────────────────────────────────

export const DEFAULT_SAMPLE_OPENAPI = {
  openapi: '3.0.0',
  info: {
    title: 'Enterprise Billing & Accounts API',
    version: '1.0.0',
    description: 'Enterprise API spec for customer account and transaction management.',
  },
  servers: [{ url: 'https://target.local' }],
  paths: {
    '/api/v1/invoices/{id}': {
      get: {
        summary: 'Retrieve invoice by ID',
        description: 'Fetch detailed invoice records by numeric identifier.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'format', in: 'query', required: false, schema: { type: 'string', enum: ['json', 'pdf', 'csv'] } },
        ],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Invoice details' }, '404': { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete invoice by ID',
        description: 'Administrative deletion of invoice records.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Deleted' }, '403': { description: 'Forbidden' } },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        summary: 'Retrieve user profile',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User data' } },
      },
    },
    '/api/v1/orders/checkout': {
      post: {
        summary: 'Submit checkout order',
        description: 'Creates a payment checkout transaction.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cartId', 'amount'],
                properties: {
                  cartId: { type: 'string' },
                  amount: { type: 'number' },
                  currency: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Order created' }, '400': { description: 'Invalid input' } },
      },
    },
    '/api/v1/health': {
      get: {
        summary: 'Service health check',
        description: 'Public health status.',
        responses: { '200': { description: 'Healthy' } },
      },
    },
  },
};

// ─── OpenApiEngine Class ────────────────────────────────────────────────────

export class OpenApiEngine {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = 'https://target.local', defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = defaultHeaders;
  }

  /**
   * Parses an OpenAPI 2.0 or 3.0 specification JSON object into operations
   */
  public parseSpec(spec: any): ApiOperation[] {
    const operations: ApiOperation[] = [];
    const paths = spec.paths || {};

    let opCounter = 1;
    for (const [pathStr, pathObj] of Object.entries<any>(paths)) {
      if (!pathObj || typeof pathObj !== 'object') continue;

      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
      for (const m of httpMethods) {
        if (pathObj[m]) {
          const item = pathObj[m];
          const parameters: ApiParamSpec[] = [];

          // Path-level + operation-level parameters
          const combinedParams = [...(pathObj.parameters || []), ...(item.parameters || [])];
          for (const p of combinedParams) {
            parameters.push({
              name: p.name,
              in: p.in || 'query',
              type: p.schema?.type || p.type || 'string',
              required: Boolean(p.required),
              description: p.description,
              schema: p.schema,
            });
          }

          // Request Body Schema (OpenAPI 3.0)
          let requestBodySchema: any;
          if (item.requestBody?.content?.['application/json']?.schema) {
            requestBodySchema = item.requestBody.content['application/json'].schema;
          }

          const hasSecurity = Boolean(
            (item.security && item.security.length > 0) || (spec.security && spec.security.length > 0)
          );

          operations.push({
            id: `api-op-${opCounter++}`,
            path: pathStr,
            method: m.toUpperCase(),
            summary: item.summary || `${m.toUpperCase()} ${pathStr}`,
            description: item.description || item.summary || 'REST API endpoint',
            type: 'REST',
            authRequired: hasSecurity,
            parameters,
            requestBodySchema,
            responses: item.responses,
          });
        }
      }
    }

    return operations;
  }

  /**
   * Infers producer-consumer dataflow dependencies across API operations (RESTler model)
   */
  public inferProducerConsumerDependencies(operations: ApiOperation[]): ApiDependencyRelation[] {
    const relations: ApiDependencyRelation[] = [];
    const producers = operations.filter((op) => op.method === 'POST' || op.method === 'PUT');
    const consumers = operations.filter((op) => op.parameters.some((p) => p.in === 'path'));

    for (const consumer of consumers) {
      const pathParams = consumer.parameters.filter((p) => p.in === 'path');
      for (const pp of pathParams) {
        const pathPrefix = consumer.path.substring(0, consumer.path.indexOf(`{${pp.name}}`)).replace(/\/+$/, '');
        const matchingProducer = producers.find((p) => p.path === pathPrefix || p.path.startsWith(pathPrefix));

        if (matchingProducer) {
          relations.push({
            producerOpId: matchingProducer.id,
            producerPath: matchingProducer.path,
            producerMethod: matchingProducer.method,
            consumerOpId: consumer.id,
            consumerPath: consumer.path,
            consumerMethod: consumer.method,
            paramName: pp.name,
            expectedField: pp.name === 'id' ? 'id' : pp.name,
          });
        }
      }
    }

    return relations;
  }

  /**
   * Generates property-based boundary test cases for a specific operation
   */
  public generateTestCases(op: ApiOperation): ApiFuzzTestCase[] {
    const cases: ApiFuzzTestCase[] = [];
    let caseIdx = 1;

    // 1. Valid Baseline Case
    cases.push({
      id: `tc-${op.id}-${caseIdx++}`,
      name: 'Valid Schema Baseline',
      category: 'BASELINE',
      description: 'Sends structurally valid conformant parameters matching schema types.',
      targetPath: op.path,
      method: op.method,
      pathParams: this.generateSampleParams(op.parameters, 'path', 'valid'),
      queryParams: this.generateSampleParams(op.parameters, 'query', 'valid'),
      headers: { ...this.defaultHeaders },
      body: this.generateSampleBody(op.requestBodySchema, 'valid'),
    });

    // 2. Type Inversion / Confusion Tests
    cases.push({
      id: `tc-${op.id}-${caseIdx++}`,
      name: 'Type Inversion (String where Integer Expected)',
      category: 'TYPE_CONFUSION',
      description: 'Injects alphanumeric string literals into numeric integer slots.',
      targetPath: op.path,
      method: op.method,
      pathParams: this.generateSampleParams(op.parameters, 'path', 'type_mismatch'),
      queryParams: this.generateSampleParams(op.parameters, 'query', 'type_mismatch'),
      headers: { ...this.defaultHeaders },
      body: this.generateSampleBody(op.requestBodySchema, 'type_mismatch'),
    });

    // 3. Boundary Extreme Values
    cases.push({
      id: `tc-${op.id}-${caseIdx++}`,
      name: 'Boundary Values (Overflow & Negative)',
      category: 'BOUNDARY_EXTREME',
      description: 'Tests integer overflow (> 2^53 - 1), negative values, and oversized buffers.',
      targetPath: op.path,
      method: op.method,
      pathParams: this.generateSampleParams(op.parameters, 'path', 'boundary'),
      queryParams: this.generateSampleParams(op.parameters, 'query', 'boundary'),
      headers: { ...this.defaultHeaders },
      body: this.generateSampleBody(op.requestBodySchema, 'boundary'),
    });

    // 4. Missing Mandatory Properties
    if (op.requestBodySchema?.required || op.parameters.some((p) => p.required)) {
      cases.push({
        id: `tc-${op.id}-${caseIdx++}`,
        name: 'Missing Required Schema Fields',
        category: 'MISSING_REQUIRED',
        description: 'Omits mandatory path/body parameters to test schema validator resilience.',
        targetPath: op.path,
        method: op.method,
        pathParams: this.generateSampleParams(op.parameters, 'path', 'missing'),
        queryParams: this.generateSampleParams(op.parameters, 'query', 'missing'),
        headers: { ...this.defaultHeaders },
        body: this.generateSampleBody(op.requestBodySchema, 'missing'),
      });
    }

    // 5. Security Canaries (SQL Injection & Path Traversal)
    cases.push({
      id: `tc-${op.id}-${caseIdx++}`,
      name: 'Security Injection Canaries (SQLi & Traversal)',
      category: 'SECURITY_CANARY',
      description: "Appends single-quote canaries (' OR '1'='1) and traversal markers (../../etc/passwd).",
      targetPath: op.path,
      method: op.method,
      pathParams: this.generateSampleParams(op.parameters, 'path', 'canary'),
      queryParams: this.generateSampleParams(op.parameters, 'query', 'canary'),
      headers: { ...this.defaultHeaders },
      body: this.generateSampleBody(op.requestBodySchema, 'canary'),
    });

    return cases;
  }

  /**
   * Executes a single test case against the target server via Sentinel IPC
   */
  public async runTestCase(tc: ApiFuzzTestCase): Promise<ApiFuzzResult> {
    // Interpolate path parameters
    let computedPath = tc.targetPath;
    for (const [k, v] of Object.entries(tc.pathParams)) {
      computedPath = computedPath.replace(`{${k}}`, encodeURIComponent(String(v)));
    }

    // Append query parameters
    const queryEntries = Object.entries(tc.queryParams);
    if (queryEntries.length > 0) {
      const qStr = queryEntries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      computedPath += (computedPath.includes('?') ? '&' : '?') + qStr;
    }

    const targetUrl = `${this.baseUrl}${computedPath.startsWith('/') ? computedPath : '/' + computedPath}`;
    const host = this.getHost(targetUrl);

    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Sentinel-Schemathesis/6.0',
      Accept: 'application/json, text/plain, */*',
      ...tc.headers,
    };

    let bodyStr = tc.body || '';
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(new TextEncoder().encode(bodyStr).length);
    }

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const rawReq = `${tc.method} ${computedPath} HTTP/1.1\r\n${headerLines}\r\n\r\n${bodyStr}`;

    const startTime = performance.now();
    try {
      const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
        tabId: `api_fuzz_${tc.id}`,
        targetUrl,
        rawRequest: rawReq,
      });

      const durationMs = res.durationMs || Math.round(performance.now() - startTime);
      const statusCode = res.statusCode || 200;
      const body = res.body || '';

      const verdict = this.classifyVerdict(tc, statusCode, body);

      return {
        testCase: tc,
        statusCode,
        durationMs,
        verdict,
        bodySnippet: body.slice(0, 160),
        rawResponse: res.rawResponse || body,
      };
    } catch (err: any) {
      return {
        testCase: tc,
        statusCode: 0,
        durationMs: Math.round(performance.now() - startTime),
        verdict: 'CONNECTION_ERROR',
        bodySnippet: 'Request failed',
        errorDetail: err?.message || 'Network transport error',
        rawResponse: '',
      };
    }
  }

  // ─── Classification & Fault Detection ─────────────────────────────────────

  private classifyVerdict(tc: ApiFuzzTestCase, status: number, body: string): ConformanceVerdict {
    const lower = body.toLowerCase();

    // 1. Unhandled Server Crash (Schemathesis Critical Bug)
    if (status >= 500) {
      return 'UNHANDLED_CRASH_500';
    }

    // 2. Information Disclosure (Stack Trace Leak)
    if (
      lower.includes('traceback (most recent call last)') ||
      lower.includes('nullpointerexception') ||
      lower.includes('syntaxerror:') ||
      lower.includes('fatal error:') ||
      lower.includes('org.springframework.') ||
      lower.includes('at express.router')
    ) {
      return 'INFO_DISCLOSURE';
    }

    // 3. Compliant RFC handling
    if (tc.category === 'BASELINE') {
      return status >= 200 && status < 300 ? 'COMPLIANT_VALID' : 'COMPLIANT_REJECTED';
    }

    // When feeding invalid/boundary data, 400 or 422 is expected and compliant
    if (status === 400 || status === 422 || status === 404) {
      return 'COMPLIANT_REJECTED';
    }

    return 'COMPLIANT_VALID';
  }

  // ─── Generators ───────────────────────────────────────────────────────────

  private generateSampleParams(
    params: ApiParamSpec[],
    location: 'path' | 'query',
    mode: 'valid' | 'type_mismatch' | 'boundary' | 'missing' | 'canary'
  ): Record<string, any> {
    const filtered = params.filter((p) => p.in === location);
    const result: Record<string, any> = {};

    for (const p of filtered) {
      if (mode === 'missing' && !p.required) continue;

      switch (mode) {
        case 'valid':
          result[p.name] = p.type === 'integer' || p.type === 'number' ? 1 : 'sample_test';
          break;
        case 'type_mismatch':
          result[p.name] = p.type === 'integer' || p.type === 'number' ? 'string_literal_crash' : 99999;
          break;
        case 'boundary':
          result[p.name] = p.type === 'integer' || p.type === 'number' ? 9007199254740995 : 'A'.repeat(5000);
          break;
        case 'canary':
          result[p.name] = "1' OR '1'='1";
          break;
        case 'missing':
          // Omit from result
          break;
      }
    }

    return result;
  }

  private generateSampleBody(schema: any, mode: 'valid' | 'type_mismatch' | 'boundary' | 'missing' | 'canary'): string | undefined {
    if (!schema) return undefined;

    const props = schema.properties || {};
    const obj: Record<string, any> = {};

    for (const [k, propSchema] of Object.entries<any>(props)) {
      const type = propSchema.type || 'string';

      switch (mode) {
        case 'valid':
          obj[k] = type === 'number' || type === 'integer' ? 100 : 'valid_input';
          break;
        case 'type_mismatch':
          obj[k] = type === 'number' || type === 'integer' ? 'invalid_string' : [1, 2, 3];
          break;
        case 'boundary':
          obj[k] = type === 'number' || type === 'integer' ? 9999999999999999 : 'X'.repeat(8000);
          break;
        case 'canary':
          obj[k] = "' OR '1'='1 --";
          break;
        case 'missing':
          // Only include 1 property, omit others
          if (Object.keys(obj).length === 0) obj[k] = 'test';
          break;
      }
    }

    return JSON.stringify(obj, null, 2);
  }

  private getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'target.local';
    }
  }
}
