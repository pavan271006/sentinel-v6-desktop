/**
 * Sentinel Sovereign Ω - Debug & API Documentation Discovery Service
 * src/services/contentDiscovery/DebugApiDocDiscoveryService.ts
 *
 * Implements Level 6 API Specification & Diagnostic Endpoint Discovery:
 * 1. Swagger / OpenAPI Specification Probing & Automatic Route Ingestion:
 *    Probes standard /swagger.json, /openapi.json, /v3/api-docs, /api-docs, and /redoc.
 *    Parses OpenAPI 3.x and Swagger 2.0 paths, methods, parameters, and request schemas.
 * 2. GraphQL Introspection Dredging:
 *    Probes /graphql, /api/graphql, and /graphiql. Executes __schema introspection to
 *    extract all Query, Mutation, and Type definitions.
 * 3. Exposed Debug & Administrative Telemetry Detection:
 *    Probes Spring Boot Actuators (/actuator/env, /actuator/heapdump, /actuator/mappings),
 *    ASP.NET Trace/Elmah (/elmah.axd, /trace.axd), Rails routes (/rails/info/routes),
 *    Next.js Dev Manifests, /.env, and /.git/HEAD with strict anti-SPA false-positive validation.
 */

import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';

export interface DiscoveredApiDoc {
  url: string;
  type: 'openapi_v3' | 'swagger_v2' | 'swagger_ui' | 'redoc' | 'postman_collection';
  title?: string;
  version?: string;
  endpoints: Array<{
    path: string;
    method: string;
    summary?: string;
    parameters?: string[];
  }>;
}

export interface GraphqlIntrospectionResult {
  endpointUrl: string;
  isIntrospectionEnabled: boolean;
  queryType?: string;
  mutationType?: string;
  typesCount: number;
  sampleQueries: string[];
  sampleMutations: string[];
}

export interface ExposedDebugFinding {
  url: string;
  category: 'SPRING_ACTUATOR' | 'DOT_ENV' | 'GIT_REPOSITORY' | 'ELMAH_TRACE' | 'RAILS_ROUTES' | 'NEXTJS_DEV_MANIFEST' | 'PHP_INFO';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  evidenceSnippet: string;
  exploitStrategy: string;
}

export interface DebugApiDocReport {
  apiDocs: DiscoveredApiDoc[];
  graphql: GraphqlIntrospectionResult[];
  debugFindings: ExposedDebugFinding[];
  extractedEndpoints: SiteMapRequest[];
}

export class DebugApiDocDiscoveryService {
  private static readonly SWAGGER_OPENAPI_PATHS = [
    '/swagger.json',
    '/swagger/v1/swagger.json',
    '/api/swagger.json',
    '/v1/swagger.json',
    '/v2/swagger.json',
    '/v3/swagger.json',
    '/openapi.json',
    '/api/openapi.json',
    '/v3/api-docs',
    '/v3/api-docs/swagger-config',
    '/v2/api-docs',
    '/api-docs',
    '/api/v1/api-docs',
    '/swagger-ui.html',
    '/swagger-ui/index.html',
    '/swagger-ui/',
    '/docs',
    '/api/docs',
    '/redoc',
    '/api/redoc',
  ];

  private static readonly GRAPHQL_PATHS = [
    '/graphql',
    '/api/graphql',
    '/v1/graphql',
    '/query',
    '/graphiql',
    '/altair',
    '/playground',
  ];

