import {
  HttpqlToken,
  HttpqlComparisonOperator,
  HttpqlAstNode,
  HttpqlSyntaxError,
  HttpqlValidationResult,
  HttpqlAutocompleteSuggestion,
} from '../types/httpql';
import { TrafficSummary, TransactionDetails } from '../types/traffic';
import { TransactionModel } from '../types/models';

// Known field names and aliases
export const KNOWN_HTTPQL_FIELDS = [
  { name: 'req.method', aliases: ['method'], description: 'HTTP Request method (e.g. GET, POST, PUT)' },
  { name: 'req.url', aliases: ['url', 'req.uri', 'uri'], description: 'Full Request URL' },
  { name: 'req.path', aliases: ['path'], description: 'URL path component (e.g. /api/v1/users)' },
  { name: 'req.host', aliases: ['host'], description: 'Target Hostname or domain' },
  { name: 'req.header', aliases: ['req.headers'], description: 'Request header value (req.header.Authorization)' },
  { name: 'req.body', description: 'Request raw body text' },
  { name: 'res.status', aliases: ['resp.status', 'status', 'status_code'], description: 'HTTP Response status code (e.g. 200, 404)' },
  { name: 'res.header', aliases: ['resp.header', 'resp.headers', 'res.headers'], description: 'Response header value (res.header.Content-Type)' },
  { name: 'res.body', aliases: ['resp.body'], description: 'Response raw body text' },
  { name: 'res.time_ms', aliases: ['res.time', 'resp.time', 'resp.time_ms', 'duration_ms', 'duration'], description: 'Total response duration in ms' },
  { name: 'tx.in_scope', aliases: ['scope.status', 'scope', 'in_scope'], description: 'Scope evaluation status (true/false)' },
  { name: 'tags', description: 'Transaction tags array' },
  { name: 'mime', aliases: ['mime_type', 'res.mime'], description: 'Response MIME type' },
  { name: 'size', aliases: ['size_bytes', 'res.size'], description: 'Response payload size in bytes' },
];

export const KNOWN_OPERATORS: Array<{ op: HttpqlComparisonOperator; desc: string }> = [
  { op: '==', desc: 'Exact equality' },
  { op: '!=', desc: 'Inequality' },
  { op: 'contains', desc: 'Substring contains' },
  { op: 'not_contains', desc: 'Substring does not contain' },
  { op: 'starts_with', desc: 'Starts with prefix' },
  { op: 'ends_with', desc: 'Ends with suffix' },
  { op: 'matches', desc: 'Matches regular expression' },
  { op: 'in', desc: 'Contained within list of literals' },
  { op: '>', desc: 'Greater than (numeric)' },
  { op: '>=', desc: 'Greater than or equal (numeric)' },
  { op: '<', desc: 'Less than (numeric)' },
  { op: '<=', desc: 'Less than or equal (numeric)' },
];

/**
 * Tokenizes an HTTPQL query string into lexical tokens.
 */
