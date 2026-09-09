import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  FileCode2,
  Play,
  Copy,
  Sparkles,
} from 'lucide-react';

export const InQLWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [endpoint, setEndpoint] = useState('https://target.local/graphql');
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

  const responseJson = `{
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
}`;

  const handleIntrospect = () => {
    addToast({ type: 'success', title: 'Schema Introspected', description: 'Extracted 14 Queries, 8 Mutations, 22 Object Types' });
  };

  const handleRunQuery = () => {
    addToast({ type: 'info', title: 'Executed GraphQL Query', description: '200 OK (28ms)' });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">InQL GraphQL Security & Introspection Workbench</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Schema AST Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Sparkles className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleIntrospect}
          >
            Introspect Schema
          </Button>
          <Button
            variant="primary"
            size="xs"
            leftIcon={<Play className="w-3 h-3" />}
            onClick={handleRunQuery}
            className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
          >
            Execute Query
          </Button>
        </div>
      </div>

      {/* Target Config Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex items-center gap-3">
        <div className="flex-1 flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2 font-mono">Endpoint:</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 px-2 py-0.5 rounded text-[10px] font-bold">
            Introspection: Enabled
          </span>
          <span className="bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40 px-2 py-0.5 rounded text-[10px] font-bold">
            Batching: Vulnerable
          </span>
        </div>
      </div>

      {/* Main Split: Query Editor (Left) vs JSON Response (Right) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Query Editor */}
        <div className="flex-1 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#34d399]">
            <span>GraphQL Query / Mutation</span>
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
    </div>
  );
};
