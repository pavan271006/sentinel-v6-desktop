import { describe, it, expect } from 'vitest';
import { SarifExporter } from './SarifExporter';

describe('SarifExporter — OASIS SARIF v2.1.0 & Standalone Dark HTML Synthesizer', () => {
  const mockTargetConfig = {
    id: 't1',
    name: 'Search Endpoint',
    url: 'https://target.local/api/search',
    method: 'GET',
    headers: [],
    body: '',
    parameters: [],
    rawRequest: 'GET /api/search?q=test HTTP/1.1\r\nHost: target.local\r\n\r\n',
  };

  const mockFindings = [
    {
      id: 'f1',
      title: 'PostgreSQL Error-Based SQL Injection',
      severity: 'Critical',
      confidence: 'Confirmed',
      confidenceScore: 100,
      parameterName: 'q',
      injectionType: 'Error-based',
      dbms: 'PostgreSQL',
      evidence: ['ERROR: invalid input syntax for integer: "admin\'--"'],
      reproductionRequest: "GET /api/search?q=' AND 1=CAST((SELECT version()) AS int)-- HTTP/1.1\r\nHost: target.local\r\n\r\n",
      url: 'https://target.local/api/search?q=test',
    },
  ];

  it('generates valid SARIF v2.1.0 JSON compliant structure', () => {
    const sarif = SarifExporter.generateSarif(mockFindings as any, mockTargetConfig as any);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
    expect(sarif.runs.length).toBe(1);

    const run = sarif.runs[0];
    expect(run.tool.driver.name).toContain('Sentinel SQL X');
    expect(run.tool.driver.rules.length).toBeGreaterThan(0);
    expect(run.results.length).toBe(1);

    const result = run.results[0];
    expect(result.ruleId).toBe('SENTINEL-SQL-CWE89');
    expect(result.level).toBe('error');
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('https://target.local/api/search?q=test');
    expect(result.properties.cwe).toContain('CWE-89');
  });

  it('generates standalone dark-mode HTML report containing findings and metadata', () => {
    const html = SarifExporter.generateStandaloneHtmlReport(mockFindings as any, mockTargetConfig as any, 'VULNERABLE');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('SENTINEL SQL X');
    expect(html).toContain('PostgreSQL');
    expect(html).toContain('https://target.local/api/search');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('ERROR: invalid input syntax');
  });
});
