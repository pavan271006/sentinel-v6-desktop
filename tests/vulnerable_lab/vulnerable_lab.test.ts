import { describe, it, expect, beforeEach } from 'vitest';
import { VulnerableLabServer } from './app';

describe('SENTINEL V6: Local Deliberately Vulnerable Lab & Negative Controls', () => {
  let lab: VulnerableLabServer;

  beforeEach(() => {
    lab = new VulnerableLabServer();
  });

  describe('1. SQL Injection Fixture (LAB-SQLI-001)', () => {
    it('detects SQL injection and extracts sensitive data on vulnerable endpoint', () => {
      const result = lab.searchProductsVulnerable("' OR 1=1 --");
      expect(result.vulnerable).toBe(true);
      expect(result.results.length).toBeGreaterThan(1);
      expect(result.results[0].name).toContain('SQLI_EXTRACTED_DATA_SUCCESS');
      expect(result.sql).toContain("LIKE '%' OR 1=1 --%'");
    });

    it('NEGATIVE CONTROL: verifies zero false positives on safe parameterized endpoint', () => {
      const result = lab.searchProductsSafe("' OR 1=1 --");
      expect(result.vulnerable).toBe(false);
      expect(result.results.length).toBe(1);
      expect(result.results[0].name).toBe('Standard Widget');
      expect(result.sql).toContain('SELECT * FROM products WHERE name LIKE ?');
    });
  });

  describe('2. Broken Object Level Authorization / IDOR (LAB-BOLA-001)', () => {
    it('detects BOLA when Alice accesses Admin confidential document on vulnerable endpoint', () => {
      const result = lab.getDocumentVulnerable('doc-101', 'token-user-alice');
      expect(result.status).toBe(200);
      expect(result.doc).toBeDefined();
      expect(result.doc?.title).toBe('Admin Master Key');
      expect(result.doc?.content).toBe('SECRET_CONFIDENTIAL_KEY_9988');
    });

    it('NEGATIVE CONTROL: blocks unauthorized cross-tenant object access on safe endpoint', () => {
      const result = lab.getDocumentSafe('doc-101', 'token-user-alice');
      expect(result.status).toBe(403);
      expect(result.error).toContain('Access Denied');
      expect(result.doc).toBeUndefined();
    });

    it('allows document owner (Alice) to access her own document on safe endpoint', () => {
      const result = lab.getDocumentSafe('doc-102', 'token-user-alice');
      expect(result.status).toBe(200);
      expect(result.doc?.title).toBe('Alice Diary');
    });
  });

  describe('3. Broken Function Level Authorization / BFLA (LAB-BFLA-001)', () => {
    it('detects BFLA when standard user Bob triggers administrative backup on vulnerable endpoint', () => {
      const result = lab.executeAdminBackupVulnerable('token-user-bob');
      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBe('ADMIN_DATABASE_EXPORT_BACKUP_BLOB');
    });

    it('NEGATIVE CONTROL: enforces admin role check on safe endpoint for standard user', () => {
      const result = lab.executeAdminBackupSafe('token-user-bob');
      expect(result.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Forbidden: Admin role required (SEC-09)');
    });

    it('allows verified admin to execute backup on safe endpoint', () => {
      const result = lab.executeAdminBackupSafe('token-admin');
      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBe('ADMIN_DATABASE_EXPORT_BACKUP_BLOB');
    });
  });

  describe('4. Path Traversal Fixture (LAB-TRAV-001)', () => {
    it('detects arbitrary file read when traversal sequence is supplied on vulnerable endpoint', () => {
      const result = lab.readFileVulnerable('../../../../etc/passwd');
      expect(result.status).toBe(200);
      expect(result.content).toContain('root:x:0:0:root:/root:/bin/bash');
    });

    it('NEGATIVE CONTROL: sanitizes path traversal input on safe endpoint', () => {
      const result = lab.readFileSafe('../../../../etc/passwd');
      expect(result.status).toBe(400);
      expect(result.error).toContain('Path Traversal Detected');
      expect(result.content).toBeUndefined();
    });
  });

  describe('5. SSRF / Cloud Metadata Fixture (LAB-SSRF-001)', () => {
    it('detects cloud metadata extraction on vulnerable SSRF fetch endpoint', () => {
      const result = lab.fetchRemoteUrlVulnerable('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
      expect(result.status).toBe(200);
      expect(result.body).toContain('admin-secrets-access');
    });

    it('NEGATIVE CONTROL: enforces SEC-01 safety gate against loopback/cloud IPs on safe endpoint', () => {
      const result = lab.fetchRemoteUrlSafe('http://169.254.169.254/latest/meta-data/');
      expect(result.status).toBe(403);
      expect(result.error).toContain('SEC-01 Scope Safety Gate');
    });
  });

  describe('6. Concurrency / Race Condition Fixture (LAB-RACE-001)', () => {
    it('demonstrates non-atomic multi-redemption race vulnerability under concurrent calls', async () => {
      // Dispatch 3 parallel async redemption requests
      const promises = [
        lab.redeemCouponVulnerable('DISCOUNT-2026'),
        lab.redeemCouponVulnerable('DISCOUNT-2026'),
        lab.redeemCouponVulnerable('DISCOUNT-2026'),
      ];
      const results = await Promise.all(promises);
      const successfulRedemptions = results.filter((r) => r.success);
      // Because of simulated non-atomic delay, more than 1 succeeds
      expect(successfulRedemptions.length).toBeGreaterThan(1);
    });

    it('NEGATIVE CONTROL: guarantees atomic single-use redemption on safe endpoint', async () => {
      const promises = [
        lab.redeemCouponSafe('DISCOUNT-2026'),
        lab.redeemCouponSafe('DISCOUNT-2026'),
        lab.redeemCouponSafe('DISCOUNT-2026'),
      ];
      const results = await Promise.all(promises);
      const successfulRedemptions = results.filter((r) => r.success);
      expect(successfulRedemptions.length).toBe(1);
    });
  });

  describe('7. OAST & Session Lifecycle Governance', () => {
    it('records and correlates out-of-band callback tokens', () => {
      const testToken = 'oast-sec-token-998877';
      expect(lab.hasOastCallback(testToken)).toBe(false);
      lab.recordOastCallback(testToken);
      expect(lab.hasOastCallback(testToken)).toBe(true);
    });

    it('rejects locked and expired sessions with appropriate HTTP status codes', () => {
      const lockedAuth = lab.authenticate('token-locked');
      expect(lockedAuth.status).toBe(403);
      expect(lockedAuth.error).toBe('Account Locked');

      const expiredAuth = lab.authenticate('token-expired');
      expect(expiredAuth.status).toBe(401);
      expect(expiredAuth.error).toBe('Session Expired');
    });
  });

  describe('8. XSS & DOM Reflection Fixture (LAB-XSS-001)', () => {
    it('detects unescaped script reflection in vulnerable comment rendering', () => {
      const payload = '<script>alert(1)</script>';
      const result = lab.renderUserCommentVulnerable(payload);
      expect(result.vulnerable).toBe(true);
      expect(result.html).toBe('<div class="user-comment"><script>alert(1)</script></div>');
    });

    it('NEGATIVE CONTROL: verifies HTML entity escaping on safe comment rendering', () => {
      const payload = '<script>alert(1)</script>';
      const result = lab.renderUserCommentSafe(payload);
      expect(result.vulnerable).toBe(false);
      expect(result.html).toBe('<div class="user-comment">&lt;script&gt;alert(1)&lt;/script&gt;</div>');
    });
  });

  describe('9. GraphQL Introspection & Authorization Fixture (LAB-GQL-001)', () => {
    it('detects enabled GraphQL introspection on vulnerable endpoint', () => {
      const query = '{ __schema { types { name } } }';
      const result = lab.executeGraphQLVulnerable(query);
      expect(result.introspectionAllowed).toBe(true);
      expect(result.data?.__schema?.types?.length).toBeGreaterThan(0);
    });

    it('NEGATIVE CONTROL: blocks schema introspection on safe production GraphQL endpoint', () => {
      const query = '{ __schema { types { name } } }';
      const result = lab.executeGraphQLSafe(query);
      expect(result.introspectionAllowed).toBe(false);
      expect(result.errors?.[0]?.message).toContain('GraphQL Introspection is disabled');
    });
  });

  describe('10. JWT Token Verification & Alg None Bypass (LAB-JWT-001)', () => {
    it('detects alg: none signature bypass on vulnerable JWT validator', () => {
      const headerB64 = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payloadB64 = btoa(JSON.stringify({ user: 'admin', role: 'security_lead' }));
      const unsignedJwt = `${headerB64}.${payloadB64}.`;

      const result = lab.verifyJwtTokenVulnerable(unsignedJwt);
      expect(result.valid).toBe(true);
      expect(result.claims?.user).toBe('admin');
    });

    it('NEGATIVE CONTROL: rejects unsigned or non-RS256 JWT tokens on safe validator', () => {
      const headerB64 = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payloadB64 = btoa(JSON.stringify({ user: 'admin', role: 'security_lead' }));
      const unsignedJwt = `${headerB64}.${payloadB64}.`;

      const result = lab.verifyJwtTokenSafe(unsignedJwt);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Algorithm mismatch');
    });
  });

  describe('11. Command Injection Fixture (LAB-CMD-001)', () => {
    it('detects arbitrary command execution via shell metacharacters on vulnerable endpoint', () => {
      const result = lab.executePingVulnerable('127.0.0.1; id');
      expect(result.status).toBe(200);
      expect(result.output).toContain('uid=0(root)');
    });

    it('NEGATIVE CONTROL: validates strict IP format and rejects shell metacharacters on safe endpoint', () => {
      const result = lab.executePingSafe('127.0.0.1; id');
      expect(result.status).toBe(400);
      expect(result.error).toContain('Shell metacharacters rejected (SEC-02)');
      expect(result.output).toBeUndefined();
    });
  });
});
