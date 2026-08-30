import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge, MethodBadge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { useToastStore } from '../stores/toastStore';
import { FileCode2, Radio, Play } from 'lucide-react';

export interface ApiEndpointSpec {
  id: string;
  type: 'REST' | 'GRAPHQL' | 'WEBSOCKET';
  path: string;
  method?: string;
  authRequired: boolean;
  parameters: { name: string; type: string; in: string; required: boolean }[];
  description: string;
}

const SAMPLE_ENDPOINTS: ApiEndpointSpec[] = [
  {
    id: 'api-01',
    type: 'REST',
    path: '/api/v1/invoices/{id}',
    method: 'GET',
    authRequired: true,
    parameters: [
      { name: 'id', type: 'integer', in: 'path', required: true },
      { name: 'format', type: 'string', in: 'query', required: false },
    ],
    description: 'Fetch detailed invoice records by ID.',
  },
  {
    id: 'api-02',
    type: 'GRAPHQL',
    path: '/graphql',
    method: 'POST',
    authRequired: false,
    parameters: [{ name: 'query', type: 'string', in: 'body', required: true }],
    description: 'GraphQL Endpoint (Introspection Enabled: 42 types exposed)',
  },
  {
    id: 'api-03',
    type: 'WEBSOCKET',
    path: '/ws/v1/notifications',
    authRequired: true,
    parameters: [{ name: 'token', type: 'string', in: 'query', required: true }],
    description: 'Real-time push notification stream over WS.',
  },
];

export const ApiSecurityWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [endpoints] = useState<ApiEndpointSpec[]>(SAMPLE_ENDPOINTS);
  const [selectedId, setSelectedId] = useState<string>('api-02');
  const [graphqlQuery, setGraphqlQuery] = useState(
    'query IntrospectionQuery {\n  __schema {\n    queryType { name }\n    mutationType { name }\n    types {\n      name\n      fields { name type { name } }\n    }\n  }\n}'
  );

  const selectedApi = endpoints.find((e) => e.id === selectedId) || endpoints[0];

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileCode2 className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">API Security & Schema Explorer</h1>
            <p className="text-xs text-text-secondary">OpenAPI 3.0, GraphQL introspection, and WebSocket frame analyzer.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="scope-in">OPENAPI 3.0 LOADED</Badge>
          <Badge variant="neutral">{endpoints.length} Operations Indexed</Badge>
        </div>
      </div>

      {/* Main Split: Endpoint List (Left) vs Deep Schema / GraphQL Inspector (Right) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={500}
          minSize={300}
          maxSize={800}
          storageKey="api_security_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-y-auto p-3 space-y-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
                Discovered API Operations
              </span>
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => setSelectedId(ep.id)}
                  className={`p-3 rounded border cursor-pointer transition-colors space-y-1.5 ${
                    selectedId === ep.id ? 'bg-bg-panel-elevated border-accent-cyan/50' : 'bg-bg-app border-border-subtle hover:border-border-default'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ep.method ? <MethodBadge method={ep.method} /> : <Badge variant="neutral">{ep.type}</Badge>}
                      <span className="font-mono text-xs font-semibold text-text-primary">{ep.path}</span>
                    </div>
                    <Badge variant={ep.authRequired ? 'scope-deny' : 'scope-in'}>
                      {ep.authRequired ? 'AUTH' : 'PUBLIC'}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">{ep.description}</p>
                </div>
              ))}
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedApi && (
                <>
                  <div className="p-3 bg-bg-panel rounded border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Operation Specification</span>
                      <Badge variant="neutral">{selectedApi.type}</Badge>
                    </div>

                    <h2 className="text-sm font-bold text-text-primary font-mono">{selectedApi.path}</h2>
                    <p className="text-xs text-text-secondary">{selectedApi.description}</p>

                    {/* Parameters Table */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Parameters:</span>
                      <div className="space-y-1">
                        {selectedApi.parameters.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-bg-app rounded border border-border-subtle text-xs">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-accent-cyan font-bold">{p.name}</span>
                              <span className="text-text-muted">({p.type})</span>
                              <span className="text-text-secondary">in {p.in}</span>
                            </div>
                            <Badge variant={p.required ? 'scope-deny' : 'neutral'}>
                              {p.required ? 'REQUIRED' : 'OPTIONAL'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* GraphQL Workspace if selected */}
                  {selectedApi.type === 'GRAPHQL' && (
                    <div className="p-3 bg-bg-panel rounded border border-border-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">GraphQL Query & Mutation Fuzzer</span>
                        <Badge variant="scope-deny">INTROSPECTION ENABLED</Badge>
                      </div>
                      <textarea
                        value={graphqlQuery}
                        onChange={(e) => setGraphqlQuery(e.target.value)}
                        className="w-full h-36 bg-bg-app border border-border-subtle rounded p-2.5 font-mono text-xs text-text-primary focus:border-accent-cyan outline-none resize-none"
                        spellCheck={false}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Play className="w-3.5 h-3.5" />}
                          onClick={() => addToast({ type: 'success', title: 'GraphQL Introspection Query Executed (42 types extracted)' })}
                        >
                          Execute Introspection
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Radio className="w-3.5 h-3.5" />}
                          onClick={() => addToast({ type: 'info', title: 'Fuzzing circular depth limits...' })}
                        >
                          Fuzz Depth Limits
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
