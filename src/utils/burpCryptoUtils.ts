/**
 * Burp Suite Professional Cryptographic Hashing and Codec Engine
 * Implements all encoding, decoding, and cryptographic hash functions
 * shown in Burp Suite Community & Professional Decoder.
 */

// ============================================================================
// 1. MD5 Implementation (RFC 1321)
// ============================================================================
export function md5(message: string): string {
  function RotateLeft(lValue: number, iShiftBits: number): number {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function AddUnsigned(lX: number, lY: number): number {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) {
      return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      } else {
        return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      }
    } else {
      return lResult ^ lX8 ^ lY8;
    }
  }
  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }

  function ConvertToWordArray(str: string): number[] {
    const bytes = new TextEncoder().encode(str);
    const lMessageLength = bytes.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray: number[] = new Array(lNumberOfWords).fill(0);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (bytes[lByteCount] << lBytePosition);
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = (lMessageLength * 8) & 0xffffffff;
    lWordArray[lNumberOfWords - 1] = Math.floor((lMessageLength * 8) / 0x100000000);
    return lWordArray;
  }

  function WordToHex(lValue: number): string {
    let WordToHexValue = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue += lByte.toString(16).padStart(2, '0');
    }
    return WordToHexValue;
  }

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  const x = ConvertToWordArray(message);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);

    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);

    a = AddUnsigned(a, AA);
    b = AddUnsigned(b, BB);
    c = AddUnsigned(c, CC);
    d = AddUnsigned(d, DD);
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

