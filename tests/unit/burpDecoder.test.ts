import { describe, it, expect, beforeEach } from 'vitest';
import {
  md2,
  md5,
  sha1,
  sha256Js,
  sha3,
  ripemd160,
  blake2b,
  blake2s,
  blake3,
  computeHash,
  encodeOctal,
  decodeOctal,
  encodeBinary,
  decodeBinary,
  encodeGzip,
  decodeGzip,
} from '../../src/utils/burpCryptoUtils';
import {
  autoDetectCodec,
  decodeText,
  encodeText,
  decodeBurpText,
  encodeBurpText,
} from '../../src/utils/burpDecoderUtils';
import { useDecoderStore, DecoderStep } from '../../src/stores/decoderStore';

describe('Burp Suite Cryptographic Hash Engine (All 20 Algorithms)', () => {
  it('computes RFC 1319 compliant MD2 hashes', () => {
    expect(md2('')).toBe('8350e5a3e24c153df2275c9f80692773');
    expect(md2('a')).toBe('32ec01ec4a6dac72c0ab96fb34c0b5d1');
    expect(md2('abc')).toBe('da853b0d3f88d99b30283a69e6ded6bb');
    expect(md2('message digest')).toBe('ab4f496bfb2a530b219ff33031fe06b0');
  });

  it('computes RFC 1321 compliant MD5 hashes', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe(
      '9e107d9d372bb6826bd81d3542a419d6'
    );
  });

  it('computes SHA-1 hashes accurately', async () => {
    const hash = await sha1('hello');
    expect(hash).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('computes SHA-256 hashes accurately', () => {
    expect(sha256Js('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('computes Keccak SHA-3 (224, 256, 384, 512)', () => {
    const sha3_224 = sha3('hello', 224);
    const sha3_256 = sha3('hello', 256);
    const sha3_384 = sha3('hello', 384);
    const sha3_512 = sha3('hello', 512);

    expect(sha3_224).toHaveLength(56);
    expect(sha3_256).toHaveLength(64);
    expect(sha3_384).toHaveLength(96);
    expect(sha3_512).toHaveLength(128);
    expect(sha3_256).toBe('3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392');
  });

  it('computes RFC-compliant RIPEMD-160 hashes', () => {
    const res = ripemd160('hello');
    expect(res).toHaveLength(40);
    expect(res).toBe('108f07b8382412612c048d07d13f814118445acd');
  });

  it('computes BLAKE2b (160, 256, 384, 512 bits)', () => {
    const b160 = blake2b('hello', 160);
    const b256 = blake2b('hello', 256);
    const b384 = blake2b('hello', 384);
    const b512 = blake2b('hello', 512);

    expect(b160).toHaveLength(40);
    expect(b256).toHaveLength(64);
    expect(b384).toHaveLength(96);
    expect(b512).toHaveLength(128);
  });

  it('computes BLAKE2s (128, 160, 224, 256 bits)', () => {
    const s128 = blake2s('hello', 128);
    const s160 = blake2s('hello', 160);
    const s224 = blake2s('hello', 224);
    const s256 = blake2s('hello', 256);

    expect(s128).toHaveLength(32);
    expect(s160).toHaveLength(40);
    expect(s224).toHaveLength(56);
    expect(s256).toHaveLength(64);
  });

  it('computes BLAKE3-256', () => {
    const b3 = blake3('hello');
    expect(b3).toHaveLength(64);
  });

  it('dispatches all 20 hash algorithm options through computeHash', async () => {
    const algos = [
      'BLAKE2B-160',
      'BLAKE2B-256',
      'BLAKE2B-384',
      'BLAKE2B-512',
      'BLAKE2S-128',
      'BLAKE2S-160',
      'BLAKE2S-224',
      'BLAKE2S-256',
      'BLAKE3-256',
      'MD2',
      'MD5',
      'SHA-1',
      'SHA-224',
      'SHA-256',
      'SHA-384',
      'SHA-512',
      'SHA3-224',
      'SHA3-256',
      'SHA3-384',
      'SHA3-512',
      'RIPEMD-160',
    ];

    for (const algo of algos) {
      const res = await computeHash(algo, 'burp suite pro');
      expect(res).toBeTruthy();
      expect(typeof res).toBe('string');
      expect(res.length).toBeGreaterThan(0);
    }
  });
});

describe('Burp Suite Codecs & Encoders', () => {
  it('encodes and decodes Octal format', () => {
    const original = 'ABC';
    const octal = encodeOctal(original);
    expect(octal).toBe('\\101\\102\\103');
    expect(decodeOctal(octal)).toBe('ABC');
  });

  it('encodes and decodes 8-bit Binary format', () => {
    const original = 'Hi!';
    const bin = encodeBinary(original);
    expect(bin).toBe('01001000 01101001 00100001');
    expect(decodeBinary(bin)).toBe('Hi!');
  });

  it('encodes and decodes Gzip', async () => {
    const original = 'test gzip compression payload 12345';
    const compressed = await encodeGzip(original);
    expect(compressed).toBeTruthy();
    const decompressed = await decodeGzip(compressed);
    expect(decompressed).toBe(original);
  });

  it('encodes and decodes Burp Suite URL, Base64, Hex, HTML', async () => {
    const raw = 'admin&user=<test>';
    const urlEnc = await encodeBurpText(raw, 'URL');
    expect(urlEnc).toContain('%26');
    expect(await decodeBurpText(urlEnc, 'URL')).toBe(raw);

    const b64 = await encodeBurpText(raw, 'Base64');
    expect(await decodeBurpText(b64, 'Base64')).toBe(raw);

    const hex = await encodeBurpText('ABC', 'Hex');
    expect(hex).toBe('414243');
    expect(await decodeBurpText('414243', 'Hex')).toBe('ABC');

    const html = await encodeBurpText('<script>', 'HTML');
    expect(html).toBe('&lt;script&gt;');
    expect(await decodeBurpText('&lt;script&gt;', 'HTML')).toBe('<script>');
  });
});

describe('Smart Drag-Selection Auto-Decoder', () => {
  it('detects URL encoded strings and decodes', () => {
    const codec = autoDetectCodec('%27%20UNION%20SELECT%20NULL--');
    expect(codec).toBe('url');
    const decoded = decodeText('%27%20UNION%20SELECT%20NULL--', codec);
    expect(decoded).toBe("' UNION SELECT NULL--");
    expect(encodeText(decoded, codec)).toBe("'+UNION+SELECT+NULL--");
  });

  it('detects Base64 encoded strings and decodes', () => {
    const codec = autoDetectCodec('SGVsbG8gV29ybGQh');
    expect(codec).toBe('base64');
    const decoded = decodeText('SGVsbG8gV29ybGQh', codec);
    expect(decoded).toBe('Hello World!');
    expect(encodeText(decoded, codec)).toBe('SGVsbG8gV29ybGQh');
  });

  it('detects Hex strings and decodes', () => {
    const codec = autoDetectCodec('\\x41\\x42\\x43\\x44');
    expect(codec).toBe('hex');
    expect(decodeText('\\x41\\x42\\x43\\x44', codec)).toBe('ABCD');
  });

  it('detects HTML entities and decodes', () => {
    const codec = autoDetectCodec('&lt;img&#x20;src=x&gt;');
    expect(codec).toBe('html');
    expect(decodeText('&lt;img&#x20;src=x&gt;', codec)).toBe('<img src=x>');
  });

  it('detects JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotVerify';
    const codec = autoDetectCodec(jwt);
    expect(codec).toBe('jwt');
  });
});

describe('Burp Suite Decoder Cascading Workbench Store', () => {
  beforeEach(() => {
    useDecoderStore.getState().clearCascade();
    useDecoderStore.getState().setInputText('');
  });

  it('sets input text and updates view mode', () => {
    const store = useDecoderStore.getState();
    store.setInputText('test input');
    expect(useDecoderStore.getState().inputText).toBe('test input');

    store.setInputViewMode('hex');
    expect(useDecoderStore.getState().inputViewMode).toBe('hex');
  });

  it('adds cascading transformation steps and tracks type, action, and color', () => {
    const store = useDecoderStore.getState();
    store.setInputText('admin');

    const step1: DecoderStep = {
      id: 'step-1',
      sourceStepId: 'root',
      operationType: 'encode',
      format: 'URL',
      label: 'Encode as URL',
      color: '#ff0000',
      output: '%61%64%6d%69%6e',
      viewMode: 'text',
    };
    store.addStep(step1);

    expect(useDecoderStore.getState().steps).toHaveLength(1);
    expect(useDecoderStore.getState().steps[0].operationType).toBe('encode');
    expect(useDecoderStore.getState().steps[0].format).toBe('URL');
    expect(useDecoderStore.getState().steps[0].color).toBe('#ff0000');
    expect(useDecoderStore.getState().steps[0].output).toBe('%61%64%6d%69%6e');

    // Cascade second step from step 1
    const step2: DecoderStep = {
      id: 'step-2',
      sourceStepId: 'step-1',
      operationType: 'hash',
      format: 'MD5',
      label: 'Hash as MD5',
      color: '#555555',
      output: 'fa246d0262c3925617b0c72bb20eeb1d',
      viewMode: 'text',
    };
    store.addStep(step2);

    expect(useDecoderStore.getState().steps).toHaveLength(2);
    expect(useDecoderStore.getState().steps[1].sourceStepId).toBe('step-1');
    expect(useDecoderStore.getState().steps[1].format).toBe('MD5');
  });

  it('updates step output and view mode', () => {
    const store = useDecoderStore.getState();
    const step: DecoderStep = {
      id: 'step-1',
      sourceStepId: 'root',
      operationType: 'encode',
      format: 'Base64',
      label: 'Encode as Base64',
      color: '#ffff00',
      output: 'YWRtaW4=',
      viewMode: 'text',
    };
    store.addStep(step);

    store.updateStepOutput('step-1', 'modified');
    expect(useDecoderStore.getState().steps[0].output).toBe('modified');

    store.updateStepViewMode('step-1', 'hex');
    expect(useDecoderStore.getState().steps[0].viewMode).toBe('hex');
  });

  it('removes a step and clears the entire cascade', () => {
    const store = useDecoderStore.getState();
    const step: DecoderStep = {
      id: 'step-1',
      sourceStepId: 'root',
      operationType: 'encode',
      format: 'Base64',
      label: 'Encode as Base64',
      color: '#ffff00',
      output: 'YWRtaW4=',
      viewMode: 'text',
    };
    store.addStep(step);

    store.removeStep('step-1');
    expect(useDecoderStore.getState().steps).toHaveLength(0);

    store.addStep({ ...step, id: 'step-a' });
    store.addStep({ ...step, id: 'step-b' });
    expect(useDecoderStore.getState().steps).toHaveLength(2);

    store.clearCascade();
    expect(useDecoderStore.getState().steps).toHaveLength(0);
  });
});
