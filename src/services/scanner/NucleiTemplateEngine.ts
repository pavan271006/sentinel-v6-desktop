/**
 * Sentinel V6 - Nuclei YAML Template Engine & Zero-Day Heuristic Scanner
 *
 * Implements standard Nuclei-compatible YAML template execution for active/passive vulnerability scanning.
 * Supports word matchers, regex matchers, status code matchers, dynamic variables ({{BaseURL}}, {{RootURL}}),
 * and bundled high-priority zero-day / misconfiguration detection templates.
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export interface NucleiInfo {
  name: string;
  author: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reference?: string[];
  tags: string[];
  cve?: string;
  cvss?: number;
}

export interface NucleiMatcher {
  type: 'word' | 'regex' | 'status' | 'binary';
  words?: string[];
  regex?: string[];
  status?: number[];
  part?: 'body' | 'header' | 'all' | 'interactsh_protocol';
  condition?: 'and' | 'or';
  negative?: boolean;
}

export interface NucleiHttpRequest {
  method: string;
  path: string[];
  headers?: Record<string, string>;
  body?: string;
  matchersCondition?: 'and' | 'or';
  matchers: NucleiMatcher[];
}

export interface NucleiTemplate {
  id: string;
  info: NucleiInfo;
  http: NucleiHttpRequest[];
}

export interface NucleiExecutionResult {
  templateId: string;
  templateName: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  matched: boolean;
  matchedUrl?: string;
  extractedResults?: string[];
  evidence?: string;
  description: string;
  cve?: string;
  cvss?: number;
}

// ─── Curated High-Value Zero-Day & Critical Templates ────────────────────────

export const BUILTIN_NUCLEI_TEMPLATES: NucleiTemplate[] = [
  {
    id: 'git-config-exposure',
    info: {
      name: 'Git Repository Metadata Disclosure (.git/config)',
      author: 'Sentinel Security Team',
      severity: 'high',
      description: 'The .git/config configuration file is exposed, leaking source code repository URLs and credentials.',
      tags: ['exposure', 'git', 'misconfig'],
      cve: 'CWE-200',
      cvss: 7.5,
    },
    http: [
      {
        method: 'GET',
        path: ['{{BaseURL}}/.git/config'],
        matchersCondition: 'and',
        matchers: [
          { type: 'status', status: [200] },
          { type: 'word', words: ['[core]', 'repositoryformatversion'], condition: 'and', part: 'body' },
        ],
      },
    ],
  },
  {
    id: 'env-file-disclosure',
    info: {
      name: 'Environment Configuration File Disclosure (.env)',
      author: 'Sentinel Security Team',
      severity: 'critical',
      description: 'The .env configuration file is accessible via HTTP, exposing plaintext API keys, database credentials, and secret tokens.',
      tags: ['exposure', 'env', 'secrets'],
      cve: 'CWE-552',
      cvss: 9.8,
    },
    http: [
      {
        method: 'GET',
        path: ['{{BaseURL}}/.env', '{{BaseURL}}/.env.local', '{{BaseURL}}/.env.production'],
        matchersCondition: 'and',
        matchers: [
          { type: 'status', status: [200] },
          { type: 'regex', regex: ['(DB_PASSWORD|APP_KEY|DATABASE_URL|AWS_SECRET_ACCESS_KEY|SECRET_KEY)=\\S+'], part: 'body' },
        ],
      },
    ],
  },
  {
    id: 'client-prototype-pollution',
    info: {
      name: 'Client-Side Prototype Pollution URL Vector',
      author: 'Sentinel Security Team',
      severity: 'medium',
      description: 'Application parses query strings into Object prototype via __proto__ or constructor.prototype keys.',
      tags: ['prototype-pollution', 'xss', 'js'],
      cve: 'CWE-1321',
      cvss: 6.5,
    },
    http: [
      {
        method: 'GET',
        path: ['{{BaseURL}}/?__proto__[sentinel_polluted]=true&constructor[prototype][sentinel_polluted]=true'],
        matchersCondition: 'and',
        matchers: [
          { type: 'status', status: [200] },
          { type: 'word', words: ['sentinel_polluted'], part: 'body' },
        ],
      },
    ],
  },
  {
    id: 'cors-wildcard-origin-reflection',
    info: {
      name: 'Arbitrary CORS Origin Reflection with Credentials',
      author: 'Sentinel Security Team',
      severity: 'high',
      description: 'The server dynamically reflects untrusted Origin headers with Access-Control-Allow-Credentials: true, enabling cross-origin authenticated data theft.',
      tags: ['cors', 'misconfig', 'auth'],
      cve: 'CWE-942',
      cvss: 8.1,
    },
    http: [
      {
        method: 'GET',
        path: ['{{BaseURL}}'],
        headers: {
          'Origin': 'https://evil-attacker-domain.sentinel.com',
        },
        matchersCondition: 'and',
        matchers: [
          { type: 'word', words: ['Access-Control-Allow-Origin: https://evil-attacker-domain.sentinel.com', 'Access-Control-Allow-Credentials: true'], condition: 'and', part: 'header' },
        ],
      },
    ],
  },
  {
    id: 'spring4shell-classloader-rce',
    info: {
      name: 'Spring Framework ClassLoader Access (Spring4Shell / CVE-2022-22965)',
      author: 'Sentinel Security Team',
      severity: 'critical',
      description: 'Spring MVC / WebFlux data binding vulnerability allows remote ClassLoader manipulation leading to RCE.',
      tags: ['rce', 'spring', 'java'],
      cve: 'CVE-2022-22965',
      cvss: 9.8,
    },
    http: [
      {
        method: 'POST',
        path: ['{{BaseURL}}'],
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'class.module.classLoader.DefaultAssertionStatus=true',
        matchersCondition: 'and',
        matchers: [
          { type: 'status', status: [200, 400] },
          { type: 'regex', regex: ['(org\\.springframework|DefaultAssertionStatus)'], part: 'body' },
        ],
      },
    ],
  },
  {
    id: 'aws-metadata-ssrf-probe',
    info: {
      name: 'AWS EC2 Instance Metadata SSRF Exfiltration',
      author: 'Sentinel Security Team',
      severity: 'critical',
      description: 'Probes for open server-side request forgery paths to the AWS IMDSv1 metadata service.',
      tags: ['ssrf', 'aws', 'cloud'],
      cve: 'CWE-918',
      cvss: 9.8,
    },
    http: [
      {
        method: 'GET',
        path: ['{{BaseURL}}/?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/', '{{BaseURL}}/?redirect=http://169.254.169.254/latest/meta-data/'],
        matchersCondition: 'and',
        matchers: [
          { type: 'status', status: [200] },
          { type: 'word', words: ['Code', 'AccessKeyId', 'SecretAccessKey', 'Token'], condition: 'or', part: 'body' },
        ],
      },
    ],
  },
];

// ─── Nuclei Template Execution Engine ───────────────────────────────────────

export class NucleiTemplateEngine {
  private templates: NucleiTemplate[];

  constructor(customTemplates: NucleiTemplate[] = []) {
    this.templates = [...BUILTIN_NUCLEI_TEMPLATES, ...customTemplates];
  }

  public getTemplates(): NucleiTemplate[] {
    return this.templates;
  }

  public addTemplate(template: NucleiTemplate): void {
    this.templates.push(template);
  }

  /**
   * Executes a single Nuclei template against a target URL.
   */
  public async executeTemplate(targetUrl: string, template: NucleiTemplate): Promise<NucleiExecutionResult> {
    const cleanBaseUrl = targetUrl.replace(/\/+$/, '');

    for (const reqConfig of template.http) {
      for (const pathPattern of reqConfig.path) {
        const url = pathPattern.replace(/{{BaseURL}}/g, cleanBaseUrl).replace(/{{RootURL}}/g, cleanBaseUrl);
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel-Nuclei/6.0',
          ...(reqConfig.headers || {}),
        };

        const rawRequest = `${reqConfig.method} ${url} HTTP/1.1\r\nHost: ${new URL(url).host}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n${reqConfig.body || ''}`;

        try {
          const res: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
            tabId: `nuclei_${template.id}`,
            targetUrl: url,
            rawRequest,
          });

          const statusCode = res.statusCode || 200;
          const body = res.body || '';
          const rawHeaders = res.rawResponse || '';

          // Evaluate Matchers
          const matcherResults: boolean[] = [];

          for (const matcher of reqConfig.matchers) {
            let passed = false;
            let targetContent = body;
            if (matcher.part === 'header') targetContent = rawHeaders;
            else if (matcher.part === 'all') targetContent = `${rawHeaders}\r\n${body}`;

            if (matcher.type === 'status' && matcher.status) {
              passed = matcher.status.includes(statusCode);
            } else if (matcher.type === 'word' && matcher.words) {
              if (matcher.condition === 'and') {
                passed = matcher.words.every((w) => targetContent.toLowerCase().includes(w.toLowerCase()));
              } else {
                passed = matcher.words.some((w) => targetContent.toLowerCase().includes(w.toLowerCase()));
              }
            } else if (matcher.type === 'regex' && matcher.regex) {
              passed = matcher.regex.some((r) => new RegExp(r, 'i').test(targetContent));
            }

            if (matcher.negative) {
              passed = !passed;
            }
            matcherResults.push(passed);
          }

          const condition = reqConfig.matchersCondition || 'and';
          const isMatched =
            condition === 'and'
              ? matcherResults.every(Boolean)
              : matcherResults.some(Boolean);

          if (isMatched) {
            return {
              templateId: template.id,
              templateName: template.info.name,
              severity: template.info.severity,
              matched: true,
              matchedUrl: url,
              evidence: `Matched on ${url} (HTTP ${statusCode})`,
              description: template.info.description,
              cve: template.info.cve,
              cvss: template.info.cvss,
            };
          }
        } catch {
          // Continue to next probe
        }
      }
    }

    return {
      templateId: template.id,
      templateName: template.info.name,
      severity: template.info.severity,
      matched: false,
      description: template.info.description,
      cve: template.info.cve,
      cvss: template.info.cvss,
    };
  }

  /**
   * Runs all registered Nuclei templates across a target URL.
   */
  public async scanTarget(
    targetUrl: string,
    onProgress?: (result: NucleiExecutionResult, index: number, total: number) => void
  ): Promise<NucleiExecutionResult[]> {
    const results: NucleiExecutionResult[] = [];
    for (let i = 0; i < this.templates.length; i++) {
      const t = this.templates[i];
      const res = await this.executeTemplate(targetUrl, t);
      results.push(res);
      onProgress?.(res, i + 1, this.templates.length);
    }
    return results;
  }
}
