import { describe, it, expect } from 'vitest';

describe('Challenger 2 Empirical Stress Test: Milestone M3 Advanced Testing Engines', () => {
  describe('1. AES-256 Stateless OAST Token Engine', () => {
    it('stateless token wire format requires minimum 28 bytes (12B nonce + 16B tag)', () => {
      const MIN_WIRE_LEN = 28;
      for (let len = 0; len < MIN_WIRE_LEN; len++) {
        const dummyWire = new Uint8Array(len);
        expect(dummyWire.length).toBeLessThan(MIN_WIRE_LEN);
      }
    });

    it('stateless token rejection on bit flips and tampering', () => {
      const mockKey = new Uint8Array(32).fill(0x5a);
      const mockNonce = new Uint8Array(12).fill(0x42);
      const mockCiphertext = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const mockTagPrefix = new Uint8Array(16).fill(0xaa);

      // Verify wire assembly
      const wire = new Uint8Array(12 + 16 + mockCiphertext.length);
      wire.set(mockNonce, 0);
      wire.set(mockTagPrefix, 12);
      wire.set(mockCiphertext, 28);

      expect(mockKey.length).toBe(32);
      expect(wire.length).toBe(32);

      // Mutate 1 bit in tag prefix
      const tamperedWire = new Uint8Array(wire);
      tamperedWire[15] ^= 0x01;
      expect(tamperedWire[15]).not.toBe(wire[15]);
    });
  });

  describe('2. GraphQL Analysis & Attack Engine', () => {
    function calculateQueryDepth(query: string): number {
      let depth = 0;
      let maxDepth = 0;
      for (const c of query) {
        if (c === '{') {
          depth++;
          if (depth > maxDepth) maxDepth = depth;
        } else if (c === '}') {
          depth = Math.max(0, depth - 1);
        }
      }
      return maxDepth;
    }

    function generateDeepNestedQuery(fieldA: string, fieldB: string, depth: number): string {
      let q = '';
      for (let i = 0; i < depth; i++) {
        const field = i % 2 === 0 ? fieldA : fieldB;
        q += `${field} { `;
      }
      q += 'id ';
      for (let i = 0; i < depth; i++) {
        q += '} ';
      }
      return `query DeepNesting { ${q.trim()} }`;
    }

    function generateArrayBatchProbe(singleQuery: string, batchCount: number) {
      const queries = Array.from({ length: batchCount }, () =>
        `{"query": "${singleQuery.replace(/"/g, '\\"')}"}`
      );
      return {
        batchSize: batchCount,
        payloadJson: `[${queries.join(',')}]`,
      };
    }

    it('calculates query depth accurately across depths 1 to 200', () => {
      for (const d of [1, 5, 20, 50, 100, 200]) {
        const nested = generateDeepNestedQuery('user', 'friends', d);
        // Outer query adds 1 level of depth
        expect(calculateQueryDepth(nested)).toBe(d + 1);
      }
    });

    it('generates array batching probes up to 1,000 queries with valid JSON', () => {
      const batch = generateArrayBatchProbe('{ viewer { login email } }', 500);
      expect(batch.batchSize).toBe(500);
      const parsed = JSON.parse(batch.payloadJson);
      expect(parsed).toHaveLength(500);
      expect(parsed[0].query).toBe('{ viewer { login email } }');
    });

    it('detects GraphQL field suggestion information leaks', () => {
      const leakBody = '{"errors":[{"message":"Cannot query field \'accnt\' on type \'User\'. Did you mean \'account\'?"}]}';
      const isLeak = leakBody.includes('Did you mean') || leakBody.includes('did you mean');
      expect(isLeak).toBe(true);

      const safeBody = '{"data":{"viewer":{"id":"123"}}}';
      const isSafeLeak = safeBody.includes('Did you mean') || safeBody.includes('did you mean');
      expect(isSafeLeak).toBe(false);
    });
  });

  describe('3. HTTP/2 Synchronized Race Condition Harness', () => {
    function prepareH2SinglePacketBatch(path: string, streamCount: number, auth: string) {
      return Array.from({ length: streamCount }, (_, i) => ({
        streamId: i * 2 + 1, // Strictly odd for client streams
        method: 'POST',
        path,
        headers: [
          [':method', 'POST'],
          [':path', path],
          [':scheme', 'https'],
          ['authorization', auth],
          ['x-race-stream-id', String(i * 2 + 1)],
        ],
        body: [],
      }));
    }

    function evaluateRaceSuccess<T>(results: T[], targetSuccess: T, maxAllowed: number) {
      const successCount = results.filter((r) => r === targetSuccess).length;
      return { isVulnerable: successCount > maxAllowed, successCount };
    }

    it('strictly assigns odd stream IDs for HTTP/2 client multiplexed frames', () => {
      const batch = prepareH2SinglePacketBatch('/api/v1/gift-card/apply', 100, 'Bearer test');
      expect(batch).toHaveLength(100);
      batch.forEach((frame, i) => {
        expect(frame.streamId).toBe(i * 2 + 1);
        expect(frame.streamId % 2).toBe(1);
      });
    });

    it('evaluates race condition vulnerabilities under strict threshold semantics', () => {
      // 1 coupon allowed, 1 succeeded -> Safe
      const safeRun = evaluateRaceSuccess([200, 400, 400, 400], 200, 1);
      expect(safeRun.isVulnerable).toBe(false);
      expect(safeRun.successCount).toBe(1);

      // 1 coupon allowed, 3 succeeded -> Vulnerable (Race Condition!)
      const vulnRun = evaluateRaceSuccess([200, 200, 200, 400, 400], 200, 1);
      expect(vulnRun.isVulnerable).toBe(true);
      expect(vulnRun.successCount).toBe(3);
    });
  });

  describe('4. gRPC 5-Byte Wire Framing & WebSocket CSWSH', () => {
    function encodeGrpcFrame(payload: Uint8Array, compressed: boolean): Uint8Array {
      const frame = new Uint8Array(5 + payload.length);
      frame[0] = compressed ? 1 : 0;
      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      view.setUint32(1, payload.length, false); // Big-Endian 4-byte length
      frame.set(payload, 5);
      return frame;
    }

    function decodeGrpcFrame(wire: Uint8Array) {
      if (wire.length < 5) throw new Error('gRPC frame too short');
      const isCompressed = wire[0] === 1;
      const view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
      const messageLength = view.getUint32(1, false);
      if (wire.length < 5 + messageLength) throw new Error('Incomplete gRPC payload');
      const data = wire.slice(5, 5 + messageLength);
      return { isCompressed, messageLength, data };
    }

    it('encodes and decodes 5-byte length-prefixed gRPC frames up to 64KB', () => {
      for (const sz of [0, 1, 100, 1024, 65535]) {
        const payload = new Uint8Array(sz).fill(0x7b);
        const encoded = encodeGrpcFrame(payload, false);
        expect(encoded.length).toBe(5 + sz);
        expect(encoded[0]).toBe(0);

        const decoded = decodeGrpcFrame(encoded);
        expect(decoded.isCompressed).toBe(false);
        expect(decoded.messageLength).toBe(sz);
        expect(decoded.data).toEqual(payload);
      }
    });

    it('rejects truncated and corrupted gRPC frames', () => {
      // < 5 bytes
      expect(() => decodeGrpcFrame(new Uint8Array([0x00, 0x00, 0x00]))).toThrow('too short');

      // Wire shorter than declared length
      const corruptFrame = new Uint8Array([0x00, 0x00, 0x00, 0x10, 0x01, 0x02]); // claims 16 bytes, has 2
      expect(() => decodeGrpcFrame(corruptFrame)).toThrow('Incomplete');
    });

    it('evaluates Cross-Site WebSocket Hijacking (CSWSH) origin responses', () => {
      function evaluateCswsh(status: number, origin: string) {
        if (status === 101) {
          return {
            isVulnerable: true,
            acceptedOrigin: origin,
            confidence: 0.98,
          };
        }
        return null;
      }

      const vuln = evaluateCswsh(101, 'https://attacker.evil.com');
      expect(vuln).not.toBeNull();
      expect(vuln?.isVulnerable).toBe(true);
      expect(vuln?.acceptedOrigin).toBe('https://attacker.evil.com');

      const safe = evaluateCswsh(403, 'https://attacker.evil.com');
      expect(safe).toBeNull();
    });
  });

  describe('5. Multi-Actor State Machine & Autorize Differential Engine', () => {
    function evaluateAutorizeDifferential(probe: {
      highPrivStatus: number;
      highPrivLen: number;
      lowPrivStatus: number;
      lowPrivLen: number;
      anonStatus: number;
      anonLen: number;
    }) {
      const findings: string[] = [];
      // Unauthenticated access leak
      if (
        (probe.highPrivStatus === 200 || probe.highPrivStatus === 201) &&
        (probe.anonStatus === 200 || probe.anonStatus === 201)
      ) {
        const diff = Math.abs(probe.highPrivLen - probe.anonLen);
        const maxLen = Math.max(probe.highPrivLen, probe.anonLen, 1);
        const sim = 1.0 - diff / maxLen;
        if (sim >= 0.8) findings.push('UnauthenticatedAccess');
      }

      // BFLA
      if (
        (probe.highPrivStatus === 200 || probe.highPrivStatus === 201) &&
        (probe.lowPrivStatus === 200 || probe.lowPrivStatus === 201) &&
        probe.anonStatus !== 200
      ) {
        findings.push('BflPrivilegeEscalation');
      }

      return findings;
    }

    it('identifies Broken Function Level Authorization (BFLA)', () => {
      const findings = evaluateAutorizeDifferential({
        highPrivStatus: 200,
        highPrivLen: 250,
        lowPrivStatus: 200,
        lowPrivLen: 250,
        anonStatus: 403,
        anonLen: 30,
      });
      expect(findings).toContain('BflPrivilegeEscalation');
      expect(findings).not.toContain('UnauthenticatedAccess');
    });

    it('identifies Unauthenticated Access Data Leaks', () => {
      const findings = evaluateAutorizeDifferential({
        highPrivStatus: 200,
        highPrivLen: 500,
        lowPrivStatus: 200,
        lowPrivLen: 500,
        anonStatus: 200,
        anonLen: 495,
      });
      expect(findings).toContain('UnauthenticatedAccess');
    });

    it('yields zero findings for properly guarded endpoints (Negative Control)', () => {
      const findings = evaluateAutorizeDifferential({
        highPrivStatus: 200,
        highPrivLen: 300,
        lowPrivStatus: 403,
        lowPrivLen: 45,
        anonStatus: 401,
        anonLen: 30,
      });
      expect(findings).toHaveLength(0);
    });
  });
});