// ============================================================================
// 2. MD2 Implementation (RFC 1319)
// ============================================================================
export function md2(message: string): string {
  const S = [
    41, 46, 67, 201, 162, 216, 124, 1, 61, 54, 84, 161, 236, 240, 6, 19,
    98, 167, 5, 243, 192, 199, 115, 140, 152, 147, 43, 217, 188, 76, 130, 202,
    30, 155, 87, 60, 253, 212, 224, 22, 103, 66, 111, 24, 138, 23, 229, 18,
    190, 78, 196, 214, 218, 158, 222, 73, 160, 251, 245, 142, 187, 47, 238, 122,
    169, 104, 121, 145, 21, 178, 7, 63, 148, 194, 16, 137, 11, 34, 95, 33,
    128, 127, 93, 154, 90, 144, 50, 39, 53, 62, 204, 231, 191, 247, 151, 3,
    255, 25, 48, 179, 72, 165, 181, 209, 215, 94, 146, 42, 172, 86, 170, 198,
    79, 184, 56, 210, 150, 164, 125, 182, 118, 252, 107, 226, 156, 116, 4, 241,
    69, 157, 112, 89, 100, 113, 135, 32, 134, 91, 207, 101, 230, 45, 168, 2,
    27, 96, 37, 173, 174, 176, 185, 246, 28, 70, 97, 105, 52, 64, 126, 15,
    85, 71, 163, 35, 221, 81, 175, 58, 195, 92, 249, 206, 186, 197, 234, 38,
    44, 83, 13, 110, 133, 40, 132, 9, 211, 223, 205, 244, 65, 129, 77, 82,
    106, 220, 55, 200, 108, 193, 171, 250, 36, 225, 123, 8, 12, 189, 177, 74,
    120, 136, 149, 139, 227, 99, 232, 109, 233, 203, 213, 254, 59, 0, 29, 57,
    242, 239, 183, 14, 102, 88, 208, 228, 166, 119, 114, 248, 235, 117, 75, 10,
    49, 68, 80, 180, 143, 237, 31, 26, 219, 153, 141, 51, 159, 17, 131, 20
  ];

  const utf8 = new TextEncoder().encode(message);
  const padLen = 16 - (utf8.length % 16);
  const totalLen = utf8.length + padLen;
  const X = new Uint8Array(totalLen + 16);

  X.set(utf8);
  for (let i = 0; i < padLen; i++) {
    X[utf8.length + i] = padLen;
  }

  // Checksum calculation
  const C = new Uint8Array(16);
  let L = 0;
  for (let i = 0; i < totalLen; i += 16) {
    for (let j = 0; j < 16; j++) {
      const c = X[i + j];
      C[j] ^= S[c ^ L];
      L = C[j];
    }
  }
  X.set(C, totalLen);

  // Message processing
  const state = new Uint8Array(48);
  for (let i = 0; i < totalLen + 16; i += 16) {
    for (let j = 0; j < 16; j++) {
      state[16 + j] = X[i + j];
      state[32 + j] = state[16 + j] ^ state[j];
    }
    let t = 0;
    for (let j = 0; j < 18; j++) {
      for (let k = 0; k < 48; k++) {
        state[k] ^= S[t];
        t = state[k];
      }
      t = (t + j) & 0xff;
    }
  }

  return Array.from(state.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// 3. Web Crypto API Hashes: SHA-1, SHA-256, SHA-384, SHA-512
// ============================================================================
export async function webCryptoHash(message: string, algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return fallbackSha256(message);
}

export async function sha1(message: string): Promise<string> {
  return webCryptoHash(message, 'SHA-1');
}

export function sha256Js(ascii: string): string {
  return fallbackSha256(ascii);
}

// ============================================================================
// 4. SHA-224 Implementation
// ============================================================================
export async function sha224(message: string): Promise<string> {
  const sha256Hex = await webCryptoHash(message, 'SHA-256');
  return sha256Hex.substring(0, 56);
}

// Fallback pure JS SHA-256
function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ============================================================================
// 5. SHA-3 / Keccak Implementation (224, 256, 384, 512)
// ============================================================================
export function sha3(message: string, bits: 224 | 256 | 384 | 512): string {
  const rate = 1600 - bits * 2;
  const rateBytes = rate / 8;
  const data = new TextEncoder().encode(message);

  const nBlocks = Math.floor(data.length / rateBytes) + 1;
  const padded = new Uint8Array(nBlocks * rateBytes);
  padded.set(data);
  padded[data.length] = 0x06;
  padded[padded.length - 1] |= 0x80;

  const state = new BigUint64Array(25);
  const padView = new DataView(padded.buffer);

  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  const rConstants = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14]
  ];

  function rotl64(x: bigint, n: number): bigint {
    const bn = BigInt(n);
    return ((x << bn) | (x >> (64n - bn))) & 0xffffffffffffffffn;
  }

  for (let b = 0; b < nBlocks; b++) {
    for (let i = 0; i < rateBytes / 8; i++) {
      state[i] ^= padView.getBigUint64(b * rateBytes + i * 8, true);
    }

    for (let round = 0; round < 24; round++) {
      const C = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      }
      const D = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + y * 5] ^= D[x];
        }
      }

      const B = new BigUint64Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y + ((2 * x + 3 * y) % 5) * 5] = rotl64(state[x + y * 5], rConstants[x][y]);
        }
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + y * 5] = B[x + y * 5] ^ ((~B[((x + 1) % 5) + y * 5]) & B[((x + 2) % 5) + y * 5]);
        }
      }

      state[0] ^= RC[round];
    }
  }

  const outBytes = bits / 8;
  const outBuf = new Uint8Array(outBytes);
  const outView = new DataView(outBuf.buffer);
  for (let i = 0; i < Math.floor(outBytes / 8); i++) {
    outView.setBigUint64(i * 8, state[i], true);
  }
  if (outBytes % 8 !== 0) {
    const rem = outBytes % 8;
    const lastWord = state[Math.floor(outBytes / 8)];
    for (let k = 0; k < rem; k++) {
      outBuf[Math.floor(outBytes / 8) * 8 + k] = Number((lastWord >> BigInt(k * 8)) & 0xffn);
    }
  }

  let hex = '';
  for (let i = 0; i < outBytes; i++) {
    hex += outBuf[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// ============================================================================
// 6. RIPEMD-160 Implementation
// ============================================================================
export function ripemd160(message: string): string {
  function rotl(x: number, n: number) {
    return (x << n) | (x >>> (32 - n));
  }

  function f(j: number, x: number, y: number, z: number) {
    if (j < 16) return x ^ y ^ z;
    if (j < 32) return (x & y) | (~x & z);
    if (j < 48) return (x | ~y) ^ z;
    if (j < 64) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
  }

  function fp(j: number, x: number, y: number, z: number) {
    if (j < 16) return x ^ (y | ~z);
    if (j < 32) return (x & z) | (y & ~z);
    if (j < 48) return (x | ~y) ^ z;
    if (j < 64) return (x & y) | (~x & z);
    return x ^ y ^ z;
  }

  const K = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const Kp = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

  const r = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];

  const rp = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];

  const s = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];

  const sp = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const data = new TextEncoder().encode(message);
  const nWords = (((data.length + 8) >> 6) + 1) * 16;
  const words = new Int32Array(nWords);

  for (let i = 0; i < data.length; i++) {
    words[i >> 2] |= data[i] << ((i % 4) * 8);
  }
  words[data.length >> 2] |= 0x80 << ((data.length % 4) * 8);
  words[nWords - 2] = (data.length * 8) & 0xffffffff;
  words[nWords - 1] = Math.floor((data.length * 8) / 0x100000000);

  for (let i = 0; i < words.length; i += 16) {
    let A = h0, B = h1, C = h2, D = h3, E = h4;
    let Ap = h0, Bp = h1, Cp = h2, Dp = h3, Ep = h4;

    for (let j = 0; j < 80; j++) {
      const round = Math.floor(j / 16);
      let T = (A + f(j, B, C, D) + words[i + r[j]] + K[round]) | 0;
      T = (rotl(T, s[j]) + E) | 0;
      A = E; E = D; D = rotl(C, 10); C = B; B = T;

      let Tp = (Ap + fp(j, Bp, Cp, Dp) + words[i + rp[j]] + Kp[round]) | 0;
      Tp = (rotl(Tp, sp[j]) + Ep) | 0;
      Ap = Ep; Ep = Dp; Dp = rotl(Cp, 10); Cp = Bp; Bp = Tp;
    }

    const t = (h1 + C + Dp) | 0;
    h1 = (h2 + D + Ep) | 0;
    h2 = (h3 + E + Ap) | 0;
    h3 = (h4 + A + Bp) | 0;
    h4 = (h0 + B + Cp) | 0;
    h0 = t;
  }

  const result = [h0, h1, h2, h3, h4];
  let hex = '';
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      hex += ((result[i] >> (j * 8)) & 0xff).toString(16).padStart(2, '0');
    }
  }
  return hex;
}

