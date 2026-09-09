/**
 * Sentinel Autonomous SQL Engine — tRPC & Nested RPC Batch Parser
 *
 * Deconstructs modern Next.js / tRPC batch queries (`{"0": {"json": {...}}}`, `[{"json": {...}}]`)
 * to discover candidate injection vectors and reconstruct valid serialized batch requests.
 */

import { CandidateParameter } from '../../../types/sqlScanner';

export interface TrpcExtractedParam {
  param: CandidateParameter;
  batchIndex: string | number;
  jsonKeyPath: string;
}

export class TrpcBatchParser {
  /**
   * Checks if raw JSON matches standard tRPC batch request structures.
   */
  public static isTrpcPayload(parsedJson: any): boolean {
    if (!parsedJson || typeof parsedJson !== 'object') return false;

    // Array batch format: [{"json": ...}, {"json": ...}]
    if (Array.isArray(parsedJson)) {
      return parsedJson.some((item) => item && typeof item === 'object' && ('json' in item || 'query' in item));
    }

    // Object indexed batch format: {"0": {"json": ...}, "1": {"json": ...}}
    const keys = Object.keys(parsedJson);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys.some((k) => parsedJson[k] && typeof parsedJson[k] === 'object' && 'json' in parsedJson[k]);
    }

    // Single procedure format: {"json": {...}}
    return 'json' in parsedJson;
  }

  /**
   * Extracts candidate parameters from tRPC batch structures.
   */
  public static extractParameters(parsedJson: any): CandidateParameter[] {
    const params: CandidateParameter[] = [];

    const recurseExtract = (obj: any, path: string, batchIdx: string | number) => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, val] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          params.push({
            id: `trpc_${batchIdx}_${fullPath}`,
            name: `trpc[${batchIdx}].${fullPath}`,
            location: 'body_json',
            originalValue: String(val),
            jsonPath: `${batchIdx}.json.${fullPath}`,
            enabled: true,
          });
        } else if (typeof val === 'object' && val !== null) {
          recurseExtract(val, fullPath, batchIdx);
        }
      }
    };

    if (Array.isArray(parsedJson)) {
      parsedJson.forEach((batchItem, idx) => {
        if (batchItem && typeof batchItem === 'object' && batchItem.json) {
          recurseExtract(batchItem.json, '', idx);
        }
      });
    } else if (typeof parsedJson === 'object' && parsedJson !== null) {
      for (const [k, batchItem] of Object.entries(parsedJson)) {
        if (batchItem && typeof batchItem === 'object' && (batchItem as any).json) {
          recurseExtract((batchItem as any).json, '', k);
        }
      }
    }

    return params;
  }
}
