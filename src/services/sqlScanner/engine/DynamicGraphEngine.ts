/**
 * UCMA-X — Dynamic Investigation Graph & Bayesian Distribution Generator
 * Constructs live Tri-Graph DAGs, Bayesian context beliefs, DBMS distributions,
 * and AI copilot deduction feeds dynamically from any active target HTTP request.
 */

import {
  InvestigationNode,
  InvestigationEdge,
  BeliefEntropyItem,
  AiCopilotReasoningItem,
  CandidateParameter,
  InjectionContext,
} from '../../../types/sqlScanner';
import { RequestParser, ParsedHttpRequest } from '../RequestParser';
import { ContextDetector } from '../ContextDetector';

export interface GeneratedScanTelemetry {
  investigationNodes: InvestigationNode[];
  investigationEdges: InvestigationEdge[];
  contextBeliefs: BeliefEntropyItem[];
  dbmsBeliefs: BeliefEntropyItem[];
  aiReasoningLogs: AiCopilotReasoningItem[];
  shannonEntropy: number;
  confidenceState: string;
}

export class DynamicGraphEngine {
  /**
   * Generates initial dynamic graph, priors, and copilot reasoning from a raw HTTP request.
   */
  public static generateForRequest(rawRequest: string, targetUrl?: string): GeneratedScanTelemetry {
    let parsed: ParsedHttpRequest;
    try {
      parsed = RequestParser.parse(rawRequest, targetUrl);
    } catch {
      parsed = {
        method: 'GET',
        url: targetUrl || 'http://localhost/target',
        host: 'localhost',
        path: '/target',
        protocol: 'http',
        headers: [],
        body: '',
        parameters: [],
      };
    }

    let pathname = '/target';
    try {
      if (parsed.url) {
        pathname = new URL(parsed.url).pathname || '/target';
      }
    } catch {
      pathname = '/target';
    }

    const host = parsed.host || 'target.local';
    const contentTypeHeader = (parsed.headers || []).find((h) => h.name.toLowerCase() === 'content-type')?.value || '';
    const isXml = parsed.isXml || parsed.body.trim().startsWith('<') || contentTypeHeader.toLowerCase().includes('xml');
    const isJson = parsed.isJson || parsed.body.trim().startsWith('{') || contentTypeHeader.toLowerCase().includes('json');

    // Detect contexts for all parameters
    for (const p of parsed.parameters) {
      if (!p.detectedContext || p.detectedContext === 'unknown') {
        p.detectedContext = ContextDetector.detectContext(p, rawRequest);
      }
    }

    // 1. Root Node
    const nodes: InvestigationNode[] = [
      {
        id: 'node-root',
        label: `${parsed.method} ${pathname}`,
        type: 'root_request',
        status: 'supported',
        depth: 0,
        eig: 1.0,
        cost: 1,
        priority: 1.0,
        description: `Target entrypoint: ${parsed.method} ${pathname} (Host: ${host})`,
        evidenceCount: 1,
      },
    ];
    const edges: InvestigationEdge[] = [];

    // 2. Surface Nodes & Context Nodes
    if (parsed.parameters.length === 0) {
      nodes.push({
        id: 'node-surf-empty',
        label: 'Raw Body / Unparameterized',
        type: 'surface',
        status: 'pending',
        depth: 1,
        eig: 0.5,
        cost: 1,
        priority: 0.5,
        description: 'No query or body parameters discovered in initial parse',
        evidenceCount: 0,
      });
      edges.push({
        id: 'e-root-empty',
        source: 'node-root',
        target: 'node-surf-empty',
        label: 'surface discovery',
        type: 'derives',
      });
    } else {
      parsed.parameters.forEach((param, idx) => {
        const surfId = `node-surf-${param.id}`;
        const locLabel = isXml && param.location === 'body_xml' ? 'XML Element' : param.location;
        nodes.push({
          id: surfId,
          label: `${param.name} (${locLabel})`,
          type: 'surface',
          status: 'pending',
          depth: 1,
          eig: 0.95 - idx * 0.05,
          cost: 1,
          priority: 0.95 - idx * 0.05,
          description: `Parameter "${param.name}" at location ${param.location} (Original: ${param.originalValue || 'empty'})`,
          evidenceCount: 0,
        });
        edges.push({
          id: `e-root-${param.id}`,
          source: 'node-root',
          target: surfId,
          label: 'surface discovery',
          type: 'derives',
        });

        const ctxId = `node-ctx-${param.id}`;
        const ctxName = this.formatContextName(param.detectedContext || 'single_quote_string');
        nodes.push({
          id: ctxId,
          label: `${ctxName} Context`,
          type: 'context_hypothesis',
          status: 'pending',
          depth: 2,
          eig: 0.88,
          cost: 2,
          priority: 0.65,
          description: `Syntactic AST hypothesis for "${param.name}": ${param.detectedContext || 'single_quote_string'}`,
          evidenceCount: 0,
        });
        edges.push({
          id: `e-ctx-${param.id}`,
          source: surfId,
          target: ctxId,
          label: 'context inference',
          type: 'derives',
        });
      });
    }

    // 3. Candidate Experiment Branches
    const experimentBranches = [
      {
        id: 'node-exp-error',
        label: 'Error-Based Oracle Probe',
        desc: 'CAST / type coercion error leakage detection',
        cost: 2,
        eig: 0.90,
        prio: 0.55,
      },
      {
        id: 'node-exp-bool',
        label: 'Differential Boolean Truth Probe',
        desc: 'Differential invariant evaluation (TRUE vs FALSE)',
        cost: 3,
        eig: 0.92,
        prio: 0.50,
      },
      {
        id: 'node-exp-union',
        label: 'In-Band UNION Column Sweeper',
        desc: 'Column projection and canary marker reflection',
        cost: 3,
        eig: 0.95,
        prio: 0.52,
      },
      {
        id: 'node-exp-sprt',
        label: 'Wald SPRT Sequential Latency',
        desc: 'Sequential probability ratio test timing lane',
        cost: 5,
        eig: 0.80,
        prio: 0.32,
      },
    ];

    const firstParam = parsed.parameters[0];
    const sourceNodeId = firstParam ? `node-ctx-${firstParam.id}` : (parsed.parameters.length > 0 ? `node-surf-${parsed.parameters[0].id}` : 'node-surf-empty');

    experimentBranches.forEach((exp, idx) => {
      nodes.push({
        id: exp.id,
        label: exp.label,
        type: 'experiment_branch',
        status: 'pending',
        depth: 3,
        eig: exp.eig,
        cost: exp.cost,
        priority: exp.prio,
        description: exp.desc,
        evidenceCount: 0,
      });
      edges.push({
        id: `e-exp-${idx}`,
        source: sourceNodeId,
        target: exp.id,
        label: 'EIG candidate',
        type: 'derives',
      });
    });

    // 4. Dynamic Bayesian Belief Distributions
    const contextBeliefs = this.computeContextPriors(parsed.parameters);
    const dbmsBeliefs = this.computeInitialDbmsPriors();

    // Compute Shannon Entropy H(P) = -sum(p * log2(p))
    let totalEntropy = 0;
    for (const item of contextBeliefs) {
      if (item.probability > 0) {
        totalEntropy -= item.probability * Math.log2(item.probability);
      }
    }

    // 5. Dynamic AI Copilot Reasoner Pre-Scan Telemetry
    const paramSummary = parsed.parameters.length > 0
      ? parsed.parameters.map((p) => `"${p.name}" (${p.location}${isXml ? '/XML' : ''})`).join(', ')
      : 'No dynamic parameters found';

    const aiReasoningLogs: AiCopilotReasoningItem[] = [
      {
        id: `ai-init-1`,
        timestamp: Date.now(),
        hypothesis: `Target Vector Surface: ${parsed.parameters.length} candidate vector(s) in ${parsed.method} ${pathname}`,
        reasoning: `Parsed candidate vectors: ${paramSummary}. Format: ${isXml ? 'XML Document' : isJson ? 'JSON Document' : 'Standard Query/Form'}. Initial AST priors assigned to parameter contexts.`,
        suggestedAction: 'Launch scan to probe perimeter defenses and execute sequential hypothesis testing.',
        confidenceScore: 0.0,
      },
    ];

    if (isXml) {
      aiReasoningLogs.push({
        id: `ai-init-2`,
        timestamp: Date.now() + 1,
        hypothesis: `WAF Evasion Strategy: XML Entity & Character Obfuscation Available`,
        reasoning: `Target uses XML serialization. Automated payload mutations will employ XML hexadecimal entities (&x27;, &x22;) and Hackvertor entity expansion if perimeter WAF blocks raw SQL characters.`,
        suggestedAction: 'Enable defensive WAF bypass engine during probe dispatch.',
        confidenceScore: 0.75,
      });
    }

    return {
      investigationNodes: nodes,
      investigationEdges: edges,
      contextBeliefs,
      dbmsBeliefs,
      aiReasoningLogs,
      shannonEntropy: totalEntropy,
      confidenceState: 'Prior Distribution (Unprobed)',
    };
  }

