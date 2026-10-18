import React, { useState } from 'react';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { useReconStore } from '../../stores/reconStore';
import { useToastStore } from '../../stores/toastStore';
import {
  sentinelAgentBridge,
  WebsiteKnowledgeBase,
  AgentToolDefinition,
} from '../../services/contentDiscovery/SentinelAgentBridge';
import {
  Globe,
  Server,
  Key,
  Database,
  Layers,
  History,
  Bot,
  Copy,
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Terminal,
  Code,
  FileCode,
  CheckCircle2,
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import {
  autonomousPentestAgent,
  AgentStepLog,
  AutonomousAssessmentReport,
} from '../../services/ai/AutonomousPentestAgent';

interface WebsiteKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetHost?: string;
}

type TabType = 'overview' | 'pillar1' | 'pillar2' | 'pillar3' | 'pillar4' | 'agent_tools';

export const WebsiteKnowledgeBaseModal: React.FC<WebsiteKnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  targetHost,
}) => {
  const { latestKnowledgeBase, setLatestKnowledgeBase } = useReconStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRunningCapture, setIsRunningCapture] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Autonomous Agent Runner State
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentProgress, setAgentProgress] = useState<{ percent: number; status: string } | null>(null);
  const [agentLogs, setAgentLogs] = useState<AgentStepLog[]>([]);
  const [agentReport, setAgentReport] = useState<AutonomousAssessmentReport | null>(null);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);
  const [agentObjective, setAgentObjective] = useState(
    'Perform full 4-pillar reconnaissance, identify origin candidate IPs, extract Next.js Server Actions, and map high-risk attack surfaces.'
  );

  if (!isOpen) return null;

  // Resolve active knowledge base either from store or from bridge cache
  const activeHost = (targetHost || latestKnowledgeBase?.target.host || 'target.local')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();

  const kb: WebsiteKnowledgeBase | undefined =
    latestKnowledgeBase?.target.host === activeHost
      ? latestKnowledgeBase
      : sentinelAgentBridge.getCachedKnowledgeBase(activeHost) || latestKnowledgeBase || undefined;

  const handleCopyText = (text: string, keyName: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast({
      type: 'success',
      title: 'Copied to Clipboard',
      description: `${label} copied to clipboard`,
    });
  };

  const handleExportJson = () => {
    if (!kb) return;
    const jsonStr = JSON.stringify(kb, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_knowledge_base_${activeHost || 'target'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'Export Complete',
      description: `Saved knowledge base JSON for ${activeHost}`,
    });
  };

  const handleRunCapture = async () => {
    if (!activeHost || activeHost === 'target.local') {
      addToast({
        type: 'warning',
        title: 'Target Required',
        description: 'Please specify an active host or URL to run reconnaissance.',
      });
      return;
    }

    setIsRunningCapture(true);
    setCaptureProgress('Initializing 4-Pillar Reconnaissance Engine...');

    try {
      const targetUrl = activeHost.startsWith('http') ? activeHost : `https://${activeHost}/`;
      const result = await sentinelAgentBridge.captureFullWebsiteKnowledgeBase(targetUrl, {
        enableStealthBrowser: true,
        maxArchiveLimit: 250,
        onProgress: (phase, detail) => {
          setCaptureProgress(`[${phase}] ${detail}`);
        },
      });

      setLatestKnowledgeBase(result);
      addToast({
        type: 'success',
        title: 'Reconnaissance Captured',
        description: `Knowledge Base updated with ${result.allDiscoveredRequests.length} endpoints and ${result.pillar1_infrastructure.subdomains.length} subdomains.`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Capture Interrupted',
        description: err?.message || 'Failed during reconnaissance capture',
      });
    } finally {
      setIsRunningCapture(false);
      setCaptureProgress(null);
    }
  };

  const handleRunAutonomousAgent = async () => {
    if (!activeHost || activeHost === 'target.local') {
      addToast({
        type: 'warning',
        title: 'Target Required',
        description: 'Please specify an active host or URL to run autonomous assessment.',
      });
      return;
    }

    setIsRunningAgent(true);
    setAgentLogs([]);
    setAgentReport(null);
    setAgentProgress({ percent: 0, status: 'Booting autonomous pre-assessment agent...' });

    try {
      const targetUrl = activeHost.startsWith('http') ? activeHost : `https://${activeHost}/`;
      const report = await autonomousPentestAgent.runAssessment({
        targetUrl,
        objective: agentObjective,
        onStep: (step) => {
          setAgentLogs((prev) => [...prev, step]);
        },
        onProgress: (percent, status) => {
          setAgentProgress({ percent, status });
        },
      });

      setAgentReport(report);
      setLatestKnowledgeBase(report.knowledgeBase);
      addToast({
        type: 'success',
        title: 'Autonomous Assessment Complete',
        description: `Agent discovered ${report.keyFindings.length} actionable findings in ${(report.durationMs / 1000).toFixed(1)}s.`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Agent Assessment Interrupted',
        description: err?.message || 'Agent encountered an error during assessment.',
      });
    } finally {
      setIsRunningAgent(false);
      setAgentProgress(null);
    }
  };

  const handleAbortAgent = () => {
    autonomousPentestAgent.abort();
    setIsRunningAgent(false);
    setAgentProgress(null);
    addToast({
      type: 'info',
      title: 'Agent Stopped',
      description: 'Autonomous pre-assessment agent was aborted by user.',
    });
  };

  const agentTools: AgentToolDefinition[] = sentinelAgentBridge.getAgentToolDefinitions();

  const q = searchQuery.toLowerCase().trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold font-mono text-base">
                Sentinel Sovereign Ω — Website Knowledge Base
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                AI Agent Bridge & Recon Dossier
              </span>
            </div>
            <p className="text-xs text-[#9da5b4]">
              Unified pre-assessment intelligence, origin de-cloaking, static AST/SourceMap dredging, and MCP tool registry.
            </p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[78vh] -mx-6 -my-4 text-xs font-sans">
        {/* Top Control & Target Banner */}
        <div className="bg-[#141517] border-b border-[#2b2d30] p-4 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#9da5b4] uppercase font-mono">Target Host</span>
              <span className="text-emerald-400 font-bold font-mono text-sm flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                {activeHost || 'target.local'}
              </span>
            </div>

            {kb && (
              <>
                <div className="h-7 w-px bg-[#2b2d30] mx-1" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#9da5b4] uppercase font-mono">CDN / WAF</span>
                  <span className="font-mono text-xs font-semibold text-amber-300">
                    {kb.target.detectedCdnOrWaf ? (
                      <span className="flex items-center gap-1 text-rose-300">
                        <Shield className="w-3.5 h-3.5 text-rose-400" />
                        {kb.target.detectedCdnOrWaf}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Direct Origin / No CDN Detected
                      </span>
                    )}
                  </span>
                </div>

                {kb.target.detectedSaasEcosystem.length > 0 && (
                  <>
                    <div className="h-7 w-px bg-[#2b2d30] mx-1" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono">SaaS Footprint</span>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {kb.target.detectedSaasEcosystem.slice(0, 4).map((saas) => (
                          <span
                            key={saas}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/60 text-sky-300 border border-sky-600/30 font-mono"
                          >
                            {saas}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              leftIcon={<Download className="w-3.5 h-3.5 text-sky-400" />}
              onClick={handleExportJson}
              disabled={!kb}
            >
              Export JSON
            </Button>

            <Button
              variant="secondary"
              size="xs"
              leftIcon={
                copiedKey === 'kb_json' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                )
              }
              onClick={() => handleCopyText(JSON.stringify(kb, null, 2), 'kb_json', 'Knowledge Base JSON')}
              disabled={!kb}
            >
              Copy Full KB JSON
            </Button>

            <Button
              variant="primary"
              size="xs"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRunningCapture ? 'animate-spin' : ''}`} />}
              onClick={handleRunCapture}
              disabled={isRunningCapture}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              {isRunningCapture ? 'Running Capture...' : 'Capture Full Knowledge Base'}
            </Button>
          </div>
        </div>

        {/* Live Progress Bar during capture */}
        {isRunningCapture && captureProgress && (
          <div className="bg-[#1e222b] px-4 py-2 border-b border-amber-500/30 flex items-center gap-2 text-xs font-mono text-amber-300 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>{captureProgress}</span>
          </div>
        )}

        {/* Tab Navigation & Search Strip */}
        <div className="bg-[#1e1f22] border-b border-[#2b2d30] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'overview', label: '📊 Overview & Stats', count: kb?.allDiscoveredRequests.length },
              {
                id: 'pillar1',
                label: '🌐 1. Infrastructure & Origin',
                count: kb?.pillar1_infrastructure.subdomains.length,
              },
              {
                id: 'pillar2',
                label: '⚡ 2. Static Client Dredging',
                count: kb?.pillar2_staticClientDredging.astExtractedEndpoints.length,
              },
              {
                id: 'pillar3',
                label: '🥷 3. Dynamic Stealth Crawling',
                count: kb?.pillar3_dynamicBrowserCrawl.crawledEndpointsCount,
              },
              {
                id: 'pillar4',
                label: '🕰️ 4. Historical Archives',
                count:
                  (kb?.pillar4_historicalArchives.waybackCount || 0) +
                  (kb?.pillar4_historicalArchives.commonCrawlCount || 0),
              },
              {
                id: 'agent_tools',
                label: '🤖 AI Agent Tools (9)',
                count: agentTools.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-amber-400 text-amber-300 bg-[#252830]'
                    : 'border-transparent text-[#9da5b4] hover:text-white hover:bg-[#252830]/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#141517] text-white border border-[#3e4249]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#141517] rounded border border-[#3e4249] px-2 py-1 my-1 w-64">
            <Search className="w-3.5 h-3.5 text-[#9da5b4] mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter findings..."
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Tab Content Canvas */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#141517]">
          {!kb && !isRunningCapture ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
              <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Bot className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-white font-bold text-sm">No Knowledge Base Captured Yet</h3>
                <p className="text-xs text-[#9da5b4] mt-1">
                  Click the &quot;Capture Full Knowledge Base&quot; button above or run a Stealth Crawl on {activeHost} to
                  populate all 4 reconnaissance pillars and AI Agent intelligence.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleRunCapture}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                Start Pre-Assessment Capture Now
              </Button>
            </div>
          ) : (
            <>
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && kb && (
                <div className="space-y-4">
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">Origin Candidate IPs</span>
                      <span className="text-xl font-bold font-mono text-rose-400">
                        {kb.pillar1_infrastructure.originAnalysis.originCandidateIps.length}
                      </span>
                      <span className="text-[10px] text-[#6f737a] block mt-0.5">Direct IP bypassing CDN</span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono">CT Log Subdomains</span>
                      <span className="text-xl font-bold font-mono text-cyan-400">
                        {kb.pillar1_infrastructure.subdomains.length}
                      </span>
                      <span className="text-[10px] text-[#6f737a] block mt-0.5">crt.sh mined hostnames</span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono">Client AST Endpoints</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        {kb.pillar2_staticClientDredging.astExtractedEndpoints.length}
                      </span>
                      <span className="text-[10px] text-[#6f737a] block mt-0.5">Constant-folded routes</span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono">Historical Archive URLs</span>
                      <span className="text-xl font-bold font-mono text-purple-400">
                        {kb.pillar4_historicalArchives.waybackCount + kb.pillar4_historicalArchives.commonCrawlCount}
                      </span>
                      <span className="text-[10px] text-[#6f737a] block mt-0.5">Wayback & Common Crawl</span>
                    </div>
                  </div>

                  {/* Highlights Summary Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origin & Favicon Card */}
                    <div className="bg-[#1e1f22] p-4 rounded border border-[#2b2d30] space-y-2">
                      <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                          <Server className="w-4 h-4 text-rose-400" />
                          Origin De-cloaking & Favicon Hash
                        </span>
                        {kb.pillar1_infrastructure.originAnalysis.faviconHashMmh3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#141517] text-amber-300 font-mono border border-[#3e4249]">
                            mmh3: {kb.pillar1_infrastructure.originAnalysis.faviconHashMmh3}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {kb.pillar1_infrastructure.originAnalysis.originCandidateIps.length === 0 ? (
                          <p className="text-[#8c9099] italic">No candidate origin IPs discovered yet.</p>
                        ) : (
                          kb.pillar1_infrastructure.originAnalysis.originCandidateIps.map((cand, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-[#141517] border border-[#2b2d30] flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-rose-400">{cand.ip}</span>
                                <span className="text-[10px] text-[#9da5b4] block">{cand.source}</span>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                                {cand.confidence}
                              </span>
                            </div>
                          ))
                        )}

                        {kb.pillar1_infrastructure.originAnalysis.shodanQueries.length > 0 && (
                          <div className="mt-2 p-2 rounded bg-sky-950/40 border border-sky-800/40">
                            <span className="text-[10px] text-sky-400 font-bold block uppercase">Shodan Dork Query</span>
                            <div className="flex items-center justify-between mt-1">
                              <code className="text-[11px] text-sky-200">{kb.pillar1_infrastructure.originAnalysis.shodanQueries[0]}</code>
                              <button
                                onClick={() =>
                                  handleCopyText(
                                    kb.pillar1_infrastructure.originAnalysis.shodanQueries[0] || '',
                                    'shodan_dork',
                                    'Shodan Dork'
                                  )
                                }
                                className="text-sky-300 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Leaked Secrets & Next.js Server Actions Card */}
                    <div className="bg-[#1e1f22] p-4 rounded border border-[#2b2d30] space-y-2">
                      <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                          <Key className="w-4 h-4 text-amber-400" />
                          High-Entropy Secrets & Server Actions
                        </span>
                        <span className="text-[10px] text-[#9da5b4] font-mono">
                          {kb.pillar2_staticClientDredging.discoveredSecrets.length} Secrets /{' '}
                          {kb.pillar2_staticClientDredging.nextServerActions.length} Actions
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs max-h-56 overflow-y-auto">
                        {kb.pillar2_staticClientDredging.discoveredSecrets.length === 0 &&
                        kb.pillar2_staticClientDredging.nextServerActions.length === 0 ? (
                          <p className="text-[#8c9099] italic">No high-entropy secrets or Next.js actions detected.</p>
                        ) : (
                          <>
                            {kb.pillar2_staticClientDredging.discoveredSecrets.slice(0, 4).map((sec, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-[#141517] border border-amber-900/40 flex items-center justify-between"
                              >
                                <div className="truncate mr-2">
                                  <span className="font-bold text-amber-400 block truncate">{sec.type}</span>
                                  <code className="text-[10px] text-[#dfdfdf] truncate block">{sec.value}</code>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-mono whitespace-nowrap">
                                  H(X): {sec.entropy.toFixed(2)}
                                </span>
                              </div>
                            ))}

                            {kb.pillar2_staticClientDredging.nextServerActions.slice(0, 3).map((act, idx) => (
                              <div
                                key={`act-${idx}`}
                                className="p-2 rounded bg-[#141517] border border-cyan-900/40 flex items-center justify-between"
                              >
                                <div className="truncate mr-2">
                                  <span className="text-[10px] text-cyan-400 font-bold block uppercase">
                                    Next.js Server Action
                                  </span>
                                  <code className="text-xs text-white">{act.path}</code>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                                  {act.method}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Pillar 1 - Infrastructure & Origin */}
              {activeTab === 'pillar1' && kb && (
                <div className="space-y-4">
                  {/* Origin Analysis Table */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white font-mono flex items-center gap-1.5">
                        <Server className="w-4 h-4 text-rose-400" />
                        De-cloaked Origin Server Candidates
                      </span>
                    </div>
                    {kb.pillar1_infrastructure.originAnalysis.originCandidateIps.length === 0 ? (
                      <p className="text-xs text-[#8c9099] font-mono italic">No candidate origin IPs isolated.</p>
                    ) : (
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-[#141517] text-[#9da5b4] text-[10px] border-b border-[#2b2d30]">
                          <tr>
                            <th className="p-2">IP Address</th>
                            <th className="p-2">Rationale / Vector</th>
                            <th className="p-2">Confidence</th>
                            <th className="p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b2d30]">
                          {kb.pillar1_infrastructure.originAnalysis.originCandidateIps.map((cand, idx) => (
                            <tr key={idx} className="hover:bg-[#252830]">
                              <td className="p-2 font-bold text-rose-400">{cand.ip}</td>
                              <td className="p-2 text-[#dfdfdf]">{cand.source}</td>
                              <td className="p-2">
                                <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px]">
                                  {cand.confidence}
                                </span>
                              </td>
                              <td className="p-2">
                                <button
                                  onClick={() => handleCopyText(cand.ip, `cand_${idx}`, 'Origin IP')}
                                  className="text-sky-400 hover:text-white"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* CT Subdomains & Dangling CNAMEs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CT Subdomains */}
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white font-mono flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-cyan-400" />
                          Certificate Transparency Subdomains ({kb.pillar1_infrastructure.subdomains.length})
                        </span>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
                        {kb.pillar1_infrastructure.subdomains
                          .filter((s) => !q || s.hostname.toLowerCase().includes(q))
                          .map((sub, idx) => (
                            <div
                              key={idx}
                              className="p-1.5 rounded bg-[#141517] hover:bg-[#252830] flex items-center justify-between border border-[#2b2d30]"
                            >
                              <div>
                                <span className="text-cyan-300 font-semibold block">{sub.hostname}</span>
                                <span className="text-[9px] text-[#6f737a]">{sub.source} • {sub.category}</span>
                              </div>
                              <button
                                onClick={() => handleCopyText(sub.hostname, `sub_${idx}`, 'Subdomain')}
                                className="text-[#8c9099] hover:text-white"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Cloud Storage Buckets & Dangling CNAMEs */}
                    <div className="space-y-4">
                      {/* Cloud Buckets */}
                      <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                        <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                          <Database className="w-4 h-4 text-amber-400" />
                          Cloud Storage Buckets ({kb.pillar1_infrastructure.cloudBuckets.length})
                        </span>
                        <div className="space-y-1 font-mono text-xs max-h-32 overflow-y-auto">
                          {kb.pillar1_infrastructure.cloudBuckets.length === 0 ? (
                            <p className="text-xs text-[#8c9099] italic">No public buckets identified.</p>
                          ) : (
                            kb.pillar1_infrastructure.cloudBuckets.map((b, idx) => (
                              <div
                                key={idx}
                                className="p-1.5 rounded bg-[#141517] border border-[#2b2d30] flex items-center justify-between"
                              >
                                <div>
                                  <span className="text-amber-300 font-bold block">{b.bucketName}</span>
                                  <span className="text-[10px] text-[#8c9099] uppercase">{b.provider}</span>
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    b.accessStatus.includes('PUBLIC') ? 'bg-rose-950 text-rose-300' : 'bg-sky-950 text-sky-300'
                                  }`}
                                >
                                  {b.accessStatus}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Dangling CNAME Takeovers */}
                      <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                        <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          Subdomain Takeover Suspects ({kb.pillar1_infrastructure.subdomains.filter((s) => Boolean(s.potentialTakeoverProvider)).length})
                        </span>
                        <div className="space-y-1 font-mono text-xs max-h-32 overflow-y-auto">
                          {kb.pillar1_infrastructure.subdomains.filter((s) => Boolean(s.potentialTakeoverProvider)).length === 0 ? (
                            <p className="text-xs text-emerald-400 italic">No dangling CNAME records detected.</p>
                          ) : (
                            kb.pillar1_infrastructure.subdomains.filter((s) => Boolean(s.potentialTakeoverProvider)).map((d, idx) => (
                              <div key={idx} className="p-2 rounded bg-rose-950/30 border border-rose-800 text-rose-300">
                                <span className="font-bold block">{d.hostname}</span>
                                <span className="text-[10px] text-rose-200">
                                  Points to: {d.cnameTarget || 'unresolved'} ({d.potentialTakeoverProvider})
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Pillar 2 - Static Client Dredging */}
              {activeTab === 'pillar2' && kb && (
                <div className="space-y-4">
                  {/* AST Extracted Endpoints */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white font-mono flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-emerald-400" />
                        Constant-Folded AST Endpoints & API Routes ({kb.pillar2_staticClientDredging.astExtractedEndpoints.length})
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                      {kb.pillar2_staticClientDredging.astExtractedEndpoints
                        .filter((ep) => !q || ep.path.toLowerCase().includes(q))
                        .map((ep, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-[#141517] border border-[#2b2d30] flex items-center justify-between hover:bg-[#252830]"
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              <span className="text-[10px] font-bold text-emerald-400">{ep.method}</span>
                              <span className="text-white font-bold truncate">{ep.path}</span>
                              {ep.sourceScript && (
                                <span className="text-[9px] text-[#6f737a] truncate">({ep.sourceScript})</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleCopyText(ep.path, `ep_${idx}`, 'Endpoint Path')}
                              className="text-[#8c9099] hover:text-white"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Unpacked Source Maps & Zod Schemas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Unpacked Source Maps */}
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                        <FileCode className="w-4 h-4 text-purple-400" />
                        Unpacked JavaScript Source Maps ({kb.pillar2_staticClientDredging.unpackedSourceMaps.length})
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
                        {kb.pillar2_staticClientDredging.unpackedSourceMaps.length === 0 ? (
                          <p className="text-xs text-[#8c9099] italic">No active .map files discovered.</p>
                        ) : (
                          kb.pillar2_staticClientDredging.unpackedSourceMaps.map((sm, idx) => (
                            <div key={idx} className="p-2 rounded bg-[#141517] border border-[#2b2d30]">
                              <span className="text-purple-300 font-bold block truncate">{sm.sourceMapUrl}</span>
                              <span className="text-[10px] text-[#8c9099]">
                                Recovered {sm.sourceFilesCount} original source files
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Schemas */}
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        Client-Side Request Schemas & Zod Types ({kb.pillar2_staticClientDredging.extractedRequestSchemas.length})
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
                        {kb.pillar2_staticClientDredging.extractedRequestSchemas.length === 0 ? (
                          <p className="text-xs text-[#8c9099] italic">No schema definitions extracted.</p>
                        ) : (
                          kb.pillar2_staticClientDredging.extractedRequestSchemas.map((sch, idx) => (
                            <div key={idx} className="p-2 rounded bg-[#141517] border border-[#2b2d30]">
                              <span className="text-sky-300 font-bold block">{sch.name}</span>
                              <span className="text-[10px] text-[#9da5b4]">Fields: {sch.fields.join(', ')}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Pillar 3 - Dynamic Stealth Crawling */}
              {activeTab === 'pillar3' && kb && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">CDP Stealth Engine</span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          kb.pillar3_dynamicBrowserCrawl.cdpConnected ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {kb.pillar3_dynamicBrowserCrawl.cdpConnected ? 'CONNECTED' : 'STANDBY'}
                      </span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">Router Routes Discovered</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {kb.pillar3_dynamicBrowserCrawl.routerRoutes.length}
                      </span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">DOM Forms Extracted</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {kb.pillar3_dynamicBrowserCrawl.domForms.length}
                      </span>
                    </div>
                  </div>

                  {/* IndexedDB & Storage Items */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                      <Database className="w-4 h-4 text-purple-400" />
                      Dredged IndexedDB & Offline Storage Items ({kb.pillar3_dynamicBrowserCrawl.offlineStorageAndIndexedDb.length})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-xs">
                      {kb.pillar3_dynamicBrowserCrawl.offlineStorageAndIndexedDb.length === 0 ? (
                        <p className="text-xs text-[#8c9099] italic">No local offline database records dredged.</p>
                      ) : (
                        kb.pillar3_dynamicBrowserCrawl.offlineStorageAndIndexedDb.map((st, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-[#141517] border border-[#2b2d30] flex items-center justify-between"
                          >
                            <div>
                              <span className="text-purple-300 font-bold block truncate max-w-xs">{st.url}</span>
                              <span className="text-[10px] text-[#8c9099]">Source: {st.source}</span>
                            </div>
                            {st.title && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#dfdfdf] max-w-xs truncate">
                                {st.title}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Pillar 4 - Historical Archives */}
              {activeTab === 'pillar4' && kb && (
                <div className="space-y-4">
                  {/* Historical Source Counts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">Wayback Machine</span>
                      <span className="text-xl font-bold font-mono text-white">
                        {kb.pillar4_historicalArchives.waybackCount}
                      </span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">Common Crawl NDJSON</span>
                      <span className="text-xl font-bold font-mono text-white">
                        {kb.pillar4_historicalArchives.commonCrawlCount}
                      </span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">AlienVault OTX</span>
                      <span className="text-xl font-bold font-mono text-white">
                        {kb.pillar4_historicalArchives.alienVaultCount}
                      </span>
                    </div>

                    <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                      <span className="text-[10px] text-[#9da5b4] uppercase font-mono block">URLScan.io</span>
                      <span className="text-xl font-bold font-mono text-white">
                        {kb.pillar4_historicalArchives.urlScanCount}
                      </span>
                    </div>
                  </div>

                  {/* Extrapolated Legacy API Endpoints */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                      <History className="w-4 h-4 text-purple-400" />
                      Extrapolated Legacy API Versions (/api/v1, /api/beta) ({kb.pillar4_historicalArchives.legacyApiExtrapolations.length})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-xs">
                      {kb.pillar4_historicalArchives.legacyApiExtrapolations.length === 0 ? (
                        <p className="text-xs text-[#8c9099] italic">No versioned API routes extrapolated.</p>
                      ) : (
                        kb.pillar4_historicalArchives.legacyApiExtrapolations.map((leg, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-[#141517] border border-[#2b2d30] flex items-center justify-between"
                          >
                            <span className="text-purple-300 font-bold">{leg}</span>
                            <button
                              onClick={() => handleCopyText(leg, `leg_${idx}`, 'Legacy API')}
                              className="text-[#8c9099] hover:text-white"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Discovered API Specifications & Swagger/OpenAPI Specs */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                      <Code className="w-4 h-4 text-emerald-400" />
                      Discovered API Specifications & Docs ({kb.pillar4_historicalArchives.apiDocs?.length || 0})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs">
                      {(!kb.pillar4_historicalArchives.apiDocs || kb.pillar4_historicalArchives.apiDocs.length === 0) ? (
                        <p className="text-xs text-[#8c9099] italic">No public Swagger or OpenAPI specifications discovered.</p>
                      ) : (
                        kb.pillar4_historicalArchives.apiDocs.map((doc, idx) => (
                          <div key={idx} className="p-2 rounded bg-[#141517] border border-[#2b2d30] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-400 font-bold">{doc.title || doc.url}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                                {doc.type} {doc.version && `v${doc.version}`}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#9da5b4] block truncate">{doc.url}</span>
                            {doc.endpoints.length > 0 && (
                              <span className="text-[10px] text-purple-300 block">
                                {doc.endpoints.length} routes parsed and mapped to SiteMap
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* GraphQL Endpoints & Introspection */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30]">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5 mb-2">
                      <Layers className="w-4 h-4 text-pink-400" />
                      GraphQL Endpoints & Schema Introspection ({kb.pillar4_historicalArchives.graphqlIntrospection?.length || 0})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs">
                      {(!kb.pillar4_historicalArchives.graphqlIntrospection || kb.pillar4_historicalArchives.graphqlIntrospection.length === 0) ? (
                        <p className="text-xs text-[#8c9099] italic">No GraphQL endpoints or introspection enabled.</p>
                      ) : (
                        kb.pillar4_historicalArchives.graphqlIntrospection.map((gql, idx) => (
                          <div key={idx} className="p-2 rounded bg-[#141517] border border-[#2b2d30] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-pink-300 font-bold truncate max-w-sm">{gql.endpointUrl}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  gql.isIntrospectionEnabled ? 'bg-rose-500 text-white' : 'bg-[#2b2d30] text-[#9da5b4]'
                                }`}
                              >
                                {gql.isIntrospectionEnabled ? 'INTROSPECTION ENABLED' : 'CLOSED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#dfdfdf]">
                              Schema: {gql.typesCount} types, {gql.sampleQueries.length} queries, {gql.sampleMutations.length} mutations.
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Exposed Debug & Diagnostic Findings */}
                  <div className="bg-[#1e1f22] p-3 rounded border border-rose-500/30">
                    <span className="font-bold text-rose-400 font-mono flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Exposed Debug, Actuator & Configuration Endpoints ({kb.pillar4_historicalArchives.exposedDebugFindings?.length || 0})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs">
                      {(!kb.pillar4_historicalArchives.exposedDebugFindings || kb.pillar4_historicalArchives.exposedDebugFindings.length === 0) ? (
                        <p className="text-xs text-[#8c9099] italic">No sensitive debug or actuator endpoints detected.</p>
                      ) : (
                        kb.pillar4_historicalArchives.exposedDebugFindings.map((dbg, idx) => (
                          <div key={idx} className="p-2.5 rounded bg-[#141517] border border-rose-500/20 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    dbg.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                                  }`}
                                >
                                  {dbg.severity}
                                </span>
                                <span className="text-white font-bold">{dbg.title}</span>
                              </div>
                              <span className="text-[10px] text-[#8c9099]">{dbg.category}</span>
                            </div>
                            <span className="text-[11px] text-purple-300 block truncate">{dbg.url}</span>
                            <p className="text-[11px] text-[#dfdfdf]">{dbg.description}</p>
                            <div className="bg-[#1e1f22] p-1.5 rounded text-[10px] text-rose-300 flex items-center justify-between">
                              <span>Strategy: {dbg.exploitStrategy}</span>
                              <button
                                onClick={() => handleCopyText(dbg.exploitStrategy, `dbg_${idx}`, 'Exploit Strategy')}
                                className="text-[#8c9099] hover:text-white"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: AI Agent Tools & Autonomous Pentest Runner */}
              {activeTab === 'agent_tools' && (
                <div className="space-y-4">
                  {/* Autonomous Pre-Assessment Runner Panel */}
                  <div className="bg-[#1e1f22] p-4 rounded-lg border border-purple-500/40 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <div>
                          <span className="font-bold text-white text-sm font-mono flex items-center gap-2">
                            Autonomous Pre-Assessment Agent
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-purple-300">
                              ReAct Heuristic Loop
                            </span>
                          </span>
                          <p className="text-xs text-[#9da5b4]">
                            Orchestrates all 4 pillars, de-cloaks origins, maps AST routes, and correlates offensive attack vectors.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isRunningAgent ? (
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
                            onClick={handleAbortAgent}
                          >
                            Stop Agent
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                            onClick={handleRunAutonomousAgent}
                          >
                            Launch Assessment
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Objective Input */}
                    <div className="flex items-center gap-2 bg-[#141517] p-2 rounded border border-[#2b2d30]">
                      <Crosshair className="w-4 h-4 text-purple-400 shrink-0" />
                      <input
                        type="text"
                        value={agentObjective}
                        onChange={(e) => setAgentObjective(e.target.value)}
                        placeholder="Define agent reconnaissance objective..."
                        className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                        disabled={isRunningAgent}
                      />
                    </div>

                    {/* Live Progress Bar when Running */}
                    {isRunningAgent && agentProgress && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-purple-300 animate-pulse">{agentProgress.status}</span>
                          <span className="text-[#8c9099] font-bold">{agentProgress.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#141517] rounded-full overflow-hidden border border-[#2b2d30]">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${agentProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Live Agent Step Trace Feed */}
                    {agentLogs.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#2b2d30]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-purple-400" />
                            Agent ReAct Trace Feed ({agentLogs.length} steps)
                          </span>
                          <span className="text-[10px] text-[#8c9099] font-mono">
                            {isRunningAgent ? 'Agent actively reasoning & harvesting...' : 'Sequence completed'}
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                          {agentLogs.map((log, idx) => {
                            const isExpanded = expandedLogIndex === idx;
                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded border transition-colors ${
                                  log.type === 'finding'
                                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                                    : log.type === 'action'
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                                    : log.type === 'summary'
                                    ? 'bg-sky-950/20 border-sky-500/30 text-sky-200'
                                    : 'bg-[#141517] border-[#2b2d30] text-[#dfdfdf]'
                                }`}
                              >
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => setExpandedLogIndex(isExpanded ? null : idx)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                                        log.type === 'finding'
                                          ? 'bg-rose-500/20 text-rose-400'
                                          : log.type === 'action'
                                          ? 'bg-amber-500/20 text-amber-400'
                                          : log.type === 'summary'
                                          ? 'bg-sky-500/20 text-sky-400'
                                          : 'bg-purple-500/20 text-purple-300'
                                      }`}
                                    >
                                      Step {log.step} • {log.type}
                                    </span>
                                    {log.toolName && (
                                      <span className="text-[10px] text-amber-300 font-bold bg-[#1e1f22] px-1 rounded">
                                        {log.toolName}
                                      </span>
                                    )}
                                  </div>
                                  {(log.toolArgs || log.content.length > 80) && (
                                    <span className="text-[#8c9099] text-[10px]">
                                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </span>
                                  )}
                                </div>

                                <p className={`mt-1 text-xs ${!isExpanded && 'truncate'}`}>{log.content}</p>

                                {isExpanded && log.toolArgs && (
                                  <div className="mt-2 p-2 bg-[#0d0e10] rounded text-[10px] text-emerald-300 overflow-x-auto">
                                    <span className="text-[9px] text-[#8c9099] block uppercase mb-1">Tool Arguments:</span>
                                    <pre>{JSON.stringify(log.toolArgs, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Agent Key Findings & Exploit Recommendations */}
                    {agentReport && agentReport.keyFindings.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#2b2d30]">
                        <span className="text-xs font-bold text-rose-400 font-mono flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Key Offensive Vectors & Exploit Strategies ({agentReport.keyFindings.length})
                        </span>

                        <div className="space-y-2">
                          {agentReport.keyFindings.map((finding, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded bg-[#141517] border border-rose-500/30 space-y-1.5 font-mono text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                      finding.severity === 'CRITICAL'
                                        ? 'bg-rose-500 text-white'
                                        : finding.severity === 'HIGH'
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-yellow-500/20 text-yellow-300'
                                    }`}
                                  >
                                    {finding.severity}
                                  </span>
                                  <span className="text-white font-bold">{finding.title}</span>
                                </div>
                                <span className="text-[10px] text-[#8c9099]">{finding.category}</span>
                              </div>
                              <p className="text-xs text-[#dfdfdf]">{finding.description}</p>
                              <div className="bg-[#1e1f22] p-2 rounded border border-[#2b2d30] flex items-center justify-between">
                                <div className="pr-2">
                                  <span className="text-[10px] text-rose-300 font-bold block uppercase">
                                    Exploit Strategy:
                                  </span>
                                  <span className="text-[11px] text-[#dfdfdf]">{finding.exploitStrategy}</span>
                                </div>
                                <button
                                  onClick={() =>
                                    handleCopyText(finding.exploitStrategy, `exploit_${idx}`, 'Exploit Strategy')
                                  }
                                  className="text-[#8c9099] hover:text-white p-1"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Executive Summary Report Box */}
                        <div className="bg-[#141517] p-3 rounded border border-purple-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-300 font-mono">
                              Autonomous Executive Pre-Assessment Report
                            </span>
                            <button
                              onClick={() =>
                                handleCopyText(agentReport.executiveSummary, 'exec_report', 'Executive Report')
                              }
                              className="text-[#8c9099] hover:text-white flex items-center gap-1 text-[10px] font-mono"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Markdown</span>
                            </button>
                          </div>
                          <pre className="text-xs text-[#dfdfdf] whitespace-pre-wrap font-mono max-h-48 overflow-y-auto p-2 bg-[#0d0e10] rounded border border-[#2b2d30]">
                            {agentReport.executiveSummary}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#1e1f22] p-3 rounded border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white font-mono flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-amber-400" />
                        AI Agent Function Calling & MCP Tool Registry
                      </span>
                      <p className="text-xs text-[#9da5b4] mt-0.5">
                        These {agentTools.length} tool schemas can be fed directly to Claude Desktop, Cursor, OpenAI, Anthropic, or local LLM agents over MCP to execute reconnaissance and pentesting without writing repetitive code.
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      size="xs"
                      leftIcon={
                        copiedKey === 'tools_json' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                        )
                      }
                      onClick={() =>
                        handleCopyText(JSON.stringify(agentTools, null, 2), 'tools_json', 'Agent Tool Definitions')
                      }
                    >
                      Copy All Tool Definitions
                    </Button>
                  </div>

                  {/* Tool List */}
                  <div className="space-y-2">
                    {agentTools.map((tool, idx) => (
                      <div key={idx} className="bg-[#1e1f22] p-3 rounded border border-[#2b2d30] space-y-2 font-mono">
                        <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
                          <span className="font-bold text-amber-400 text-xs">{tool.name}</span>
                          <button
                            onClick={() =>
                              handleCopyText(JSON.stringify(tool, null, 2), `tool_${idx}`, `${tool.name} Schema`)
                            }
                            className="text-[#8c9099] hover:text-white flex items-center gap-1 text-[10px]"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Schema</span>
                          </button>
                        </div>
                        <p className="text-xs text-[#dfdfdf]">{tool.description}</p>
                        <div className="bg-[#141517] p-2 rounded border border-[#2b2d30] text-[11px]">
                          <span className="text-[10px] text-[#8c9099] block uppercase">Parameters:</span>
                          <pre className="text-emerald-300 mt-1 whitespace-pre-wrap">
                            {JSON.stringify(tool.parameters.properties, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
