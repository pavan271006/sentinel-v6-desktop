import { describe, it, expect } from 'vitest';
import { RequestParser } from '../../src/services/sqlScanner/RequestParser';
import { ErrorTester } from '../../src/services/sqlScanner/ErrorTester';
import { MetadataExtractor } from '../../src/services/sqlScanner/MetadataExtractor';
import { BooleanTester } from '../../src/services/sqlScanner/BooleanTester';

describe('Scanner Identity & Architecture Verification Tests', () => {
  it('verifies RequestParser extracts all parameter locations correctly', () => {
    const rawReq = `GET /filter?category=Gifts HTTP/1.1\r\nHost: target.local\r\nCookie: TrackingId=xyz123; session=abc789\r\n\r\n`;
    const parsed = RequestParser.parse(rawReq);
    expect(parsed.parameters.length).toBeGreaterThanOrEqual(3);
    expect(parsed.parameters.some((p) => p.name === 'category' && p.location === 'query')).toBe(true);
    expect(parsed.parameters.some((p) => p.name === 'TrackingId' && p.location === 'cookie')).toBe(true);
    expect(parsed.parameters.some((p) => p.name === 'session' && p.location === 'cookie')).toBe(true);
  });

  it('verifies ErrorTester identifies PostgreSQL and conversion error patterns', () => {
    const pgError = `ERROR: invalid input syntax for type integer: "administrator"`;
    const match = ErrorTester.analyzeResponse(pgError);
    expect(match).not.toBeNull();
    expect(match?.dbms).toBe('PostgreSQL');
  });

  it('verifies MetadataExtractor extracts error-based leaked identifiers and credentials', () => {
    const leakedTableBody = `ERROR: invalid input syntax for type integer: "users"`;
    const extractedTable = MetadataExtractor.extractErrorBasedData(leakedTableBody);
    expect(extractedTable).toBe('users');

    const leakedUserBody = `ERROR: invalid input syntax for type integer: "administrator"`;
    const extractedUser = MetadataExtractor.extractErrorBasedData(leakedUserBody);
    expect(extractedUser).toBe('administrator');

    const leakedPassBody = `Conversion failed when converting the varchar value 's3cretPass123' to data type int.`;
    const extractedPass = MetadataExtractor.extractErrorBasedData(leakedPassBody);
    expect(extractedPass).toBe('s3cretPass123');
  });

  it('verifies BooleanTester differential classification logic', () => {
    const baseline = `<html><body>Welcome to the shop</body></html>`;
    const trueBody = `<html><body>Welcome to the shop Welcome back!</body></html>`;
    const falseBody = `<html><body>Welcome to the shop</body></html>`;

    const diff = BooleanTester.evaluateDifferential(baseline, 200, trueBody, 200, falseBody, 200);
    expect(diff.isVulnerable).toBe(true);
  });
});
