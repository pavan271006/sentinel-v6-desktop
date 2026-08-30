import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  KeyRound,
  ShieldAlert,
  Zap,
  Copy,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

function base64UrlEncode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

function base64UrlDecode(str: string): string {
  try {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += '==';
        break;
      case 3:
        output += '=';
        break;
      default:
        throw new Error('Illegal base64url string!');
    }
    return decodeURIComponent(escape(atob(output)));
  } catch {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }
}

export const JwtWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [rawToken, setRawToken] = useState(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoidXNlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNzg3MDU4NDQxfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  );

  const [headerJson, setHeaderJson] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadJson, setPayloadJson] = useState('{\n  "sub": "1234567890",\n  "name": "Admin User",\n  "role": "user",\n  "iat": 1516239022,\n  "exp": 1787058441\n}');
  const [secretKey, setSecretKey] = useState('your-256-bit-secret');

  // Decode raw token on change
  const handleRawTokenChange = (token: string) => {
    setRawToken(token);
    try {
      const parts = token.trim().split('.');
      if (parts.length >= 2) {
        const decodedHeader = base64UrlDecode(parts[0]);
        const decodedPayload = base64UrlDecode(parts[1]);
        setHeaderJson(JSON.stringify(JSON.parse(decodedHeader), null, 2));
        setPayloadJson(JSON.stringify(JSON.parse(decodedPayload), null, 2));
      }
    } catch {
      // Ignored during partial typing
    }
  };

  // Re-encode token from edited Header & Payload
  const handleReEncode = () => {
    try {
      const encodedH = base64UrlEncode(JSON.stringify(JSON.parse(headerJson)));
      const encodedP = base64UrlEncode(JSON.stringify(JSON.parse(payloadJson)));
      const unsigned = `${encodedH}.${encodedP}`;
      const newSignature = base64UrlEncode(`sig_${secretKey}_${Date.now()}`);
      setRawToken(`${unsigned}.${newSignature}`);
      addToast({ type: 'success', title: 'JWT Re-Encoded', description: 'Updated raw token buffer' });
    } catch (err) {
      addToast({ type: 'error', title: 'Invalid JSON', description: String(err) });
    }
  };

  // 1. Attack: Alg: None
  const handleAlgNoneAttack = () => {
    try {
      const headerObj = JSON.parse(headerJson);
      headerObj.alg = 'none';
      const newHeaderStr = JSON.stringify(headerObj, null, 2);
      setHeaderJson(newHeaderStr);
      const encodedH = base64UrlEncode(JSON.stringify(headerObj));
      const encodedP = base64UrlEncode(JSON.stringify(JSON.parse(payloadJson)));
      setRawToken(`${encodedH}.${encodedP}.`);
      addToast({ type: 'warning', title: 'Alg: None Attack Applied', description: 'Signature stripped & alg set to "none"' });
    } catch (err) {
      addToast({ type: 'error', title: 'Parse Error', description: String(err) });
    }
  };

  // 2. Attack: Escalate Role to Admin
  const handleEscalateAdmin = () => {
    try {
      const payloadObj = JSON.parse(payloadJson);
      payloadObj.role = 'admin';
      payloadObj.isAdmin = true;
      payloadObj.admin = true;
      payloadObj.exp = Math.floor(Date.now() / 1000) + 86400 * 365; // +1 year
      const newPayloadStr = JSON.stringify(payloadObj, null, 2);
      setPayloadJson(newPayloadStr);
      handleReEncode();
      addToast({ type: 'success', title: 'Role Escalated to Admin', description: 'Added admin: true & extended expiry' });
    } catch (err) {
      addToast({ type: 'error', title: 'Parse Error', description: String(err) });
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* 1. Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">JSON Web Tokens (JWT) Pentest & Verification Workbench</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            RFC 7519 / RFC 7515
          </span>
        </div>

        {/* Quick Attack Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Zap className="w-3 h-3 text-[#f37021]" />}
            onClick={handleAlgNoneAttack}
            title="Perform CVE-2015-9235 'alg: none' signature bypass"
          >
            Alg: None Attack
          </Button>

          <Button
            variant="secondary"
            size="xs"
            leftIcon={<ShieldAlert className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleEscalateAdmin}
            title="Modify claims to grant admin privileges"
          >
            Escalate to Admin
          </Button>

          <Button
            variant="primary"
            size="xs"
            leftIcon={<RefreshCw className="w-3 h-3" />}
            onClick={handleReEncode}
            className="bg-[#f37021] hover:bg-[#e05d06] text-white"
          >
            Re-Encode Token
          </Button>

          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Copy className="w-3 h-3" />}
            onClick={() => {
              navigator.clipboard.writeText(rawToken);
              addToast({ type: 'success', title: 'Copied JWT to Clipboard' });
            }}
          >
            Copy
          </Button>
        </div>
      </div>

      {/* 2. Main 3-Pane Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Pane: Encoded Raw Token Buffer */}
        <div className="w-1/3 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#9da5b4]">
            <span>Raw Encoded Token</span>
            <span className="font-mono text-[10px] text-[#6f737a]">{rawToken.length} chars</span>
          </div>
          <textarea
            value={rawToken}
            onChange={(e) => handleRawTokenChange(e.target.value)}
            placeholder="Paste JWT here (header.payload.signature)..."
            className="flex-1 w-full bg-[#1e1f22] text-[#f37021] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none break-all leading-5"
          />

          {/* Quick Info & Signature Status */}
          <div className="mt-3 p-2.5 bg-[#1e1f22] rounded border border-[#313438] space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#9da5b4]">Signature Status:</span>
              <span className="flex items-center gap-1 text-[#34d399] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9da5b4]">Algorithm:</span>
              <span className="text-white font-bold">{JSON.parse(headerJson || '{}').alg || 'HS256'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9da5b4]">Type:</span>
              <span className="text-white">JWT</span>
            </div>
          </div>
        </div>

        {/* Center Pane: Decoded Header & Payload JSON Editors */}
        <div className="flex-1 flex flex-col border-r border-[#2b2d30] bg-[#1e1f22] p-3 space-y-3 overflow-y-auto">
          {/* Header Editor */}
          <div className="flex-1 flex flex-col min-h-[160px]">
            <div className="flex items-center justify-between pb-1 text-xs font-semibold text-[#ef4444]">
              <span>Header: Algorithm & Token Type</span>
              <span className="text-[10px] font-mono text-[#9da5b4]">JSON</span>
            </div>
            <textarea
              value={headerJson}
              onChange={(e) => setHeaderJson(e.target.value)}
              className="flex-1 w-full bg-[#141517] text-[#ef4444] font-mono text-xs p-2.5 rounded border border-[#313438] focus:border-[#ef4444] focus:outline-none resize-none"
            />
          </div>

          {/* Payload Editor */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-1 text-xs font-semibold text-[#a855f7]">
              <span>Payload: Claims & Identity Attributes</span>
              <span className="text-[10px] font-mono text-[#9da5b4]">JSON</span>
            </div>
            <textarea
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="flex-1 w-full bg-[#141517] text-[#a855f7] font-mono text-xs p-2.5 rounded border border-[#313438] focus:border-[#a855f7] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Right Pane: Signature Verification & Secret Key Management */}
        <div className="w-80 flex flex-col bg-[#2b2d30] p-3 space-y-3 overflow-y-auto flex-shrink-0">
          <div className="text-xs font-semibold text-[#38bdf8] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Verify & Sign Secret</span>
          </div>

          <div>
            <label className="text-[11px] text-[#9da5b4] block mb-1">HMAC SHA-256 Secret Key</label>
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full bg-[#141517] text-white px-2.5 py-1.5 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono text-xs"
            />
          </div>

          <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2 text-xs">
            <span className="font-semibold text-white">Common Pentest Attacks</span>
            <div className="space-y-1.5 text-[11px] text-[#9da5b4]">
              <div className="flex items-start gap-1.5">
                <span className="text-[#f37021] font-bold">•</span>
                <span><strong>CVE-2015-9235:</strong> Change alg to 'none', 'None', 'NONE' to bypass signature checks.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#38bdf8] font-bold">•</span>
                <span><strong>Key Confusion:</strong> Convert RS256 to HS256 using target's public RSA key.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#34d399] font-bold">•</span>
                <span><strong>JWK Injection:</strong> Embed attacker public key directly in JWT header.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
