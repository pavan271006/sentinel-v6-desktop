import { CandidateParameter, InjectionContext } from '../../types/sqlScanner';

export class ContextDetector {
  /**
   * Analyzes parameter name, original value, surrounding query structure, and location
   * to determine the most likely SQL execution context.
   *
   * Uses word-boundary aware matching to prevent false positives (e.g. 'dir' inside 'directory').
   */
  public static detectContext(param: CandidateParameter, rawRequest: string): InjectionContext {
    const nameLower = param.name.toLowerCase();
    const val = param.originalValue.trim();

    // Helper: word-boundary match on parameter name
    const nameMatchesWord = (word: string) => new RegExp(`(^|[_\\-.])(${word})($|[_\\-.]|\\d)`, 'i').test(nameLower);

    // 1. ORDER BY Context — use word boundaries to avoid matching 'directory', 'redirect', etc.
    if (
      nameMatchesWord('sort') ||
      nameMatchesWord('order') ||
      nameMatchesWord('orderby') ||
      nameMatchesWord('sortby') ||
      nameMatchesWord('sortdir') ||
      nameMatchesWord('orderdir') ||
      (nameMatchesWord('dir') && !nameLower.includes('directory') && !nameLower.includes('direct')) ||
      val.toLowerCase() === 'asc' ||
      val.toLowerCase() === 'desc'
    ) {
      return 'order_by_clause';
    }

    // 2. LIMIT / OFFSET Context
    if (
      nameMatchesWord('limit') ||
      nameMatchesWord('offset') ||
      nameMatchesWord('page') ||
      nameMatchesWord('pagesize') ||
      nameMatchesWord('page_size') ||
      nameMatchesWord('per_page') ||
      nameMatchesWord('perpage') ||
      nameMatchesWord('skip') ||
      nameMatchesWord('take') ||
      nameMatchesWord('rows')
    ) {
      return 'limit_offset';
    }

    // 3. GROUP BY Context
    if (nameMatchesWord('group') || nameMatchesWord('groupby') || nameMatchesWord('aggregate')) {
      return 'group_by_clause';
    }

    // 4. HAVING Context
    if (nameMatchesWord('having') || nameMatchesWord('filter_count') || nameMatchesWord('min_count')) {
      return 'having_clause';
    }

    // 5. Identifier Context (dynamic table/column name)
    if (
      nameMatchesWord('table') ||
      nameMatchesWord('tbl') ||
      nameMatchesWord('field') ||
      nameMatchesWord('col_name') ||
      nameMatchesWord('column')
    ) {
      return 'identifier';
    }

    // 6. SELECT List / Projected Column Expression Context
    if (
      nameMatchesWord('fields') ||
      nameMatchesWord('columns') ||
      nameMatchesWord('projection') ||
      nameMatchesWord('select_list') ||
      nameMatchesWord('attributes') ||
      nameMatchesWord('expr') ||
      nameMatchesWord('select')
    ) {
      return 'select_expr';
    }

    // 7. JOIN Condition Context
    if (
      nameMatchesWord('join') ||
      nameMatchesWord('on_clause') ||
      nameMatchesWord('relation') ||
      nameMatchesWord('rel_id') ||
      nameMatchesWord('join_on')
    ) {
      return 'join_clause';
    }

    // 8. CASE / WHEN Expression Context
    if (
      nameMatchesWord('condition') ||
      nameMatchesWord('case_when') ||
      nameMatchesWord('when') ||
      nameMatchesWord('branch')
    ) {
      return 'case_expr';
    }

    // 9. Window Function / Partition Context
    if (
      nameMatchesWord('partition') ||
      nameMatchesWord('window') ||
      nameMatchesWord('over') ||
      nameMatchesWord('ranking')
    ) {
      return 'window_func';
    }

    // 10. CTE / WITH Clause Context
    if (
      nameMatchesWord('with') ||
      nameMatchesWord('cte') ||
      nameMatchesWord('recursive')
    ) {
      return 'cte_clause';
    }

    // 11. Full-Text Search / Pattern Context
    if (
      nameMatchesWord('fts') ||
      nameMatchesWord('tsquery') ||
      nameMatchesWord('match') ||
      nameMatchesWord('contains') ||
      nameMatchesWord('fulltext')
    ) {
      return 'fulltext_search';
    }

    // 12. Spatial / GIS Context
    if (
      val.toUpperCase().startsWith('POINT(') ||
      val.toUpperCase().startsWith('POLYGON(') ||
      val.toUpperCase().startsWith('LINESTRING(') ||
      nameMatchesWord('geom') ||
      nameMatchesWord('spatial') ||
      nameMatchesWord('bbox') ||
      nameMatchesWord('geojson') ||
      nameMatchesWord('wkt')
    ) {
      return 'spatial_op';
    }

    // 13. DELETE Condition Context
    if (nameLower.includes('delete') || nameLower.includes('purge') || nameLower.includes('remove_')) {
      return 'delete_where';
    }

    // 14. Boolean Literal Parameter Context
    if (
      val.toLowerCase() === 'true' ||
      val.toLowerCase() === 'false' ||
      nameMatchesWord('bool') ||
      nameMatchesWord('boolean') ||
      ((nameMatchesWord('is') || nameMatchesWord('has')) && (val === '0' || val === '1'))
    ) {
      return 'boolean_literal';
    }

    // 15. INSERT Values Context
    if (nameLower.includes('insert') || (param.location === 'body_form' && nameLower.includes('create_'))) {
      return 'insert_values';
    }

    // 16. UPDATE Set Context
    if (nameLower.includes('update') || nameLower.includes('set_')) {
      return 'update_set';
    }

    // 17. MERGE / UPSERT Clause Context
    if (
      nameMatchesWord('merge') ||
      nameMatchesWord('upsert') ||
      nameMatchesWord('matched') ||
      nameMatchesWord('not_matched') ||
      nameMatchesWord('on_conflict') ||
      nameMatchesWord('conflict') ||
      rawRequest.toLowerCase().includes('merge into') ||
      rawRequest.toLowerCase().includes('on conflict')
    ) {
      return 'merge_clause';
    }

    // 18. Date / Timestamp Temporal Context
    const isIsoDate =
      /^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(val) ||
      /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (
      isIsoDate ||
      nameMatchesWord('date') ||
      nameMatchesWord('timestamp') ||
      nameMatchesWord('created_at') ||
      nameMatchesWord('updated_at') ||
      nameMatchesWord('start_date') ||
      nameMatchesWord('end_date') ||
      nameMatchesWord('from_date') ||
      nameMatchesWord('to_date') ||
      nameMatchesWord('period') ||
      nameMatchesWord('until') ||
      nameMatchesWord('since')
    ) {
      return 'date_time';
    }

    // 19. Vector DB / Embedding Similarity Context
    if (
      nameMatchesWord('vector') ||
      nameMatchesWord('embedding') ||
      nameMatchesWord('similarity') ||
      nameMatchesWord('distance') ||
      nameMatchesWord('nearest') ||
      nameMatchesWord('cosine') ||
      (val.startsWith('[') && val.endsWith(']') && val.includes(',') && !val.includes('"'))
    ) {
      return 'vector_op';
    }

    // 20. Array / Collection Context
    if (
      (val.startsWith('{') && val.endsWith('}') && val.includes(',')) ||
      nameMatchesWord('array') ||
      nameMatchesWord('tags') ||
      nameMatchesWord('items_list')
    ) {
      return 'array_derived';
    }

    // 21. Numeric Context (Pure integers / decimals)
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      return 'numeric';
    }

