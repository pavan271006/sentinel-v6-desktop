import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Zap,
  CheckCircle2,
  Play,
  Copy,
  Check,
  Cpu,
  Layers,
  Lock,
} from 'lucide-react';
import { useVulnIntelStore } from '../stores/vulnIntelStore';
import { Button } from '../design-system/Button';

export const VulnIntelWorkspaceView: React.FC = () => {
  const {
    advisories,
    selectedAdvisoryId,
    searchQuery,
    filterOnlyKev,
    filterMinSeverity,
    targetTechnologies,
    verificationStages,
    isSyncing,
    setSearchQuery,
    toggleKevFilter,
    setMinSeverityFilter,
    selectAdvisory,
    syncFeeds,
    runVerificationProbe,
  } = useVulnIntelStore();

  const [targetUrl, setTargetUrl] = useState('https://target.local');
  const [copiedHash, setCopiedHash] = useState(false);
  const [isProbing, setIsProbing] = useState(false);

  const selectedAdvisory = useMemo(() => {
    return advisories.find((a) => a.id === selectedAdvisoryId) || advisories[0];
  }, [advisories, selectedAdvisoryId]);

  const filteredAdvisories = useMemo(() => {
    return advisories.filter((adv) => {
      if (filterOnlyKev && !adv.isKev) return false;
      if (filterMinSeverity !== 'ALL' && adv.severity !== filterMinSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = adv.id.toLowerCase().includes(q);
        const matchTitle = adv.title.toLowerCase().includes(q);
        const matchDesc = adv.description.toLowerCase().includes(q);
        const matchCpe = adv.cpeMatches.some((c) => c.toLowerCase().includes(q));
        if (!matchId && !matchTitle && !matchDesc && !matchCpe) return false;
      }
      return true;
    });
  }, [advisories, filterOnlyKev, filterMinSeverity, searchQuery]);

  const currentVerification = selectedAdvisory
    ? verificationStages[selectedAdvisory.id]
    : undefined;

  const handleRunProbe = async () => {
    if (!selectedAdvisory) return;
    setIsProbing(true);
    try {
      await runVerificationProbe(selectedAdvisory.id, targetUrl, true);
    } finally {
      setIsProbing(false);
    }
  };

  const handleCopyCasHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div
      data-testid="vuln-intel-workspace"
      className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs"
    >
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
            <span className="font-bold text-white text-xs tracking-wide">
              Vulnerability Intelligence & Emerging Threat Ingestion
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
            SYNC: LIVE (NVD 2.0, CISA KEV, GHSA, OSV)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />}
            onClick={() => syncFeeds()}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Feeds Now'}
          </Button>
        </div>
      </div>

      {/* Filter & Target Strip */}
      <div className="p-2.5 bg-[#141517] border-b border-[#2b2d30] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1 w-72">
            <Search className="w-3.5 h-3.5 text-[#9da5b4] mr-2" />
            <input
              type="text"
              placeholder="Search CVE ID, Apache, Spring..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none placeholder-[#6f737a]"
            />
          </div>

          {/* CISA KEV Toggle */}
          <button
            onClick={toggleKevFilter}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
              filterOnlyKev
                ? 'bg-purple-900 text-purple-200 border border-purple-500 shadow-sm'
                : 'bg-[#1e1f22] text-[#9da5b4] border border-[#3e4249] hover:bg-[#2b2d30]'
            }`}
          >
            <Zap className={`w-3 h-3 ${filterOnlyKev ? 'text-purple-300 fill-purple-300' : ''}`} />
            <span>CISA KEV ONLY</span>
          </button>

          {/* Severity Dropdown */}
          <select
            value={filterMinSeverity}
            onChange={(e) => setMinSeverityFilter(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="bg-[#1e1f22] text-white px-2 py-1 rounded border border-[#3e4249] text-xs focus:outline-none"
          >
            <option value="ALL" className="bg-[#2b2d30] text-[#dfdfdf]">All Severities</option>
            <option value="CRITICAL" className="bg-[#2b2d30] text-[#dfdfdf]">Critical Only</option>
            <option value="HIGH" className="bg-[#2b2d30] text-[#dfdfdf]">High</option>
            <option value="MEDIUM" className="bg-[#2b2d30] text-[#dfdfdf]">Medium</option>
          </select>
        </div>

        {/* Target URL Input */}
        <div className="flex items-center gap-2">
          <span className="text-[#9da5b4] text-[11px]">Active Target:</span>
          <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1 w-64">
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Two-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Advisory Browser */}
        <div className="w-5/12 border-r border-[#2b2d30] flex flex-col bg-[#141517]">
          <div className="px-3 py-1.5 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between text-[11px] font-semibold text-[#9da5b4]">
            <span>Advisories ({filteredAdvisories.length})</span>
            <span>EPSS / KEV Priority</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#232428]">
            {filteredAdvisories.map((adv) => {
              const isSelected = adv.id === selectedAdvisoryId;
              return (
                <div
                  key={adv.id}
                  data-testid={`advisory-item-${adv.id}`}
                  onClick={() => selectAdvisory(adv.id)}
                  className={`p-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#2b2d30] border-l-2 border-[#ef4444]'
                      : 'hover:bg-[#1a1b1e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white font-mono text-xs">{adv.id}</span>
                      {adv.isKev && (
                        <span className="bg-purple-900/80 text-purple-200 border border-purple-500 font-bold px-1.5 py-0.2 rounded text-[10px] flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> KEV
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        adv.severity === 'CRITICAL'
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : adv.severity === 'HIGH'
                          ? 'bg-orange-950 text-orange-300 border border-orange-700'
                          : 'bg-yellow-950 text-yellow-300 border border-yellow-700'
                      }`}
                    >
                      {adv.severity} {adv.cvssV3?.baseScore ? `(${adv.cvssV3.baseScore})` : ''}
                    </span>
                  </div>

                  <div className="text-white text-xs font-medium line-clamp-1 mb-1">{adv.title}</div>
                  <div className="text-[#9da5b4] text-[11px] line-clamp-2">{adv.description}</div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-[#6f737a] font-mono">
                    <span>Source: {adv.source}</span>
                    {adv.epss && (
                      <span className="text-emerald-400">
                        EPSS: {(adv.epss.score * 100).toFixed(1)}% (Top{' '}
                        {((1 - adv.epss.percentile) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Target Intelligence & Verification Lifecycle */}
        <div className="flex-1 flex flex-col bg-[#1e1f22] overflow-y-auto">
          {selectedAdvisory ? (
            <div className="p-4 flex flex-col gap-4">
              {/* Target Technology Confidence Strip */}
              <div className="bg-[#141517] border border-[#3e4249] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#38bdf8]" />
                    <span className="font-bold text-white text-xs">
                      Bayesian Target Technology Confidence Correlation
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9da5b4] font-mono">
                    Evidence Weights: Header 0.30 | DOM 0.50 | Hash 0.85 | Probe 0.95
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {targetTechnologies.map((tech) => (
                    <div
                      key={tech.name}
                      className="flex items-center gap-2 bg-[#1e1f22] border border-[#3e4249] px-2.5 py-1.5 rounded"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span className="font-bold text-white text-xs">
                        {tech.name} {tech.version || ''}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                          tech.confidence >= 0.85
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : tech.confidence >= 0.5
                            ? 'bg-yellow-950 text-yellow-300 border border-yellow-700'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {Math.round(tech.confidence * 100)}% Match
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advisory Details Card */}
              <div className="bg-[#141517] border border-[#3e4249] rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
                  <div>
                    <h2 className="text-white text-sm font-bold">{selectedAdvisory.title}</h2>
                    <span className="text-[#9da5b4] font-mono text-[11px]">
                      {selectedAdvisory.id} • Published: {selectedAdvisory.publishedAt.slice(0, 10)}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="xs"
                    leftIcon={<Play className="w-3 h-3" />}
                    onClick={handleRunProbe}
                    disabled={isProbing}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold"
                  >
                    {isProbing ? 'Probing Target...' : 'Execute Safe Verification Probe'}
                  </Button>
                </div>

                <p className="text-[#dfdfdf] text-xs leading-relaxed">
                  {selectedAdvisory.description}
                </p>

                {/* CVSS & Vector Details */}
                <div className="grid grid-cols-3 gap-3 bg-[#1e1f22] p-2.5 rounded border border-[#2b2d30] font-mono text-[11px]">
                  <div>
                    <span className="text-[#6f737a] block">CVSS v3.1 Base Score:</span>
                    <span className="text-red-400 font-bold text-xs">
                      {selectedAdvisory.cvssV3?.baseScore || 'N/A'} (
                      {selectedAdvisory.severity})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6f737a] block">CISA KEV Status:</span>
                    <span
                      className={`font-bold ${
                        selectedAdvisory.isKev ? 'text-purple-400' : 'text-[#9da5b4]'
                      }`}
                    >
                      {selectedAdvisory.isKev
                        ? `ACTIVE EXPLOIT (Due: ${selectedAdvisory.kevDueDate || 'Mandated'})`
                        : 'Not in KEV Catalog'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6f737a] block">Remediation Guidance:</span>
                    <span className="text-emerald-400">
                      {selectedAdvisory.remediationAdvice}
                    </span>
                  </div>
                </div>

                {/* CPE Matches */}
                <div>
                  <span className="text-[#9da5b4] text-[11px] font-semibold block mb-1">
                    CPE 2.3 Applicability Criteria:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAdvisory.cpeMatches.map((cpe) => (
                      <span
                        key={cpe}
                        className="bg-[#1e1f22] text-[#38bdf8] font-mono text-[10px] px-2 py-0.5 rounded border border-[#2b2d30]"
                      >
                        {cpe}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6-Stage Verification Timeline & Forensic CAS Card */}
              <div className="bg-[#141517] border border-[#3e4249] rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      Verification-First Vulnerability Testing Lifecycle & CAS Proof
                    </span>
                  </div>
                  {currentVerification && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        currentVerification.stage === 'VERIFIED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : currentVerification.stage === 'NOT_VULNERABLE'
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-red-950 text-red-300'
                      }`}
                    >
                      STATUS: {currentVerification.stage}
                    </span>
                  )}
                </div>

                {/* Lifecycle Audit Log */}
                {currentVerification ? (
                  <div className="flex flex-col gap-2">
                    <div className="bg-[#101113] p-2.5 rounded border border-[#2b2d30] font-mono text-[11px] flex flex-col gap-1 text-[#dfdfdf]">
                      {currentVerification.log.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-[#6f737a]">[{idx + 1}]</span>
                          <span
                            className={
                              entry.includes('succeeded') || entry.includes('PASSED')
                                ? 'text-emerald-300'
                                : entry.includes('FAILED') || entry.includes('Aborted')
                                ? 'text-red-300'
                                : 'text-white'
                            }
                          >
                            {entry}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CAS Hash Block */}
                    {currentVerification.casHash && (
                      <div className="bg-[#101113] p-2.5 rounded border border-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="text-white font-bold text-xs block">
                              Cryptographic CAS Proof Descriptor Captured (SEC-07)
                            </span>
                            <span className="text-[#9da5b4] font-mono text-[10px]">
                              SHA-256: {currentVerification.casHash}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          onClick={() => handleCopyCasHash(currentVerification.casHash!)}
                        >
                          {copiedHash ? 'Copied' : 'Copy CAS Hash'}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[#101113] rounded border border-dashed border-[#3e4249] text-center text-[#6f737a] text-xs">
                    No probe executed yet. Click &quot;Execute Safe Verification Probe&quot; to test target with non-destructive proof.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-[#6f737a]">Select an advisory to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
};
