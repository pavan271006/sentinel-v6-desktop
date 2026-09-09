/**
 * Sentinel SQL X — Standalone Zero-Egress IAST Runtime Agent
 *
 * Lightweight, zero-dependency Node.js runtime agent for deep gray-box security observability.
 * Intercepts query execution at database driver boundaries (pg, mysql2, sqlite3) to detect
 * AST grammar mutations and unparameterized query interpolation at runtime.
 *
 * Usage:
 *   node --require ./sentinel-iast-agent.js server.js
 *   or:
 *   require('./sentinel-iast-agent.js');
 *
 * Configuration via Environment Variables:
 *   SENTINEL_IAST_ENABLED     - Enable/disable agent (default: 'true')
 *   SENTINEL_IAST_ENDPOINT    - Local Sentinel telemetry socket (default: 'http://127.0.0.1:5014/iast/telemetry')
 *   SENTINEL_IAST_TOKEN       - Shared secret authorization token (default: 'sentinel-agent-secret')
 *   SENTINEL_IAST_STRICT_AST  - Treat any comment or quote breakout as critical (default: 'true')
 *   SENTINEL_IAST_VERBOSE     - Print runtime driver hooks to stderr (default: 'false')
 */

'use strict';

const http = require('http');
const url = require('url');

// ── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
  enabled: process.env.SENTINEL_IAST_ENABLED !== 'false',
  endpoint: process.env.SENTINEL_IAST_ENDPOINT || 'http://127.0.0.1:5014/iast/telemetry',
  token: process.env.SENTINEL_IAST_TOKEN || 'sentinel-agent-secret',
  strictAst: process.env.SENTINEL_IAST_STRICT_AST !== 'false',
  verbose: process.env.SENTINEL_IAST_VERBOSE === 'true',
};

// Internal In-Memory State (Zero external network egress)
const state = {
  activeTaints: new Map(), // token -> { sourceParam, rawPayload, timestamp }
  history: [],
  breaches: [],
};