    // 22. JSON Context
    if (param.location === 'body_json' || param.location === 'graphql' || param.jsonPath) {
      return 'json_derived';
    }

    // 23. XML Context
    if (param.location === 'body_xml' || param.xmlPath) {
      return 'xml_derived';
    }

    // 24. Subquery Context
    if (val.toUpperCase().startsWith('(SELECT') || nameMatchesWord('subquery')) {
      return 'subquery';
    }

    // 25. Subquery / Parenthesis Context (Explicit Parenthesis in Value)
    if ((val.startsWith('(') && val.endsWith(')')) || rawRequest.includes(`(${param.originalValue})`)) {
      return 'parenthesized_string';
    }

    // 26. WHERE Clause Context
    if (nameMatchesWord('where') || nameMatchesWord('filter_clause')) {
      return 'where_clause';
    }

    // 25. Double Quote Context
    if ((val.startsWith('"') && val.endsWith('"')) || rawRequest.includes(`"${param.originalValue}"`)) {
      return 'double_quote_string';
    }

    // 26. Search / LIKE Context
    if (
      nameMatchesWord('search') ||
      nameMatchesWord('query') ||
      nameMatchesWord('find') ||
      nameMatchesWord('term') ||
      nameMatchesWord('filter') ||
      nameMatchesWord('keyword') ||
      nameMatchesWord('q') ||
      val.includes('%') ||
      val.includes('_')
    ) {
      return 'like_clause';
    }

    // 27. Single Quote Template Context
    if (rawRequest.includes(`'${param.originalValue}'`)) {
      return 'single_quote_string';
    }

    // Default: single quote string context (most common WHERE clause pattern)
    return 'single_quote_string';
  }
}
