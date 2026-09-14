import { describe, it, expect } from 'vitest';
import { HackvertorEngine } from './HackvertorEngine';

describe('HackvertorEngine', () => {
  it('evaluates URL encoding and decoding correctly', async () => {
    const input = '<@url_encode>SELECT * FROM users WHERE id = 1<@/url_encode>';
    const output = await HackvertorEngine.evaluate(input);
    expect(output).toBe('SELECT%20*%20FROM%20users%20WHERE%20id%20%3D%201');

    const decoded = await HackvertorEngine.evaluate(`<@url_decode>${output}<@/url_decode>`);
    expect(decoded).toBe('SELECT * FROM users WHERE id = 1');
  });

  it('evaluates Base64 encoding and decoding correctly', async () => {
    const input = '<@base64_encode>hello world<@/base64_encode>';
    const output = await HackvertorEngine.evaluate(input);
    expect(output).toBe('aGVsbG8gd29ybGQ=');

    const decoded = await HackvertorEngine.evaluate(`<@base64_decode>${output}<@/base64_decode>`);
    expect(decoded).toBe('hello world');
  });

  it('evaluates MD5 and SHA-256 hashes correctly with genuine cryptographic digests', async () => {
    const md5Input = '<@md5>admin<@/md5>';
    const md5Output = await HackvertorEngine.evaluate(md5Input);
    // Known MD5 of "admin" is 21232f297a57a5a743894a0e4a801fc3
    expect(md5Output).toBe('21232f297a57a5a743894a0e4a801fc3');

    const sha256Input = '<@sha256>admin<@/sha256>';
    const sha256Output = await HackvertorEngine.evaluate(sha256Input);
    // Known SHA-256 of "admin" is 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
    expect(sha256Output).toBe('8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');
  });

  it('evaluates nested tags in correct innermost-first sequence', async () => {
    // Nested: sha256("admin") -> base64_encode(sha256)
    const nested = '<@base64_encode><@sha256>admin<@/sha256><@/base64_encode>';
    const output = await HackvertorEngine.evaluate(nested);
    // base64("8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918")
    const expected = btoa('8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');
    expect(output).toBe(expected);
  });

  it('evaluates SQL Evasion tags: space2comment and sql_hex', async () => {
    const commentInput = '<@space2comment>UNION SELECT 1, 2, 3<@/space2comment>';
    const commentOutput = await HackvertorEngine.evaluate(commentInput);
    expect(commentOutput).toBe('UNION/**/SELECT/**/1,/**/2,/**/3');

    const hexInput = '<@sql_hex>admin<@/sql_hex>';
    const hexOutput = await HackvertorEngine.evaluate(hexInput);
    // "admin" in hex: 61646d696e -> 0x61646d696e
    expect(hexOutput).toBe('0x61646d696e');
  });
});