// ── AST Boundary Pattern Engine ───────────────────────────────────────────────
const AST_VIOLATION_RULES = [
  {
    id: 'stacked_statement',
    regex: /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|WAITFOR|CREATE|TRUNCATE)\b/i,
    description: 'AST Statement Boundary Breach: Stacked SQL statement executed via semicolon command boundary.',
    severity: 'Critical',
  },
  {
    id: 'union_projection',
    regex: /\bUNION\s+(ALL\s+)?SELECT\b/i,
    description: 'AST Projection Breach: Secondary query tree injected via UNION SELECT operator.',
    severity: 'Critical',
  },
  {
    id: 'boolean_control_flow',
    regex: /'\s*(OR|AND)\s+('?[0-9a-zA-Z_]+'?|[0-9]+)\s*=\s*('?[0-9a-zA-Z_]+'?|[0-9]+)/i,
    description: 'AST Predicate Breach: Injected boolean operator mutated WHERE/HAVING clause truth condition.',
    severity: 'High',
  },
  {
    id: 'blind_side_channel_function',
    regex: /\b(SLEEP|BENCHMARK|PG_SLEEP|WAITFOR\s+DELAY|DBMS_PIPE\.RECEIVE_MESSAGE)\s*\(/i,
    description: 'AST Function Invocation: Injected time-delay or execution side-channel function detected.',
    severity: 'Critical',
  },
  {
    id: 'comment_truncation',
    regex: /('--|#|\/\*)/,
    description: 'AST Lexer Truncation: Comment token suppressed remaining SQL grammar nodes.',
    severity: 'Medium',
  },
  {
    id: 'quote_delimiter_escape',
    regex: /('[^']*(OR|AND|UNION|SELECT|--|#))/i,
    description: 'AST String Literal Breakout: Input escaped string literal boundaries without driver parameterization.',
    severity: 'High',
  },
];

/**
 * Inspects a SQL query string against AST violation rules and registered taint tokens.
 */
function inspectSqlQuery(sqlString, driverName) {
  if (!sqlString || typeof sqlString !== 'string') return null;

  // Extract application caller location from stack trace (skipping agent frames)
  const stack = new Error().stack || '';
  const lines = stack.split('\n').slice(2);
  let callerLocation = 'unknown';
  for (const line of lines) {
    if (!line.includes('sentinel-iast-agent') && !line.includes('node:internal')) {
      const match = line.match(/\((.+)\)/) || line.match(/at\s+(.+)/);
      if (match) {
        callerLocation = match[1];
        break;
      }
    }
  }

  // Check for known taint tokens or raw payloads
  let detectedTaint = null;
  for (const [token, info] of state.activeTaints.entries()) {
    if (sqlString.includes(token) || (info.rawPayload && info.rawPayload.length > 3 && sqlString.includes(info.rawPayload))) {
      detectedTaint = info;
      break;
    }
  }

  // Evaluate AST Grammar Rules
  let matchedRule = null;
  for (const rule of AST_VIOLATION_RULES) {
    if (rule.regex.test(sqlString)) {
      matchedRule = rule;
      break;
    }
  }

  const isBreach = Boolean(matchedRule) || Boolean(detectedTaint);

  const event = {
    id: `iast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    driver: driverName,
    sinkLocation: callerLocation,
    executedQuery: sqlString,
    taintedParameter: detectedTaint ? detectedTaint.sourceParam : undefined,
    taintedValue: detectedTaint ? detectedTaint.rawPayload : undefined,
    grammarViolation: matchedRule ? matchedRule.description : undefined,
    ruleId: matchedRule ? matchedRule.id : undefined,
    severity: matchedRule ? matchedRule.severity : 'High',
    isVulnerable: isBreach,
    stackTrace: callerLocation,
  };

  state.history.push(event);

  if (isBreach) {
    state.breaches.push(event);
    emitAlertToLocalSentinel(event);

    process.stderr.write(
      `\x1b[31m[SENTINEL-IAST ALERT]\x1b[0m ${matchedRule ? matchedRule.description : 'Untrusted query detected'}\n` +
      `  Location: ${callerLocation}\n` +
      `  Driver:   ${driverName}\n` +
      `  SQL:      ${sqlString.substring(0, 160)}${sqlString.length > 160 ? '...' : ''}\n`
    );
  } else if (CONFIG.verbose) {
    process.stderr.write(`[SENTINEL-IAST] Query executed safely on [${driverName}] (${sqlString.length} chars)\n`);
  }

  return event;
}

/**
 * Emits telemetry payload to local Sentinel instance via HTTP POST (Zero Egress, local loopback only).
 */
function emitAlertToLocalSentinel(event) {
  try {
    const parsed = url.parse(CONFIG.endpoint);
    // Enforce loopback-only safety check
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      return;
    }

    const payload = JSON.stringify(event);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 5014,
        path: parsed.path || '/iast/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Sentinel-Agent-Token': CONFIG.token,
        },
        timeout: 800,
      },
      (res) => {
        res.resume(); // discard response body
      }
    );

    req.on('error', () => {
      // Sentinel not running or listener inactive; fail silently to prevent app crash
    });

    req.write(payload);
    req.end();
  } catch {
    // Non-blocking catch
  }
}

// ── Database Driver Monkey-Patching ───────────────────────────────────────────

/**
 * Patch PostgreSQL Driver ('pg')
 */
function patchPg(pgModule) {
  if (!pgModule || pgModule.__sentinel_patched) return;
  pgModule.__sentinel_patched = true;

  // Patch Client.prototype.query
  if (pgModule.Client && pgModule.Client.prototype) {
    const originalClientQuery = pgModule.Client.prototype.query;
    pgModule.Client.prototype.query = function (config, values, callback) {
      const sqlText = typeof config === 'string' ? config : (config && config.text);
      inspectSqlQuery(sqlText, 'pg.Client');
      return originalClientQuery.apply(this, arguments);
    };
  }

  // Patch Pool.prototype.query
  if (pgModule.Pool && pgModule.Pool.prototype) {
    const originalPoolQuery = pgModule.Pool.prototype.query;
    pgModule.Pool.prototype.query = function (config, values, callback) {
      const sqlText = typeof config === 'string' ? config : (config && config.text);
      inspectSqlQuery(sqlText, 'pg.Pool');
      return originalPoolQuery.apply(this, arguments);
    };
  }

  if (CONFIG.verbose) {
    process.stderr.write('[SENTINEL-IAST] Hooked pg (PostgreSQL) driver queries.\n');
  }
}

/**
 * Patch MySQL Driver ('mysql2')
 */
function patchMysql2(mysql2Module) {
  if (!mysql2Module || mysql2Module.__sentinel_patched) return;
  mysql2Module.__sentinel_patched = true;

  const Connection = mysql2Module.Connection || (mysql2Module.prototype && mysql2Module.prototype.constructor);
  if (Connection && Connection.prototype) {
    const originalQuery = Connection.prototype.query;
    Connection.prototype.query = function (sql, values, cb) {
      const sqlText = typeof sql === 'string' ? sql : (sql && sql.sql);
      inspectSqlQuery(sqlText, 'mysql2.Connection.query');
      return originalQuery.apply(this, arguments);
    };

    const originalExecute = Connection.prototype.execute;
    if (originalExecute) {
      Connection.prototype.execute = function (sql, values, cb) {
        const sqlText = typeof sql === 'string' ? sql : (sql && sql.sql);
        inspectSqlQuery(sqlText, 'mysql2.Connection.execute');
        return originalExecute.apply(this, arguments);
      };
    }
  }

  if (CONFIG.verbose) {
    process.stderr.write('[SENTINEL-IAST] Hooked mysql2 driver queries.\n');
  }
}

/**
 * Patch SQLite Driver ('sqlite3')
 */
function patchSqlite3(sqlite3Module) {
  if (!sqlite3Module || sqlite3Module.__sentinel_patched) return;
  sqlite3Module.__sentinel_patched = true;

  if (sqlite3Module.Database && sqlite3Module.Database.prototype) {
    const methods = ['all', 'get', 'run', 'each'];
    for (const method of methods) {
      const original = sqlite3Module.Database.prototype[method];
      if (typeof original === 'function') {
        sqlite3Module.Database.prototype[method] = function (sql) {
          if (typeof sql === 'string') {
            inspectSqlQuery(sql, `sqlite3.Database.${method}`);
          }
          return original.apply(this, arguments);
        };
      }
    }
  }

  if (CONFIG.verbose) {
    process.stderr.write('[SENTINEL-IAST] Hooked sqlite3 driver queries.\n');
  }
}

// ── Module Loading Interceptor (require Hook) ─────────────────────────────────
if (CONFIG.enabled) {
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id) {
    const loadedModule = originalRequire.apply(this, arguments);

    try {
      if (id === 'pg') {
        patchPg(loadedModule);
      } else if (id === 'mysql2' || id === 'mysql2/promise') {
        patchMysql2(loadedModule);
      } else if (id === 'sqlite3') {
        patchSqlite3(loadedModule);
      }
    } catch {
      // Defensive guard: never break application module loading
    }

    return loadedModule;
  };

  process.stderr.write(`[SENTINEL-IAST] Agent initialized. Local telemetry endpoint: ${CONFIG.endpoint}\n`);
}

// ── Exported Programmatic API ─────────────────────────────────────────────────
module.exports = {
  config: CONFIG,
  registerTaint: (sourceParam, rawPayload) => {
    const token = `snl_iast_${Math.random().toString(36).substr(2, 8)}`;
    state.activeTaints.set(token, {
      token,
      sourceParam,
      rawPayload,
      timestamp: Date.now(),
    });
    return token;
  },
  inspectQuery: (sql, driver) => inspectSqlQuery(sql, driver || 'manual'),
  getHistory: () => [...state.history],
  getBreaches: () => [...state.breaches],
  reset: () => {
    state.activeTaints.clear();
    state.history = [];
    state.breaches = [];
  },
};
