import { SqlScanReport, SqlScanFinding } from '../../types/sqlScanner';
import { ComplianceMapper } from './engine/ComplianceMapper';
import { WafRuleGenerator } from './engine/WafRuleGenerator';
import { BountyTemplateExporter } from './engine/BountyTemplateExporter';

export class ReportGenerator {
  /**
   * Generates a 1-Click HackerOne formatted bug bounty submission report
   */
  public static generateHackerOneReport(finding: SqlScanFinding, report: SqlScanReport): string {
    return BountyTemplateExporter.exportHackerOne(finding, report);
  }

  /**
   * Generates a 1-Click Bugcrowd formatted bug bounty submission report
   */
  public static generateBugcrowdReport(finding: SqlScanFinding, report: SqlScanReport): string {
    return BountyTemplateExporter.exportBugcrowd(finding, report);
  }
  /**
   * Generates comprehensive technical report in Markdown format
   */
  public static generateTechnicalMarkdown(report: SqlScanReport): string {
    const lines: string[] = [];

    lines.push(`# Sentinel SQL Security Assessment — Technical Report`);
    lines.push(`**Generated:** ${new Date(report.generatedAt).toUTCString()}  `);
    lines.push(`**Target:** \`${report.targetMethod} ${report.targetUrl}\`  `);
    lines.push(`**FINAL VERDICT:** **${report.verdict}**  `);
    lines.push(`**Verdict Details:** ${report.verdictReason}  `);
    lines.push(`**Total Probes Sent:** ${report.requestsSent} (Tests Executed: ${report.testsExecuted})  `);
    lines.push(`**Duration:** ${(report.durationMs / 1000).toFixed(2)}s  `);
    lines.push(`**Identified DBMS:** ${report.dbms.dbms} ${report.dbms.version || ''} (${report.dbms.confidence} Confidence)  `);
    lines.push(`**WAF Status:** ${report.waf.detected ? `Detected (${report.waf.wafName})` : 'None Observed'}  `);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`## Vulnerability Summary`);
    if (report.findings.length === 0) {
      lines.push(`> No SQL injection vulnerabilities were confirmed on the tested parameters.`);
      if (report.safetyCertificate && report.safetyCertificate.isSafe) {
        lines.push(``);
        lines.push(`### Formal Safety Certificate (Negative Proof of Immunity)`);
        lines.push(`- **Status:** **MATHEMATICALLY VERIFIED IMMUNE** (Zero Relational Control Demonstrated)`);
        lines.push(`- **Total Verified Invariant Proofs:** ${report.safetyCertificate.proofs.length}`);
        lines.push(``);
        lines.push(`| Immunity Theorem | Confidence | Evidence Basis |`);
        lines.push(`| :--- | :--- | :--- |`);
        for (const proof of report.safetyCertificate.proofs) {
          lines.push(`| **${proof.reason}** | ${(proof.confidence * 100).toFixed(0)}% | ${proof.evidenceLogs.join(' ')} |`);
        }
      }
    } else {
      lines.push(`| Severity | Finding | Parameter | Injection Type | Confidence | CWE |`);
      lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
      for (const f of report.findings) {
        lines.push(`| **${f.severity}** | ${f.title} | \`${f.parameterName}\` (${f.parameterLocation}) | ${f.injectionType} | ${f.confidence} (${f.confidenceScore}%) | ${f.cwe} |`);
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    if (report.findings.length > 0) {
      lines.push(`## Detailed Technical Findings`);
      lines.push(``);

      for (let i = 0; i < report.findings.length; i++) {
        const f = report.findings[i];
        lines.push(`### ${i + 1}. ${f.title} (${f.severity})`);
        lines.push(`- **Target URL:** \`${f.url}\``);
        lines.push(`- **HTTP Method:** \`${f.httpMethod}\``);
        lines.push(`- **Vulnerable Parameter:** \`${f.parameterName}\` (Location: \`${f.parameterLocation}\`)`);
        lines.push(`- **Injection Class:** ${f.injectionType}`);
        lines.push(`- **DBMS Target:** ${f.dbms} ${f.dbmsVersion || ''}`);
        lines.push(`- **Confidence Score:** ${f.confidenceScore}% (${f.confidence})`);
        lines.push(`- **CWE / Classification:** [${f.cwe}](https://cwe.mitre.org/data/definitions/89.html) | ${f.owaspCategory}`);
        lines.push(``);
        lines.push(`#### Confidence Evidence Factors`);
        for (const factor of f.confidenceBreakdown.factors) {
          lines.push(`- **${factor.name}** (+${factor.points} pts): ${factor.description}`);
        }
        lines.push(``);

        lines.push(`#### 8-Layer Defense Resilience & Operational Impact`);
        lines.push(`- **AST Structure Control:** ${f.sqlStructureControl ? 'CONFIRMED' : 'UNCONFIRMED'}`);
        lines.push(`- **Cross-Tenant Access:** ${f.crossTenantAccess ? 'BREACHED' : 'CONSTRAINED (RLS/PoLP)'}`);
        lines.push(`- **Data Access Demonstrated:** ${f.dataAccessDemonstrated ? 'YES' : 'NO'}`);
        lines.push(`- **Write Capability:** ${f.writeCapability ? 'YES' : 'NO'}`);
        lines.push(`- **Privilege Capability:** ${f.privilegeCapability ? 'ELEVATED' : 'CONSTRAINED'}`);
        if (f.impactConstraints && f.impactConstraints.length > 0) {
          lines.push(`- **Active Kernel Impact Constraints:** \`${f.impactConstraints.join(', ')}\``);
        }
        if (f.defenseLayerTrace && f.defenseLayerTrace.length > 0) {
          lines.push(``);
          lines.push(`| Layer | Status | Certainty | Evaluation Basis |`);
          lines.push(`| :--- | :--- | :--- | :--- |`);
          for (const lt of f.defenseLayerTrace) {
            lines.push(`| **${lt.layer}** | \`${lt.status}\` | ${lt.certainty} | ${lt.details || 'N/A'} |`);
          }
        }
        lines.push(``);

        if (f.evidence.length > 0) {
          lines.push(`#### Reproduction Evidence & Probes`);
          for (const ev of f.evidence) {
            lines.push(`**Probe:** \`${ev.payload}\`  `);
            lines.push(`**Analysis:** ${ev.analysisSummary}  `);
            lines.push(`**Response Comparison:** Baseline ${ev.baselineStatus} (${ev.baselineLength}B, ${ev.baselineDurationMs}ms) vs Test ${ev.testStatus} (${ev.testLength}B, ${ev.testDurationMs}ms)`);
            lines.push(``);
            lines.push(`\`\`\`http`);
            lines.push(ev.rawRequest.trim());
            lines.push(`\`\`\``);
            lines.push(``);
          }
        }

        lines.push(`#### Remediation Guidance`);
        lines.push(f.remediation);
        lines.push(``);

        // Compliance & Standards Mapping
        const compliance = ComplianceMapper.mapFinding(f);
        lines.push(`#### Regulatory & Compliance Mapping`);
        lines.push(`- **CVSS v3.1 Score:** **${compliance.cvssV31.baseScore} (${compliance.cvssV31.severity})** — \`${compliance.cvssV31.vectorString}\``);
        lines.push(`- **OWASP Top 10:** \`${compliance.owasp.code} - ${compliance.owasp.name}\``);
        lines.push(`- **MITRE CWE:** [${compliance.cwe.name}](${compliance.cwe.url})`);
        lines.push(`- **PCI-DSS v4.0:** ${compliance.pciDssV4.requirements.join(', ')} — ${compliance.pciDssV4.guidance}`);
        lines.push(`- **NIST SP 800-53:** Controls \`${compliance.nistSp80053.controls.join(', ')}\` (${compliance.nistSp80053.name})`);
        lines.push(`- **ISO/IEC 27001:2022:** Controls \`${compliance.iso27001.controls.join(', ')}\` (${compliance.iso27001.title})`);
        lines.push(``);

        // Automated WAF Virtual Patches
        let urlPath = '/';
        try {
          urlPath = new URL(report.targetUrl).pathname || '/';
        } catch {}
        const patches = WafRuleGenerator.generateVirtualPatches(f, urlPath);

        lines.push(`#### Immediate WAF Virtual Patches`);
        lines.push(`**Cloudflare WAF Custom Rule:**`);
        lines.push(`\`\`\`text\n${patches.cloudflareWaf}\n\`\`\``);
        lines.push(`**ModSecurity (OWASP CRS SecRule):**`);
        lines.push(`\`\`\`apache\n${patches.modSecuritySecRule}\n\`\`\``);
        lines.push(`**AWS WAF v2 JSON Rule:**`);
        lines.push(`\`\`\`json\n${patches.awsWafJson}\n\`\`\``);
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
      }
    }

    lines.push(`## Database Schema Discovery`);
    lines.push(`- **DBMS:** ${report.catalog.dbms}`);
    lines.push(`- **Version:** ${report.catalog.version || 'Unverified'}`);
    lines.push(`- **Application Tables Discovered:** ${report.catalog.applicationTables.length}`);
    lines.push(`- **System Objects Discovered:** ${report.catalog.systemTables.length}`);
    lines.push(``);

    if (report.catalog.applicationTables.length > 0) {
      lines.push(`\`\`\`text`);
      lines.push(`DATABASE (${report.catalog.dbms})`);
      lines.push(`├── APPLICATION OBJECTS`);
      for (const t of report.catalog.applicationTables) {
        lines.push(`│   ├── ${t.name}${t.isSensitive ? ' [SENSITIVE OBJECT]' : ''}`);
        for (const c of t.columns) {
          lines.push(`│   │   ├── ${c.name} (${c.dataType})${c.isSensitive ? ' [SENSITIVE]' : ''}`);
        }
      }
      lines.push(`└── SYSTEM / INTERNAL OBJECTS (${report.catalog.systemTables.length} tables)`);
      lines.push(`\`\`\``);
      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * Generates high-level executive summary in Markdown format
   */
  public static generateExecutiveMarkdown(report: SqlScanReport): string {
    const lines: string[] = [];

    lines.push(`# Executive Security Summary — SQL Injection Risk Assessment`);
    lines.push(`**Target Application:** \`${report.targetUrl}\`  `);
    lines.push(`**Assessment Date:** ${new Date(report.generatedAt).toLocaleDateString()}  `);
    lines.push(`**FINAL VERDICT:** **${report.verdict}**  `);
    lines.push(``);
    lines.push(`### Assessment Overview`);
    lines.push(report.verdictReason);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * Generates formatted HTML report
   */
  public static generateHtmlReport(report: SqlScanReport): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sentinel SQL Security Assessment Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #e1e4ea; margin: 40px auto; max-width: 900px; line-height: 1.6; }
    h1, h2, h3 { color: #ffffff; }
    .verdict { padding: 12px 20px; border-radius: 6px; font-weight: bold; font-family: monospace; display: inline-block; }
    .verdict-vuln { background: #4c0519; border: 1px solid #f43f5e; color: #fda4af; }
    .verdict-clean { background: #064e3b; border: 1px solid #10b981; color: #6ee7b7; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-family: monospace; font-size: 13px; }
    th, td { border: 1px solid #232834; padding: 8px 12px; text-align: left; }
    th { background: #161a23; color: #ffffff; }
    pre { background: #161a23; padding: 14px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 12px; border: 1px solid #232834; }
    code { font-family: monospace; color: #10b981; }
  </style>
</head>
<body>
  <h1>Sentinel SQL Security Assessment</h1>
  <p><strong>Target:</strong> ${report.targetMethod} ${report.targetUrl}</p>
  <p><strong>Date:</strong> ${new Date(report.generatedAt).toUTCString()}</p>
  
  <div class="verdict ${report.verdict === 'VULNERABLE' ? 'verdict-vuln' : 'verdict-clean'}">
    FINAL RESULT: ${report.verdict}
  </div>

  <h2>Summary</h2>
  <p>${report.verdictReason}</p>
  <p><strong>DBMS:</strong> ${report.dbms.dbms} (${report.dbms.version || 'Unverified'})</p>
  <p><strong>Tests Executed:</strong> ${report.testsExecuted} | <strong>Probes Sent:</strong> ${report.requestsSent}</p>

  <h2>Findings (${report.findings.length})</h2>
  ${
    report.findings.length === 0
      ? '<p>No SQL injection vulnerabilities confirmed.</p>'
      : `<table>
          <thead>
            <tr><th>Severity</th><th>Title</th><th>Parameter</th><th>Type</th></tr>
          </thead>
          <tbody>
            ${report.findings
              .map(
                (f) =>
                  `<tr><td>${f.severity}</td><td>${f.title}</td><td>${f.parameterName}</td><td>${f.injectionType}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>`
  }

  <h2>Discovered Database Schema</h2>
  <p>Discovered ${report.catalog.applicationTables.length} application table(s) and ${report.catalog.systemTables.length} system object(s).</p>
</body>
</html>`;
  }
}
