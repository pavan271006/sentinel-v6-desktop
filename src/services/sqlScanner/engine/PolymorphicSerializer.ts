/**
 * SOHE God Rail v3 — Polymorphic Request Serializer
 *
 * Implements Content-Type Polymorphism & Parser Confusion Testing.
 *
 * Many modern API gateways, reverse proxies, and microservices (e.g. Spring Boot,
 * Express, ASP.NET Core) accept multiple content-type representations for the same
 * endpoint. Often, a front-end WAF inspects only `application/x-www-form-urlencoded`,
 * but the backend automatically deserializes `application/json` or `application/xml`.
 *
 * This module converts request bodies between representations:
 * 1. Form URL-Encoded <--> JSON Object
 * 2. Form URL-Encoded <--> XML Tree
 * 3. Form URL-Encoded <--> Multipart Form-Data
 * 4. Parameter Array/Object Nesting (e.g., `param[id]=val` vs `{"param": {"id": "val"}}`)
 */

import { GhostHttpRequest } from '../stealth/GhostNetwork';

export type BodyFormat = 'form_urlencoded' | 'json' | 'xml' | 'multipart';

export interface PolymorphicMutation {
  format: BodyFormat;
  contentTypeHeader: string;
  body: string;
  transformationNotes: string;
}

export class PolymorphicSerializer {
  /**
   * Generates alternative content-type representations of a request body,
   * injecting the specified payload into the target parameter.
   */
  public static generateMutations(
    baseRequest: GhostHttpRequest,
    targetParam: string,
    payload: string
  ): PolymorphicMutation[] {
    const mutations: PolymorphicMutation[] = [];
    const params = this.extractParameters(baseRequest);

    // Ensure the target parameter is present with the injected payload
    params[targetParam] = payload;

    // 1. JSON Representation
    mutations.push({
      format: 'json',
      contentTypeHeader: 'application/json; charset=utf-8',
      body: this.serializeToJson(params),
      transformationNotes: 'Converted request body to JSON object notation',
    });

    // 2. XML Representation
    mutations.push({
      format: 'xml',
      contentTypeHeader: 'application/xml; charset=utf-8',
      body: this.serializeToXml(params),
      transformationNotes: 'Converted request body to structured XML root document',
    });

    // 3. Multipart Form-Data Representation
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 16)}`;
    mutations.push({
      format: 'multipart',
      contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
      body: this.serializeToMultipart(params, boundary),
      transformationNotes: 'Converted parameters to isolated multipart/form-data chunks',
    });

    // 4. Standard Form URL-encoded (for baseline reference)
    mutations.push({
      format: 'form_urlencoded',
      contentTypeHeader: 'application/x-www-form-urlencoded; charset=utf-8',
      body: this.serializeToForm(params),
      transformationNotes: 'Standard application/x-www-form-urlencoded encoding',
    });

    return mutations;
  }

  /**
   * Extracts parameter key-value pairs from whatever the base request body was.
   */
  private static extractParameters(req: GhostHttpRequest): Record<string, string> {
    const params: Record<string, string> = {};
    const rawBody = req.body || '';

    // Check if body is JSON
    if (rawBody.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawBody);
        for (const [k, v] of Object.entries(parsed)) {
          params[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
        return params;
      } catch {}
    }

    // Check if body is URL-encoded form: a=1&b=2
    if (rawBody.includes('=') && !rawBody.trim().startsWith('<')) {
      const parts = rawBody.split('&');
      for (const part of parts) {
        const eq = part.indexOf('=');
        if (eq > 0) {
          const k = decodeURIComponent(part.substring(0, eq).trim());
          const v = decodeURIComponent(part.substring(eq + 1).trim());
          params[k] = v;
        }
      }
      return params;
    }

    // If query string in URL has parameters, copy them as baseline
    try {
      const u = new URL(req.url);
      u.searchParams.forEach((v, k) => {
        params[k] = v;
      });
    } catch {}

    return params;
  }

  private static serializeToJson(params: Record<string, string>): string {
    const resultObj: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      // Handle nested keys like user[name] or profile.email
      if (key.includes('[') && key.endsWith(']')) {
        const rootKey = key.substring(0, key.indexOf('['));
        const subKey = key.substring(key.indexOf('[') + 1, key.length - 1);
        if (!resultObj[rootKey]) resultObj[rootKey] = {};
        resultObj[rootKey][subKey] = value;
      } else if (key.includes('.')) {
        const [root, sub] = key.split('.');
        if (!resultObj[root]) resultObj[root] = {};
        resultObj[root][sub] = value;
      } else {
        resultObj[key] = value;
      }
    }

    return JSON.stringify(resultObj, null, 2);
  }

  private static serializeToXml(params: Record<string, string>): string {
    const xmlEntries = Object.entries(params)
      .map(([k, v]) => `  <${this.sanitizeXmlTag(k)}>${this.escapeXml(v)}</${this.sanitizeXmlTag(k)}>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<request>\n${xmlEntries}\n</request>`;
  }

  private static serializeToMultipart(params: Record<string, string>, boundary: string): string {
    let multipart = '';

    for (const [key, value] of Object.entries(params)) {
      multipart += `--${boundary}\r\n`;
      multipart += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      multipart += `${value}\r\n`;
    }

    multipart += `--${boundary}--\r\n`;
    return multipart;
  }

  private static serializeToForm(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  private static sanitizeXmlTag(tag: string): string {
    return tag.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private static escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
