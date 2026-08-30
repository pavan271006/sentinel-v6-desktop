export class PayloadMutationEngine {
  /**
   * Generates controlled mutations for an SQL probe string
   */
  public static generateMutations(
    basePayload: string,
    options?: {
      enableUrlEncoding?: boolean;
      enableCommentVariants?: boolean;
      enableWhitespaceVariants?: boolean;
      enableCaseVariants?: boolean;
      maxVariants?: number;
    }
  ): string[] {
    const max = options?.maxVariants || 5;
    const variants = new Set<string>();
    variants.add(basePayload);

    // 1. Whitespace variations
    if (options?.enableWhitespaceVariants && basePayload.includes(' ')) {
      variants.add(basePayload.replace(/ /g, '/**/'));
      variants.add(basePayload.replace(/ /g, '+'));
      variants.add(basePayload.replace(/ /g, '%20'));
      variants.add(basePayload.replace(/ /g, '%09'));
    }

    // 2. Comment variations
    if (options?.enableCommentVariants) {
      if (basePayload.endsWith('-- -')) {
        variants.add(basePayload.slice(0, -4) + '--');
        variants.add(basePayload.slice(0, -4) + '#');
        variants.add(basePayload.slice(0, -4) + '/*');
      } else if (basePayload.endsWith('--')) {
        variants.add(basePayload.slice(0, -2) + '-- -');
        variants.add(basePayload.slice(0, -2) + '#');
      }
    }

    // 3. Case variations
    if (options?.enableCaseVariants) {
      const mixed = basePayload
        .replace(/UNION/gi, 'uNiOn')
        .replace(/SELECT/gi, 'sElEcT')
        .replace(/AND/gi, 'aNd')
        .replace(/OR/gi, 'oR')
        .replace(/FROM/gi, 'fRoM')
        .replace(/WHERE/gi, 'wHeRe');
      if (mixed !== basePayload) {
        variants.add(mixed);
      }
    }

    // 4. URL Encoding
    if (options?.enableUrlEncoding) {
      variants.add(encodeURIComponent(basePayload));
    }

    return Array.from(variants).slice(0, max);
  }
}
