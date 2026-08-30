/**
 * SENTINEL V6: Local Deliberately Vulnerable Lab Application
 * 
 * Provides controlled, isolated test fixtures for security testing engines.
 * Includes both VULNERABLE and SAFE (negative control) endpoints for:
 * - SQL Injection (SQLi)
 * - Cross-Site Scripting (XSS / DOM XSS)
 * - Insecure Direct Object Reference (BOLA / IDOR)
 * - Broken Function Level Authorization (BFLA)
 * - Server-Side Request Forgery (SSRF - Mock Target)
 * - Path Traversal
 * - Arbitrary File Upload
 * - CORS Misconfiguration
 * - Concurrency / Race Condition Fixture
 * - GraphQL Authorization & Batching
 * - OAST Interaction Callback
 */

export interface LabUser {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'guest';
  token: string;
  isLocked?: boolean;
  isExpired?: boolean;
}

export interface LabDocument {
  id: string;
  ownerId: number;
  title: string;
  content: string;
  isPublic: boolean;
}

export class VulnerableLabServer {
  private users: Map<string, LabUser> = new Map();
  private documents: Map<string, LabDocument> = new Map();
  private coupons: Map<string, { used: boolean; remainingUses: number }> = new Map();
  private oastCallbacks: string[] = [];

  constructor() {
    this.seedDatabase();
  }

  private seedDatabase() {
    // Seed Users
    this.users.set('token-admin', { id: 1, username: 'admin', role: 'admin', token: 'token-admin' });
    this.users.set('token-user-alice', { id: 2, username: 'alice', role: 'user', token: 'token-user-alice' });
    this.users.set('token-user-bob', { id: 3, username: 'bob', role: 'user', token: 'token-user-bob' });
    this.users.set('token-guest', { id: 4, username: 'guest', role: 'guest', token: 'token-guest' });
    this.users.set('token-locked', { id: 5, username: 'locked_user', role: 'user', token: 'token-locked', isLocked: true });
    this.users.set('token-expired', { id: 6, username: 'expired_user', role: 'user', token: 'token-expired', isExpired: true });

    // Seed Documents (for IDOR / BOLA)
    this.documents.set('doc-101', { id: 'doc-101', ownerId: 1, title: 'Admin Master Key', content: 'SECRET_CONFIDENTIAL_KEY_9988', isPublic: false });
    this.documents.set('doc-102', { id: 'doc-102', ownerId: 2, title: 'Alice Diary', content: 'Alice private notes', isPublic: false });
    this.documents.set('doc-103', { id: 'doc-103', ownerId: 3, title: 'Bob Public CV', content: 'Bob public resume', isPublic: true });

    // Seed Coupons (for Race Condition testing)
    this.coupons.set('DISCOUNT-2026', { used: false, remainingUses: 1 });
  }

  // --- 1. AUTHENTICATION & SESSION FIXTURES ---
  public authenticate(token: string): { user?: LabUser; error?: string; status: number } {
    const user = this.users.get(token);
    if (!user) return { error: 'Invalid Token', status: 401 };
    if (user.isLocked) return { error: 'Account Locked', status: 403 };
    if (user.isExpired) return { error: 'Session Expired', status: 401 };
    return { user, status: 200 };
  }

  // --- 2. SQL INJECTION (Vulnerable vs Safe) ---
  public searchProductsVulnerable(query: string): { results: any[]; sql: string; vulnerable: true } {
    // Simulates raw concatenated SQL
    const simulatedSql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
    if (query.includes("'") || query.includes("--") || query.includes("OR 1=1")) {
      return {
        results: [
          { id: 1, name: 'Flag: SQLI_EXTRACTED_DATA_SUCCESS', price: 9999 },
          { id: 2, name: 'Admin Password Hash: $2a$12$e8xK...hash', price: 0 },
        ],
        sql: simulatedSql,
        vulnerable: true,
      };
    }
    return { results: [{ id: 10, name: 'Standard Widget', price: 19.99 }], sql: simulatedSql, vulnerable: true };
  }

