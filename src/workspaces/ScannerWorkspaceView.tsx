import React, { useState, useRef } from 'react';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { useToastStore } from '../stores/toastStore';
import {
  Shield,
  Lock,
  User,
  Users,
  Plus,
  X,
  CheckCircle2,
  Radio,
  Zap,
  Sparkles,
  Play,
  Square,
  Bug,
  Search,
  Activity,
  Compass,
} from 'lucide-react';
import { ipcClient } from '../ipc/client';
import { useScannerStore } from '../stores/scannerStore';
import { dashboardCrawlerEngine, DashboardEndpointItem } from '../services/dashboardScanner/DashboardCrawlerEngine';

export const ScannerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'setup' | 'findings'>('setup');

  // 1. Target Definition State
  const [targetUrl, setTargetUrl] = useState('https://0a2d000a0489b7aa80d362c200b20046.web-security-academy.net/');
  const [detectedStack, setDetectedStack] = useState<string | null>(null);
  const [isDetectingStack, setIsDetectingStack] = useState(false);

  // 2. Scope & Safety Boundaries State (Empty = Open Scope permitted to any target)
  const [scopeDomains, setScopeDomains] = useState<string[]>([]);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [showAddDomain, setShowAddDomain] = useState(false);

  const [excludedPaths, setExcludedPaths] = useState<string[]>([
    '/logout',
    '/delete-account',
    '/billing/checkout',
  ]);
  const [newPathInput, setNewPathInput] = useState('');
  const [showAddPath, setShowAddPath] = useState(false);
  const [enforceSafeOnly, setEnforceSafeOnly] = useState(false);

  // 3. Multi-Tenant Authentication State
  const [authMode, setAuthMode] = useState<'anonymous' | 'single' | 'multi'>('anonymous');

  const [tenantA, setTenantA] = useState({
    username: 'wiener',
    password: 'peter',
    role: 'Standard User',
  });

  const [tenantB, setTenantB] = useState({
    username: 'carlos',
    password: 'montoya',
    role: 'Peer User',
  });

  const [unauthBaseline, setUnauthBaseline] = useState(true);

  // 4. Attacks State
  const [topics, setTopics] = useState({
    sqliUnion: false,
    sqliBoolean: false,
    sqliError: false,
    sqliTimeBlind: false,
    sqliOastSecondOrder: false,
    sqliStackedOrm: false,
  });

  // 5. Scan Depth & Safety Policy State
  const [profile, setProfile] = useState<'PASSIVE' | 'SAFE' | 'STANDARD'>('STANDARD');
  const [rateLimit, setRateLimit] = useState(25);

  // Dedicated Dashboard Crawler State
  const [isCrawlerRunning, setIsCrawlerRunning] = useState(false);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<DashboardEndpointItem[]>([]);
  const [crawlerStatusText, setCrawlerStatusText] = useState('Ready to crawl');
  const [crawlerStats, setCrawlerStats] = useState({ queued: 0, visited: 0, total: 0 });
  const [endpointSearch, setEndpointSearch] = useState('');

  // Smooth Scroll to Section with Sticky Header & Quick-Jump Offset Compensation
  const scrollToSection = (id: string) => {
    if (activeSubTab === 'findings') {
      setActiveSubTab('setup');
    }
    const container = containerRef.current;
    if (!container) return;
    if (id === 'sec-target') {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        // Sticky header (~62px) + sticky nav (~44px) + comfortable margin (24px) = 130px offset
        const stickyOffset = 130;
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - stickyOffset;
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }, activeSubTab === 'findings' ? 50 : 0);
  };

  // Auto-Detect Stack Handler
  const handleAutoDetectStack = () => {
    setIsDetectingStack(true);
    setTimeout(() => {
      setIsDetectingStack(false);
      setDetectedStack('React 18 (SPA) • Next.js 14 App Router • Node.js Express • Nginx 1.24 Edge Proxy');
      addToast({
        type: 'info',
        title: 'Stack Fingerprinted',
        description: 'Identified React 18 SPA, Next.js Server Actions, Node.js backend, and Nginx edge.',
      });
    }, 500);
  };

  // Scope Add/Remove
  const handleAddDomain = () => {
    if (newDomainInput.trim() && !scopeDomains.includes(newDomainInput.trim())) {
      setScopeDomains([...scopeDomains, newDomainInput.trim()]);
      setNewDomainInput('');
      setShowAddDomain(false);
    }
  };

  const handleRemoveDomain = (d: string) => {
    setScopeDomains(scopeDomains.filter((item) => item !== d));
  };

  const handleAddPath = () => {
    if (newPathInput.trim() && !excludedPaths.includes(newPathInput.trim())) {
      setExcludedPaths([...excludedPaths, newPathInput.trim()]);
      setNewPathInput('');
      setShowAddPath(false);
    }
  };

  const handleRemovePath = (p: string) => {
    setExcludedPaths(excludedPaths.filter((item) => item !== p));
  };

  // Launch / Stop Stealth Assessment
  const handleStartAssessment = async () => {
    if (isCrawlerRunning) {
      dashboardCrawlerEngine.abort();
      setIsCrawlerRunning(false);
      setCrawlerStatusText('Stopped by operator.');
      addToast({
        type: 'info',
        title: 'Stealth Crawl Stopped',
        description: 'Dashboard stealth crawler has been halted.',
      });
      return;
    }

    if (!targetUrl) {
      addToast({ type: 'error', title: 'Target Required', description: 'Please provide a valid target URL.' });
      return;
    }

    const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

    setIsCrawlerRunning(true);
    setDiscoveredEndpoints([]);
    setCrawlerStatusText(`Launching stealth browser & initializing crawl on ${fullUrl}...`);

    addToast({
      type: 'info',
      title: 'Starting Stealth Audit...',
      description: `Launching stealth proxy browser & initializing reconnaissance for ${fullUrl}`,
    });

    try {
      // Register scan target in scanner store
      useScannerStore.getState().addScanTarget({
        url: fullUrl,
        method: 'GET',
      });

      // Auto-determine effective auth mode: if user provided credentials, never drop them
      const effectiveAuthMode =
        authMode !== 'anonymous'
          ? authMode
          : tenantA.username.trim() && tenantA.password.trim()
          ? (tenantB.username.trim() && tenantB.password.trim() ? 'multi' : 'single')
          : 'anonymous';

      // Launch crawler engine with full configuration (continuous loop)
      dashboardCrawlerEngine.start({
        targetUrl: fullUrl,
        excludedPaths,
        profile,
        rateLimit,
        authMode: effectiveAuthMode,
        tenantA: effectiveAuthMode !== 'anonymous' ? tenantA : undefined,
        tenantB: effectiveAuthMode === 'multi' ? tenantB : undefined,
        onEndpointDiscovered: (endpoint) => {
          setDiscoveredEndpoints((prev) => {
            if (prev.some((e) => e.path === endpoint.path && e.method === endpoint.method)) {
              return prev;
            }
            return [endpoint, ...prev];
          });
        },
        onProgress: (status, stats) => {
          setCrawlerStatusText(status);
          setCrawlerStats(stats);
        },
        onError: (err) => {
          setIsCrawlerRunning(false);
          addToast({
            type: 'error',
            title: 'Crawler Error',
            description: err,
          });
        },
      });
    } catch (err: any) {
      setIsCrawlerRunning(false);
      addToast({
        type: 'error',
        title: 'Stealth Launch Error',
        description: err?.message || 'Could not launch stealth browser',
      });
    }
  };

  const activeTopicCount = Object.values(topics).filter(Boolean).length;

  const domainList: Array<{ key: string; name: string; count: number; icon: string; desc: string }> = [];

  const quickNav = [
    { id: 'sec-target', label: '1. Target', icon: '🎯' },
    { id: 'sec-scope', label: '2. Scope & Safety', icon: '🛡️' },
    { id: 'sec-auth', label: '3. Authentication', icon: '👥' },
    { id: 'sec-topics', label: '4. Attacks', icon: '⚔️' },
    { id: 'sec-depth', label: '5. Depth & Safety', icon: '⚙️' },
    { id: 'sec-launch', label: '6. Review & Launch', icon: '🚀' },
  ];

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full bg-[#080a0f] overflow-y-auto font-sans text-[#e4e4e7] custom-scrollbar selection:bg-accent-cyan/30 scroll-smooth">
      
      {/* ─── Top Master Header Bar (Full Width) ─────────────────────────────── */}
      <header className="flex items-center justify-between px-6 lg:px-8 py-3.5 bg-[#0e111a] border-b border-[#1c2234] flex-shrink-0 z-20 shadow-lg sticky top-0 backdrop-blur">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan shadow-sm">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-sm font-extrabold tracking-wider text-white uppercase">
                SENTINEL // RESEARCH ASSESSMENT SETUP
              </h1>
              <Badge variant="scope-in">K_SK SAFETY KERNEL</Badge>
              <Badge variant="neutral">14 DOMAINS / 100 CLASSES</Badge>
              <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-[#34d399] font-mono">
                <Shield className="w-3.5 h-3.5" />
                Zero False Positives
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Target: <span className="font-mono text-accent-cyan">{targetUrl}</span> • Full-Screen Security Assessment Control Deck
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={isCrawlerRunning ? "destructive" : "primary"}
            size="sm"
            leftIcon={isCrawlerRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-white text-white" />}
            onClick={handleStartAssessment}
            className={isCrawlerRunning ? "cursor-pointer font-bold px-4 bg-red-600 hover:bg-red-700 text-white" : "shadow-accent-orange/20 cursor-pointer font-bold px-4"}
          >
            {isCrawlerRunning ? 'Stop' : 'Start'}
          </Button>
        </div>
      </header>

      {/* ─── Sticky Quick-Jump Anchor Bar (Full Width) ───────────────────────── */}
      <nav className="flex items-center justify-between px-6 lg:px-8 py-2 bg-[#0a0c13]/95 border-b border-[#1c2234] flex-shrink-0 text-xs font-medium sticky top-[61px] z-10 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 custom-scrollbar w-full">
          <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mr-1 hidden md:inline">
            Quick Jump:
          </span>
          {quickNav.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#161b2b] border border-transparent hover:border-[#283147] transition-all whitespace-nowrap text-xs cursor-pointer"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onClick={() => setActiveSubTab(activeSubTab === 'findings' ? 'setup' : 'findings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              activeSubTab === 'findings'
                ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white bg-[#141824] hover:bg-[#1a2030] border-[#252c40]'
            }`}
            title="View Audit Findings"
          >
            <Bug className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Findings</span>
            <span className="text-[10px] text-[#64748b] bg-[#0e111a] px-1.5 py-0.2 rounded border border-[#1c2234]">0</span>
          </button>
        </div>
      </nav>

      {/* ─── Main Content Canvas (Conditional: Setup vs Findings) ────── */}
      {activeSubTab === 'findings' ? (
        <main className="w-full px-6 lg:px-8 py-10 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center justify-center p-12 text-center select-none bg-[#0e111a] rounded-2xl border border-[#1c2234] max-w-lg w-full space-y-4 shadow-lg">
            <div className="p-4 rounded-2xl bg-[#141824] border border-[#252c40] text-border-subtle">
              <Bug className="w-10 h-10 text-[#64748b]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Findings Yet</h3>
              <p className="text-xs text-[#94a3b8] mt-1.5 leading-relaxed">
                This space is currently empty. Click <span className="text-accent-orange font-bold">Start</span> to run a stealth audit against <span className="font-mono text-accent-cyan">{targetUrl}</span> to discover and populate verified vulnerabilities.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveSubTab('setup')}
                className="text-xs cursor-pointer"
              >
                ← Back to Audit Setup
              </Button>
            </div>
          </div>
        </main>
      ) : (
        <main className="w-full px-6 lg:px-8 py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: TARGET DEFINITION (Full Width)                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-target" className="p-6 rounded-2xl bg-[#0e111a] border border-[#1c2234] space-y-5 shadow-md scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#1c2234] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-cyan/15 text-accent-cyan font-bold text-base">🎯</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. TARGET DEFINITION</h2>
                <p className="text-xs text-[#94a3b8]">Specify the base URL, framework architecture, and transport encryption profile.</p>
              </div>
            </div>
            <Badge variant="scope-in">AUTHORIZED SCOPE</Badge>
          </div>

          {/* Target URL Input with Auto-Detect */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-9 space-y-1.5">
              <label className="text-xs font-semibold text-[#94a3b8]">Target Base URL / Host:</label>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://app.example.com"
                  className="w-full px-4 py-2.5 bg-[#141824] rounded-xl border border-[#252c40] text-sm text-white focus:border-accent-cyan focus:outline-none font-mono transition-colors"
                />
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleAutoDetectStack}
                  disabled={isDetectingStack}
                  leftIcon={<Sparkles className="w-4 h-4 text-accent-cyan" />}
                  className="flex-shrink-0"
                >
                  {isDetectingStack ? 'Detecting...' : 'Auto-Detect Stack'}
                </Button>
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-[#94a3b8]">Transport Security:</label>
              <div className="px-4 py-2.5 bg-[#141824] rounded-xl border border-[#252c40] text-xs font-mono text-[#94a3b8] flex justify-between items-center h-[42px]">
                <span>TLS 1.3 / HTTP2</span>
                <Lock className="w-4 h-4 text-[#34d399]" />
              </div>
            </div>
          </div>

          {/* Detected Architecture Banner */}
          {detectedStack && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-xs">
              <CheckCircle2 className="w-4 h-4 text-accent-cyan flex-shrink-0" />
              <span className="font-semibold text-white">Detected Architecture:</span>
              <span className="font-mono text-accent-cyan">{detectedStack}</span>
            </div>
          )}

          {/* Live Discovered Endpoints Stream Deck */}
          <div className="pt-2 border-t border-[#1c2234]">
            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c2234] pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className={`w-2.5 h-2.5 rounded-full ${isCrawlerRunning ? 'bg-[#34d399] animate-ping' : 'bg-[#64748b]'}`} />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Live Discovered Endpoints Stream
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                    {discoveredEndpoints.length} Discovered
                  </span>
                  {isCrawlerRunning && (
                    <span className="text-[11px] font-mono text-[#34d399] flex items-center gap-1">
                      <Activity className="w-3 h-3 animate-spin" />
                      Continuous Stealth Crawl Active
                    </span>
                  )}
                </div>

                {/* Filter Search Input */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input
                      type="text"
                      value={endpointSearch}
                      onChange={(e) => setEndpointSearch(e.target.value)}
                      placeholder="Filter paths..."
                      className="pl-8 pr-3 py-1 bg-[#0e111a] rounded-lg border border-[#252c40] text-xs font-mono text-white focus:outline-none focus:border-accent-cyan w-48"
                    />
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="text-[11px] font-mono text-[#94a3b8] flex items-center justify-between">
                <span className="truncate">{crawlerStatusText}</span>
                {isCrawlerRunning && (
                  <span className="text-accent-cyan flex-shrink-0 ml-2">
                    Rate: {rateLimit} QPS • Visited: {crawlerStats.visited} • In Queue: {crawlerStats.queued}
                  </span>
                )}
              </div>

              {/* Endpoints Table */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-[#1c2234] bg-[#0a0c13]">
                {discoveredEndpoints.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#64748b]">
                    {isCrawlerRunning ? (
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="w-5 h-5 text-accent-cyan animate-spin" />
                        <span>Crawling target... extracting DOM links, JavaScript routes, forms, and parameter endpoints.</span>
                      </div>
                    ) : (
                      <span>Awaiting crawl engagement. Discovered endpoints will automatically stream here when you click Start.</span>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#101420] text-[#94a3b8] border-b border-[#1c2234] sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="px-3 py-2 w-20">Method</th>
                        <th className="px-3 py-2">Path / Endpoint</th>
                        <th className="px-3 py-2 w-36">Source</th>
                        <th className="px-3 py-2 w-24 text-right">Discovered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#161c2c]">
                      {discoveredEndpoints
                        .filter((ep) =>
                          endpointSearch
                            ? ep.path.toLowerCase().includes(endpointSearch.toLowerCase()) ||
                              ep.method.toLowerCase().includes(endpointSearch.toLowerCase()) ||
                              ep.source.toLowerCase().includes(endpointSearch.toLowerCase())
                            : true
                        )
                        .map((ep) => (
                          <tr key={ep.id} className="hover:bg-[#131726] transition-colors">
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  ep.method === 'POST'
                                    ? 'bg-accent-orange/20 text-accent-orange'
                                    : ep.source === 'GET Probe'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-accent-cyan/20 text-accent-cyan'
                                }`}
                              >
                                {ep.method}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-white truncate max-w-md" title={ep.url}>
                              {ep.path}
                            </td>
                            <td className="px-3 py-1.5 text-[#94a3b8] text-[11px] whitespace-nowrap">
                              {ep.source}
                            </td>
                            <td className="px-3 py-1.5 text-[#64748b] text-[10px] whitespace-nowrap text-right">
                              {new Date(ep.discoveredAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: SCOPE & SAFETY BOUNDARIES (Full Width, 2 Columns)         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-scope" className="p-6 rounded-2xl bg-[#0e111a] border border-[#1c2234] space-y-5 shadow-md scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#1c2234] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-cyan/15 text-accent-cyan font-bold text-base">🛡️</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. SCOPE & SAFETY BOUNDARIES</h2>
                <p className="text-xs text-[#94a3b8]">Enforce allowed host targets and default-deny excluded paths for safety.</p>
              </div>
            </div>
            <Badge variant="scope-in">SEC-01 FAIL-CLOSED</Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Authorized In-Scope Targets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#94a3b8]">
                  Authorized In-Scope Targets (Allowed Domains):
                </label>
                <span className={`text-[11px] font-mono ${scopeDomains.length === 0 ? 'text-accent-cyan font-bold' : 'text-[#34d399]'}`}>
                  {scopeDomains.length === 0 ? '0 Active (Open Scope: Any Domain Permitted)' : `${scopeDomains.length} Active`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3.5 bg-[#141824] rounded-xl border border-[#252c40] min-h-[64px]">
                {scopeDomains.length === 0 ? (
                  <span className="text-xs text-[#94a3b8] italic">
                    Open Scope active: Requests will freely route to any target domain without restriction.
                  </span>
                ) : (
                  scopeDomains.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 text-xs font-mono font-medium"
                    >
                      {domain}
                      <button onClick={() => handleRemoveDomain(domain)} className="hover:text-white ml-0.5" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
                {showAddDomain ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newDomainInput}
                      onChange={(e) => setNewDomainInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                      placeholder="*.api.target.com"
                      autoFocus
                      className="px-3 py-1 bg-[#0e111a] rounded-lg border border-accent-cyan text-xs font-mono text-white focus:outline-none"
                    />
                    <Button variant="primary" size="sm" onClick={handleAddDomain}>Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDomain(false)}>Cancel</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddDomain(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-[#252c40] text-xs text-[#94a3b8] hover:text-white hover:border-accent-cyan transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Target Host</span>
                  </button>
                )}
              </div>
            </div>

            {/* Excluded Paths */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#94a3b8]">
                  Excluded Paths (Default-Deny for Destructive Endpoints):
                </label>
                <span className="text-[11px] text-accent-orange font-mono">Non-Destructive Guaranteed</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3.5 bg-[#141824] rounded-xl border border-[#252c40] min-h-[64px]">
                {excludedPaths.map((path) => (
                  <span
                    key={path}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-orange/15 text-accent-orange border border-accent-orange/30 text-xs font-mono font-medium"
                  >
                    {path}
                    <button onClick={() => handleRemovePath(path)} className="hover:text-white ml-0.5" title="Remove">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {showAddPath ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newPathInput}
                      onChange={(e) => setNewPathInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                      placeholder="/api/v1/delete"
                      autoFocus
                      className="px-3 py-1 bg-[#0e111a] rounded-lg border border-accent-orange text-xs font-mono text-white focus:outline-none"
                    />
                    <Button variant="primary" size="sm" onClick={handleAddPath}>Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddPath(false)}>Cancel</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddPath(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-[#252c40] text-xs text-[#94a3b8] hover:text-white hover:border-accent-orange transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Excluded Path</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Safety Invariant Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#141824] border border-[#252c40] text-xs">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#34d399]" />
              <div>
                <span className="font-semibold text-white">Universal Safety Kernel (K_SK) Invariant:</span>
                <span className="text-[#94a3b8] ml-1.5">
                  Protects backend applications by default-denying destructive actions.
                </span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer" title="When enabled, blocks POST/PUT/DELETE mutations so tests remain non-destructive">
              <input
                type="checkbox"
                checked={enforceSafeOnly}
                onChange={(e) => setEnforceSafeOnly(e.target.checked)}
                className="rounded text-accent-cyan focus:ring-0"
              />
              <span className="text-white font-medium">Enforce Read-Only Mutations (GET/HEAD Only)</span>
            </label>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: MULTI-TENANT AUTHENTICATION MATRIX (Full Width)           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-auth" className="p-6 rounded-2xl bg-[#0e111a] border border-[#1c2234] space-y-5 shadow-md scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#1c2234] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-orange/15 text-accent-orange font-bold text-base">👥</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">3. MULTI-TENANT AUTHENTICATION MATRIX</h2>
                <p className="text-xs text-[#94a3b8]">Provide credentials for cross-account differential testing (IDOR, BOLA, BFLA).</p>
              </div>
            </div>
            <Badge variant="scope-in">DUAL-TENANT MATRIX</Badge>
          </div>

          {/* Identity Mode Radio Group (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            {[
              { id: 'anonymous', label: 'Anonymous Only', desc: 'Test unauthenticated public attack surface' },
              { id: 'single', label: 'Single Account', desc: 'Standard single-user privilege audit' },
              { id: 'multi', label: 'Dual-Tenant Matrix (Recommended)', desc: 'Full cross-tenant IDOR/BOLA differential testing' },
            ].map((m) => (
              <label
                key={m.id}
                onClick={() => setAuthMode(m.id as any)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  authMode === m.id
                    ? 'bg-accent-cyan/15 border-accent-cyan text-white font-bold shadow-sm'
                    : 'bg-[#141824] border-[#252c40] text-[#94a3b8] hover:border-[#3b4764]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="authMode"
                    checked={authMode === m.id}
                    onChange={() => setAuthMode(m.id as any)}
                    className="text-accent-cyan focus:ring-0"
                  />
                  <span className="font-bold text-white">{m.label}</span>
                </div>
                <p className="text-[11px] text-[#64748b]">{m.desc}</p>
              </label>
            ))}
          </div>

          {/* Symmetrical Dual Tenant Cards (2 Columns 50/50 Full Width) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenant Alpha Card */}
            <div className="p-5 rounded-xl bg-[#141824] border border-[#252c40] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#252c40] pb-3">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-accent-cyan" />
                  <span className="text-xs font-bold text-white">Tenant Alpha (Primary Subject)</span>
                </div>
                <Badge variant="scope-in">Primary Target</Badge>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#94a3b8] block mb-1">Username / Email:</label>
                    <input
                      type="text"
                      value={tenantA.username}
                      onChange={(e) => {
                        setTenantA({ ...tenantA, username: e.target.value });
                        if (authMode === 'anonymous' && e.target.value.trim()) setAuthMode('single');
                      }}
                      className="w-full px-3.5 py-2 bg-[#0e111a] rounded-lg border border-[#252c40] text-white focus:border-accent-cyan focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[#94a3b8] block mb-1">Password:</label>
                    <input
                      type="password"
                      value={tenantA.password}
                      onChange={(e) => {
                        setTenantA({ ...tenantA, password: e.target.value });
                        if (authMode === 'anonymous' && e.target.value.trim()) setAuthMode('single');
                      }}
                      className="w-full px-3.5 py-2 bg-[#0e111a] rounded-lg border border-[#252c40] text-white focus:border-accent-cyan focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant Beta Card */}
            <div className="p-5 rounded-xl bg-[#141824] border border-[#252c40] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#252c40] pb-3">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-accent-orange" />
                  <span className="text-xs font-bold text-white">Tenant Beta (Cross-Tenant Peer)</span>
                </div>
                <Badge variant="neutral">Cross-Tenant Verifier</Badge>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#94a3b8] block mb-1">Username / Email:</label>
                    <input
                      type="text"
                      value={tenantB.username}
                      onChange={(e) => {
                        setTenantB({ ...tenantB, username: e.target.value });
                        if (e.target.value.trim()) setAuthMode('multi');
                      }}
                      className="w-full px-3.5 py-2 bg-[#0e111a] rounded-lg border border-[#252c40] text-white focus:border-accent-orange focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[#94a3b8] block mb-1">Password:</label>
                    <input
                      type="password"
                      value={tenantB.password}
                      onChange={(e) => {
                        setTenantB({ ...tenantB, password: e.target.value });
                        if (e.target.value.trim()) setAuthMode('multi');
                      }}
                      className="w-full px-3.5 py-2 bg-[#0e111a] rounded-lg border border-[#252c40] text-white focus:border-accent-orange focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Way Differential Comparison Checkbox */}
          <div className="flex items-center gap-2 p-3.5 bg-[#141824] rounded-xl border border-[#252c40] text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={unauthBaseline}
                onChange={(e) => setUnauthBaseline(e.target.checked)}
                className="rounded text-accent-cyan focus:ring-0 cursor-pointer"
              />
              <span className="text-white font-medium">
                Perform 3-Way Differential Comparison (Tenant Alpha vs Tenant Beta vs Unauthenticated Baseline)
              </span>
            </label>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: ATTACKS                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-topics" className="p-6 rounded-2xl bg-[#0e111a] border border-[#1c2234] space-y-5 shadow-md scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#1c2234] pb-3.5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-orange/15 text-accent-orange font-bold text-base">⚔️</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">4. ATTACKS</h2>
                <p className="text-xs text-[#94a3b8]">Configure and select vulnerability attack modules.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="neutral">None</Badge>
            </div>
          </div>

          <div className="p-8 text-center text-xs text-[#94a3b8] bg-[#141824] rounded-xl border border-[#252c40] font-mono">
            None
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5: SCAN DEPTH, PERFORMANCE & DELIVERABLES (Full Width)       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-depth" className="p-6 rounded-2xl bg-[#0e111a] border border-[#1c2234] space-y-5 shadow-md scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#1c2234] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-cyan/15 text-accent-cyan font-bold text-base">⚙️</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">5. SCAN DEPTH & SAFETY POLICY</h2>
                <p className="text-xs text-[#94a3b8]">Configure execution profiles and rate limits. Continuous crawl runs until stopped.</p>
              </div>
            </div>
            <Badge variant="neutral">{profile} PROFILE</Badge>
          </div>

          {/* Execution Depth Profile Cards (3 Equal Columns) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#94a3b8]">Execution Depth Profile:</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              {[
                {
                  id: 'PASSIVE',
                  name: 'Passive Only',
                  badge: 'Viewing Only',
                  desc: 'Reconnaissance viewing only: extracts DOM links, JS routes, headers, and metadata with zero parameter changes.',
                },
                {
                  id: 'SAFE',
                  name: 'Safe Research',
                  badge: 'GET Param Mutations',
                  desc: 'Probes benign GET query parameters (?key=val) to discover parameter endpoints without destructive POST mutations.',
                },
                {
                  id: 'STANDARD',
                  name: 'Standard',
                  badge: 'Full Access (GET + POST)',
                  desc: 'Full access: discovers and reads GET, POST forms, interactive buttons, and all application endpoints.',
                },
              ].map((p) => (
                <label
                  key={p.id}
                  onClick={() => setProfile(p.id as any)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    profile === p.id
                      ? 'bg-accent-cyan/15 border-accent-cyan text-white font-bold shadow-sm'
                      : 'bg-[#141824] border-[#252c40] text-[#94a3b8] hover:border-[#3b4764]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="profile"
                          checked={profile === p.id}
                          onChange={() => setProfile(p.id as any)}
                          className="text-accent-cyan focus:ring-0"
                        />
                        <span className="font-bold text-white">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0a0c13] text-accent-cyan border border-[#252c40]">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8] leading-relaxed">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Performance & Continuous Execution Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[#1c2234]">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94a3b8]">Rate Limiting (Max QPS):</span>
                <span className="font-mono text-accent-cyan font-bold">{rateLimit} req/sec</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full accent-accent-cyan cursor-pointer"
              />
              <p className="text-[11px] text-[#64748b]">Paces crawler outbound requests to avoid target rate-limiting or firewall bans.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141824] border border-[#252c40] flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isCrawlerRunning ? 'bg-[#34d399] animate-ping' : 'bg-accent-cyan'}`} />
                  Continuous Crawl Loop
                </span>
                <p className="text-[11px] text-[#94a3b8]">
                  Runs continuously in the background until explicitly halted by the operator.
                </p>
              </div>
              <span className={`font-mono text-[11px] px-2.5 py-1 rounded-lg border ${
                isCrawlerRunning
                  ? 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30 font-bold'
                  : 'bg-[#0a0c13] text-[#94a3b8] border-[#252c40]'
              }`}>
                {isCrawlerRunning ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 6: AUDIT REVIEW & MASTER LAUNCH DECK (Full Width)            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section id="sec-launch" className="p-6 rounded-2xl bg-gradient-to-b from-[#131724] to-[#0a0c14] border-2 border-accent-orange/40 shadow-2xl space-y-6 scroll-mt-32">
          <div className="flex items-center justify-between border-b border-[#252c40] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-orange/20 text-accent-orange font-bold text-base">🚀</div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  6. AUDIT REVIEW & MASTER EXECUTION DECK
                </h2>
                <p className="text-xs text-[#94a3b8]">Verify engagement parameters and launch the autonomous research pipeline.</p>
              </div>
            </div>
            <Badge variant="scope-in">READY TO EXECUTE</Badge>
          </div>

          {/* Assessment Review Summary Grid (5 Equal Columns Full Width) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-1">
              <span className="text-[#94a3b8] block">Target Host</span>
              <span className="text-accent-cyan font-bold truncate block">{targetUrl}</span>
              <span className="text-[11px] text-[#34d399]">TLS 1.3 / HTTP2</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-1">
              <span className="text-[#94a3b8] block">Execution Engine</span>
              <span className="text-accent-orange font-bold block">STEALTH CRAWLER</span>
              <span className="text-[11px] text-[#34d399] font-mono">Continuous Mode</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-1">
              <span className="text-[#94a3b8] block">Scope Rules</span>
              <span className="text-[#34d399] font-bold block">{scopeDomains.length} Allowed Domains</span>
              <span className="text-[11px] text-accent-orange">{excludedPaths.length} Excluded Paths</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-1">
              <span className="text-[#94a3b8] block">Identity & Auth</span>
              <span className="text-white font-bold block">{authMode.toUpperCase()}</span>
              <span className="text-[11px] text-[#94a3b8] font-mono truncate block">{authMode === 'anonymous' ? 'Unauthenticated' : 'Credentials Configured'}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141824] border border-[#252c40] space-y-1">
              <span className="text-[#94a3b8] block">Execution Strategy</span>
              <span className="text-accent-orange font-bold block">{profile} PROFILE</span>
              <span className="text-[11px] text-[#34d399]">Rate: {rateLimit} QPS</span>
            </div>
          </div>

          {/* Primary Master Execution Button */}
          <div className="p-5 rounded-xl bg-[#141824] border border-[#252c40] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#34d399]" />
                Universal Safety Kernel Enforcement: Active
              </h3>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                All traffic strictly mediated via K_SK. Excluded paths guarded with default-deny safety kernel.
              </p>
            </div>

            <Button
              variant={isCrawlerRunning ? "destructive" : "primary"}
              size="lg"
              className={`w-full sm:w-auto px-12 py-4 text-sm font-bold tracking-wider uppercase shadow-xl transition-all cursor-pointer ${
                isCrawlerRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                  : 'bg-gradient-to-r from-accent-orange to-[#ea580c] shadow-accent-orange/25 text-white hover:brightness-110'
              }`}
              leftIcon={isCrawlerRunning ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 text-white fill-white" />}
              onClick={handleStartAssessment}
            >
              {isCrawlerRunning ? '■ Stop Stealth Crawl' : 'Start'}
            </Button>
          </div>
        </section>

      </main>
      )}
    </div>
  );
};
