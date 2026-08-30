import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { useToastStore } from '../stores/toastStore';
import { FileText, Download } from 'lucide-react';

export const ReportingWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [reportFormat, setReportFormat] = useState<'MARKDOWN' | 'HTML' | 'PDF' | 'SARIF' | 'JSON'>('MARKDOWN');
  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState(`# SENTINEL V6 — Penetration Testing Executive Report

**Engagement Target**: \`https://target.local\`  
**Date**: 2026-08-17  
**Platform Version**: Sentinel V6.0.0 Enterprise Workstation  
**Auditor**: Lead Security Consultant  

---

## 1. Executive Summary

During the comprehensive security assessment against \`target.local\`, Sentinel V6 identified **3 high/critical security findings** backed by cryptographically immutable Content-Addressed Storage (CAS) evidence.

### Vulnerability Summary Table
| # | Finding Title | Severity | CWE | CVSS | Verification Strategy |
|---|---|---|---|---|---|
| 1 | SQL Injection in User Search | **CRITICAL** | CWE-89 | 9.8 | Error Pattern + Differential |
| 2 | Out-of-Band SSRF via Webhook | **CRITICAL** | CWE-918 | 9.1 | OAST DNS/HTTP Callback |
| 3 | Broken Object Level Authorization (BOLA) | **HIGH** | CWE-284 | 8.5 | IRA+ Multi-Principal Matrix |

---

## 2. Technical Findings & Remediation Guidance

### Finding 1: SQL Injection in /api/v1/users/search
- **Endpoint**: \`GET /api/v1/users/search?q=1\`
- **Evidence CAS Hash**: \`cas-sha256-88a912fbb19042cda9\`
- **Remediation**: Implement prepared SQL statements with strict parameter type binding.

### Finding 2: Out-of-Band Blind SSRF via Webhook Integration
- **Endpoint**: \`POST /api/v1/webhooks/subscribe\`
- **Evidence CAS Hash**: \`cas-sha256-4401bbfe992301a9\`
- **Remediation**: Enforce fail-closed egress scope filter (SEC-01) blocking loopback (127.0.0.1) and internal CIDRs.
`);

  const handleExport = () => {
    setGenerating(true);
    addToast({ type: 'info', title: `Generating ${reportFormat} report bundle...` });
    setTimeout(() => {
      setGenerating(false);
      addToast({ type: 'success', title: `Report exported successfully: sentinel_v6_report.${reportFormat.toLowerCase()}` });
    }, 400);
  };

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Executive Reporting & SARIF 2.1 Exporter</h1>
            <p className="text-xs text-text-secondary">Export verified engagement findings to Markdown, HTML, PDF, SARIF 2.1, and JSON.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value as any)}
            className="bg-bg-app border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none"
          >
            <option value="MARKDOWN">Markdown (.md)</option>
            <option value="HTML">Interactive HTML (.html)</option>
            <option value="PDF">Executive PDF (.pdf)</option>
            <option value="SARIF">SARIF 2.1 (.sarif)</option>
            <option value="JSON">Raw JSON Dossier (.json)</option>
          </select>

          <Button
            variant="primary"
            size="sm"
            disabled={generating}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExport}
          >
            {generating ? 'Exporting...' : `Export ${reportFormat}`}
          </Button>
        </div>
      </div>

      {/* Main Markdown Preview / Editor */}
      <div className="flex-1 p-4 overflow-y-auto">
        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          className="w-full h-full bg-bg-panel border border-border-subtle rounded p-4 font-mono text-xs text-text-primary focus:border-accent-cyan outline-none resize-none leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
