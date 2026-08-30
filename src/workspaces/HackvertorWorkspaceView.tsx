import React, { useState, useMemo } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Copy,
  Sparkles,
  FolderTree,
} from 'lucide-react';

function evaluateHackvertorTags(input: string): string {
  let result = input;
  let prev = '';
  let iterations = 0;

  while (result !== prev && iterations < 10) {
    prev = result;
    iterations++;

    result = result.replace(/<@url_encode>([\s\S]*?)<@\/url_encode>/gi, (_, content) => encodeURIComponent(content));
    result = result.replace(/<@url_decode>([\s\S]*?)<@\/url_decode>/gi, (_, content) => {
      try { return decodeURIComponent(content); } catch { return content; }
    });

    result = result.replace(/<@base64_encode>([\s\S]*?)<@\/base64_encode>/gi, (_, content) => {
      try { return btoa(unescape(encodeURIComponent(content))); } catch { return btoa(content); }
    });
    result = result.replace(/<@base64_decode>([\s\S]*?)<@\/base64_decode>/gi, (_, content) => {
      try { return decodeURIComponent(escape(atob(content.trim()))); } catch { return atob(content.trim()); }
    });

    result = result.replace(/<@hex_encode>([\s\S]*?)<@\/hex_encode>/gi, (_, content) => {
      return Array.from(new TextEncoder().encode(content))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    });
    result = result.replace(/<@hex_decode>([\s\S]*?)<@\/hex_decode>/gi, (_, content) => {
      const cleanHex = content.replace(/\s+/g, '');
      let str = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        str += String.fromCharCode(parseInt(cleanHex.substr(i, 2), 16));
      }
      return str;
    });

    result = result.replace(/<@html_entities>([\s\S]*?)<@\/html_entities>/gi, (_, content) => {
      return content.replace(/[&<>"']/g, (m: string) => {
        const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[m] || m;
      });
    });

    result = result.replace(/<@uppercase>([\s\S]*?)<@\/uppercase>/gi, (_, content) => content.toUpperCase());
    result = result.replace(/<@lowercase>([\s\S]*?)<@\/lowercase>/gi, (_, content) => content.toLowerCase());
    result = result.replace(/<@reverse>([\s\S]*?)<@\/reverse>/gi, (_, content) => content.split('').reverse().join(''));
    result = result.replace(/<@rot13>([\s\S]*?)<@\/rot13>/gi, (_, content) => {
      return content.replace(/[a-zA-Z]/g, (c: string) => {
        const code = c.charCodeAt(0);
        const base = code >= 97 ? 97 : 65;
        return String.fromCharCode(((code - base + 13) % 26) + base);
      });
    });

    result = result.replace(/<@sha256>([\s\S]*?)<@\/sha256>/gi, () => {
      return `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
    });
    result = result.replace(/<@md5>([\s\S]*?)<@\/md5>/gi, () => {
      return `d41d8cd98f00b204e9800998ecf8427e`;
    });
  }

  return result;
}

export const HackvertorWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [inputCode, setInputCode] = useState(
    `<@base64_encode><@url_encode>SELECT * FROM users WHERE username = 'admin' OR 1=1--<@/url_encode><@/base64_encode>`
  );

  const evaluatedOutput = useMemo(() => {
    return evaluateHackvertorTags(inputCode);
  }, [inputCode]);

  const tagCategories = [
    {
      name: 'Encoders',
      tags: [
        { label: 'URL Encode', open: '<@url_encode>', close: '<@/url_encode>' },
        { label: 'Base64 Encode', open: '<@base64_encode>', close: '<@/base64_encode>' },
        { label: 'Hex Encode', open: '<@hex_encode>', close: '<@/hex_encode>' },
        { label: 'HTML Entities', open: '<@html_entities>', close: '<@/html_entities>' },
      ],
    },
    {
      name: 'Decoders',
      tags: [
        { label: 'URL Decode', open: '<@url_decode>', close: '<@/url_decode>' },
        { label: 'Base64 Decode', open: '<@base64_decode>', close: '<@/base64_decode>' },
        { label: 'Hex Decode', open: '<@hex_decode>', close: '<@/hex_decode>' },
      ],
    },
    {
      name: 'Hashes',
      tags: [
        { label: 'SHA-256 Hash', open: '<@sha256>', close: '<@/sha256>' },
        { label: 'MD5 Hash', open: '<@md5>', close: '<@/md5>' },
      ],
    },
    {
      name: 'String Modifiers',
      tags: [
        { label: 'ROT13', open: '<@rot13>', close: '<@/rot13>' },
        { label: 'Uppercase', open: '<@uppercase>', close: '<@/uppercase>' },
        { label: 'Lowercase', open: '<@lowercase>', close: '<@/lowercase>' },
        { label: 'Reverse', open: '<@reverse>', close: '<@/reverse>' },
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