  private static readonly DEBUG_PROBE_SPECS: Array<{
    path: string;
    category: ExposedDebugFinding['category'];
    severity: ExposedDebugFinding['severity'];
    title: string;
    description: string;
    exploitStrategy: string;
    validator: (status: number, body: string, headers: Record<string, string>) => boolean;
  }> = [
    {
      path: '/actuator/env',
      category: 'SPRING_ACTUATOR',
      severity: 'CRITICAL',
      title: 'Spring Boot Actuator Environment Exposed (/actuator/env)',
      description: 'The /actuator/env endpoint reveals environment variables, database credentials, and cloud secrets.',
      exploitStrategy: 'Extract database passwords and API tokens directly. Check for Spring Cloud RCE (e.g. spring.cloud.bootstrap.location).',
      validator: (status, body) => status === 200 && (body.includes('propertySources') || body.includes('systemProperties')),
    },
    {
      path: '/actuator/heapdump',
      category: 'SPRING_ACTUATOR',
      severity: 'CRITICAL',
      title: 'Spring Boot Actuator Memory Heap Dump Exposed (/actuator/heapdump)',
      description: 'Permits full JVM memory extraction including decrypted tokens, session cookies, and private encryption keys.',
      exploitStrategy: 'Download heap dump file and analyze with Eclipse Memory Analyzer (MAT) or strings to dump plaintext credentials.',
      validator: (status, body, headers) =>
        Boolean(
          status === 200 &&
            ((headers['content-type'] && headers['content-type'].includes('octet-stream')) ||
              (headers['content-disposition'] && headers['content-disposition'].includes('heapdump')))
        ),
    },
    {
      path: '/actuator/mappings',
      category: 'SPRING_ACTUATOR',
      severity: 'HIGH',
      title: 'Spring Boot Actuator Request Mappings Exposed (/actuator/mappings)',
      description: 'Reveals the complete server-side URL routing table, controller classes, and unauthenticated endpoints.',
      exploitStrategy: 'Harvest hidden admin routes and internal REST endpoints from the contexts.mappings JSON tree.',
      validator: (status, body) => status === 200 && body.includes('contexts') && body.includes('mappings'),
    },
    {
      path: '/actuator',
      category: 'SPRING_ACTUATOR',
      severity: 'MEDIUM',
      title: 'Spring Boot Actuator Root Directory Enabled (/actuator)',
      description: 'The Spring Boot actuator discovery index is accessible without authentication.',
      exploitStrategy: 'Traverse _links to identify enabled sensitive actuator endpoints (beans, loggers, env, httptrace).',
      validator: (status, body) => status === 200 && body.includes('_links') && body.includes('/actuator'),
    },
    {
      path: '/.env',
      category: 'DOT_ENV',
      severity: 'CRITICAL',
      title: 'Environment Configuration File Exposed (/.env)',
      description: 'The server root exposes production configuration variables, database URIs, and master secret keys.',
      exploitStrategy: 'Extract database connection strings, JWT secrets, and AWS/Stripe credentials directly.',
      validator: (status, body) =>
        status === 200 &&
        (body.includes('DB_PASSWORD') ||
          body.includes('DATABASE_URL') ||
          body.includes('APP_KEY=') ||
          body.includes('AWS_SECRET_ACCESS_KEY') ||
          /^[A-Z0-9_]{3,}=.+$/m.test(body)) &&
        !body.includes('<!DOCTYPE') &&
        !body.includes('<html'),
    },
    {
      path: '/.git/HEAD',
      category: 'GIT_REPOSITORY',
      severity: 'CRITICAL',
      title: 'Exposed Git Source Code Repository (/.git/HEAD)',
      description: 'The root .git directory is accessible over HTTP, permitting complete source code reconstruction.',
      exploitStrategy: 'Use git-dumper or goyave to dump and reconstruct the entire application repository and git commit history.',
      validator: (status, body) => status === 200 && body.startsWith('ref: refs/heads/'),
    },
    {
      path: '/elmah.axd',
      category: 'ELMAH_TRACE',
      severity: 'HIGH',
      title: 'ASP.NET Error Log Library Exposed (/elmah.axd)',
      description: 'ELMAH captures and displays complete unhandled application exceptions, stack traces, and session cookies.',
      exploitStrategy: 'Review stack traces for database connection strings and hijack user sessions via logged Cookie headers.',
      validator: (status, body) => status === 200 && (body.includes('Error Log for') || body.includes('elmah')),
    },
    {
      path: '/trace.axd',
      category: 'ELMAH_TRACE',
      severity: 'HIGH',
      title: 'ASP.NET Native Request Trace Exposed (/trace.axd)',
      description: 'Exposes real-time HTTP requests, response headers, viewstate data, and session IDs.',
      exploitStrategy: 'Harvest active session tokens and internal request paths from the request log table.',
      validator: (status, body) => status === 200 && body.includes('Application Trace') && body.includes('Requests Details'),
    },
    {
      path: '/rails/info/routes',
      category: 'RAILS_ROUTES',
      severity: 'HIGH',
      title: 'Ruby on Rails Internal Route Table Exposed (/rails/info/routes)',
      description: 'Development route table reveals all internal controller actions and URL parameter patterns.',
      exploitStrategy: 'Audit unlinked controller actions and test for missing authorization checks on internal resources.',
      validator: (status, body) => status === 200 && body.includes('Routes matching') && body.includes('Controller#Action'),
    },
    {
      path: '/_next/static/development/_devPagesManifest.json',
      category: 'NEXTJS_DEV_MANIFEST',
      severity: 'MEDIUM',
      title: 'Next.js Development Pages Manifest Exposed',
      description: 'Reveals all active Next.js pages including unpublished drafts, admin pages, and test fixtures.',
      exploitStrategy: 'Harvest private internal pages from the JSON mapping.',
      validator: (status, body) => status === 200 && body.includes('.js') && (body.startsWith('{') || body.startsWith('[')),
    },
    {
      path: '/phpinfo.php',
      category: 'PHP_INFO',
      severity: 'HIGH',
      title: 'PHP Info Diagnostic Page Exposed (/phpinfo.php)',
      description: 'Dumps complete PHP configuration, server environment variables, OS details, and module paths.',
      exploitStrategy: 'Identify exact PHP version, enabled dangerous extensions, and server-side file paths for LFI targeting.',
      validator: (status, body) => status === 200 && (body.includes('PHP Version') || body.includes('phpinfo()')),
    },
  ];