export function tokenizeHttpql(query: string): { tokens: HttpqlToken[]; errors: HttpqlSyntaxError[] } {
  const tokens: HttpqlToken[] = [];
  const errors: HttpqlSyntaxError[] = [];
  let i = 0;
  const n = query.length;

  while (i < n) {
    const ch = query[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', start: i, end: i + 1 });
      i++;
      continue;
    }

    // List Brackets
    if (ch === '[') {
      tokens.push({ type: 'LIST_OPEN', value: '[', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ']') {
      tokens.push({ type: 'LIST_CLOSE', value: ']', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', start: i, end: i + 1 });
      i++;
      continue;
    }

    // Logical AND (&& or and)
    if (query.startsWith('&&', i)) {
      tokens.push({ type: 'LOGICAL_AND', value: '&&', start: i, end: i + 2 });
      i += 2;
      continue;
    }

    // Logical OR (|| or or)
    if (query.startsWith('||', i)) {
      tokens.push({ type: 'LOGICAL_OR', value: '||', start: i, end: i + 2 });
      i += 2;
      continue;
    }

    // Two-character operators: ==, !=, <=, >=, ~=, =~, !~
    if (query.startsWith('==', i)) {
      tokens.push({ type: 'OPERATOR', value: '==', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (query.startsWith('!=', i)) {
      tokens.push({ type: 'OPERATOR', value: '!=', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (query.startsWith('<=', i)) {
      tokens.push({ type: 'OPERATOR', value: '<=', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (query.startsWith('>=', i)) {
      tokens.push({ type: 'OPERATOR', value: '>=', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (query.startsWith('~=', i) || query.startsWith('=~', i)) {
      tokens.push({ type: 'OPERATOR', value: 'contains', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (query.startsWith('!~=', i) || query.startsWith('!~', i)) {
      tokens.push({ type: 'OPERATOR', value: 'not_contains', start: i, end: i + (query.startsWith('!~=') ? 3 : 2) });
      i += query.startsWith('!~=') ? 3 : 2;
      continue;
    }

    // Single character operators: <, >, =, !
    if (ch === '<') {
      tokens.push({ type: 'OPERATOR', value: '<', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === '>') {
      tokens.push({ type: 'OPERATOR', value: '>', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === '=') {
      tokens.push({ type: 'OPERATOR', value: '==', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'LOGICAL_NOT', value: '!', start: i, end: i + 1 });
      i++;
      continue;
    }

    // String literals ("..." or '...')
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let val = '';
      let closed = false;
      while (i < n) {
        if (query[i] === '\\' && i + 1 < n) {
          val += query[i + 1];
          i += 2;
        } else if (query[i] === quote) {
          closed = true;
          i++;
          break;
        } else {
          val += query[i];
          i++;
        }
      }
      if (!closed) {
        errors.push({
          message: `Unclosed string literal starting at position ${start}`,
          offset: start,
        });
      }
      tokens.push({ type: 'STRING_LITERAL', value: val, start, end: i });
      continue;
    }

    // Number literals (integers and floats)
    if (/\d/.test(ch)) {
      const start = i;
      while (i < n && /[\d.]/.test(query[i])) {
        i++;
      }
      const numStr = query.substring(start, i);
      tokens.push({ type: 'NUMBER_LITERAL', value: numStr, start, end: i });
      continue;
    }

    // Colon operator (: or :>= or :<= or :!= or :== or :> or :<)
    if (ch === ':') {
      const start = i;
      i++;
      if (query.startsWith('>=', i)) {
        tokens.push({ type: 'OPERATOR', value: '>=', start, end: i + 2 });
        i += 2;
      } else if (query.startsWith('<=', i)) {
        tokens.push({ type: 'OPERATOR', value: '<=', start, end: i + 2 });
        i += 2;
      } else if (query.startsWith('!=', i)) {
        tokens.push({ type: 'OPERATOR', value: '!=', start, end: i + 2 });
        i += 2;
      } else if (query.startsWith('==', i)) {
        tokens.push({ type: 'OPERATOR', value: '==', start, end: i + 2 });
        i += 2;
      } else if (query.startsWith('>', i)) {
        tokens.push({ type: 'OPERATOR', value: '>', start, end: i + 1 });
        i += 1;
      } else if (query.startsWith('<', i)) {
        tokens.push({ type: 'OPERATOR', value: '<', start, end: i + 1 });
        i += 1;
      } else if (query.startsWith('=', i)) {
        tokens.push({ type: 'OPERATOR', value: '==', start, end: i + 1 });
        i += 1;
      } else {
        tokens.push({ type: 'OPERATOR', value: 'contains', start, end: i });
      }
      continue;
    }

    // Path literals starting with / (e.g. /api/v1/auth, /graphql)
    if (ch === '/') {
      const start = i;
      while (i < n && /[a-zA-Z0-9_.\/?:&=-]/.test(query[i])) {
        i++;
      }
      const pathVal = query.substring(start, i);
      tokens.push({ type: 'STRING_LITERAL', value: pathVal, start, end: i });
      continue;
    }

    // Word tokens: identifiers, keywords (and, or, not, contains, starts_with, ends_with, matches, in, not in, true, false)
    if (/[a-zA-Z_.]/.test(ch)) {
      const start = i;
      while (i < n && /[a-zA-Z0-9_.-]/.test(query[i])) {
        i++;
      }
      const word = query.substring(start, i);
      const lower = word.toLowerCase();

      if (lower === 'and') {
        tokens.push({ type: 'LOGICAL_AND', value: 'and', start, end: i });
      } else if (lower === 'or') {
        tokens.push({ type: 'LOGICAL_OR', value: 'or', start, end: i });
      } else if (lower === 'not') {
        // Check if next token is "in" -> "not in"
        let peek = i;
        while (peek < n && /\s/.test(query[peek])) peek++;
        if (query.substring(peek, peek + 2).toLowerCase() === 'in' && !/[a-zA-Z0-9_]/.test(query[peek + 2] || '')) {
          tokens.push({ type: 'OPERATOR', value: 'not in', start, end: peek + 2 });
          i = peek + 2;
        } else {
          tokens.push({ type: 'LOGICAL_NOT', value: 'not', start, end: i });
        }
      } else if (
        ['contains', 'not_contains', 'starts_with', 'ends_with', 'matches', 'in'].includes(lower)
      ) {
        tokens.push({ type: 'OPERATOR', value: lower as HttpqlComparisonOperator, start, end: i });
      } else if (lower === 'true' || lower === 'false') {
        tokens.push({ type: 'BOOLEAN_LITERAL', value: lower, start, end: i });
      } else {
        // Field name or unquoted literal
        tokens.push({ type: 'FIELD', value: word, start, end: i });
      }
      continue;
    }

    // Unknown character
    errors.push({
      message: `Unexpected character '${ch}' at position ${i}`,
      offset: i,
    });
    tokens.push({ type: 'UNKNOWN', value: ch, start: i, end: i + 1 });
    i++;
  }

  return { tokens, errors };
}

/**
 * Parses tokens into an AST (Abstract Syntax Tree) with operator precedence:
 * OR (lowest) -> AND -> NOT -> Primary / Comparison
 */
class HttpqlParser {
  private tokens: HttpqlToken[];
  private pos = 0;
  public referencedFields: string[] = [];

  constructor(tokens: HttpqlToken[]) {
    this.tokens = tokens;
  }

  private peek(): HttpqlToken | undefined {
    return this.tokens[this.pos];
  }

  private next(): HttpqlToken | undefined {
    return this.tokens[this.pos++];
  }

  public parse(): HttpqlAstNode {
    if (this.tokens.length === 0) {
      return { type: 'EMPTY' };
    }
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      throw {
        message: `Unexpected token '${tok.value}' at position ${tok.start}`,
        offset: tok.start,
        token: tok.value,
      } as HttpqlSyntaxError;
    }
    return expr;
  }

  private parseOr(): HttpqlAstNode {
    let left = this.parseAnd();

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok && tok.type === 'LOGICAL_OR') {
        this.next();
        const right = this.parseAnd();
        left = {
          type: 'LOGICAL',
          operator: 'OR',
          left,
          right,
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseAnd(): HttpqlAstNode {
    let left = this.parseUnary();

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok && tok.type === 'LOGICAL_AND') {
        this.next();
        const right = this.parseUnary();
        left = {
          type: 'LOGICAL',
          operator: 'AND',
          left,
          right,
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseUnary(): HttpqlAstNode {
    const tok = this.peek();
    if (tok && tok.type === 'LOGICAL_NOT') {
      this.next();
      const operand = this.parseUnary();
      return {
        type: 'UNARY',
        operator: 'NOT',
        operand,
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): HttpqlAstNode {
    const tok = this.peek();
    if (!tok) {
      throw {
        message: 'Unexpected end of query',
        offset: this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].end : 0,
      } as HttpqlSyntaxError;
    }

    // Parenthesized expression
    if (tok.type === 'LPAREN') {
      this.next();
      const expr = this.parseOr();
      const closeTok = this.next();
      if (!closeTok || closeTok.type !== 'RPAREN') {
        throw {
          message: `Expected closing parenthesis ')' matching opening at position ${tok.start}`,
          offset: tok.start,
        } as HttpqlSyntaxError;
      }
      return expr;
    }

    // Comparison expression: <Field> <Operator> <Value>
    if (tok.type === 'FIELD' || tok.type === 'STRING_LITERAL') {
      const fieldTok = this.next()!;
      let fieldName = fieldTok.value;
      let subField: string | undefined;

      // Handle dot syntax e.g. req.header.Authorization
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        if (parts.length >= 3 && (parts[0] === 'req' || parts[0] === 'res' || parts[0] === 'resp') && (parts[1] === 'header' || parts[1] === 'headers')) {
          fieldName = `${parts[0]}.${parts[1]}`;
          subField = parts.slice(2).join('.');
        }
      }

      this.referencedFields.push(fieldName);

      const opTok = this.next();
      if (!opTok || opTok.type !== 'OPERATOR') {
        // If there's no operator, check if it's a bare substring search on all fields
        return {
          type: 'COMPARISON',
          field: { type: 'FIELD', name: 'req.url' },
          operator: 'contains',
          value: { type: 'LITERAL', value: fieldTok.value, raw: fieldTok.value },
        };
      }

      const operator = opTok.value as HttpqlComparisonOperator;
      const valTok = this.peek();
      if (!valTok) {
        throw {
          message: `Expected value after operator '${opTok.value}' at position ${opTok.end}`,
          offset: opTok.end,
        } as HttpqlSyntaxError;
      }

      let literalValue: string | number | boolean | RegExp | Array<string | number>;
      let rawLiteral = '';

      if (valTok.type === 'LIST_OPEN') {
        // Parse list [ "GET", "POST" ]
        this.next();
        const list: Array<string | number> = [];
        while (this.pos < this.tokens.length) {
          const itemTok = this.next();
          if (!itemTok) break;
          if (itemTok.type === 'LIST_CLOSE') break;
          if (itemTok.type === 'COMMA') continue;

          if (itemTok.type === 'STRING_LITERAL' || itemTok.type === 'FIELD') {
            list.push(itemTok.value);
          } else if (itemTok.type === 'NUMBER_LITERAL') {
            list.push(Number(itemTok.value));
          }
        }
        literalValue = list;
        rawLiteral = JSON.stringify(list);
      } else if (valTok.type === 'STRING_LITERAL' || valTok.type === 'FIELD') {
        this.next();
        literalValue = valTok.value;
        rawLiteral = valTok.value;
      } else if (valTok.type === 'NUMBER_LITERAL') {
        this.next();
        literalValue = Number(valTok.value);
        rawLiteral = valTok.value;
      } else if (valTok.type === 'BOOLEAN_LITERAL') {
        this.next();
        literalValue = valTok.value === 'true';
        rawLiteral = valTok.value;
      } else {
        this.next();
        literalValue = valTok.value;
        rawLiteral = valTok.value;
      }

      return {
        type: 'COMPARISON',
        field: { type: 'FIELD', name: fieldName, subField },
        operator,
        value: { type: 'LITERAL', value: literalValue, raw: rawLiteral },
      };
    }

    throw {
      message: `Unexpected token '${tok.value}' at position ${tok.start}`,
      offset: tok.start,
      token: tok.value,
    } as HttpqlSyntaxError;
  }
}

/**
 * Parses an HTTPQL query string into an AST.
 */
export function parseHttpql(query: string): {
  ast: HttpqlAstNode;
  error?: HttpqlSyntaxError;
  referencedFields: string[];
} {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ast: { type: 'EMPTY' }, referencedFields: [] };
  }

  const { tokens, errors } = tokenizeHttpql(query);
  if (errors.length > 0) {
    return { ast: { type: 'EMPTY' }, error: errors[0], referencedFields: [] };
  }

  try {
    const parser = new HttpqlParser(tokens);
    const ast = parser.parse();
    return { ast, referencedFields: parser.referencedFields };
  } catch (err: any) {
    return { ast: { type: 'EMPTY' }, error: err as HttpqlSyntaxError, referencedFields: [] };
  }
}

/**
 * Validates an HTTPQL query and produces syntax feedback and SQL where clause.
 */
export function validateHttpql(query: string): HttpqlValidationResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { valid: true, referencedFields: [] };
  }

  const { ast, error, referencedFields } = parseHttpql(query);
  if (error) {
    return {
      valid: false,
      error,
      referencedFields,
    };
  }

  const compiledSqlWhere = compileHttpqlToSql(ast);
  return {
    valid: true,
    compiledSqlWhere,
    referencedFields,
  };
}

/**
 * Extracts a target field's value from a summary or transaction model for evaluation.
 */
function extractFieldValue(item: any, fieldName: string, subField?: string): any {
  const normalizedField = fieldName.toLowerCase();

  // Method
  if (['req.method', 'method'].includes(normalizedField)) {
    return item.method || item.request?.method || '';
  }

  // URL / URI
  if (['req.url', 'url', 'req.uri', 'uri'].includes(normalizedField)) {
    return item.url || item.request?.url || '';
  }

  // Path
  if (['req.path', 'path'].includes(normalizedField)) {
    if (item.path) return item.path;
    const urlStr = item.url || item.request?.url || '';
    try {
      return new URL(urlStr).pathname;
    } catch {
      const match = urlStr.match(/^https?:\/\/[^/]+(\/[^?#]*)?/i);
      return match && match[1] ? match[1] : '/';
    }
  }

  // Host
  if (['req.host', 'host'].includes(normalizedField)) {
    if (item.host) return item.host;
    const urlStr = item.url || item.request?.url || '';
    try {
      return new URL(urlStr).hostname;
    } catch {
      const match = urlStr.match(/^https?:\/\/([^/:?#]+)/i);
      return match ? match[1] : '';
    }
  }

  // Status code
  if (['res.status', 'resp.status', 'status', 'status_code'].includes(normalizedField)) {
    return typeof item.status === 'number'
      ? item.status
      : item.response?.statusCode || 0;
  }

  // Duration in ms
  if (['res.time_ms', 'res.time', 'resp.time', 'resp.time_ms', 'duration_ms', 'duration'].includes(normalizedField)) {
    return typeof item.durationMs === 'number'
      ? item.durationMs
      : item.response?.durationMs || 0;
  }

  // Size in bytes
  if (['size', 'size_bytes', 'res.size'].includes(normalizedField)) {
    return typeof item.sizeBytes === 'number'
      ? item.sizeBytes
      : item.response?.bodyBytes?.length || 0;
  }

  // Scope status
  if (['tx.in_scope', 'scope.status', 'scope', 'in_scope'].includes(normalizedField)) {
    return Boolean(item.inScope);
  }

  // MIME type
  if (['mime', 'mime_type', 'res.mime'].includes(normalizedField)) {
    return item.mimeType || '';
  }

  // Tags
  if (normalizedField === 'tags') {
    return Array.isArray(item.tags) ? item.tags : [];
  }

  // Headers lookup
  if (['req.header', 'req.headers'].includes(normalizedField)) {
    const headers: Array<{ name: string; value: string }> = item.request?.headers || [];
    if (!subField) return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
    const targetHeader = headers.find(
      (h) => h.name.toLowerCase() === subField.toLowerCase()
    );
    return targetHeader ? targetHeader.value : '';
  }

  if (['res.header', 'resp.header', 'res.headers', 'resp.headers'].includes(normalizedField)) {
    const headers: Array<{ name: string; value: string }> = item.response?.headers || [];
    if (!subField) return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
    const targetHeader = headers.find(
      (h) => h.name.toLowerCase() === subField.toLowerCase()
    );
    return targetHeader ? targetHeader.value : '';
  }

  // Body lookup
  if (normalizedField === 'req.body') {
    return item.request?.bodyText || (typeof item.request?.bodyBytes === 'string' ? item.request.bodyBytes : '');
  }
  if (['res.body', 'resp.body'].includes(normalizedField)) {
    return item.response?.bodyText || (typeof item.response?.bodyBytes === 'string' ? item.response.bodyBytes : '');
  }

  return '';
}

/**
 * Evaluates an HTTPQL AST against a transaction summary or model.
 */
export function evaluateHttpql(
  node: HttpqlAstNode,
  tx: TrafficSummary | TransactionModel | TransactionDetails
): boolean {
  if (node.type === 'EMPTY') {
    return true;
  }

  if (node.type === 'LOGICAL') {
    if (node.operator === 'AND') {
      return evaluateHttpql(node.left, tx) && evaluateHttpql(node.right, tx);
    }
    if (node.operator === 'OR') {
      return evaluateHttpql(node.left, tx) || evaluateHttpql(node.right, tx);
    }
  }

  if (node.type === 'UNARY') {
    if (node.operator === 'NOT') {
      return !evaluateHttpql(node.operand, tx);
    }
  }

  if (node.type === 'COMPARISON') {
    const fieldValue = extractFieldValue(tx, node.field.name, node.field.subField);
    const expected = node.value.value;
    const op = node.operator;

    // Numerical comparisons
    if (typeof fieldValue === 'number' || typeof expected === 'number') {
      const numActual = Number(fieldValue);
      const numExpected = Number(expected);

      switch (op) {
        case '==':
        case '=':
          return numActual === numExpected;
        case '!=':
          return numActual !== numExpected;
        case '>':
          return numActual > numExpected;
        case '>=':
          return numActual >= numExpected;
        case '<':
          return numActual < numExpected;
        case '<=':
          return numActual <= numExpected;
        case 'in':
          return Array.isArray(expected) && expected.map(Number).includes(numActual);
        case 'not in':
          return Array.isArray(expected) && !expected.map(Number).includes(numActual);
      }
    }

    // Boolean comparisons
    if (typeof fieldValue === 'boolean' || typeof expected === 'boolean') {
      const boolActual = Boolean(fieldValue);
      const boolExpected = expected === true || expected === 'true';
      if (op === '==' || op === '=') return boolActual === boolExpected;
      if (op === '!=') return boolActual !== boolExpected;
    }

    // Tags array comparison
    if (Array.isArray(fieldValue)) {
      const strExpected = String(expected).toLowerCase();
      if (op === 'contains' || op === '==' || op === '=') {
        return fieldValue.some((t) => String(t).toLowerCase().includes(strExpected));
      }
      if (op === 'not_contains' || op === '!=') {
        return !fieldValue.some((t) => String(t).toLowerCase().includes(strExpected));
      }
    }

    // String comparisons
    const strActual = String(fieldValue || '').toLowerCase();
    const strExpected = String(expected || '').toLowerCase();

    switch (op) {
      case '==':
      case '=':
        return strActual === strExpected;
      case '!=':
        return strActual !== strExpected;
      case 'contains':
      case '~=':
        return strActual.includes(strExpected);
      case 'not_contains':
      case '!~=':
        return !strActual.includes(strExpected);
      case 'starts_with':
        return strActual.startsWith(strExpected);
      case 'ends_with':
        return strActual.endsWith(strExpected);
      case 'matches':
      case '=~':
        try {
          const regex = new RegExp(strExpected, 'i');
          return regex.test(String(fieldValue || ''));
        } catch {
          return false;
        }
      case 'in':
        if (Array.isArray(expected)) {
          return expected.map((v) => String(v).toLowerCase()).includes(strActual);
        }
        return false;
      case 'not in':
        if (Array.isArray(expected)) {
          return !expected.map((v) => String(v).toLowerCase()).includes(strActual);
        }
        return true;
      default:
        return false;
    }
  }

  return true;
}

/**
 * Compiles an HTTPQL AST node into a backend SQLite WHERE clause.
 */
export function compileHttpqlToSql(node: HttpqlAstNode): string {
  if (node.type === 'EMPTY') return '1=1';

  if (node.type === 'LOGICAL') {
    const leftSql = compileHttpqlToSql(node.left);
    const rightSql = compileHttpqlToSql(node.right);
    return `(${leftSql} ${node.operator} ${rightSql})`;
  }

  if (node.type === 'UNARY') {
    const opSql = compileHttpqlToSql(node.operand);
    return `NOT (${opSql})`;
  }

  if (node.type === 'COMPARISON') {
    const col = mapFieldToSqlColumn(node.field.name);
    const op = node.operator;
    const val = node.value.value;

    if (op === '==' || op === '=') {
      return `${col} = '${escapeSql(val)}'`;
    }
    if (op === '!=') {
      return `${col} != '${escapeSql(val)}'`;
    }
    if (op === 'contains') {
      return `${col} LIKE '%${escapeSql(val)}%'`;
    }
    if (op === 'not_contains') {
      return `${col} NOT LIKE '%${escapeSql(val)}%'`;
    }
    if (op === 'starts_with') {
      return `${col} LIKE '${escapeSql(val)}%'`;
    }
    if (op === 'ends_with') {
      return `${col} LIKE '%${escapeSql(val)}'`;
    }
    if (['>', '>=', '<', '<='].includes(op)) {
      return `${col} ${op} ${Number(val)}`;
    }
    if (op === 'in' && Array.isArray(val)) {
      const items = val.map((v) => `'${escapeSql(v)}'`).join(', ');
      return `${col} IN (${items})`;
    }
  }

  return '1=1';
}

function mapFieldToSqlColumn(field: string): string {
  const f = field.toLowerCase();
  if (['req.method', 'method'].includes(f)) return 'req_method';
  if (['req.url', 'url', 'req.uri', 'uri'].includes(f)) return 'req_uri';
  if (['res.status', 'resp.status', 'status'].includes(f)) return 'res_status';
  if (['res.time_ms', 'duration_ms', 'timing_ms'].includes(f)) return 'timing_ms';
  if (['tx.in_scope', 'in_scope'].includes(f)) return 'in_scope';
  return 'req_uri';
}

function escapeSql(val: any): string {
  return String(val).replace(/'/g, "''");
}

/**
 * Context-aware autocomplete generator for HTTPQL query input.
 */
export function getHttpqlSuggestions(
  query: string,
  cursorPosition: number
): HttpqlAutocompleteSuggestion[] {
  const textBeforeCursor = query.substring(0, cursorPosition);
  const trimmed = textBeforeCursor.trim();
  const endsWithSpace = textBeforeCursor.endsWith(' ');
  const words = trimmed ? trimmed.split(/\s+/) : [];
  const currentWord = endsWithSpace ? '' : (textBeforeCursor.match(/[\w.:-]+$/)?.[0] || '');

  const suggestions: HttpqlAutocompleteSuggestion[] = [];

  // Determine last completed word vs current word
  const lastCompletedWord = endsWithSpace
    ? (words.length > 0 ? words[words.length - 1] : '')
    : (words.length > 1 ? words[words.length - 2] : '');

  const secondLastCompletedWord = endsWithSpace
    ? (words.length > 1 ? words[words.length - 2] : '')
    : (words.length > 2 ? words[words.length - 3] : '');

  const isAfterField = KNOWN_HTTPQL_FIELDS.some(
    (f) => f.name === lastCompletedWord || f.aliases?.includes(lastCompletedWord)
  );

  const isAfterOperator = KNOWN_OPERATORS.some((o) => o.op === lastCompletedWord);

  if (isAfterField && endsWithSpace) {
    // Suggest Operators
    for (const op of KNOWN_OPERATORS) {
      suggestions.push({
        label: op.op,
        insertText: `${op.op} `,
        category: 'operator',
        description: op.desc,
      });
    }
    return suggestions;
  }

  if (isAfterOperator) {
    const targetField = secondLastCompletedWord;
    // Suggest contextual values
    if (['req.method', 'method'].includes(targetField.toLowerCase())) {
      const methods = ['"GET"', '"POST"', '"PUT"', '"DELETE"', '"PATCH"', '"OPTIONS"', '"HEAD"'];
      for (const m of methods) {
        suggestions.push({
          label: m,
          insertText: m,
          category: 'value',
          description: `HTTP Method ${m}`,
        });
      }
      return suggestions;
    }
    if (['res.status', 'status', 'status_code'].includes(targetField.toLowerCase())) {
      const statuses = [
        { code: '200', desc: 'OK' },
        { code: '201', desc: 'Created' },
        { code: '204', desc: 'No Content' },
        { code: '302', desc: 'Found / Redirect' },
        { code: '400', desc: 'Bad Request' },
        { code: '401', desc: 'Unauthorized' },
        { code: '403', desc: 'Forbidden' },
        { code: '404', desc: 'Not Found' },
        { code: '500', desc: 'Internal Server Error' },
        { code: '502', desc: 'Bad Gateway' },
      ];
      for (const s of statuses) {
        suggestions.push({
          label: s.code,
          insertText: s.code,
          category: 'value',
          description: `${s.code} ${s.desc}`,
        });
      }
      return suggestions;
    }
    if (['tx.in_scope', 'in_scope', 'scope'].includes(targetField.toLowerCase())) {
      suggestions.push({ label: 'true', insertText: 'true', category: 'value', description: 'In-scope items only' });
      suggestions.push({ label: 'false', insertText: 'false', category: 'value', description: 'Out-of-scope items' });
      return suggestions;
    }
  }

  // Suggest Fields
  for (const field of KNOWN_HTTPQL_FIELDS) {
    if (!currentWord || field.name.toLowerCase().includes(currentWord.toLowerCase())) {
      suggestions.push({
        label: field.name,
        insertText: `${field.name} `,
        category: 'field',
        description: field.description,
      });
    }
  }

  // Suggest Logical Keywords
  const keywords = [
    { kw: 'and', desc: 'Logical conjunction (AND)' },
    { kw: 'or', desc: 'Logical disjunction (OR)' },
    { kw: 'not', desc: 'Logical negation (NOT)' },
  ];
  for (const k of keywords) {
    if (!currentWord || k.kw.startsWith(currentWord.toLowerCase())) {
      suggestions.push({
        label: k.kw,
        insertText: `${k.kw} `,
        category: 'keyword',
        description: k.desc,
      });
    }
  }

  return suggestions;
}

