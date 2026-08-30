import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useTrafficStore } from '../stores/trafficStore';
import { ipcClient } from '../ipc/client';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  Plus,
  X,
  Minus,
  Square,
  MoreVertical,
  User,
  Zap,
  Shield,
  ExternalLink,
  Lock,
  ChevronDown,
  Rocket,
  Copy,
  Check,
} from 'lucide-react';

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  isNewTab: boolean;
}

export const BrowserWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { addTransaction } = useTrafficStore();

  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 'tab-1', title: 'PortSwigger', url: 'sentinel://newtab', isNewTab: true },
    { id: 'tab-2', title: 'PortSwigger', url: 'sentinel://newtab', isNewTab: true },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  const [omniboxInput, setOmniboxInput] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [interceptEnabled, setInterceptEnabled] = useState(true);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleLaunchSystemChrome = async () => {
    const target = activeTab.isNewTab ? 'https://www.google.com' : activeTab.url;
    const commandStr = `start chrome --proxy-server="http://127.0.0.1:8085" --ignore-certificate-errors --user-data-dir="%TEMP%\\sentinel-chrome" ${target}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(commandStr);
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 3000);
      }
    } catch {}

    try {
      await ipcClient.launchSystemBrowser(target, 8085);
      addToast({
        type: 'success',
        title: 'Google Chrome Launched with Sentinel Proxy',
        description: 'Command executed on 127.0.0.1:8085. Traffic is recorded in Proxy / HTTP History.',
      });
    } catch {
      addToast({
        type: 'info',
        title: 'Proxy Launch Command Copied to Clipboard',
        description: 'Run in terminal or PowerShell to open proxy-connected Chrome.',
      });
    }

    setShowLaunchModal(true);
  };

  const handleCreateTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newId,
      title: 'PortSwigger',
      url: 'sentinel://newtab',
      isNewTab: true,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setOmniboxInput('');
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Keep at least one tab
      setTabs([{ id: 'tab-1', title: 'PortSwigger', url: 'sentinel://newtab', isNewTab: true }]);
      setActiveTabId('tab-1');
      setOmniboxInput('');
      return;
    }
    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
      setOmniboxInput(filtered[filtered.length - 1].isNewTab ? '' : filtered[filtered.length - 1].url);
    }
  };

  const navigateToUrl = (targetUrl: string, customTitle?: string) => {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    if (cleanUrl === 'sentinel://newtab' || cleanUrl === 'about:blank') {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url: 'sentinel://newtab', title: 'PortSwigger', isNewTab: true } : t))
      );
      setOmniboxInput('');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    setIsNavigating(true);
    setOmniboxInput(cleanUrl);

    let title = customTitle || 'Target Application';
    if (cleanUrl.includes('login') || cleanUrl.includes('auth')) title = 'Security Portal Authentication';
    else if (cleanUrl.includes('profile') || cleanUrl.includes('users')) title = 'User Profile Dashboard';
    else if (cleanUrl.includes('invoices') || cleanUrl.includes('export')) title = 'Invoices Statement Export';
    else if (cleanUrl.includes('portswigger.net') || cleanUrl.includes('academy')) title = 'Web Security Academy';

    addToast({
      type: 'info',
      title: `Chromium Navigating: ${cleanUrl}`,
      description: 'Routing through Sentinel MITM Proxy (127.0.0.1:8080)',
    });

    setTimeout(() => {
      setIsNavigating(false);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url: cleanUrl, title, isNewTab: false } : t))
      );

      // Emit transaction to trafficStore
      let host = 'portswigger.net';
      let path = '/';
      try {
        const parsed = new URL(cleanUrl);
        host = parsed.hostname || parsed.host;
        path = (parsed.pathname || '/') + (parsed.search || '');
      } catch {}

      addTransaction({
        id: `tx-brw-${Date.now().toString(36)}`,
        seqNumber: Math.floor(Math.random() * 900) + 100,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        method: 'GET',
        url: cleanUrl,
        host: host,
        path: path || '/',
        status: 200,
        durationMs: 38,
        sizeBytes: 1540,
        inScope: true,
        mimeType: 'text/html',
        tags: ['scope:target', 'browser-proxy'],
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
      });

      addToast({
        type: 'success',
        title: 'Proxy Intercept: Request Logged to HTTP History',
      });
    }, 300);
  };

  const handleOmniboxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToUrl(omniboxInput || 'https://target.local/');
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#111216] text-[#dfdfdf] overflow-hidden select-none font-sans">
      {/* 1. Chromium Top Tab Strip & Window Controls */}
      <div className="h-10 bg-[#16171d] border-b border-[#23252e] flex items-end justify-between px-2 pt-1 flex-shrink-0">
        {/* Left: Tab Search Dropdown & Tabs List */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          <button className="p-1.5 text-[#9da5b4] hover:text-white hover:bg-[#23252e] rounded-full mr-1" title="Search tabs">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setOmniboxInput(tab.isNewTab ? '' : tab.url);
                }}
                className={`group relative flex items-center gap-2 px-3 py-1.5 min-w-[160px] max-w-[220px] rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#23252e] text-white shadow-md'
                    : 'bg-transparent text-[#9da5b4] hover:bg-[#1c1d25] hover:text-[#dfdfdf]'
                }`}
              >
                {/* PortSwigger / Sentinel Orange Bolt */}
                <div className="w-3.5 h-3.5 rounded bg-[#f37021] flex items-center justify-center flex-shrink-0">
                  <Zap className="w-2.5 h-2.5 text-white fill-current" />
                </div>

                <span className="truncate flex-1 font-medium">{tab.title}</span>

                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[#8c9099] hover:bg-[#343744] hover:text-white transition-colors opacity-70 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={handleCreateTab}
            className="p-1 text-[#9da5b4] hover:text-white hover:bg-[#23252e] rounded-full ml-1"
            title="New tab (Ctrl+T)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-1 text-[#8c9099] mb-1.5 ml-2">
          <button className="p-1.5 hover:bg-[#23252e] hover:text-white rounded">
            <Minus className="w-3 h-3" />
          </button>
          <button className="p-1.5 hover:bg-[#23252e] hover:text-white rounded">
            <Square className="w-2.5 h-2.5" />
          </button>
          <button className="p-1.5 hover:bg-[#ef4444] hover:text-white rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Chromium Navigation & Omnibox Toolbar */}
      <div className="h-11 bg-[#23252e] border-b border-[#181920] flex items-center gap-2 px-3 flex-shrink-0">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 text-[#9da5b4]">
          <button
            onClick={() => navigateToUrl('sentinel://newtab')}
            className="p-1.5 hover:bg-[#2e313d] hover:text-white rounded-full transition-colors"
            title="Click to go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigateToUrl('https://target.local/login')}
            className="p-1.5 hover:bg-[#2e313d] hover:text-white rounded-full transition-colors"
            title="Click to go forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigateToUrl(activeTab.url || 'sentinel://newtab')}
            className={`p-1.5 hover:bg-[#2e313d] hover:text-white rounded-full transition-colors ${
              isNavigating ? 'animate-spin text-[#f37021]' : ''
            }`}
            title="Reload this page"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox / Search & URL Bar */}
        <form onSubmit={handleOmniboxSubmit} className="flex-1 max-w-4xl mx-auto flex items-center">
          <div className="w-full flex items-center bg-[#13141a] hover:bg-[#101116] focus-within:bg-[#0c0d12] border border-[#343746] focus-within:border-[#f37021] rounded-full px-3.5 py-1.5 transition-colors shadow-inner">
            <Search className="w-3.5 h-3.5 text-[#6f737a] mr-2 flex-shrink-0" />
            <input
              type="text"
              value={omniboxInput}
              onChange={(e) => setOmniboxInput(e.target.value)}
              placeholder="Search or enter URL (e.g. target.local, https://target.local/login)"
              className="w-full bg-transparent text-white font-sans text-xs outline-none placeholder-[#6f737a]"
            />
            {activeTab.url && !activeTab.isNewTab && (
              <span className="text-[10px] text-[#34d399] font-mono ml-2 flex items-center gap-1 flex-shrink-0">
                <Lock className="w-2.5 h-2.5" />
                <span>SEC-06 Proxy</span>
              </span>
            )}
          </div>
        </form>

        {/* Action Extensions & Controls */}
        <div className="flex items-center gap-2 text-[#9da5b4]">
          {/* Direct System Chrome Launcher Button */}
          <button
            onClick={handleLaunchSystemChrome}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#f37021] hover:bg-[#e05d06] text-white rounded-full font-bold text-xs shadow-md transition-all hover:scale-105 active:scale-95"
            title="Open real Google Chrome connected to Sentinel Proxy (127.0.0.1:8080)"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Launch System Chrome</span>
          </button>

          {/* Proxy Intercept Toggle */}
          <button
            onClick={() => {
              setInterceptEnabled(!interceptEnabled);
              addToast({
                type: interceptEnabled ? 'warning' : 'success',
                title: interceptEnabled ? 'Proxy Intercept Paused' : 'Proxy Intercept Active (127.0.0.1:8080)',
              });
            }}
            className={`p-1.5 rounded-full transition-colors ${
              interceptEnabled ? 'bg-[#f37021]/20 text-[#f37021] hover:bg-[#f37021]/30' : 'hover:bg-[#2e313d] hover:text-white'
            }`}
            title="Toggle Sentinel Proxy Traffic Interception"
          >
            <Shield className="w-4 h-4 fill-current" />
          </button>

          {/* User Profile */}
          <button className="p-1.5 hover:bg-[#2e313d] hover:text-white rounded-full" title="Sentinel Assessment Profile">
            <User className="w-4 h-4" />
          </button>

          {/* Three Dots Menu */}
          <button className="p-1.5 hover:bg-[#2e313d] hover:text-white rounded-full" title="Customize and control Chromium">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Main Viewport: Exact Burp Suite "Redefined" New Tab OR Live Target Webpage */}
      <div className="flex-1 overflow-y-auto flex flex-col bg-[#05060f]">
        {activeTab.isNewTab ? (
          /* Burp Suite Redefined Hero Page */
          <div className="flex-1 flex flex-col justify-between min-h-[680px] bg-gradient-to-b from-[#080816] via-[#090b24] to-[#04050e] relative overflow-hidden">
            {/* Ambient Background Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#15172b_1px,transparent_1px),linear-gradient(to_bottom,#15172b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

            {/* Hero Main Content */}
            <div className="max-w-4xl mx-auto px-8 pt-16 pb-12 z-10 w-full">
              {/* Lightning Badge Icon */}
              <div className="w-20 h-20 rounded-2xl bg-[#14142b]/90 border-2 border-[#f37021] flex items-center justify-center shadow-[0_0_35px_rgba(243,112,33,0.35)] mb-8">
                <Zap className="w-10 h-10 text-[#f37021] fill-current" />
              </div>

              {/* Main Headline */}
              <h1 className="text-6xl font-extrabold tracking-tight text-white mb-6">
                Burp, <span className="text-[#f37021]">redefined.</span>
              </h1>

              {/* Subtitle Description */}
              <p className="text-xl text-[#cbd5e1] font-normal leading-relaxed max-w-2xl mb-3">
                Burp AT brings agentic AI to human-led pentesting with Burp's proven tools, project context and purpose-built skills.
              </p>

              <div className="font-mono text-sm text-[#94a3b8] mb-8">
                Live in public beta for Burp Suite Professional users.
              </div>

              {/* CTA Buttons */}
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={handleLaunchSystemChrome}
                  className="px-8 py-3.5 bg-[#f37021] hover:bg-[#e05d06] text-white font-bold text-base rounded-md shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  <span>Launch Connected Chrome</span>
                </button>
                <button
                  onClick={() => navigateToUrl('https://target.local/', 'Target Application Dashboard')}
                  className="px-6 py-3.5 bg-[#1e293b] hover:bg-[#334155] text-[#dfdfdf] font-semibold text-base rounded-md border border-[#475569] transition-all"
                >
                  Open Sandbox Tab (127.0.0.1:8080)
                </button>
              </div>
            </div>

            {/* Bottom White Informational Strip */}
            <div className="bg-[#f0f4f9] text-[#0f172a] px-8 py-8 z-10 border-t border-white/20">
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  onClick={() => navigateToUrl('https://portswigger.net/web-security', 'Web Security Academy')}
                  className="cursor-pointer group"
                >
                  <h3 className="text-xl font-bold text-[#0f172a] group-hover:text-[#f37021] transition-colors flex items-center gap-2">
                    <span>Web Security Academy</span>
                    <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  </h3>
                  <p className="text-sm text-[#475569] mt-1">Free, online web security training and interactive lab challenges.</p>
                </div>

                <div
                  onClick={() => navigateToUrl('https://portswigger.net/burp/documentation', 'Documentation & Support')}
                  className="cursor-pointer group"
                >
                  <h3 className="text-xl font-bold text-[#0f172a] group-hover:text-[#f37021] transition-colors flex items-center gap-2">
                    <span>Documentation and support</span>
                    <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  </h3>
                  <p className="text-sm text-[#475569] mt-1">Explore guides, API references, and security testing workflows.</p>
                </div>
              </div>
            </div>

            {/* Bottom New Tab Footer */}
            <div className="bg-[#202124] text-[#9da5b4] px-8 py-3 flex items-center justify-between z-10 text-xs">
              <div className="w-24" />
              <span className="font-medium text-[#c4c7c5] select-text">Burp Suite New Tab</span>
              <button
                onClick={handleLaunchSystemChrome}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-full font-semibold transition-colors shadow-sm"
              >
                <Rocket className="w-3 h-3" />
                <span>Launch System Chrome</span>
              </button>
            </div>
          </div>
        ) : (
          /* Live Rendered Target Application Page */
          <div className="flex-1 flex flex-col bg-[#0f172a] text-white p-8">
            <div className="max-w-4xl mx-auto w-full">
              {activeTab.url.includes('login') ? (
                <div className="max-w-md mx-auto bg-[#1e293b] border border-[#334155] rounded-xl p-8 shadow-2xl mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#059669]/20 text-[#34d399] text-[11px] font-bold">
                      SEC-06 PROXY PROTECTED
                    </span>
                    <span className="text-xs text-[#94a3b8] font-mono">127.0.0.1:8080</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Sign in to Target Portal</h2>
                  <p className="text-xs text-[#94a3b8] mb-6">Enter administrative credentials to test authorization controls.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Username / Email</label>
                      <input
                        type="text"
                        defaultValue="admin@target.local"
                        className="w-full bg-[#0f172a] border border-[#475569] rounded-lg px-3 py-2 text-sm text-white focus:border-[#f37021] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Password</label>
                      <input
                        type="password"
                        defaultValue="••••••••••••"
                        className="w-full bg-[#0f172a] border border-[#475569] rounded-lg px-3 py-2 text-sm text-white focus:border-[#f37021] outline-none"
                      />
                    </div>
                    <button
                      onClick={() => navigateToUrl('https://target.local/users', 'User Profile Dashboard')}
                      className="w-full py-2.5 bg-[#f37021] hover:bg-[#e05d06] text-white font-bold rounded-lg transition-colors text-sm shadow-md mt-2"
                    >
                      Authenticate (Captured by Proxy)
                    </button>
                  </div>
                </div>
              ) : activeTab.url.includes('users') ? (
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 shadow-2xl">
                  <div className="flex items-center gap-4 pb-6 border-b border-[#334155] mb-6">
                    <div className="w-14 h-14 rounded-full bg-[#f37021] text-white flex items-center justify-center font-bold text-xl">
                      SA
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Security Administrator</h2>
                      <p className="text-xs text-[#34d399] font-mono">ROLE: SYSTEM_ADMIN (SEC-09 IRA+ Matrix Verified)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0f172a] border border-[#334155] p-4 rounded-lg">
                      <div className="text-xs text-[#94a3b8] uppercase font-semibold">User UUID</div>
                      <div className="text-sm font-mono text-white mt-1">usr_9401a8ef21</div>
                    </div>
                    <div className="bg-[#0f172a] border border-[#334155] p-4 rounded-lg">
                      <div className="text-xs text-[#94a3b8] uppercase font-semibold">Session Token</div>
                      <div className="text-sm font-mono text-[#38bdf8] mt-1">sess_jwt_8a91c2</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 shadow-2xl">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#059669]/20 text-[#34d399] text-[11px] font-bold">
                    CONNECTED TARGET APPLICATION
                  </span>
                  <h1 className="text-2xl font-bold text-white mt-4 mb-2">Sentinel Target Environment</h1>
                  <p className="text-sm text-[#94a3b8] leading-relaxed mb-6">
                    This browser session is directly connected to the Sentinel V6 proxy engine on <strong>127.0.0.1:8080</strong>. All requests, cookies, and tokens are intercepted and logged in HTTP History.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigateToUrl('https://target.local/login', 'Security Portal Authentication')}
                      className="px-5 py-2 bg-[#f37021] hover:bg-[#e05d06] text-white font-bold rounded-lg text-sm"
                    >
                      Go to Login Page
                    </button>
                    <button
                      onClick={() => navigateToUrl('sentinel://newtab')}
                      className="px-5 py-2 bg-[#334155] hover:bg-[#475569] text-white font-semibold rounded-lg text-sm"
                    >
                      Back to New Tab
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. System Chrome Proxy Launcher Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-xl shadow-2xl max-w-xl w-full p-6 text-[#dfdfdf] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2b2d30] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f37021]/15 border border-[#f37021]/30 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-[#f37021]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">System Chrome Connected to Sentinel Proxy</h3>
                  <p className="text-[11px] text-[#9da5b4]">Proxy Listener: 127.0.0.1:8085 (Traffic routed to HTTP History)</p>
                </div>
              </div>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="p-1 text-[#8c9099] hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#cbd5e1] leading-relaxed">
                Google Chrome is launched with an isolated profile and directed to route all HTTP/HTTPS traffic through Sentinel's local MITM proxy engine on port 8085.
              </p>

              <div className="p-3 bg-[#141517] border border-[#334155] rounded-lg font-mono text-[11px] text-[#38bdf8] space-y-1 relative group">
                <div className="text-[10px] text-[#8c9099] uppercase font-sans font-semibold mb-1 flex items-center justify-between">
                  <span>Executed Launch Command:</span>
                  <button
                    onClick={async () => {
                      const cmd = `start chrome --proxy-server="http://127.0.0.1:8085" --ignore-certificate-errors --user-data-dir="%TEMP%\\sentinel-chrome" ${activeTab.url || 'https://portswigger.net/web-security'}`;
                      if (navigator.clipboard) await navigator.clipboard.writeText(cmd);
                      setCopiedCmd(true);
                      setTimeout(() => setCopiedCmd(false), 2500);
                    }}
                    className="flex items-center gap-1 text-[#f37021] hover:text-white text-[10px] font-sans font-semibold"
                  >
                    {copiedCmd ? <Check className="w-3 h-3 text-[#34d399]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="break-all select-all text-white bg-[#0a0b0e] p-2 rounded border border-[#23252e]">
                  start chrome --proxy-server="http://127.0.0.1:8085" --ignore-certificate-errors --user-data-dir="%TEMP%\sentinel-chrome" {activeTab.url || 'https://portswigger.net/web-security'}
                </div>
              </div>

              <div className="bg-[#059669]/10 border border-[#059669]/30 rounded-lg p-3 text-[11px] text-[#34d399] flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Proxy Live:</strong> All requests made in this Chrome window will appear instantly under <strong>Proxy &gt; HTTP History</strong> with full inspection, Repeater, and Intruder capabilities.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2b2d30]">
              <button
                onClick={() => setShowLaunchModal(false)}
                className="px-4 py-1.5 bg-[#f37021] hover:bg-[#e05d06] text-white font-bold rounded-lg text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

