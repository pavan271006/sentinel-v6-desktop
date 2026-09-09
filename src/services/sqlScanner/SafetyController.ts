import { SafetyConfig } from '../../types/sqlScanner';

export class SafetyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyViolationError';
  }
}

/**
 * Sentinel Safety Controller
 * Guarantees zero destructive actions, rate limiting, token redaction, and strict authorization gates.
 */
export class SafetyController {
  private config: SafetyConfig;
  private requestsCount: number = 0;
  private startTime: number = 0;
  private consecutiveErrors: number = 0;

  private static DESTRUCTIVE_KEYWORDS = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+[a-zA-Z0-9_`"\[\]]+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW|INDEX|PROCEDURE|FUNCTION)\b/i,
    /\bALTER\s+(TABLE|DATABASE|SCHEMA)\b/i,
    /\bTRUNCATE\s+(TABLE)?\b/i,
    /\bEXEC\s+(xp_cmdshell|sp_executesql)\b/i,
    /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
    /\bLOAD_FILE\b/i,
    /\bSHUTDOWN\b/i,
  ];

  private static SENSITIVE_DATA_PATTERNS = [
    /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, // JWT
    /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----[^-]+-----END \1 KEY-----/g, // Private Key
    /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?([^"'\s,;&]{6,})["']?/gi, // Secret key-value pairs
    /\b4[0-9]{12}(?:[0-9]{3})?\b|\b5[1-5][0-9]{14}\b|\b3[47][0-9]{13}\b/g, // Credit Card
  ];

  constructor(config: SafetyConfig) {
    this.config = config;
  }

  public initScan(): void {
    if (!this.config.authorizedTestingConfirmed) {
      throw new SafetyViolationError('Scan blocked: Explicit authorized testing confirmation is required.');
    }
    this.requestsCount = 0;
    this.startTime = Date.now();
    this.consecutiveErrors = 0;
  }

  /**
   * Pre-flight verification before sending any test probe
   */
  public validateProbe(payload: string): void {
    if (this.requestsCount >= this.config.maxRequestsPerScan) {
      throw new SafetyViolationError(`Scan halted: Exceeded maximum safety request budget (${this.config.maxRequestsPerScan} requests).`);
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds >= this.config.maxScanDurationSeconds) {
      throw new SafetyViolationError(`Scan halted: Exceeded maximum scan duration limit (${this.config.maxScanDurationSeconds}s).`);
    }

    if (this.consecutiveErrors >= this.config.abortOnConsecutiveErrors) {
      throw new SafetyViolationError(`Scan halted: Target endpoint instability detected (${this.consecutiveErrors} consecutive network errors).`);
    }

    if (this.config.strictNonDestructiveOnly) {
      for (const pattern of SafetyController.DESTRUCTIVE_KEYWORDS) {
        if (pattern.test(payload)) {
          throw new SafetyViolationError(`Payload rejected by safety policy: Destructive SQL keyword detected (${pattern.toString()}).`);
        }
      }
    }

    this.requestsCount++;
  }

  private adaptiveDelayMs: number = 0;

  public recordResponseSuccess(): void {
    this.consecutiveErrors = 0;
  }

  public recordResponseError(): void {
    this.consecutiveErrors++;
  }

  /**
   * Evaluates response telemetry and adapts pacing to protect target server health
   */
  public recordResponseMetrics(statusCode: number, latencyMs: number): void {
    if (statusCode === 429 || statusCode === 503) {
      // Back off significantly on rate-limiting or server strain
      this.adaptiveDelayMs = Math.min(this.adaptiveDelayMs + 750, 4000);
    } else if (latencyMs > 3000) {
      // Back off moderately if target server response latency is degrading
      this.adaptiveDelayMs = Math.min(this.adaptiveDelayMs + 250, 2500);
    } else if (statusCode >= 200 && statusCode < 400 && latencyMs < 800 && this.adaptiveDelayMs > 0) {
      // Gradually recover throughput when server is responding cleanly
      this.adaptiveDelayMs = Math.max(0, this.adaptiveDelayMs - 50);
    }
  }

  /**
   * Enforces minimum throttle delay + dynamic adaptive backoff between test requests
   */
  public async throttle(): Promise<void> {
    const totalDelay = (this.config.rateLimitDelayMs || 0) + this.adaptiveDelayMs;
    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  /**
   * Automatically redacts sensitive secrets in response bodies before exposing to UI or logs
   */
  public redactSensitiveOutput(rawText: string): string {
    if (!this.config.autoRedactSensitiveData || !rawText) return rawText;
    let sanitized = rawText;
    for (const pattern of SafetyController.SENSITIVE_DATA_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.length > 24) {
          return `${match.substring(0, 4)}...[REDACTED_BY_SAFETY_POLICY]...${match.substring(match.length - 4)}`;
        }
        return '[REDACTED_BY_SAFETY_POLICY]';
      });
    }
    return sanitized;
  }
}
