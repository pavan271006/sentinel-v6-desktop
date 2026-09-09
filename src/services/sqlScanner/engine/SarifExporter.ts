/**
 * Sentinel Autonomous SQL Engine — OASIS SARIF v2.1.0 Exporter
 *
 * Exports verified findings into standard Static Analysis Results Interchange Format (SARIF)
 * compatible with GitHub Advanced Security, GitLab CI, and SonarQube.
 */

import { SqlScanReport } from '../../../types/sqlScanner';
import { OrmRemediationEngine } from './OrmRemediationEngine';

export class SarifExporter {
  /**
   * Converts a Sentinel SqlScanReport into standard SARIF v2.1.0 JSON string
   */
  public static generateSarifJson(report: SqlScanReport): string {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Sentinel Autonomous SQL Engine',
              version: '6.0.0',
              informationUri: 'https://github.com/sentinel/sql-engine',
              rules: report.findings.map((f) => ({
                id: f.cwe || 'CWE-89',
                name: f.injectionType,
                shortDescription: {
                  text: f.title,
                },
                fullDescription: {
                  text: `${f.title} identified in parameter ${f.parameterName} (${f.parameterLocation}) on ${f.url}`,
                },
                defaultConfiguration: {
                  level: f.severity === 'Critical' ? 'error' : f.severity === 'High' ? 'error' : 'warning',
                },
                help: {
                  text: `${f.remediation}\n\nRecommended Code Patch:\n${
                    OrmRemediationEngine.getRemediation(f.parameterName, f.dbms)[0]?.remediatedCode || ''
                  }`,
                },
              })),
            },
          },
          results: report.findings.map((f) => ({
            ruleId: f.cwe || 'CWE-89',
            message: {
              text: `${f.title}: Injection verified in parameter '${f.parameterName}' via 5-step causal proof.`,
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: f.url,
                  },
                  region: {
                    startLine: 1,
                  },
                },
              },
            ],
            properties: {
              parameter: f.parameterName,
              location: f.parameterLocation,
              dbms: f.dbms,
              confidenceScore: f.confidenceScore,
              confidenceLevel: f.confidence,
              remediationPatches: OrmRemediationEngine.getRemediation(f.parameterName, f.dbms),
            },
          })),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }
}