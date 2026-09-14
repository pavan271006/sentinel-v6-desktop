import React, { useState, useEffect } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Copy,
  Sparkles,
  FolderTree,
} from 'lucide-react';
import { HackvertorEngine } from '../services/hackvertor/HackvertorEngine';

export const HackvertorWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [inputCode, setInputCode] = useState(
    `<@base64_encode><@url_encode>SELECT * FROM users WHERE username = 'admin' OR 1=1--<@/url_encode><@/base64_encode>`
  );

  const [evaluatedOutput, setEvaluatedOutput] = useState<string>('');

  useEffect(() => {
    let active = true;
    HackvertorEngine.evaluate(inputCode).then((out) => {
      if (active) setEvaluatedOutput(out);
    });
    return () => { active = false; };
  }, [inputCode]);

  const tagCategories = [
    {
      name: 'Encoders',
      tags: [
        { label: 'URL Encode', open: '<@url_encode>', close: '<@/url_encode>' },
        { label: 'URL Encode All', open: '<@url_encode_all>', close: '<@/url_encode_all>' },
        { label: 'Base64 Encode', open: '<@base64_encode>', close: '<@/base64_encode>' },
        { label: 'Base64URL Encode', open: '<@base64url_encode>', close: '<@/base64url_encode>' },
        { label: 'Hex Encode', open: '<@hex_encode>', close: '<@/hex_encode>' },
        { label: 'SQL Hex (0x...)', open: '<@sql_hex>', close: '<@/sql_hex>' },
        { label: 'HTML Entities', open: '<@html_entities>', close: '<@/html_entities>' },
        { label: 'HTML Decimal', open: '<@html_decimal>', close: '<@/html_decimal>' },
        { label: 'Unicode Escape', open: '<@unicode_escape>', close: '<@/unicode_escape>' },
        { label: 'Binary 8-bit', open: '<@binary_encode>', close: '<@/binary_encode>' },
      ],
    },
    {
      name: 'Decoders',
      tags: [
        { label: 'URL Decode', open: '<@url_decode>', close: '<@/url_decode>' },
        { label: 'Base64 Decode', open: '<@base64_decode>', close: '<@/base64_decode>' },
        { label: 'Base64URL Decode', open: '<@base64url_decode>', close: '<@/base64url_decode>' },
        { label: 'Hex Decode', open: '<@hex_decode>', close: '<@/hex_decode>' },
        { label: 'Binary Decode', open: '<@binary_decode>', close: '<@/binary_decode>' },
      ],
    },
    {
      name: 'Cryptographic Hashes',
      tags: [
        { label: 'SHA-256 Hash', open: '<@sha256>', close: '<@/sha256>' },
        { label: 'SHA-384 Hash', open: '<@sha384>', close: '<@/sha384>' },
        { label: 'SHA-512 Hash', open: '<@sha512>', close: '<@/sha512>' },
        { label: 'SHA-1 Hash', open: '<@sha1>', close: '<@/sha1>' },
        { label: 'MD5 Hash', open: '<@md5>', close: '<@/md5>' },
      ],
    },
    {
      name: 'SQL Evasion & WAF',
      tags: [
        { label: 'Inline Comment (/**/)', open: '<@space2comment>', close: '<@/space2comment>' },
        { label: 'Plus for Space (+)', open: '<@space2plus>', close: '<@/space2plus>' },
        { label: 'Randomize Case', open: '<@randomcase>', close: '<@/randomcase>' },
      ],
    },
    {
      name: 'String Modifiers',
      tags: [
        { label: 'ROT13', open: '<@rot13>', close: '<@/rot13>' },
        { label: 'Uppercase', open: '<@uppercase>', close: '<@/uppercase>' },
        { label: 'Lowercase', open: '<@lowercase>', close: '<@/lowercase>' },
        { label: 'Reverse', open: '<@reverse>', close: '<@/reverse>' },
        { label: 'Strip Whitespace', open: '<@strip_whitespace>', close: '<@/strip_whitespace>' },
      ],
    },
  ];

  const insertTag = (open: string, close: string) => {
    setInputCode(`${open}${inputCode}${close}`);
    addToast({ type: 'success', title: `Wrapped in ${open}...${close}` });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Hackvertor Multi-Layer Tag Conversion Workbench</span>
          <span className="bg-[#141517] text-[#38bdf8] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            Recursive Tag Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Copy className="w-3 h-3" />}
            onClick={() => {
              navigator.clipboard.writeText(evaluatedOutput);
              addToast({ type: 'success', title: 'Copied Output to Clipboard' });
            }}
          >
            Copy Result
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Tag Palette Library */}
        <div className="w-64 flex flex-col bg-[#141517] border-r border-[#2b2d30] p-3 space-y-4 overflow-y-auto flex-shrink-0">
          <div className="text-xs font-semibold text-[#9da5b4] flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-[#f37021]" />
            <span>Tag Library</span>
          </div>

          <div className="space-y-3">
            {tagCategories.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-[11px] font-semibold text-[#6f737a] uppercase tracking-wider">{cat.name}</div>
                <div className="grid grid-cols-1 gap-1">
                  {cat.tags.map((t, tidx) => (
                    <button
                      key={tidx}
                      onClick={() => insertTag(t.open, t.close)}
                      className="text-left px-2 py-1 rounded bg-[#1e1f22] hover:bg-[#2b2d30] text-[#c4c7c5] hover:text-[#f37021] border border-[#313438] transition-colors font-mono text-[11px] truncate"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Input Tag Editor */}
        <div className="flex-1 flex flex-col border-r border-[#2b2d30] bg-[#1e1f22] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#9da5b4]">
            <span>Hackvertor Input Code (Tags & Payload)</span>
            <span className="font-mono text-[10px] text-[#6f737a]">{inputCode.length} chars</span>
          </div>
          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Type payload or insert tags like <@url_encode>test<@/url_encode>..."
            className="flex-1 w-full bg-[#141517] text-[#34d399] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
          />
        </div>

        {/* Right: Evaluated Real-Time Output */}
        <div className="flex-1 flex flex-col bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#f37021]">
            <span>Live Evaluated Output</span>
            <span className="font-mono text-[10px] text-[#6f737a]">{evaluatedOutput.length} chars</span>
          </div>
          <textarea
            readOnly
            value={evaluatedOutput}
            className="flex-1 w-full bg-[#1e1f22] text-[#38bdf8] font-mono text-xs p-3 rounded border border-[#313438] focus:outline-none resize-none select-all leading-5"
          />
        </div>
      </div>
    </div>
  );
};