  /**
   * Helper to format raw context strings into clean display labels
   */
  public static formatContextName(ctx?: InjectionContext | string): string {
    if (!ctx) return 'Single-Quote String';
    switch (ctx) {
      case 'single_quote_string':
        return 'Single-Quote String';
      case 'double_quote_string':
        return 'Double-Quote String';
      case 'numeric':
        return 'Numeric / Integer';
      case 'where_clause':
        return 'WHERE Clause Invariant';
      case 'order_by_clause':
        return 'ORDER BY Clause';
      case 'xml_derived':
        return 'XML Derived Element';
      case 'json_derived':
        return 'JSON Attribute Value';
      case 'like_clause':
        return 'LIKE Pattern Clause';
      case 'identifier':
        return 'SQL Identifier / Column';
      default:
        return ctx.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

  private static computeContextPriors(parameters: CandidateParameter[]): BeliefEntropyItem[] {
    const rawScores: Record<string, number> = {
      single_quote_string: 0.2,
      where_clause: 0.15,
      numeric: 0.1,
      order_by_clause: 0.05,
      xml_derived: 0.05,
      json_derived: 0.05,
      double_quote_string: 0.05,
      like_clause: 0.05,
    };

    if (parameters.length > 0) {
      for (const p of parameters) {
        if (p.detectedContext && rawScores[p.detectedContext] !== undefined) {
          rawScores[p.detectedContext] += 0.4;
        } else if (p.detectedContext === 'xml_derived') {
          rawScores.xml_derived = (rawScores.xml_derived || 0) + 0.5;
        } else if (p.detectedContext === 'numeric') {
          rawScores.numeric += 0.4;
        } else {
          rawScores.single_quote_string += 0.3;
        }
      }
    }

    const total = Object.values(rawScores).reduce((acc, v) => acc + v, 0);
    const entries = Object.entries(rawScores)
      .map(([name, score]) => {
        const prob = score / total;
        const bits = prob > 0 ? -prob * Math.log2(prob) : 0;
        return { name, probability: prob, shannonBits: bits, isLeading: false };
      })
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    const topTotal = entries.reduce((acc, e) => acc + e.probability, 0);
    const normalized = entries.map((e) => {
      const p = topTotal > 0 ? e.probability / topTotal : 0.2;
      return {
        ...e,
        probability: p,
        shannonBits: p > 0 ? -p * Math.log2(p) : 0,
      };
    });

    if (normalized.length > 0) {
      normalized[0].isLeading = true;
    }

    return normalized;
  }

  private static computeInitialDbmsPriors(): BeliefEntropyItem[] {
    const dialects = [
      'PostgreSQL',
      'MySQL / MariaDB',
      'Microsoft SQL Server',
      'SQLite',
      'Oracle',
    ];
    const prob = 1.0 / dialects.length;
    const bits = -prob * Math.log2(prob);

    return dialects.map((name, idx) => ({
      name,
      probability: prob,
      shannonBits: bits,
      isLeading: idx === 0, // tentative until probe evidence
    }));
  }
}
