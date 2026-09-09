import { CandidateParameter, InjectionContext } from '../../types/sqlScanner';

export class ContextDetector {
  /**
   * Analyzes parameter name, original value, surrounding query structure, and location
   * to determine the most likely SQL execution context
   */
  public static detectContext(param: CandidateParameter, rawRequest: string): InjectionContext {
    const nameLower = param.name.toLowerCase();
    const val = param.originalValue.trim();

    // 1. ORDER BY Context
    if (
      nameLower.includes('sort') ||
      nameLower.includes('order') ||
      nameLower.includes('orderby') ||
      nameLower.includes('sortby') ||
      nameLower.includes('dir') ||
      nameLower.includes('column') ||
      val.toLowerCase() === 'asc' ||
      val.toLowerCase() === 'desc'
    ) {
      return 'order_by_clause';
    }

    // 2. GROUP BY Context
    if (nameLower.includes('group') || nameLower.includes('groupby') || nameLower.includes('aggregate')) {
      return 'group_by_clause';
    }

    // 3. HAVING Context
    if (nameLower.includes('having') || nameLower.includes('filter_count') || nameLower.includes('min_count')) {
      return 'having_clause';
    }

    // 4. Identifier Context (dynamic table/column name)
    if (nameLower.includes('table') || nameLower.includes('tbl') || nameLower.includes('field') || nameLower.includes('col_name')) {
      return 'identifier';
    }

    // 5. INSERT Values Context
    if (rawRequest.includes('INSERT INTO') || nameLower.includes('insert') || (param.location === 'body_form' && nameLower.includes('create_'))) {
      return 'insert_values';
    }

    // 6. UPDATE Set Context
    if (rawRequest.includes('UPDATE ') || nameLower.includes('update') || nameLower.includes('set_')) {
      return 'update_set';
    }

    // 7. Numeric Context (Pure integers / decimals)
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      return 'numeric';
    }

    // 8. JSON Context
    if (param.location === 'body_json' || param.location === 'graphql' || param.jsonPath) {
      return 'json_derived';
    }

    // 9. XML Context
    if (param.location === 'body_xml' || param.xmlPath) {
      return 'xml_derived';
    }

    // 10. Subquery / Parenthesis Context (Explicit Parenthesis in Value)
    if ((val.startsWith('(') && val.endsWith(')')) || rawRequest.includes(`(${param.originalValue})`)) {
      return 'parenthesized_string';
    }

    // 11. Double Quote Context
    if ((val.startsWith('"') && val.endsWith('"')) || rawRequest.includes(`"${param.originalValue}"`)) {
      return 'double_quote_string';
    }

    // 10. Search / LIKE Context
    if (
      nameLower.includes('search') ||
      nameLower.includes('query') ||
      nameLower.includes('find') ||
      nameLower.includes('term') ||
      nameLower.includes('filter') ||
      nameLower.includes('keyword') ||
      val.includes('%') ||
      val.includes('_')
    ) {
      return 'like_clause';
    }

    // 11. Single Quote Template Context
    if (rawRequest.includes(`'${param.originalValue}'`)) {
      return 'single_quote_string';
    }

    // Default string context
    return 'single_quote_string';
  }
}
