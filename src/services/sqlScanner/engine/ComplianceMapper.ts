/**
 * SOHE God Rail v3 — Compliance & Standards Mapper
 *
 * Maps SQL injection findings and Formal Safety Certificates to international
 * cybersecurity regulatory standards and computing frameworks:
 * - OWASP Top 10 (2021)
 * - MITRE Common Weakness Enumeration (CWE)
 * - PCI-DSS v4.0 (Payment Card Industry Data Security Standard)
 * - NIST SP 800-53 Rev. 5 (Security and Privacy Controls)
 * - ISO/IEC 27001:2022 (Information Security Management)
 * - Common Vulnerability Scoring System (CVSS v3.1)
 */

import { SqlScanFinding } from '../../../types/sqlScanner';

export interface ComplianceMapping {
  findingId: string;
  owasp: {
    code: string;
    name: string;
    year: string;
  };
  cwe: {
    id: number;
    name: string;
    url: string;
  };
  pciDssV4: {
    requirements: string[];
    guidance: string;
  };
  nistSp80053: {
    controls: string[];
    name: string;
  };
  iso27001: {
    controls: string[];
    title: string;
  };
  cvssV31: {
    baseScore: number;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    vectorString: string;
  };
}

export class ComplianceMapper {
  /**
   * Generates international compliance and regulatory mappings for a scan finding.
   */
  public static mapFinding(finding: SqlScanFinding): ComplianceMapping {
    const isUnionOrDirect = finding.injectionType === 'UNION-based' || finding.injectionType === 'Error-based';
    const isBlind = finding.injectionType === 'Boolean-based' || finding.injectionType === 'Time-based';
    const isStacked = finding.injectionType === 'Stacked-query indicator';

    // 1. CVSS v3.1 Calculation
    // Vector format: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
    let baseScore = 9.8;
    let severity: 'Critical' | 'High' | 'Medium' | 'Low' = 'Critical';
    let vectorString = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';

    if (isStacked) {
      baseScore = 9.8;
      severity = 'Critical';
      vectorString = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
    } else if (isUnionOrDirect) {
      baseScore = 8.6;
      severity = 'High';
      vectorString = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L';
    } else if (isBlind) {
      baseScore = 7.5;
      severity = 'High';
      vectorString = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N';
    }

    // 2. Determine CWE
    let cweId = 89;
    let cweName = 'Improper Neutralization of Special Elements used in an SQL Command (\'SQL Injection\')';
    if (finding.parameterLocation === 'body_json') {
      cweId = 943;
      cweName = 'Improper Neutralization of Special Elements in Data Query Logic';
    }

    return {
      findingId: finding.id,
      owasp: {
        code: 'A03:2021',
        name: 'Injection',
        year: '2021',
      },
      cwe: {
        id: cweId,
        name: cweName,
        url: `https://cwe.mitre.org/data/definitions/${cweId}.html`,
      },
      pciDssV4: {
        requirements: ['Requirement 6.2.4', 'Requirement 6.4.1'],
        guidance:
          'PCI-DSS 4.0 Requirement 6.2.4 mandates that software is developed securely to prevent injection attacks, specifically verifying SQL query input parameterization.',
      },
      nistSp80053: {
        controls: ['SI-10', 'SI-10(1)', 'SC-5'],
        name: 'Information Input Validation & Error Handling',
      },
      iso27001: {
        controls: ['Control A.8.26', 'Control A.8.28'],
        title: 'Application security requirements & Secure coding practices',
      },
      cvssV31: {
        baseScore,
        severity,
        vectorString,
      },
    };
  }
}
