/**
 * UCMA-X — Master 11-Dimensional SQL Injection Taxonomy Catalog
 * Formal taxonomy representation defining mechanisms, contexts, oracles, lifecycles, and compatibility rules.
 */

import { DbmsType, InjectionContext, ParameterLocation } from '../../types/sqlScanner';

export type TechniqueLifecycle = 'CONFIRMED' | 'CANDIDATE' | 'RESEARCH' | 'DEPRECATED' | 'UNSUPPORTED';

export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';

export interface TaxonomyDimensionNode {
  id: string;
  name: string;
  dimension: string;
  priority: PriorityLevel;
  status: TechniqueLifecycle;
  description: string;
  applicableDbms: DbmsType[] | 'ALL';
  applicableContexts: InjectionContext[] | 'ALL';
  applicableTransports: ParameterLocation[] | 'ALL';
  researchSource: string;
}

export const MECHANISMS: Record<string, TaxonomyDimensionNode> = {
  M01: {
    id: 'M01',
    name: 'Boolean-Based Differential Inference',
    dimension: 'Mechanism',
    priority: 'P0',
    status: 'CONFIRMED',
    description: 'Infer database state bit-by-bit by evaluating truth-value expressions causing observable page/status divergence.',
    applicableDbms: 'ALL',
    applicableContexts: 'ALL',
    applicableTransports: 'ALL',
    researchSource: 'OWASP WSTG-INPV-05; Halfond & Orso (2006)',
  },
  M02: {
    id: 'M02',
    name: 'Error-Based Type Coercion / XML / Subquery Extraction',
    dimension: 'Mechanism',
    priority: 'P0',
    status: 'CONFIRMED',
    description: 'Trigger database runtime errors (e.g. CAST to int, ExtractValue, group by duplicate key) that leak extracted data.',
    applicableDbms: ['PostgreSQL', 'Microsoft SQL Server', 'MySQL', 'Oracle'],
    applicableContexts: ['numeric', 'single_quote_string', 'double_quote_string', 'parenthesized_string', 'where_clause', 'having_clause'],
    applicableTransports: 'ALL',
    researchSource: 'CWE-209; PortSwigger SQLi Lab 03',
  },
  M03: {
    id: 'M03',
    name: 'UNION-Based Canary & Set Extension',
    dimension: 'Mechanism',
    priority: 'P0',
    status: 'CONFIRMED',
    description: 'Extend original query results using UNION SELECT with type-compatible canary markers to read metadata directly in-band.',
    applicableDbms: 'ALL',
    applicableContexts: ['numeric', 'single_quote_string', 'double_quote_string', 'parenthesized_string', 'where_clause'],
    applicableTransports: 'ALL',
    researchSource: 'CWE-89; OWASP WSTG-INPV-05',
  },
  M04: {
    id: 'M04',
    name: 'Time-Based Sequential Latency Probing (SPRT)',
    dimension: 'Mechanism',
    priority: 'P0',
    status: 'CONFIRMED',
    description: 'Inject database sleep / delay primitives and evaluate response latency with sequential hypothesis testing.',
    applicableDbms: 'ALL',
    applicableContexts: 'ALL',
    applicableTransports: 'ALL',
    researchSource: 'Wald (1945) SPRT; PortSwigger Blind SQLi',
  },
  M05: {
    id: 'M05',
    name: 'Stacked Query Multi-Statement Execution',
    dimension: 'Mechanism',
    priority: 'P1',
    status: 'CONFIRMED',
    description: 'Execute independent semicolon-separated SQL statements supported by database driver capabilities.',
    applicableDbms: ['Microsoft SQL Server', 'PostgreSQL', 'MySQL', 'SQLite'],
    applicableContexts: ['numeric', 'single_quote_string', 'where_clause'],
    applicableTransports: 'ALL',
    researchSource: 'sqlmap stacked query engine',
  },
  M06: {
    id: 'M06',
    name: 'Dynamic ORDER BY / Sorting Invariant Validation',
    dimension: 'Mechanism',
    priority: 'P0',
    status: 'CONFIRMED',
    description: 'Evaluate column index and CASE expression sorting boundaries in unquoted/identifier parameters.',
    applicableDbms: 'ALL',
    applicableContexts: ['order_by_clause', 'group_by_clause', 'identifier'],
    applicableTransports: ['query', 'body_form', 'body_json'],
    researchSource: 'PortSwigger SQLi in ORDER BY; OWASP Query Builders',
  },
  M07: {
    id: 'M07',
    name: 'Second-Order Workflow & Asynchronous Storage Injection',
    dimension: 'Mechanism',
    priority: 'P1',
    status: 'CANDIDATE',
    description: 'Store unescaped payload at source endpoint; verify execution at secondary consumer endpoint or background worker.',
    applicableDbms: 'ALL',
    applicableContexts: 'ALL',
    applicableTransports: 'ALL',
    researchSource: 'PortSwigger Second-Order SQLi (00100210)',
  },
  M08: {
    id: 'M08',
    name: 'Out-of-Band (OAST) Network Interaction',
    dimension: 'Mechanism',
    priority: 'P1',
    status: 'CANDIDATE',
    description: 'Trigger outbound DNS / HTTP / SMB network interactions to an authorized collaborator gateway.',
    applicableDbms: ['Oracle', 'Microsoft SQL Server', 'MySQL', 'PostgreSQL'],
    applicableContexts: 'ALL',
    applicableTransports: 'ALL',
    researchSource: 'Burp Collaborator / OAST Standard',
  },
  M09: {
    id: 'M09',
    name: 'Relational Metamorphic Testing (TLP / NoREC / PQS)',
    dimension: 'Mechanism',
    priority: 'P2',
    status: 'CANDIDATE',
    description: 'Validate relational partitioning invariants (Q(P) UNION Q(NOT P) UNION Q(P IS NULL) == Q(TRUE)).',
    applicableDbms: 'ALL',
    applicableContexts: ['where_clause', 'numeric', 'single_quote_string'],
    applicableTransports: 'ALL',
    researchSource: 'Rigger & Su (USENIX Security 2020)',
  },
};

export const OBSERVATION_ORACLES = [
  'DIRECT_IN_BAND',
  'UNION_CANARY_REFLECTION',
  'VERBOSE_SYNTAX_ERROR',
  'CAST_TYPE_ERROR',
  'BOOLEAN_STATUS_CODE',
  'BOOLEAN_CONTENT_DIFF',
  'BOOLEAN_HEADER_REDIRECT',
  'DOM_STRUCTURAL_DIFF',
  'FIXED_TIME_DELAY',
  'SPRT_STATISTICAL_LATENCY',
  'OOB_DNS_INTERACTION',
  'OOB_HTTP_INTERACTION',
  'OOB_SMB_NTLM',
  'METAMORPHIC_INVARIANT',
  'STATE_CHANGE_SIDE_EFFECT',
] as const;

export type ObservationOracleType = typeof OBSERVATION_ORACLES[number];
