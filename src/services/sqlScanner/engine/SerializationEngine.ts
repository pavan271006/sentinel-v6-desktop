/**
 * SENTINEL — Serialization-Aware Test Generation Engine
 *
 * Maintains strict separation between:
 * 1. LOGICAL TEST: Abstract SQL AST syntax, operators, and test intent.
 * 2. WIRE REPRESENTATION: Transport-encoded HTTP bytes (JSON, XML, URL, multipart, GraphQL).
 */

import { CandidateParameter } from '../../../types/sqlScanner';

export interface SerializedTestRepresentation {
  logicalTestPayload: string;
  wireRepresentation: string;
  transportSurface: CandidateParameter['location'];
  encodingApplied: string;
  contentTypeHeader?: string;
  decodingExpectedByBackend: string;
}

export class SerializationEngine {
  /**
   * Serializes a logical SQL payload into the exact wire representation for a target parameter.
   */
  public static serializeForSurface(
    logicalPayload: string,
    param: CandidateParameter,
    options?: {
      useUnicodeEscape?: boolean;
      useXmlEntities?: boolean;
      useDoubleUrlEncode?: boolean;
    }
  ): SerializedTestRepresentation {
    let wire = logicalPayload;
    let encodingApplied = 'identity';
    let decodingExpected = 'raw';

    switch (param.location) {
      case 'body_json':
      case 'graphql': {
        if (options?.useUnicodeEscape) {
          wire = logicalPayload
            .replace(/'/g, '\\u0027')
            .replace(/"/g, '\\u0022')
            .replace(/=/g, '\\u003d')
            .replace(/ /g, '\\u0020');
          encodingApplied = 'json_unicode_escape';
          decodingExpected = 'JSON.parse() code-point resolution';
        } else {
          // Standard JSON string escaping (quote escaping)
          wire = JSON.stringify(logicalPayload).slice(1, -1);
          encodingApplied = 'json_string_escape';
          decodingExpected = 'JSON.parse() RFC 8259 unescape';
        }
        break;
      }

      case 'body_xml': {
        if (options?.useXmlEntities) {
          wire = logicalPayload
            .replace(/'/g, '&#x27;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          encodingApplied = 'xml_numeric_entity';
          decodingExpected = 'XML DOM Parser entity substitution';
        } else {
          wire = logicalPayload
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          encodingApplied = 'xml_basic_escape';
          decodingExpected = 'XML parser text node decoding';
        }
        break;
      }

      case 'query':
      case 'path': {
        if (options?.useDoubleUrlEncode) {
          wire = encodeURIComponent(encodeURIComponent(logicalPayload));
          encodingApplied = 'double_url_encode';
          decodingExpected = 'Dual-hop proxy path decoding';
        } else {
          wire = encodeURIComponent(logicalPayload);
          encodingApplied = 'standard_url_encode';
          decodingExpected = 'Standard URI query parameter decode';
        }
        break;
      }

      case 'cookie': {
        wire = encodeURIComponent(logicalPayload);
        encodingApplied = 'cookie_rfc6265_encode';
        decodingExpected = 'Cookie header parser decode';
        break;
      }

      case 'header': {
        // Strip carriage returns to prevent CRLF injection in raw headers
        wire = logicalPayload.replace(/[\r\n]/g, ' ');
        encodingApplied = 'crlf_sanitized_header';
        decodingExpected = 'HTTP header field-value parser';
        break;
      }

      case 'body_multipart': {
        wire = logicalPayload;
        encodingApplied = 'multipart_raw_field';
        decodingExpected = 'RFC 7578 multipart boundary parser';
        break;
      }

      default: {
        wire = encodeURIComponent(logicalPayload);
        encodingApplied = 'fallback_url_encode';
        decodingExpected = 'Generic parameter decode';
        break;
      }
    }

    return {
      logicalTestPayload: logicalPayload,
      wireRepresentation: wire,
      transportSurface: param.location,
      encodingApplied,
      decodingExpectedByBackend: decodingExpected,
    };
  }
}