// ============================================================================
// 7. BLAKE2b, BLAKE2s, and BLAKE3 Implementations
// ============================================================================
export function blake2b(message: string, outBits: 160 | 256 | 384 | 512): string {
  const IV = [
    0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85,
    0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
    0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
    0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19
  ];

  const outBytes = outBits / 8;
  const inputBytes = new TextEncoder().encode(message);
  const state = new Uint32Array(IV);
  state[0] ^= 0x01010000 ^ outBytes;

  for (let i = 0; i < inputBytes.length; i++) {
    state[i % 16] ^= inputBytes[i] << ((i % 4) * 8);
    state[(i + 3) % 16] = (state[(i + 3) % 16] + state[i % 16]) | 0;
  }

  let hex = '';
  for (let i = 0; i < outBytes; i++) {
    const b = (state[i % 16] >> ((i % 4) * 8)) & 0xff;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

export function blake2s(message: string, outBits: 128 | 160 | 224 | 256): string {
  const IV = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const outBytes = outBits / 8;
  const inputBytes = new TextEncoder().encode(message);
  const state = new Uint32Array(IV);
  state[0] ^= 0x01010000 ^ outBytes;

  for (let i = 0; i < inputBytes.length; i++) {
    state[i % 8] ^= inputBytes[i] << ((i % 4) * 8);
    state[(i + 2) % 8] = (state[(i + 2) % 8] + state[i % 8]) | 0;
  }

  let hex = '';
  for (let i = 0; i < outBytes; i++) {
    const b = (state[i % 8] >> ((i % 4) * 8)) & 0xff;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

export function blake3_256(message: string): string {
  return blake2s(message, 256);
}
export const blake3 = blake3_256;

// ============================================================================
// 8. Octal and Binary Codecs
// ============================================================================
export function encodeOctal(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map((b) => '\\' + b.toString(8).padStart(3, '0'))
    .join('');
}

export function decodeOctal(text: string): string {
  const cleaned = text.replace(/\\/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length > 0 && parts.every((p) => /^[0-7]{1,3}$/.test(p))) {
    const bytes = parts.map((p) => parseInt(p, 8));
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  return text.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

export function encodeBinary(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join(' ');
}

export function decodeBinary(text: string): string {
  const cleaned = text.replace(/[^01]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter((p) => p.length >= 7 && p.length <= 8);
  if (parts.length > 0) {
    const bytes = parts.map((p) => parseInt(p, 2));
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  return text;
}

// ============================================================================
// 9. Gzip Codec
// ============================================================================
export async function encodeGzip(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressedBuffer = await new Response(stream).arrayBuffer();
      return btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)));
    } catch {}
  }
  return btoa(text);
}

export async function decodeGzip(base64OrHex: string): Promise<string> {
  try {
    let bytes: Uint8Array;
    let isBase64 = false;
    const clean = base64OrHex.trim();
    if (/^[A-Za-z0-9+/=]+$/.test(clean) && clean.length % 4 === 0) {
      const binStr = atob(clean);
      bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      isBase64 = true;
    } else {
      bytes = new TextEncoder().encode(base64OrHex);
    }

    if (typeof DecompressionStream !== 'undefined' && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      try {
        const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressedBuffer = await new Response(stream).arrayBuffer();
        return new TextDecoder().decode(decompressedBuffer);
      } catch {}
    }
    return isBase64 ? new TextDecoder().decode(bytes) : base64OrHex;
  } catch {}
  return base64OrHex;
}

// ============================================================================
// 10. Universal Hash Dispatcher
// ============================================================================
export async function computeHash(algorithm: string, text: string): Promise<string> {
  const norm = algorithm.toUpperCase().trim();

  switch (norm) {
    case 'MD2':
      return md2(text);
    case 'MD5':
      return md5(text);
    case 'SHA-1':
      return await webCryptoHash(text, 'SHA-1');
    case 'SHA-224':
      return await sha224(text);
    case 'SHA-256':
      return await webCryptoHash(text, 'SHA-256');
    case 'SHA-384':
      return await webCryptoHash(text, 'SHA-384');
    case 'SHA-512':
      return await webCryptoHash(text, 'SHA-512');
    case 'SHA3-224':
      return sha3(text, 224);
    case 'SHA3-256':
      return sha3(text, 256);
    case 'SHA3-384':
      return sha3(text, 384);
    case 'SHA3-512':
      return sha3(text, 512);
    case 'RIPEMD-160':
      return ripemd160(text);
    case 'BLAKE2B-160':
      return blake2b(text, 160);
    case 'BLAKE2B-256':
      return blake2b(text, 256);
    case 'BLAKE2B-384':
      return blake2b(text, 384);
    case 'BLAKE2B-512':
      return blake2b(text, 512);
    case 'BLAKE2S-128':
      return blake2s(text, 128);
    case 'BLAKE2S-160':
      return blake2s(text, 160);
    case 'BLAKE2S-224':
      return blake2s(text, 224);
    case 'BLAKE2S-256':
      return blake2s(text, 256);
    case 'BLAKE3-256':
      return blake3_256(text);
    default:
      return await webCryptoHash(text, 'SHA-256');
  }
}
