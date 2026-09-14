import { CandidateParameter, DbmsType, InjectionContext, ParamTypeCategory, ParameterClassificationResult } from '../../../types/sqlScanner';

export class ParameterClassifier {
  private static UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private static DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  private static DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
  private static ENCODED_BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  private static HEX_REGEX = /^(0x)?[0-9a-fA-F]+$/;

  /**
   * Classifies a parameter's category, nullable status, inferred context, and optimal test suite.
   */
  public static classify(param: CandidateParameter, _dbmsHypothesis: DbmsType = 'Generic SQL'): ParameterClassificationResult {
    const val = (param.originalValue || '').trim();
    const nameLower = param.name.toLowerCase();

    // 1. Nullable / Empty
    if (!val || val.toLowerCase() === 'null' || val.toLowerCase() === 'nil' || val.toLowerCase() === 'undefined') {
      return {
        category: 'null',
        inferredContext: 'where_clause',
        confidence: 90,
        isNullable: true,
        detectedFormat: 'null_literal',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 2. Boolean
    if (val === 'true' || val === 'false' || (val === '1' && (nameLower.startsWith('is_') || nameLower.startsWith('has_') || nameLower === 'active' || nameLower === 'enabled'))) {
      return {
        category: 'boolean',
        inferredContext: 'boolean_literal',
        confidence: 95,
        isNullable: false,
        detectedFormat: 'boolean_primitive',
        recommendedTestFamilies: ['boolean', 'time'],
      };
    }

    // 3. Integer
    if (/^-?\d+$/.test(val)) {
      const isIdentifier = nameLower.endsWith('_id') || nameLower === 'id' || nameLower.endsWith('id');
      return {
        category: 'integer',
        inferredContext: isIdentifier ? 'numeric' : (param.detectedContext || 'numeric'),
        confidence: 95,
        isNullable: false,
        detectedFormat: 'signed_integer',
        recommendedTestFamilies: ['boolean', 'error', 'time', 'union', 'stacked'],
      };
    }

    // 4. Decimal / Float
    if (/^-?\d+\.\d+$/.test(val)) {
      return {
        category: 'decimal',
        inferredContext: 'numeric',
        confidence: 95,
        isNullable: false,
        detectedFormat: 'floating_point',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 5. UUID
    if (this.UUID_REGEX.test(val)) {
      return {
        category: 'uuid',
        inferredContext: 'single_quote_string',
        confidence: 98,
        isNullable: false,
        detectedFormat: 'uuid_v4',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 6. Date
    if (this.DATE_REGEX.test(val)) {
      return {
        category: 'date',
        inferredContext: 'date_time',
        confidence: 95,
        isNullable: false,
        detectedFormat: 'iso_date',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 7. Datetime / Timestamp
    if (this.DATETIME_REGEX.test(val)) {
      return {
        category: 'timestamp',
        inferredContext: 'date_time',
        confidence: 95,
        isNullable: false,
        detectedFormat: 'iso_timestamp',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 8. JSON
    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          // Check if numeric vector
          if (parsed.length > 0 && parsed.every((item) => typeof item === 'number')) {
            return {
              category: 'vector',
              inferredContext: 'vector_op',
              confidence: 90,
              isNullable: false,
              detectedFormat: 'float_vector_array',
              recommendedTestFamilies: ['boolean', 'error', 'time'],
            };
          }
          return {
            category: 'array',
            inferredContext: 'array_derived',
            confidence: 90,
            isNullable: false,
            detectedFormat: 'json_array',
            recommendedTestFamilies: ['boolean', 'error', 'time'],
          };
        }
        return {
          category: 'json',
          inferredContext: 'json_derived',
          confidence: 95,
          isNullable: false,
          detectedFormat: 'json_object',
          recommendedTestFamilies: ['boolean', 'error', 'time', 'stacked'],
        };
      } catch {
        // Not valid JSON
      }
    }

    // 9. XML
    if (val.startsWith('<') && val.endsWith('>') && val.includes('</')) {
      return {
        category: 'xml',
        inferredContext: 'xml_derived',
        confidence: 95,
        isNullable: false,
        detectedFormat: 'xml_document',
        recommendedTestFamilies: ['error', 'boolean', 'time', 'oast'],
      };
    }

    // 10. Spatial / GIS
    if (
      val.toUpperCase().startsWith('POINT(') ||
      val.toUpperCase().startsWith('POLYGON(') ||
      val.toUpperCase().startsWith('LINESTRING(') ||
      nameLower.includes('geom') ||
      nameLower.includes('bbox')
    ) {
      return {
        category: 'spatial',
        inferredContext: 'spatial_op',
        confidence: 90,
        isNullable: false,
        detectedFormat: 'wkt_geometry',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 11. Encoded (Base64 / URL)
    if (val.length >= 8 && val.length % 4 === 0 && this.ENCODED_BASE64_REGEX.test(val) && !val.includes(' ')) {
      try {
        const decoded = atob(val);
        if (decoded.length > 0 && /^[\x20-\x7E\s]+$/.test(decoded)) {
          return {
            category: 'encoded',
            inferredContext: 'single_quote_string',
            confidence: 85,
            isNullable: false,
            detectedFormat: 'base64_encoded',
            recommendedTestFamilies: ['boolean', 'error', 'time'],
          };
        }
      } catch {
        // ignore
      }
    }

    // 12. Enum
    const commonEnums = ['asc', 'desc', 'active', 'inactive', 'pending', 'approved', 'rejected', 'open', 'closed', 'public', 'private'];
    if (commonEnums.includes(val.toLowerCase())) {
      const isSort = val.toLowerCase() === 'asc' || val.toLowerCase() === 'desc';
      return {
        category: 'enum',
        inferredContext: isSort ? 'order_by_clause' : 'single_quote_string',
        confidence: 90,
        isNullable: false,
        detectedFormat: 'enum_literal',
        recommendedTestFamilies: isSort ? ['boolean', 'error', 'time'] : ['boolean', 'time'],
      };
    }

    // 13. Identifier (table / column / field)
    if (
      nameLower === 'sort' ||
      nameLower === 'order' ||
      nameLower === 'by' ||
      nameLower === 'column' ||
      nameLower === 'table' ||
      nameLower === 'field' ||
      nameLower === 'key'
    ) {
      return {
        category: 'identifier',
        inferredContext: (nameLower === 'sort' || nameLower === 'order' || nameLower === 'by') ? 'order_by_clause' : 'identifier',
        confidence: 88,
        isNullable: false,
        detectedFormat: 'sql_identifier',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 14. Binary / Hex
    if (val.length >= 4 && this.HEX_REGEX.test(val) && (val.startsWith('0x') || val.length % 2 === 0)) {
      return {
        category: 'binary',
        inferredContext: 'numeric',
        confidence: 80,
        isNullable: false,
        detectedFormat: 'hex_encoded_binary',
        recommendedTestFamilies: ['boolean', 'error', 'time'],
      };
    }

    // 15. Default: General String
    return {
      category: 'string',
      inferredContext: param.detectedContext || 'single_quote_string',
      confidence: 85,
      isNullable: false,
      detectedFormat: 'alphanumeric_string',
      recommendedTestFamilies: ['boolean', 'error', 'time', 'union', 'stacked', 'oast'],
    };
  }

  /**
   * Derives minimal optimal test set by filtering out non-viable injection families
   * for a given parameter type, context, and DBMS.
   */
  public static deriveOptimalTestSet(
    category: ParamTypeCategory,
    context: InjectionContext,
    dbms: DbmsType = 'Generic SQL'
  ): { families: ('boolean' | 'error' | 'time' | 'union' | 'stacked' | 'oast')[]; estimatedProbes: number } {
    const families: ('boolean' | 'error' | 'time' | 'union' | 'stacked' | 'oast')[] = [];

    // Boolean is universal
    families.push('boolean');

    // Error-based is viable for numeric, string, date, spatial, and vector
    if (['integer', 'decimal', 'string', 'date', 'timestamp', 'spatial', 'vector', 'null'].includes(category)) {
      families.push('error');
    }

    // Time-based is universal for blind verification
    families.push('time');

    // UNION-based requires SELECT projection or compatible WHERE/ORDER BY clause
    if (['string', 'integer', 'identifier'].includes(category) && ['numeric', 'single_quote_string', 'double_quote_string', 'where_clause'].includes(context)) {
      families.push('union');
    }

    // Stacked queries only if DBMS or parameter structure permits
    if (['PostgreSQL', 'Microsoft SQL Server', 'MySQL', 'SQLite'].includes(dbms) || dbms === 'Generic SQL') {
      if (['string', 'integer', 'json'].includes(category)) {
        families.push('stacked');
      }
    }

    // OAST for blind out-of-band exfiltration
    if (['PostgreSQL', 'Microsoft SQL Server', 'Oracle', 'MySQL'].includes(dbms) || dbms === 'Generic SQL') {
      if (['string', 'xml'].includes(category)) {
        families.push('oast');
      }
    }

    // Calculate estimated probe count
    const probesPerFamily: Record<string, number> = {
      boolean: 4,
      error: 6,
      time: 2,
      union: 12,
      stacked: 2,
      oast: 2,
    };

    const estimatedProbes = families.reduce((acc, f) => acc + (probesPerFamily[f] || 2), 0);

    return { families, estimatedProbes };
  }
}