  public searchProductsSafe(query: string): { results: any[]; sql: string; vulnerable: false } {
    // Parameterized / Escaped SQL
    const sanitized = query.replace(/['"\\]/g, '');
    const simulatedSql = `SELECT * FROM products WHERE name LIKE ? [param: "%${sanitized}%"]`;
    return { results: [{ id: 10, name: 'Standard Widget', price: 19.99 }], sql: simulatedSql, vulnerable: false };
  }

  // --- 3. BOLA / IDOR (Vulnerable vs Safe) ---
  public getDocumentVulnerable(docId: string, _userToken: string): { doc?: LabDocument; error?: string; status: number } {
    // Missing ownership validation
    const doc = this.documents.get(docId);
    if (!doc) return { error: 'Document Not Found', status: 404 };
    return { doc, status: 200 };
  }

  public getDocumentSafe(docId: string, userToken: string): { doc?: LabDocument; error?: string; status: number } {
    const auth = this.authenticate(userToken);
    if (!auth.user) return { error: auth.error, status: auth.status };

    const doc = this.documents.get(docId);
    if (!doc) return { error: 'Document Not Found', status: 404 };

    // Enforce ownership check
    if (!doc.isPublic && doc.ownerId !== auth.user.id && auth.user.role !== 'admin') {
      return { error: 'Access Denied: You do not own this document', status: 403 };
    }
    return { doc, status: 200 };
  }

  // --- 4. BFLA (Broken Function Level Authorization) ---
  public executeAdminBackupVulnerable(_userToken: string): { success: boolean; data: string; status: number } {
    // Does not check if user has admin role
    return { success: true, data: 'ADMIN_DATABASE_EXPORT_BACKUP_BLOB', status: 200 };
  }

  public executeAdminBackupSafe(userToken: string): { success: boolean; error?: string; data?: string; status: number } {
    const auth = this.authenticate(userToken);
    if (!auth.user) return { success: false, error: auth.error, status: auth.status };
    if (auth.user.role !== 'admin') {
      return { success: false, error: 'Forbidden: Admin role required (SEC-09)', status: 403 };
    }
    return { success: true, data: 'ADMIN_DATABASE_EXPORT_BACKUP_BLOB', status: 200 };
  }

  // --- 5. PATH TRAVERSAL (Vulnerable vs Safe) ---
  public readFileVulnerable(filename: string): { content: string; status: number } {
    if (filename.includes('..') && (filename.includes('/etc/passwd') || filename.includes('win.ini'))) {
      return { content: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin', status: 200 };
    }
    return { content: `Contents of ${filename}`, status: 200 };
  }

  public readFileSafe(filename: string): { content?: string; error?: string; status: number } {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return { error: 'Path Traversal Detected: Invalid filename', status: 400 };
    }
    return { content: `Contents of safe file: ${filename}`, status: 200 };
  }

  // --- 6. SSRF MOCK TARGET (Vulnerable vs Safe) ---
  public fetchRemoteUrlVulnerable(targetUrl: string): { body: string; status: number } {
    if (targetUrl.includes('169.254.169.254') || targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
      return { body: '{"ami-id": "ami-0123456789abcdef", "instance-id": "i-0987654321fedcba", "iam-role": "admin-secrets-access"}', status: 200 };
    }
    return { body: `Fetched response from ${targetUrl}`, status: 200 };
  }

  public fetchRemoteUrlSafe(targetUrl: string): { body?: string; error?: string; status: number } {
    if (targetUrl.includes('169.254.169.254') || targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1') || targetUrl.includes('10.') || targetUrl.includes('192.168.')) {
      return { error: 'SEC-01 Scope Safety Gate: SSRF to Private / Loopback IP Rejected', status: 403 };
    }
    return { body: `Fetched response from safe target: ${targetUrl}`, status: 200 };
  }

  // --- 7. RACE CONDITION FIXTURE (Vulnerable vs Safe) ---
  public async redeemCouponVulnerable(code: string): Promise<{ success: boolean; message: string }> {
    const coupon = this.coupons.get(code);
    if (!coupon || coupon.remainingUses <= 0) {
      return { success: false, message: 'Coupon already redeemed' };
    }
    // Simulate non-atomic async delay vulnerable to race
    await new Promise((resolve) => setTimeout(resolve, 5));
    coupon.remainingUses -= 1;
    if (coupon.remainingUses <= 0) coupon.used = true;
    return { success: true, message: 'Coupon successfully redeemed (vulnerable to concurrent race)!' };
  }

  public async redeemCouponSafe(code: string): Promise<{ success: boolean; message: string }> {
    const coupon = this.coupons.get(code);
    // Atomic mutex / instant check-and-decrement
    if (!coupon || coupon.remainingUses <= 0) {
      return { success: false, message: 'Coupon already redeemed' };
    }
    coupon.remainingUses -= 1;
    coupon.used = true;
    return { success: true, message: 'Coupon successfully redeemed (atomic lock)!' };
  }

  // --- 8. OAST CALLBACK RECEIVER ---
  public recordOastCallback(tokenId: string) {
    this.oastCallbacks.push(tokenId);
  }

  public hasOastCallback(tokenId: string): boolean {
    return this.oastCallbacks.includes(tokenId);
  }

  // --- 9. XSS / DOM REFLECTION FIXTURES ---
  public renderUserCommentVulnerable(comment: string): { html: string; vulnerable: true } {
    return {
      html: `<div class="user-comment">${comment}</div>`,
      vulnerable: true,
    };
  }

  public renderUserCommentSafe(comment: string): { html: string; vulnerable: false } {
    const escaped = comment
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return {
      html: `<div class="user-comment">${escaped}</div>`,
      vulnerable: false,
    };
  }

  // --- 10. GRAPHQL INTROSPECTION & BATCHING FIXTURES ---
  public executeGraphQLVulnerable(query: string): { data?: any; errors?: any[]; introspectionAllowed: boolean } {
    if (query.includes('__schema') || query.includes('__type')) {
      return {
        data: {
          __schema: {
            types: [
              { name: 'User', fields: [{ name: 'id' }, { name: 'password_hash' }, { name: 'apiKey' }] },
              { name: 'AdminMutation', fields: [{ name: 'deleteDatabase' }, { name: 'dumpSecrets' }] },
            ],
          },
        },
        introspectionAllowed: true,
      };
    }
    return { data: { products: [{ id: 1, name: 'Sample Item' }] }, introspectionAllowed: true };
  }

  public executeGraphQLSafe(query: string): { data?: any; errors?: any[]; introspectionAllowed: boolean } {
    if (query.includes('__schema') || query.includes('__type')) {
      return {
        errors: [{ message: 'GraphQL Introspection is disabled on production environment (SEC-05)' }],
        introspectionAllowed: false,
      };
    }
    return { data: { products: [{ id: 1, name: 'Sample Item' }] }, introspectionAllowed: false };
  }

  // --- 11. JWT SIGNATURE & ALG NONE FIXTURES ---
  public verifyJwtTokenVulnerable(token: string): { valid: boolean; claims?: any; error?: string } {
    const parts = token.split('.');
    if (parts.length < 2) return { valid: false, error: 'Malformed JWT' };
    try {
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      // Vulnerability: Accepts alg: none without signature
      if (header.alg === 'none' || header.alg === 'NONE') {
        return { valid: true, claims: payload };
      }
      return { valid: true, claims: payload };
    } catch {
      return { valid: false, error: 'Invalid Token Encoding' };
    }
  }

  public verifyJwtTokenSafe(token: string): { valid: boolean; claims?: any; error?: string } {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Signature required (SEC-04)' };
    try {
      const header = JSON.parse(atob(parts[0]));
      if (header.alg !== 'RS256') {
        return { valid: false, error: 'Algorithm mismatch: Only RS256 is permitted (SEC-04)' };
      }
      const payload = JSON.parse(atob(parts[1]));
      return { valid: true, claims: payload };
    } catch {
      return { valid: false, error: 'Invalid Token Signature' };
    }
  }

  // --- 12. COMMAND INJECTION FIXTURES ---
  public executePingVulnerable(host: string): { output: string; status: number } {
    if (host.includes(';') || host.includes('&') || host.includes('|')) {
      return {
        output: 'PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\nuid=0(root) gid=0(root) groups=0(root)',
        status: 200,
      };
    }
    return { output: `PING ${host}: 64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.045 ms`, status: 200 };
  }

  public executePingSafe(host: string): { output?: string; error?: string; status: number } {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(host)) {
      return { error: 'Invalid IP address format: Shell metacharacters rejected (SEC-02)', status: 400 };
    }
    return { output: `PING ${host}: 64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.045 ms`, status: 200 };
  }
}
