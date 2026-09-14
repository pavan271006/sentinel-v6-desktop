import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { Button } from '../design-system/Button';
import {
  FileCode2,
  Play,
  Copy,
  Sparkles,
  Zap,
  Flame,
  Send,
} from 'lucide-react';
import {
  GraphQLEngine,
  ParsedSchema,
  GraphQLSecurityAudit,
  FULL_INTROSPECTION_QUERY,
} from '../services/graphql/GraphQLEngine';

export const InQLWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { createTab } = useRepeaterStore();

  const [endpoint, setEndpoint] = useState('https://target.local/graphql');
  const [showStuffingModal, setShowStuffingModal] = useState(false);
  const [stuffingMutation, setStuffingMutation] = useState('login');
  const [stuffingUsername, setStuffingUsername] = useState('admin');
  const [stuffingPasswords, setStuffingPasswords] = useState(
    'admin\npassword\n123456\nadmin123\nletmein\nwelcome\nPassword123!'
  );
  const [queryText, setQueryText] = useState(
`query GetUserData {
  user(id: "1") {
    id
    username
    email
    role
    apiKey
    internalNotes
  }
}`
  );

  const [responseJson, setResponseJson] = useState<string>(
`{
  "data": {
    "user": {
      "id": "1",
      "username": "admin",
      "email": "admin@target.local",
      "role": "SYSTEM_ADMIN",
      "apiKey": "mock_key_99214a19e2",
      "internalNotes": "Master service account"
    }
  }
}`
  );

  const [schema, setSchema] = useState<ParsedSchema | null>(null);
  const [audit, setAudit] = useState<GraphQLSecurityAudit | null>({
    introspectionEnabled: true,
    arrayBatchingSupported: true,
    aliasBatchingSupported: true,
    fieldSuggestionsEnabled: true,
    sensitiveQueriesDiscovered: ['user', 'systemLogs', 'exportData'],
    sensitiveMutationsDiscovered: ['updateUserRole', 'deleteAccount', 'grantAdminToken'],
  });

  const [isIntrospecting, setIsIntrospecting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'queries' | 'mutations' | 'types'>('queries');

  const handleIntrospect = async () => {
    setIsIntrospecting(true);
    addToast({
      type: 'info',
      title: 'Running GraphQL Introspection',
      description: `Sending full schema introspection query to ${endpoint}...`,
    });

    const engine = new GraphQLEngine(endpoint);
    try {
      const parsed = await engine.introspectSchema();
      setSchema(parsed);

      const secAudit = await engine.auditSecurity(parsed);
      setAudit(secAudit);

      addToast({
        type: 'success',
        title: 'Introspection Completed',
        description: `Discovered ${parsed.queries.length} Queries, ${parsed.mutations.length} Mutations, ${parsed.types.length} Types (${parsed.sensitiveFieldsCount} Sensitive)`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Introspection Failed',
        description: err?.message || 'Server rejected introspection query',
      });
    } finally {
      setIsIntrospecting(false);
    }
  };

  const handleRecoverClairvoyance = async () => {
    setIsIntrospecting(true);
    addToast({
      type: 'info',
      title: 'Running Clairvoyance Schema Recovery',
      description: 'Probing endpoint error field suggestions to reconstruct schema...',
    });

    const engine = new GraphQLEngine(endpoint);
    try {
      const parsed = await engine.recoverSchemaViaFieldSuggestions();
      setSchema(parsed);

      const secAudit = await engine.auditSecurity(parsed);
      setAudit(secAudit);

      addToast({
        type: 'success',
        title: 'Clairvoyance Recovery Completed',
        description: `Recovered ${parsed.queries.length} Queries, ${parsed.types.length} Types (${parsed.sensitiveFieldsCount} Sensitive) from error suggestions!`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Recovery Failed',
        description: err?.message || 'Error occurred during field suggestion probing',
      });
    } finally {
      setIsIntrospecting(false);
    }
  };

  const handleRunQuery = async () => {
    setIsExecuting(true);
    const engine = new GraphQLEngine(endpoint);

    try {
      const res = await engine.executeQuery(queryText);
      setResponseJson(
        res.data || res.errors
          ? JSON.stringify({ data: res.data, errors: res.errors }, null, 2)
          : res.rawResponse
      );

      addToast({
        type: res.statusCode === 200 ? 'success' : 'warning',
        title: `GraphQL Response (HTTP ${res.statusCode})`,
        description: `Executed in ${res.durationMs}ms`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Execution Error',
        description: err?.message || 'Failed to dispatch query',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSendToRepeater = () => {
    const bodyStr = JSON.stringify({ query: queryText });
    createTab({
      title: 'GraphQL Probe',
      url: endpoint,
      method: 'POST',
      headers: [
        { id: 'h-1', name: 'Content-Type', value: 'application/json', enabled: true },
        { id: 'h-2', name: 'User-Agent', value: 'Sentinel-InQL/6.0', enabled: true },
      ],
      body: bodyStr,
    });

    addToast({ type: 'success', title: 'Sent to Repeater', description: 'Loaded GraphQL request in Repeater' });
  };

  const loadAttackTemplate = (type: 'batch_array' | 'batch_alias' | 'dos_depth' | 'introspection') => {
    const engine = new GraphQLEngine(endpoint);
    switch (type) {
      case 'introspection':
        setQueryText(FULL_INTROSPECTION_QUERY);
        break;
      case 'batch_array':
        setQueryText(engine.generateArrayBatchingAttack('{ __typename }', 5));
        break;
      case 'batch_alias':
        setQueryText(engine.generateAliasBatchingAttack('user(id: "1")', 5));
        break;
      case 'dos_depth':
        setQueryText(engine.generateDeepNestingAttack(6));
        break;
    }
    addToast({ type: 'info', title: 'Attack Payload Generated', description: `Loaded ${type} template in editor` });
  };

  const handleGenerateStuffingAttack = () => {
    const pwds = stuffingPasswords
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    const engine = new GraphQLEngine(endpoint);
    const payload = engine.generateCredentialStuffingAliasAttack(
      stuffingMutation,
      stuffingUsername,
      pwds
    );
    setQueryText(payload);
    setShowStuffingModal(false);
    addToast({
      type: 'warning',
      title: 'Alias Batching Stuffing Payload Loaded',
      description: `Packed ${pwds.length} login attempts into single mutation query to bypass IP rate limits!`,
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">InQL GraphQL Security & Introspection Workbench</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            AST Explorer & Attack Generator
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Send className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleSendToRepeater}
          >
            Send to Repeater
          </Button>
          <Button
            variant="secondary"
            size="xs"
            disabled={isIntrospecting}
            leftIcon={<Sparkles className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleIntrospect}
          >
            {isIntrospecting ? 'Introspecting...' : 'Introspect Schema'}
          </Button>
          <Button
            variant="secondary"
            size="xs"
            disabled={isIntrospecting}
            leftIcon={<Zap className="w-3 h-3 text-[#34d399]" />}
            onClick={handleRecoverClairvoyance}
            title="Recover schema via error field suggestions when introspection is disabled"
          >
            Recover (Clairvoyance)
          </Button>
          <Button
            variant="primary"
            size="xs"
            disabled={isExecuting}
            leftIcon={<Play className="w-3 h-3" />}
            onClick={handleRunQuery}
            className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
          >
            {isExecuting ? 'Executing...' : 'Execute Query'}
          </Button>
        </div>
      </div>

      {/* Target & Security Posture Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2 font-mono">Endpoint:</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        {/* Security Audit Badges */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              audit?.introspectionEnabled
                ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                : 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/40'
            }`}
          >
            Introspection: {audit?.introspectionEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              audit?.arrayBatchingSupported
                ? 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/40'
                : 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/40'
            }`}
          >
            Batching: {audit?.arrayBatchingSupported ? 'Vulnerable' : 'Protected'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              audit?.fieldSuggestionsEnabled
                ? 'bg-[#f97316]/20 text-[#f97316] border-[#f97316]/40'
                : 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/40'
            }`}
          >
            Suggestions: {audit?.fieldSuggestionsEnabled ? 'Leaked' : 'Hardened'}
          </span>
        </div>
      </div>

      {/* Attack Generators Shortcut Bar */}
      <div className="h-8 bg-[#1a1b1e] border-b border-[#2b2d30] px-3 flex items-center gap-2">
        <span className="text-[11px] text-[#9da5b4] font-semibold flex items-center gap-1">
          <Flame className="w-3 h-3 text-[#f37021]" /> Attack Generators:
        </span>
        <button
          onClick={() => loadAttackTemplate('introspection')}
          className="px-2 py-0.5 bg-[#2b2d30] hover:bg-[#383a40] text-white rounded text-[10px] font-medium"
        >
          Full Introspection
        </button>
        <button
          onClick={() => loadAttackTemplate('batch_array')}
          className="px-2 py-0.5 bg-[#2b2d30] hover:bg-[#383a40] text-white rounded text-[10px] font-medium"
        >
          Array Batching
        </button>
        <button
          onClick={() => loadAttackTemplate('batch_alias')}
          className="px-2 py-0.5 bg-[#2b2d30] hover:bg-[#383a40] text-white rounded text-[10px] font-medium"
        >
          Alias Batching
        </button>
        <button
          onClick={() => loadAttackTemplate('dos_depth')}
          className="px-2 py-0.5 bg-[#2b2d30] hover:bg-[#383a40] text-white rounded text-[10px] font-medium"
        >
          Deep Recursion DoS
        </button>
        <button
          onClick={() => setShowStuffingModal(true)}
          className="px-2.5 py-0.5 bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          ⚡ Alias Credential Stuffing (Rate-Limit Bypass)
        </button>
      </div>

      {/* Main Split: Schema Explorer (Left), Query Editor (Center), JSON Response (Right) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Schema Explorer Tree */}
        <div className="w-72 border-r border-[#2b2d30] bg-[#141517] flex flex-col">
          <div className="flex border-b border-[#2b2d30] bg-[#1e1f22]">
            {(['queries', 'mutations', 'types'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-center text-xs capitalize font-medium transition-colors ${
                  activeTab === tab ? 'bg-[#141517] text-[#f37021] border-b-2 border-[#f37021]' : 'text-[#9da5b4]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
            {schema ? (
              activeTab === 'queries' ? (
                schema.queries.map((q) => (
                  <div
                    key={q.name}
                    onClick={() => {
                      const engine = new GraphQLEngine(endpoint);
                      setQueryText(engine.generateQueryTemplate(q, false));
                    }}
                    className="p-1.5 rounded hover:bg-[#1e1f22] cursor-pointer flex items-center justify-between group"
                  >
                    <span className="text-[#38bdf8] group-hover:text-white truncate">{q.name}</span>
                    {q.isSensitive && (
                      <span className="text-[9px] bg-[#ef4444]/20 text-[#ef4444] px-1 rounded font-bold">
                        SENSITIVE
                      </span>
                    )}
                  </div>
                ))
              ) : activeTab === 'mutations' ? (
                schema.mutations.map((m) => (
                  <div
                    key={m.name}
                    onClick={() => {
                      const engine = new GraphQLEngine(endpoint);
                      setQueryText(engine.generateQueryTemplate(m, true));
                    }}
                    className="p-1.5 rounded hover:bg-[#1e1f22] cursor-pointer flex items-center justify-between group"
                  >
                    <span className="text-[#f97316] group-hover:text-white truncate">{m.name}</span>
                    {m.isSensitive && (
                      <span className="text-[9px] bg-[#ef4444]/20 text-[#ef4444] px-1 rounded font-bold">
                        SENSITIVE
                      </span>
                    )}
                  </div>
                ))
              ) : (
                schema.types.map((t) => (
                  <div key={t.name} className="p-1.5 rounded hover:bg-[#1e1f22] text-[#34d399] truncate">
                    {t.name} <span className="text-[10px] text-[#9da5b4]">({t.kind})</span>
                  </div>
                ))
              )
            ) : (
              <div className="text-center text-[#9da5b4] py-8 text-xs">
                Click "Introspect Schema" to explore queries, mutations, and types.
              </div>
            )}
          </div>
        </div>

        {/* Center: Query Editor */}
        <div className="flex-1 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#34d399]">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#34d399]" />
              GraphQL Query / Mutation Editor
            </span>
            <span className="font-mono text-[10px] text-[#6f737a]">{queryText.length} chars</span>
          </div>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="flex-1 w-full bg-[#1e1f22] text-[#34d399] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
          />
        </div>

        {/* Right: Response JSON */}
        <div className="flex-1 flex flex-col bg-[#1e1f22] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#38bdf8]">
            <span>Response JSON</span>
            <Button
              variant="secondary"
              size="xs"
              leftIcon={<Copy className="w-3 h-3" />}
              onClick={() => {
                navigator.clipboard.writeText(responseJson);
                addToast({ type: 'success', title: 'Copied Response JSON' });
              }}
            >
              Copy
            </Button>
          </div>
          <textarea
            readOnly
            value={responseJson}
            className="flex-1 w-full bg-[#141517] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:outline-none resize-none select-all leading-5"
          />
        </div>
      </div>

      {/* Alias Credential Stuffing Modal */}
      {showStuffingModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-amber-500/40 rounded-lg p-4 w-full max-w-md space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3e4249] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                GraphQL Alias Credential Stuffing Generator
              </span>
              <button onClick={() => setShowStuffingModal(false)} className="text-[#9da5b4] hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-[#9da5b4]">
              Bypasses IP-based login rate limiting and WAF thresholds by packing hundreds of password guesses into unique aliased queries within a single HTTP mutation.
            </p>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] text-[#9da5b4] font-semibold mb-1">Target Mutation Name</label>
                <input
                  type="text"
                  value={stuffingMutation}
                  onChange={(e) => setStuffingMutation(e.target.value)}
                  placeholder="e.g. login or authenticate"
                  className="w-full bg-[#141517] border border-[#3e4249] rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#9da5b4] font-semibold mb-1">Target Username / Identifier</label>
                <input
                  type="text"
                  value={stuffingUsername}
                  onChange={(e) => setStuffingUsername(e.target.value)}
                  placeholder="e.g. admin or victim@domain.com"
                  className="w-full bg-[#141517] border border-[#3e4249] rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#9da5b4] font-semibold mb-1">Password Candidates (1 per line)</label>
                <textarea
                  value={stuffingPasswords}
                  onChange={(e) => setStuffingPasswords(e.target.value)}
                  className="w-full h-28 bg-[#141517] border border-[#3e4249] rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#3e4249]">
              <Button variant="secondary" size="xs" onClick={() => setShowStuffingModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={handleGenerateStuffingAttack}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                Generate Alias Attack Query
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
