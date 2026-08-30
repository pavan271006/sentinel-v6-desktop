/**
 * HTTPQL (Sentinel HTTP Query Language) Type Definitions
 * Matches sentinel_httpql grammar specifications (V6_HTTPQL_GRAMMAR.pest)
 */

export type HttpqlTokenType =
  | 'FIELD'
  | 'OPERATOR'
  | 'STRING_LITERAL'
  | 'NUMBER_LITERAL'
  | 'BOOLEAN_LITERAL'
  | 'REGEX_LITERAL'
  | 'LIST_OPEN'
  | 'LIST_CLOSE'
  | 'COMMA'
  | 'LOGICAL_AND'
  | 'LOGICAL_OR'
  | 'LOGICAL_NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'WHITESPACE'
  | 'UNKNOWN';

export interface HttpqlToken {
  type: HttpqlTokenType;
  value: string;
  start: number;
  end: number;
}

export type HttpqlComparisonOperator =
  | '=='
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'contains'
  | '~='
  | 'not_contains'
  | '!~='
  | 'matches'
  | '=~'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not in';

export type HttpqlLogicalOperator = 'and' | '&&' | 'or' | '||';

export type HttpqlUnaryOperator = 'not' | '!';

export interface HttpqlFieldNode {
  type: 'FIELD';
  name: string;
  subField?: string;
}

export interface HttpqlLiteralNode {
  type: 'LITERAL';
  value: string | number | boolean | RegExp | Array<string | number>;
  raw: string;
}

export interface HttpqlComparisonNode {
  type: 'COMPARISON';
  field: HttpqlFieldNode;
  operator: HttpqlComparisonOperator;
  value: HttpqlLiteralNode;
}

export interface HttpqlLogicalNode {
  type: 'LOGICAL';
  operator: 'AND' | 'OR';
  left: HttpqlAstNode;
  right: HttpqlAstNode;
}

export interface HttpqlUnaryNode {
  type: 'UNARY';
  operator: 'NOT';
  operand: HttpqlAstNode;
}

export interface HttpqlEmptyNode {
  type: 'EMPTY';
}

export type HttpqlAstNode =
  | HttpqlComparisonNode
  | HttpqlLogicalNode
  | HttpqlUnaryNode
  | HttpqlEmptyNode;

export interface HttpqlSyntaxError {
  message: string;
  offset: number;
  line?: number;
  token?: string;
}

export interface HttpqlValidationResult {
  valid: boolean;
  error?: HttpqlSyntaxError;
  compiledSqlWhere?: string;
  referencedFields: string[];
}

export type HttpqlSuggestionCategory = 'field' | 'operator' | 'value' | 'keyword';

export interface HttpqlAutocompleteSuggestion {
  label: string;
  insertText: string;
  category: HttpqlSuggestionCategory;
  description: string;
  detail?: string;
}
