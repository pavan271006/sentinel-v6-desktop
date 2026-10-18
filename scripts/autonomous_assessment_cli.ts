/**
 * Sentinel Sovereign Ω - Standalone CLI Autonomous Pre-Assessment Agent
 * scripts/autonomous_assessment_cli.ts
 *
 * Runs Sentinel's complete 4-Pillar Reconnaissance Engine and 6-Stage Autonomous
 * Heuristic ReAct Agent directly from the terminal with real-time streaming output.
 * Zero external API keys or subscriptions required.
 *
 * Usage:
 *   npx tsx scripts/autonomous_assessment_cli.ts <target_url> [optional_objective]
 *
 * Example:
 *   npx tsx scripts/autonomous_assessment_cli.ts https://example.com "Focus on Next.js server actions and origin bypass"
 */

import fs from 'fs';
import path from 'path';
import { autonomousPentestAgent, AgentStepLog, AutonomousAssessmentReport } from '../src/services/ai/AutonomousPentestAgent';

// ANSI terminal colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════════╗
║               SENTINEL SOVEREIGN Ω — CLI AGENT                   ║
║         Autonomous Pre-Assessment Reconnaissance Engine          ║
╚══════════════════════════════════════════════════════════════════╝${C.reset}

${C.bold}Usage:${C.reset}
  npx tsx scripts/autonomous_assessment_cli.ts <target_url> [objective]

${C.bold}Examples:${C.reset}
  npx tsx scripts/autonomous_assessment_cli.ts https://target.corp
  npx tsx scripts/autonomous_assessment_cli.ts https://app.example.com "Verify origin IP bypasses and Next.js server actions"
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const targetUrl = args[0];
  const objective = args.slice(1).join(' ') || undefined;
  const cleanHost = targetUrl.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

  console.log(`
${C.bold}${C.magenta}====================================================================${C.reset}
${C.bold}${C.white}  SENTINEL SOVEREIGN Ω — AUTONOMOUS PRE-ASSESSMENT AGENT${C.reset}
${C.dim}  Deterministic 6-Stage Heuristic ReAct Engine (Zero API Keys)${C.reset}
${C.bold}${C.magenta}====================================================================${C.reset}
${C.cyan}  Target Host   :${C.reset} ${C.bold}${cleanHost}${C.reset} (${targetUrl})
${C.cyan}  Objective     :${C.reset} ${objective || 'Full 4-Pillar Reconnaissance & Attack Surface Mapping'}
${C.cyan}  Started At    :${C.reset} ${new Date().toISOString()}
${C.bold}${C.magenta}--------------------------------------------------------------------${C.reset}
`);

  const startTime = Date.now();

  const report: AutonomousAssessmentReport = await autonomousPentestAgent.runAssessment({
    targetUrl,
    objective,
    onProgress: (percent, status) => {
      const barLength = 24;
      const filled = Math.round((percent / 100) * barLength);
      const empty = barLength - filled;
      const bar = `${C.green}${'█'.repeat(filled)}${C.dim}${'-'.repeat(empty)}${C.reset}`;
      process.stdout.write(`\r${C.bold}[${bar}] ${percent.toString().padStart(3)}%${C.reset} ${C.dim}${status.padEnd(55)}${C.reset}`);
    },
    onStep: (stepLog: AgentStepLog) => {
      process.stdout.write('\n');
      const timeStr = new Date(stepLog.timestamp).toLocaleTimeString();
      switch (stepLog.type) {
        case 'thought':
          console.log(`  ${C.blue}🧠 [THOUGHT #${stepLog.step}]${C.reset} ${C.dim}${stepLog.content}${C.reset}`);
          break;
        case 'action':
          console.log(`  ${C.yellow}⚡ [ACTION  #${stepLog.step}]${C.reset} ${C.bold}${stepLog.toolName || 'Tool'}${C.reset}: ${stepLog.content}`);
          break;
        case 'observation':
          console.log(`  ${C.cyan}👁️  [OBSERVE #${stepLog.step}]${C.reset} ${stepLog.content}`);
          break;
        case 'finding':
          const isCrit = stepLog.content.includes('[CRITICAL]');
          const isHigh = stepLog.content.includes('[HIGH]');
          const badge = isCrit
            ? `${C.bgRed}${C.white} CRITICAL ${C.reset}`
            : isHigh
            ? `${C.bgYellow}${C.white} HIGH ${C.reset}`
            : `${C.yellow} MEDIUM ${C.reset}`;
          console.log(`  🚨 ${badge} ${C.bold}${stepLog.content}${C.reset}`);
          break;
        case 'summary':
          console.log(`  ${C.green}✓  [SUMMARY #${stepLog.step}]${C.reset} ${stepLog.content}`);
          break;
      }
    },
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n${C.bold}${C.green}✓ Assessment completed in ${durationSec}s${C.reset}`);

  // Summary Metrics
  const critCount = report.keyFindings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = report.keyFindings.filter((f) => f.severity === 'HIGH').length;
  const medCount = report.keyFindings.filter((f) => f.severity === 'MEDIUM').length;
  const lowCount = report.keyFindings.filter((f) => f.severity === 'LOW').length;

  console.log(`
${C.bold}Key Findings Summary:${C.reset}
  - ${C.red}${C.bold}CRITICAL${C.reset} : ${critCount}
  - ${C.yellow}${C.bold}HIGH${C.reset}     : ${highCount}
  - ${C.cyan}MEDIUM${C.reset}   : ${medCount}
  - ${C.dim}LOW/INFO${C.reset} : ${lowCount}
`);

  if (report.keyFindings.length > 0) {
    console.log(`${C.bold}Prioritized Exploit Playbooks:${C.reset}`);
    report.keyFindings.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.severity}] ${C.bold}${f.title}${C.reset}`);
      console.log(`     ${C.dim}Strategy:${C.reset} ${f.exploitStrategy}\n`);
    });
  }

  // Save Markdown Report to ./recon_reports/
  try {
    const reportsDir = path.resolve(process.cwd(), 'recon_reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `assessment_${cleanHost}_${timestampStr}.md`;
    const fullPath = path.join(reportsDir, filename);

    fs.writeFileSync(fullPath, report.executiveSummary, 'utf-8');
    console.log(`${C.green}📁 Executive Report saved to:${C.reset} ${fullPath}\n`);
  } catch (err: any) {
    console.warn(`Could not save report file: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal Agent Error:${C.reset}`, err);
  process.exit(1);
});
