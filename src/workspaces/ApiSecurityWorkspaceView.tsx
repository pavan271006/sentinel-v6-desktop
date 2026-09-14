import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge, MethodBadge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import {
  FileCode2,
  Play,
  Upload,
  AlertTriangle,
  Send,
  Terminal,
  Share2,
} from 'lucide-react';
import {
  OpenApiEngine,
  ApiOperation,
  ApiFuzzResult,
  ApiDependencyRelation,
  DEFAULT_SAMPLE_OPENAPI,
} from '../services/apiSecurity/OpenApiEngine';

export const ApiSecurityWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { createTab } = useRepeaterStore();

  const [baseUrl, setBaseUrl] = useState('https://target.local');
  const [engine] = useState(() => new OpenApiEngine('https://target.local'));
  const [endpoints, setEndpoints] = useState<ApiOperation[]>(() =>
    engine.parseSpec(DEFAULT_SAMPLE_OPENAPI)
  );

  const [selectedOpId, setSelectedOpId] = useState<string>(endpoints[0]?.id || 'api-op-1');
  const [isFuzzing, setIsFuzzing] = useState(false);
  const [fuzzResults, setFuzzResults] = useState<ApiFuzzResult[]>([]);
  const [selectedFuzzResult, setSelectedFuzzResult] = useState<ApiFuzzResult | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [rawSpecJson, setRawSpecJson] = useState(JSON.stringify(DEFAULT_SAMPLE_OPENAPI, null, 2));

  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [dependencies, setDependencies] = useState<ApiDependencyRelation[]>([]);

  const handleOpenDependencies = () => {
    const deps = engine.inferProducerConsumerDependencies(endpoints);
    setDependencies(deps);
    setShowDependencyModal(true);
  };

  const selectedOp = endpoints.find((e) => e.id === selectedOpId) || endpoints[0];

  const handleImportRawSpec = () => {
    try {
      const parsed = JSON.parse(rawSpecJson);
      const parsedEngine = new OpenApiEngine(baseUrl);
      const ops = parsedEngine.parseSpec(parsed);
      if (ops.length === 0) {
        addToast({ type: 'warning', title: 'No Operations Found', description: 'No valid paths found in the OpenAPI schema' });
        return;
      }
      setEndpoints(ops);
      setSelectedOpId(ops[0].id);
      setFuzzResults([]);
      setSelectedFuzzResult(null);
      setShowImportModal(false);
      addToast({
        type: 'success',
        title: 'OpenAPI Spec Loaded',
        description: `Successfully indexed ${ops.length} operations from schema`,
      });
    } catch (err: any) {
      addToast({ type: 'danger', title: 'Invalid JSON Schema', description: err?.message || 'Failed to parse JSON' });
    }
  };

  const handleRunBoundaryFuzzing = async () => {
    if (!selectedOp) return;

    setIsFuzzing(true);
    setFuzzResults([]);
    setSelectedFuzzResult(null);

    addToast({
      type: 'info',
      title: 'Schemathesis Fuzzing Started',
      description: `Generating and running property-based boundary tests for ${selectedOp.method} ${selectedOp.path}...`,
    });

    const runner = new OpenApiEngine(baseUrl);
    const testCases = runner.generateTestCases(selectedOp);
    const results: ApiFuzzResult[] = [];

    for (const tc of testCases) {
      const res = await runner.runTestCase(tc);
      results.push(res);
      setFuzzResults([...results]);

      if (res.verdict === 'UNHANDLED_CRASH_500' || res.verdict === 'INFO_DISCLOSURE') {
        addToast({
          type: 'danger',
          title: `Defect Found: ${res.verdict}`,
          description: `${tc.name} triggered HTTP ${res.statusCode} on ${tc.targetPath}`,
        });
      }
    }

    setIsFuzzing(false);
    if (results.length > 0) setSelectedFuzzResult(results[0]);

    const crashes = results.filter((r) => r.verdict === 'UNHANDLED_CRASH_500' || r.verdict === 'INFO_DISCLOSURE');
    if (crashes.length === 0) {
      addToast({
        type: 'success',
        title: 'Conformance Verified',
        description: 'Endpoint gracefully handled all boundary test cases without crashing',
      });
    }
  };

  const handleSendToRepeater = (res: ApiFuzzResult) => {
    let fullPath = res.testCase.targetPath;
    for (const [k, v] of Object.entries(res.testCase.pathParams)) {
      fullPath = fullPath.replace(`{${k}}`, encodeURIComponent(String(v)));
    }

    createTab({
      title: `API: ${res.testCase.name.slice(0, 16)}`,
      url: `${baseUrl}${fullPath.startsWith('/') ? fullPath : '/' + fullPath}`,
      method: (res.testCase.method as any) || 'GET',
      body: res.testCase.body,
    });

    addToast({
      type: 'success',
      title: 'Sent to Repeater',
      description: `Loaded ${res.testCase.name} in new Repeater tab`,
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-bold text-white text-xs">API Security & Schemathesis Property Fuzzer</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            OpenAPI 3.0 / Swagger 2.0 Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Upload className="w-3 h-3 text-[#38bdf8]" />}
            onClick={() => setShowImportModal(!showImportModal)}
          >
            Import OpenAPI Spec
          </Button>

          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Share2 className="w-3 h-3 text-[#34d399]" />}
            onClick={handleOpenDependencies}
          >
            Dependencies (RESTler)
          </Button>

          <Button
            variant="primary"
            size="xs"
            disabled={isFuzzing || !selectedOp}
            leftIcon={<Play className="w-3 h-3" />}
            onClick={handleRunBoundaryFuzzing}
            className="bg-[#38bdf8] hover:bg-[#0284c7] text-black font-bold"
          >
            {isFuzzing ? 'Running Fuzz Tests...' : 'Fuzz Boundary Extremes'}
          </Button>
        </div>
      </div>

      {/* Target Base URL Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2 font-mono">Base Target:</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#1e1f22] text-white border border-[#3e4249] px-2 py-1 rounded text-xs font-mono">
            {endpoints.length} Operations Indexed
          </span>
        </div>
      </div>

      {/* Import OpenAPI Spec Drawer */}
      {showImportModal && (
        <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Paste OpenAPI / Swagger JSON Specification</span>
            <span className="text-[10px] text-[#9da5b4]">Supports OpenAPI v2.0 & v3.0.x</span>
          </div>
          <textarea
            value={rawSpecJson}
            onChange={(e) => setRawSpecJson(e.target.value)}
            className="w-full h-36 bg-[#1e1f22] text-[#34d399] font-mono text-[11px] p-2 rounded border border-[#3e4249] focus:outline-none resize-none leading-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="xs" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="xs" onClick={handleImportRawSpec} className="bg-[#38bdf8] text-black font-bold">
              Parse & Index Spec
            </Button>
          </div>
        </div>
      )}

      {/* Main Split: Operation List (Left) vs Schemathesis Fuzzing Workbench (Right) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={420}
          minSize={280}
          maxSize={650}
          storageKey="api_security_split_v6"
          primary={
            <div className="flex flex-col h-full bg-[#141517] border-r border-[#2b2d30] overflow-y-auto p-3 space-y-2">
              <span className="text-xs font-semibold text-[#9da5b4] uppercase tracking-wider px-1">
                Indexed API Operations ({endpoints.length})
              </span>
              {endpoints.map((ep) => {
                const isSelected = selectedOpId === ep.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => {
                      setSelectedOpId(ep.id);
                      setFuzzResults([]);
                      setSelectedFuzzResult(null);
                    }}
                    className={`p-2.5 rounded border cursor-pointer transition-colors space-y-1.5 ${
                      isSelected
                        ? 'bg-[#1e1f22] border-[#38bdf8]'
                        : 'bg-[#1a1b1e] border-[#313438] hover:border-[#3e4249]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MethodBadge method={ep.method} />
                        <span className="font-mono text-xs font-semibold text-white truncate max-w-xs">
                          {ep.path}
                        </span>
                      </div>
                      <Badge variant={ep.authRequired ? 'scope-deny' : 'scope-in'}>
                        {ep.authRequired ? 'AUTH' : 'PUBLIC'}
                      </Badge>
                    </div>
                    {ep.summary && <p className="text-[11px] text-[#9da5b4] truncate">{ep.summary}</p>}
                  </div>
                );
              })}
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-[#1e1f22] overflow-hidden">
              {selectedOp ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 space-y-3">
                  {/* Operation Header & Parameter Schema */}
                  <div className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MethodBadge method={selectedOp.method} />
                        <h2 className="text-sm font-bold text-white font-mono">{selectedOp.path}</h2>
                      </div>
                      <Badge variant={selectedOp.authRequired ? 'scope-deny' : 'scope-in'}>
                        {selectedOp.authRequired ? 'REQUIRES AUTH' : 'UNAUTHENTICATED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#dfdfdf]">{selectedOp.description}</p>

                    {/* Parameters summary */}
                    {selectedOp.parameters.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] text-[#9da5b4] uppercase font-semibold">Schema Parameters:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {selectedOp.parameters.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-[#1e1f22] border border-[#3e4249] rounded text-[10px] font-mono text-white"
                            >
                              <strong className="text-[#38bdf8]">{p.name}</strong> ({p.type} in {p.in})
                              {p.required && <span className="text-[#ef4444] ml-1">*</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fuzzing Results & Conformance Table */}
                  <div className="flex-1 flex min-h-0 border border-[#3e4249] rounded overflow-hidden bg-[#141517]">
                    {/* Test cases list */}
                    <div className="flex-1 flex flex-col border-r border-[#2b2d30] overflow-hidden">
                      <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-[#38bdf8]" />
                          Property-Based Fuzzing Test Cases ({fuzzResults.length})
                        </span>
                        {isFuzzing && <span className="text-[10px] text-[#34d399] animate-pulse">Running Probes...</span>}
                      </div>

                      <div className="flex-1 overflow-y-auto">
                        {fuzzResults.length > 0 ? (
                          <table className="w-full text-left font-mono text-xs">
                            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249] sticky top-0">
                              <tr>
                                <th className="px-3 py-1.5">Test Case</th>
                                <th className="px-3 py-1.5">Fault Category</th>
                                <th className="px-3 py-1.5">Status</th>
                                <th className="px-3 py-1.5">Verdict</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2b2d30]">
                              {fuzzResults.map((r, idx) => {
                                const isSelected = selectedFuzzResult?.testCase.id === r.testCase.id;
                                return (
                                  <tr
                                    key={idx}
                                    onClick={() => setSelectedFuzzResult(r)}
                                    className={`hover:bg-[#1e1f22] cursor-pointer transition-colors ${
                                      isSelected ? 'bg-[#1e1f22] border-l-2 border-[#38bdf8]' : ''
                                    }`}
                                  >
                                    <td className="px-3 py-2 text-white font-semibold">{r.testCase.name}</td>
                                    <td className="px-3 py-2 text-[#38bdf8] text-[10px]">{r.testCase.category}</td>
                                    <td
                                      className={`px-3 py-2 font-bold ${
                                        r.statusCode >= 500
                                          ? 'text-[#ef4444]'
                                          : r.statusCode >= 200 && r.statusCode < 300
                                          ? 'text-[#34d399]'
                                          : 'text-[#eab308]'
                                      }`}
                                    >
                                      HTTP {r.statusCode}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          r.verdict === 'UNHANDLED_CRASH_500'
                                            ? 'bg-[#ef4444] text-white'
                                            : r.verdict === 'INFO_DISCLOSURE'
                                            ? 'bg-[#f97316] text-white'
                                            : r.verdict === 'COMPLIANT_REJECTED'
                                            ? 'bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40'
                                            : 'bg-[#38bdf8]/20 text-[#38bdf8]'
                                        }`}
                                      >
                                        {r.verdict}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-center text-[#9da5b4] py-12 text-xs">
                            Click "Fuzz Boundary Extremes" to mathematically generate and execute boundary tests.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Selected test case dossier */}
                    <div className="w-80 p-3 bg-[#141517] overflow-y-auto space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#2b2d30]">
                        <span className="font-bold text-white text-xs">Test Case Dossier</span>
                        {selectedFuzzResult && (
                          <Button
                            variant="secondary"
                            size="xs"
                            leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
                            onClick={() => handleSendToRepeater(selectedFuzzResult)}
                          >
                            Send to Repeater
                          </Button>
                        )}
                      </div>

                      {selectedFuzzResult ? (
                        <div className="space-y-2.5 font-mono text-xs">
                          <div>
                            <label className="text-[10px] text-[#9da5b4] uppercase">Test Case Name</label>
                            <div className="text-white font-bold bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-0.5">
                              {selectedFuzzResult.testCase.name}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-[#9da5b4] uppercase">Fault Dimension</label>
                            <p className="text-xs text-[#dfdfdf] bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-0.5">
                              {selectedFuzzResult.testCase.description}
                            </p>
                          </div>

                          {selectedFuzzResult.verdict === 'UNHANDLED_CRASH_500' && (
                            <div className="p-2.5 bg-[#ef4444]/10 border border-[#ef4444]/40 rounded text-xs text-[#ef4444] space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <AlertTriangle className="w-4 h-4" /> Unhandled Server Exception (HTTP 500)
                              </div>
                              <p className="text-[11px] text-white">
                                The API crashed when supplied with boundary inputs instead of returning a compliant 400 Bad Request.
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] text-[#9da5b4] uppercase">Response Preview</label>
                            <pre className="text-[10px] text-[#dfdfdf] bg-[#1e1f22] p-2 rounded border border-[#3e4249] mt-0.5 max-h-48 overflow-x-auto whitespace-pre-wrap">
                              {selectedFuzzResult.rawResponse || selectedFuzzResult.bodySnippet}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-[#9da5b4] text-xs py-8">
                          Select a test case to inspect injected payloads and response.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-[#9da5b4] py-16 text-xs">
                  Select an API operation from the left to view and fuzz schemas.
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* Producer-Consumer Dependency Graph Modal */}
      {showDependencyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg p-4 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3e4249] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#34d399]" />
                Inferred Producer-Consumer Dataflow (RESTler Model)
              </span>
              <button onClick={() => setShowDependencyModal(false)} className="text-[#9da5b4] hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-[#9da5b4]">
              Stateful API fuzzer graph analyzing parameter producers (POST/PUT creating IDs) and downstream consumers requiring those parameters.
            </p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {dependencies.length === 0 ? (
                <div className="text-center text-[#9da5b4] py-8 text-xs">
                  No producer-consumer path dependencies detected in current schema.
                </div>
              ) : (
                dependencies.map((dep, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#141517] rounded border border-[#3e4249] flex items-center justify-between gap-4 font-mono text-xs"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9da5b4] font-sans font-bold">1. PRODUCER:</span>
                        <MethodBadge method={dep.producerMethod} />
                        <span className="text-white">{dep.producerPath}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          yields `{dep.expectedField}`
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9da5b4] font-sans font-bold">2. CONSUMER:</span>
                        <MethodBadge method={dep.consumerMethod} />
                        <span className="text-[#38bdf8]">{dep.consumerPath}</span>
                        <span className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                          needs &#123;{dep.paramName}&#125;
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSelectedOpId(dep.consumerOpId);
                        setShowDependencyModal(false);
                        addToast({
                          type: 'info',
                          title: 'Consumer Selected',
                          description: `Switched to consumer endpoint ${dep.consumerMethod} ${dep.consumerPath}`,
                        });
                      }}
                      className="text-[#38bdf8] hover:text-white"
                    >
                      Focus
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end border-t border-[#3e4249] pt-2">
              <Button variant="secondary" size="xs" onClick={() => setShowDependencyModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