  /**
   * Conducts full API documentation, GraphQL introspection, and debug diagnostic discovery
   */
  public async runFullDiscovery(
    targetUrl: string,
    onEndpointDiscovered?: (item: SiteMapRequest) => void
  ): Promise<DebugApiDocReport> {
    const cleanHost = this.cleanHost(targetUrl);
    const rootUrl = targetUrl.startsWith('http') ? targetUrl : `https://${cleanHost}`;
    const baseUrl = rootUrl.endsWith('/') ? rootUrl.slice(0, -1) : rootUrl;

    const report: DebugApiDocReport = {
      apiDocs: [],
      graphql: [],
      debugFindings: [],
      extractedEndpoints: [],
    };

    const recordEndpoint = (path: string, method: string, title: string, notes: string): SiteMapRequest => {
      const item: SiteMapRequest = {
        id: `apidoc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        host: cleanHost,
        method,
        url: `${baseUrl}${path}`,
        path,
        params: path.includes('?'),
        status: 200,
        length: 0,
        mime: 'JSON',
        title,
        notes,
        requestRaw: `${method} ${path} HTTP/1.1\r\nHost: ${cleanHost}\r\n\r\n`,
        responseRaw: '',
        reqAttributes: {},
        reqHeaders: { Host: cleanHost },
        resAttributes: {},
        resHeaders: {},
      };
      report.extractedEndpoints.push(item);
      onEndpointDiscovered?.(item);
      return item;
    };

    // 1. Probing Swagger / OpenAPI Endpoints
    await Promise.all(
      DebugApiDocDiscoveryService.SWAGGER_OPENAPI_PATHS.map(async (docPath) => {
        try {
          const targetDocUrl = `${baseUrl}${docPath}`;
          const res = await this.safeFetch(targetDocUrl);
          if (!res || res.status !== 200 || !res.body) return;

          // Validate non-SPA response
          if (res.body.includes('<!DOCTYPE') && !docPath.includes('swagger-ui') && !docPath.includes('redoc') && !docPath.includes('docs')) {
            return;
          }

          if (docPath.endsWith('.json') || docPath.includes('api-docs') || docPath.includes('swagger-config')) {
            try {
              const spec = JSON.parse(res.body);
              if (spec.swagger || spec.openapi || spec.paths) {
                const isV3 = Boolean(spec.openapi);
                const title = spec.info?.title || 'API Specification';
                const version = spec.info?.version || '1.0';
                const docEndpoints: DiscoveredApiDoc['endpoints'] = [];

                if (spec.paths && typeof spec.paths === 'object') {
                  for (const [routePath, pathObj] of Object.entries(spec.paths)) {
                    if (pathObj && typeof pathObj === 'object') {
                      for (const [httpMethod, opObj] of Object.entries(pathObj as any)) {
                        const m = httpMethod.toUpperCase();
                        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(m)) {
                          const op = opObj as any;
                          const paramNames = Array.isArray(op?.parameters) ? op.parameters.map((p: any) => p.name) : [];
                          docEndpoints.push({
                            path: routePath,
                            method: m,
                            summary: op?.summary || op?.operationId,
                            parameters: paramNames,
                          });
                          recordEndpoint(
                            routePath,
                            m,
                            op?.summary || `${m} ${routePath}`,
                            `Discovered via OpenAPI/Swagger spec at ${docPath}`
                          );
                        }
                      }
                    }
                  }
                }

                report.apiDocs.push({
                  url: targetDocUrl,
                  type: isV3 ? 'openapi_v3' : 'swagger_v2',
                  title,
                  version,
                  endpoints: docEndpoints,
                });
                recordEndpoint(docPath, 'GET', `API Specification: ${title}`, `OpenAPI/Swagger JSON specification (${docEndpoints.length} routes)`);
              }
            } catch {}
          } else if (res.body.includes('swagger-ui') || res.body.includes('Redoc') || res.body.includes('swaggerUI')) {
            report.apiDocs.push({
              url: targetDocUrl,
              type: docPath.includes('redoc') ? 'redoc' : 'swagger_ui',
              title: 'Interactive API Documentation UI',
              endpoints: [],
            });
            recordEndpoint(docPath, 'GET', 'API Documentation UI', `Exposed Interactive API Documentation at ${docPath}`);
          }
        } catch {}
      })
    );

    // 2. Probing GraphQL Endpoints & Full Introspection
    await Promise.all(
      DebugApiDocDiscoveryService.GRAPHQL_PATHS.map(async (gqlPath) => {
        try {
          const gqlUrl = `${baseUrl}${gqlPath}`;
          const introQuery = JSON.stringify({
            query: `{
              __schema {
                queryType { name }
                mutationType { name }
                types {
                  name
                  kind
                  fields {
                    name
                    args { name }
                  }
                }
              }
            }`,
          });

          const postRes = await this.safePostJson(gqlUrl, introQuery);
          if (postRes && postRes.status === 200 && postRes.body) {
            try {
              const gqlData = JSON.parse(postRes.body);
              const schema = gqlData?.data?.__schema;
              if (schema) {
                const queryType = schema.queryType?.name;
                const mutationType = schema.mutationType?.name;
                const types = Array.isArray(schema.types) ? schema.types : [];
                const sampleQueries: string[] = [];
                const sampleMutations: string[] = [];

                for (const t of types) {
                  if (t.name === queryType && Array.isArray(t.fields)) {
                    for (const f of t.fields.slice(0, 20)) {
                      sampleQueries.push(f.name);
                      recordEndpoint(`${gqlPath}?query={${f.name}}`, 'POST', `GraphQL Query: ${f.name}`, 'Exposed via GraphQL Schema Introspection');
                    }
                  } else if (t.name === mutationType && Array.isArray(t.fields)) {
                    for (const f of t.fields.slice(0, 20)) {
                      sampleMutations.push(f.name);
                      recordEndpoint(`${gqlPath}?mutation={${f.name}}`, 'POST', `GraphQL Mutation: ${f.name}`, 'Exposed via GraphQL Schema Introspection');
                    }
                  }
                }

                report.graphql.push({
                  endpointUrl: gqlUrl,
                  isIntrospectionEnabled: true,
                  queryType,
                  mutationType,
                  typesCount: types.length,
                  sampleQueries,
                  sampleMutations,
                });
                recordEndpoint(gqlPath, 'POST', 'GraphQL Endpoint (Introspection Enabled)', `GraphQL API with ${types.length} types and ${sampleQueries.length} queries exposed.`);
              }
            } catch {}
          }
        } catch {}
      })
    );

    // 3. Probing Exposed Debug & Diagnostic Endpoints
    await Promise.all(
      DebugApiDocDiscoveryService.DEBUG_PROBE_SPECS.map(async (spec) => {
        try {
          const probeUrl = `${baseUrl}${spec.path}`;
          const res = await this.safeFetch(probeUrl);
          if (!res || res.status >= 400 || !res.body) return;

          const isVulnerable = spec.validator(res.status, res.body, res.headers);
          if (isVulnerable) {
            const snippet = res.body.slice(0, 200).replace(/\r?\n/g, ' ');
            report.debugFindings.push({
              url: probeUrl,
              category: spec.category,
              severity: spec.severity,
              title: spec.title,
              description: spec.description,
              evidenceSnippet: snippet,
              exploitStrategy: spec.exploitStrategy,
            });
            recordEndpoint(spec.path, 'GET', `Exposed: ${spec.title}`, `[${spec.severity}] ${spec.description}`);
          }
        } catch {}
      })
    );

    return report;
  }

  private async safeFetch(url: string): Promise<{ status: number; body: string; headers: Record<string, string> } | null> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, text/html, */*',
        },
        signal: AbortSignal.timeout(3500),
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      return { status: res.status, body, headers };
    } catch {
      // Fallback via Stealth Chrome CDP driver if direct fetch is blocked
      try {
        const body = await stealthCdpBrowserDriver.fetchInBrowser(url);
        if (body) {
          return { status: 200, body, headers: {} };
        }
      } catch {}
      return null;
    }
  }

  private async safePostJson(url: string, jsonPayload: string): Promise<{ status: number; body: string } | null> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        body: jsonPayload,
        signal: AbortSignal.timeout(3500),
      });
      const body = await res.text();
      return { status: res.status, body };
    } catch {
      return null;
    }
  }

  private cleanHost(input: string): string {
    return input.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim().toLowerCase();
  }
}

export const debugApiDocDiscoveryService = new DebugApiDocDiscoveryService();
