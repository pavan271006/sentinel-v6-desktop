/**
 * Sentinel Autonomous SQL Engine — Bug Bounty 1-Click Platform Report Exporter
 *
 * Formats validated findings into standardized, audit-ready Markdown templates
 * optimized for HackerOne, Bugcrowd, and Intigriti triage teams.
 */

import { SqlScanFinding, SqlScanReport } from '../../../types/sqlScanner';
import { ComplianceMapper } from './ComplianceMapper';
import { OrmRemediationEngine } from './OrmRemediationEngine';

export class BountyTemplateExporter {
  /**
   * Generates a HackerOne-formatted Markdown report.
   */
  public static exportHackerOne(finding: SqlScanFinding, _report?: SqlScanReport): string {
    const compliance = ComplianceMapper.mapFinding(finding);
    const ormPatches = OrmRemediationEngine.getRemediation(finding.parameterName, finding.dbms);
    const primaryPatch = ormPatches[0] || null;

    const lines: string[] = [];

    lines.push(`## Summary`);
    lines.push(
      `A **${finding.severity} Severity SQL Injection** vulnerability was confirmed on the parameter \`${finding.parameterName}\` (Location: \`${finding.parameterLocation}\`) at endpoint \`${finding.httpMethod} ${finding.url}\`.`
    );
    lines.push(
      `The database engine was identified as **${finding.dbms} ${finding.dbmsVersion || ''}** with **${finding.confidenceScore}% (${finding.confidence}) confidence** using formal causal verification.`
    );
    lines.push(``);

    lines.push(`## Vulnerability Details`);
    lines.push(`- **Target URL:** \`${finding.url}\``);
    lines.push(`- **HTTP Method:** \`${finding.httpMethod}\``);
    lines.push(`- **Vulnerable Parameter:** \`${finding.parameterName}\``);
    lines.push(`- **Parameter Location:** \`${finding.parameterLocation}\``);
    lines.push(`- **Injection Technique:** ${finding.injectionType}`);
    lines.push(`- **Target DBMS:** ${finding.dbms}`);
    lines.push(`- **CWE:** [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)`);
    lines.push(`- **OWASP:** ${compliance.owasp.code} - ${compliance.owasp.name}`);
    lines.push(`- **CVSS v3.1:** **${compliance.cvssV31.baseScore} (${compliance.cvssV31.severity})** (\`${compliance.cvssV31.vectorString}\`)`);
    lines.push(``);

    lines.push(`## Business & Security Impact`);
    lines.push(`Successful exploitation allows an unauthenticated/authenticated attacker to manipulate backend SQL query structure, resulting in:`);
    lines.push(`1. **Unauthorized Data Access (Confidentiality):** Extraction of sensitive database records including customer PII, internal records, and database metadata.`);
    lines.push(`2. **Row-Level Security & Tenant Boundary Bypass:** Potential circumvention of logical multi-tenant isolation boundaries.`);
    lines.push(`3. **Database Structural Control:** Verification of relational query modification without relying on disruptive modifications.`);
    lines.push(``);

    lines.push(`## Steps to Reproduce (Clean-Room Verification)`);
    lines.push(`1. Send the following baseline/verification HTTP request to observe differential or mathematical divergence:`);
    lines.push(``);

    if (finding.reproductionRequest) {
      lines.push(`### Reproduction Request`);
      lines.push(`\`\`\`http`);
      lines.push(finding.reproductionRequest.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`### Minimal Non-Destructive cURL Command`);
    lines.push(`\`\`\`bash`);
    lines.push(BountyTemplateExporter.generateCurlCommand(finding));
    lines.push(`\`\`\``);
    lines.push(``);

    if (finding.evidence && finding.evidence.length > 0) {
      lines.push(`## Evidence & Differential Analysis`);
      for (const ev of finding.evidence.slice(0, 3)) {
        lines.push(`- **Payload:** \`${ev.payload}\``);
        lines.push(`  - **Analysis:** ${ev.analysisSummary}`);
        lines.push(`  - **Response Comparison:** Baseline ${ev.baselineStatus} (${ev.baselineLength}B, ${ev.baselineDurationMs}ms) vs Test ${ev.testStatus} (${ev.testLength}B, ${ev.testDurationMs}ms)`);
      }
      lines.push(``);
    }

    lines.push(`## Remediation Guidance`);
    lines.push(`Ensure that all user-supplied input is parameterized using prepared statements or native ORM query builders.`);
    lines.push(``);

    if (primaryPatch) {
      lines.push(`### Recommended Fix (${primaryPatch.frameworkName} - ${primaryPatch.ecosystem})`);
      lines.push(`\`\`\`${primaryPatch.language}`);
      lines.push(`// VULNERABLE:`);
      lines.push(primaryPatch.vulnerablePattern);
      lines.push(``);
      lines.push(`// SECURE REMEDIATION:`);
      lines.push(primaryPatch.remediatedCode);
      lines.push(`\`\`\``);
      lines.push(`${primaryPatch.diffExplanation}`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * Generates a Bugcrowd-formatted Markdown report.
   */
  public static exportBugcrowd(finding: SqlScanFinding, _report?: SqlScanReport): string {
    const lines: string[] = [];

    lines.push(`### Vulnerability Title`);
    lines.push(`SQL Injection in \`${finding.parameterName}\` on \`${finding.url}\``);
    lines.push(``);

    lines.push(`### Target`);
    lines.push(`\`${finding.url}\``);
    lines.push(``);

    lines.push(`### Vulnerability Type`);
    lines.push(`Server-Side Injection > SQL Injection (SQLi)`);
    lines.push(``);

    lines.push(`### Severity`);
    lines.push(`**${finding.severity}** (Confidence: ${finding.confidenceScore}%)`);
    lines.push(``);

    lines.push(`### Description`);
    lines.push(`During assessment of \`${finding.url}\`, an SQL injection vulnerability was identified on parameter \`${finding.parameterName}\`. The backend database engine was confirmed as **${finding.dbms}**.`);
    lines.push(``);

    lines.push(`### Proof of Concept`);
    lines.push(`\`\`\`bash`);
    lines.push(BountyTemplateExporter.generateCurlCommand(finding));
    lines.push(`\`\`\``);
    lines.push(``);

    lines.push(`### Impact`);
    lines.push(`An attacker can execute arbitrary database commands within the context of the connected database user, allowing potential data exfiltration and integrity compromise.`);
    lines.push(``);

    lines.push(`### Suggested Remediation`);
    lines.push(finding.remediation);

    return lines.join('\n');
  }

  /**
   * Constructs a clean, safe curl command reproduction for the finding.
   */
  public static generateCurlCommand(finding: SqlScanFinding): string {
    const url = finding.url;
    const method = finding.httpMethod.toUpperCase();
    const payload = finding.evidence && finding.evidence[0] ? finding.evidence[0].payload : '';

    if (method === 'GET') {
      let targetUrl = url;
      try {
        const u = new URL(url);
        if (finding.parameterLocation === 'query') {
          u.searchParams.set(finding.parameterName, payload || finding.parameterName);
          targetUrl = u.toString();
        }
      } catch {}
      return `curl -s -i -k -X GET "${targetUrl}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0"`;
    }

    return `curl -s -i -k -X ${method} "${url}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0" \\
  --data-raw "${finding.parameterName}=${encodeURIComponent(payload)}"`;
  }
}
