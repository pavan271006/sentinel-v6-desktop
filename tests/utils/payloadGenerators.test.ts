import { describe, it, expect } from 'vitest';
import {
  generatePayloads,
  DEFAULT_PAYLOAD_CONFIG,
  PayloadConfigState,
  BUILT_IN_WORDLISTS,
} from '../../src/utils/payloadGenerators';

describe('Payload Generators (All 16 Burp Suite Professional Types)', () => {
  it('1. generates Simple list payloads', () => {
    const list = generatePayloads('Simple list', DEFAULT_PAYLOAD_CONFIG);
    expect(list).toContain('admin');
    expect(list).toContain('root');
    expect(list.length).toBeGreaterThan(0);
  });

  it('2. generates Runtime file payloads fallback', () => {
    const list = generatePayloads('Runtime file', DEFAULT_PAYLOAD_CONFIG);
    expect(list.length).toBeGreaterThan(0);
  });

  it('3. generates Custom iterator combinations', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      iteratorSlots: [
        ['admin', 'user'],
        ['123', 'pass'],
      ],
      iteratorSeparator: ':',
    };
    const list = generatePayloads('Custom iterator', config);
    expect(list).toEqual(['admin:123', 'admin:pass', 'user:123', 'user:pass']);
  });

  it('4. generates Character substitution payloads', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      charSubBaseWord: 'password',
      charSubRules: [
        { from: 'a', to: '@' },
        { from: 'o', to: '0' },
      ],
    };
    const list = generatePayloads('Character substitution', config);
    expect(list).toContain('p@ssword');
    expect(list).toContain('passw0rd');
  });

  it('5. generates Case modification variations', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      caseModBaseWord: 'Admin',
      caseModRules: ['lower', 'upper', 'proper', 'invert'],
    };
    const list = generatePayloads('Case modification', config);
    expect(list).toContain('admin');
    expect(list).toContain('ADMIN');
    expect(list).toContain('Admin');
    expect(list).toContain('aDMIN');
  });

  it('6. generates Illegal Unicode representations', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      illegalUnicodeBase: 'admin',
    };
    const list = generatePayloads('Illegal Unicode', config);
    expect(list.some((p) => p.includes('%u00') || p.includes('%c0%'))).toBe(true);
  });

  it('7. generates Character blocks of increasing length', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      blockChar: 'A',
      blockMinLength: 10,
      blockMaxLength: 50,
      blockStep: 20,
    };
    const list = generatePayloads('Character blocks', config);
    expect(list).toEqual(['AAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']);
  });

  it('8. generates Numbers (sequential & random)', () => {
    const configSeq: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      numberType: 'sequential',
      numFrom: 1,
      numTo: 5,
      numStep: 1,
      numBase: 'decimal',
      numMinDigits: 3,
    };
    const listSeq = generatePayloads('Numbers', configSeq);
    expect(listSeq).toEqual(['001', '002', '003', '004', '005']);

    const configHex: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      numberType: 'sequential',
      numFrom: 10,
      numTo: 12,
      numStep: 1,
      numBase: 'hex',
      numMinDigits: 2,
    };
    const listHex = generatePayloads('Numbers', configHex);
    expect(listHex).toEqual(['0a', '0b', '0c']);
  });

  it('9. generates Dates across range', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-03',
      dateStepDays: 1,
    };
    const list = generatePayloads('Dates', config);
    expect(list).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('10. generates Brute forcer combinatorial strings', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      bruteCharset: 'ab',
      bruteMinLen: 1,
      bruteMaxLen: 2,
    };
    const list = generatePayloads('Brute forcer', config);
    expect(list).toEqual(['a', 'b', 'aa', 'ab', 'ba', 'bb']);
  });

  it('11. generates Null payloads', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      nullCount: 5,
    };
    const list = generatePayloads('Null payloads', config);
    expect(list).toHaveLength(5);
    expect(list.every((p) => p === '')).toBe(true);
  });

  it('12. generates Character frobber single-byte mutations', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      frobberBase: 'abc',
    };
    const list = generatePayloads('Character frobber', config);
    expect(list).toEqual(['bbc', 'acc', 'abd']);
  });

  it('13. generates Bit flipper single-bit flips', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      bitFlipperBase: btoa('test'),
      bitFlipperMode: 'base64',
    };
    const list = generatePayloads('Bit flipper', config);
    expect(list.length).toBeGreaterThan(1);
    expect(list[0]).toBe(btoa('test'));
  });

  it('14. generates Username permutations from names', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      userGenFirst: 'John',
      userGenLast: 'Doe',
    };
    const list = generatePayloads('Username generator', config);
    expect(list).toContain('johndoe');
    expect(list).toContain('jdoe');
    expect(list).toContain('john.doe');
    expect(list).toContain('doe.j');
    expect(list).toContain('doej');
  });

  it('15. generates ECB block shuffler transposed blocks', () => {
    const config: PayloadConfigState = {
      ...DEFAULT_PAYLOAD_CONFIG,
      ecbBase: '111111111111111122222222222222223333333333333333',
      ecbBlockSize: 16,
    };
    const list = generatePayloads('ECB block shuffler', config);
    expect(list.length).toBeGreaterThan(1);
    expect(list[1]).toContain('22222222222222221111111111111111');
  });

  it('16. provides built-in pre-packaged security wordlists', () => {
    expect(BUILT_IN_WORDLISTS['Fuzzing - SQL Injection'].length).toBeGreaterThan(10);
    expect(BUILT_IN_WORDLISTS['Fuzzing - Cross-Site Scripting (XSS)'].length).toBeGreaterThan(10);
    expect(BUILT_IN_WORDLISTS['Fuzzing - Path Traversal & LFI'].length).toBeGreaterThan(10);
    expect(BUILT_IN_WORDLISTS['Fuzzing - Command Injection'].length).toBeGreaterThan(10);
    expect(BUILT_IN_WORDLISTS['Usernames - Common'].length).toBeGreaterThan(10);
    expect(BUILT_IN_WORDLISTS['Passwords - Common'].length).toBeGreaterThan(10);
  });
});
