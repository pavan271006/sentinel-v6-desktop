/**
 * Sentinel Sovereign Ω - Adaptive Element Locator (Inspired by Scrapling)
 *
 * Implements resilient, similarity-driven DOM element re-discovery.
 * Overcomes the fragility of static CSS selectors and hardcoded IDs when
 * target websites undergo framework hydration, class name hashing (Tailwind,
 * CSS Modules, styled-components), or layout updates.
 *
 * Capabilities:
 * - Multi-metric similarity scoring: Jaccard n-gram token overlap + Levenshtein distance
 * - Attribute affinity weighting (id, name, aria-label, placeholder, title, role, data-testid)
 * - Semantic tag & role boosting (buttons, inputs, links, forms)
 * - Self-healing selector diagnostics: reports when and how a selector drifted
 */

export interface AdaptiveElementHint {
  selector?: string;
  idMatch?: string;
  nameMatch?: string;
  textMatch?: string;
  hrefMatch?: string;
  ariaMatch?: string;
  placeholderMatch?: string;
  roleMatch?: string;
  tagHint?: string;
  threshold?: number;
}

export interface AdaptiveMatchResult {
  matched: boolean;
  score: number;
  originalHint: string;
  adaptedSelector: string;
  elementSummary: {
    tagName: string;
    id: string;
    className: string;
    text: string;
    name?: string;
    type?: string;
  };
}

/**
 * Computes Jaccard similarity between two token sets (0.0 to 1.0)
 */
export function jaccardTokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const cleanA = a.toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ');
  const cleanB = b.toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ');

  const tokensA = new Set(cleanA.split(/[\s_-]+/).filter(t => t.length > 1));
  const tokensB = new Set(cleanB.split(/[\s_-]+/).filter(t => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++;
  });

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalized Levenshtein distance similarity (0.0 to 1.0)
 */
export function normalizedStringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return minLen / maxLen;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const dist = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1.0 - dist / maxLen);
}

/**
 * Produces an inlined, zero-dependency browser evaluation script that scans
 * the live DOM and locates the best candidate matching the AdaptiveElementHint.
 */
export function buildBrowserAdaptiveLookupScript(hint: AdaptiveElementHint): string {
  return `
    (function __sentinelAdaptiveFind() {
      const hint = ${JSON.stringify(hint)};
      const threshold = hint.threshold || 0.52;

      // 1. Direct match fast paths
      if (hint.idMatch) {
        const el = document.getElementById(hint.idMatch);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          return {
            found: true,
            score: 1.0,
            adaptedSelector: '#' + hint.idMatch,
            element: el
          };
        }
      }

      if (hint.selector && hint.selector !== '*') {
        try {
          const direct = document.querySelector(hint.selector);
          if (direct && direct.offsetWidth > 0 && direct.offsetHeight > 0) {
            return {
              found: true,
              score: 1.0,
              adaptedSelector: hint.selector,
              element: direct
            };
          }
        } catch(e) {}
      }

      // 2. Similarity-based Adaptive Re-Discovery
      const candidates = Array.from(document.querySelectorAll(
        'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="tab"], .btn, .button, [onclick]'
      )).filter(n => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(n).visibility !== 'hidden';
      });

      function cleanTokens(str) {
        if (!str) return [];
        return str.toLowerCase().replace(/[^a-z0-9\\s_-]/g, ' ').split(/[\\s_-]+/).filter(x => x.length > 1);
      }

      function jaccard(arrA, arrB) {
        if (arrA.length === 0 || arrB.length === 0) return 0;
        const setA = new Set(arrA);
        const setB = new Set(arrB);
        let inter = 0;
        setA.forEach(t => { if (setB.has(t)) inter++; });
        const union = setA.size + setB.size - inter;
        return union === 0 ? 0 : inter / union;
      }

      let bestNode = null;
      let bestScore = 0;
      let bestSel = '';

      const targetText = (hint.textMatch || '').toLowerCase().trim();
      const targetTextTokens = cleanTokens(targetText);
      const targetIdTokens = cleanTokens(hint.idMatch || '');
      const targetNameTokens = cleanTokens(hint.nameMatch || '');
      const targetPlaceholderTokens = cleanTokens(hint.placeholderMatch || '');
      const targetAriaTokens = cleanTokens(hint.ariaMatch || '');

      for (const node of candidates) {
        let score = 0;
        const tag = node.tagName.toLowerCase();
        const nodeText = (node.innerText || node.value || node.textContent || '').trim().toLowerCase();
        const nodeTextTokens = cleanTokens(nodeText);
        const nodeIdTokens = cleanTokens(node.id || '');
        const nodeNameTokens = cleanTokens(node.getAttribute('name') || '');
        const nodePlaceholderTokens = cleanTokens(node.getAttribute('placeholder') || '');
        const nodeAriaTokens = cleanTokens(node.getAttribute('aria-label') || '');
        const nodeRole = (node.getAttribute('role') || '').toLowerCase();

        // Exact text match bonus
        if (targetText && nodeText === targetText) {
          score += 0.85;
        } else if (targetText && (nodeText.includes(targetText) || targetText.includes(nodeText))) {
          score += 0.65;
        } else if (targetTextTokens.length > 0) {
          score += jaccard(targetTextTokens, nodeTextTokens) * 0.60;
        }

        // Identifier & Name tokens
        if (targetIdTokens.length > 0 && nodeIdTokens.length > 0) {
          score += jaccard(targetIdTokens, nodeIdTokens) * 0.40;
        }
        if (targetNameTokens.length > 0 && nodeNameTokens.length > 0) {
          score += jaccard(targetNameTokens, nodeNameTokens) * 0.40;
        }

        // Aria & Placeholder tokens
        if (targetAriaTokens.length > 0 && nodeAriaTokens.length > 0) {
          score += jaccard(targetAriaTokens, nodeAriaTokens) * 0.35;
        }
        if (targetPlaceholderTokens.length > 0 && nodePlaceholderTokens.length > 0) {
          score += jaccard(targetPlaceholderTokens, nodePlaceholderTokens) * 0.35;
        }

        // Tag and role matching bonus
        if (hint.tagHint && tag === hint.tagHint.toLowerCase()) {
          score += 0.15;
        }
        if (hint.roleMatch && (nodeRole === hint.roleMatch.toLowerCase() || tag === hint.roleMatch.toLowerCase())) {
          score += 0.15;
        }

        // If target is button-like
        if (/button|submit/i.test(hint.selector || '') && (tag === 'button' || node.type === 'submit' || nodeRole === 'button')) {
          score += 0.10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
          bestSel = node.id ? '#' + node.id : (node.name ? tag + '[name="' + node.name + '"]' : tag);
        }
      }

      if (bestNode && bestScore >= threshold) {
        bestNode.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r = bestNode.getBoundingClientRect();
        return {
          found: true,
          score: Math.min(1.0, Math.round(bestScore * 100) / 100),
          adaptedSelector: bestSel,
          coords: {
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2)
          },
          summary: {
            tagName: bestNode.tagName,
            id: bestNode.id || '',
            className: bestNode.className || '',
            text: (bestNode.innerText || bestNode.value || '').slice(0, 50),
            name: bestNode.getAttribute('name') || '',
            type: bestNode.getAttribute('type') || ''
          }
        };
      }

      return { found: false, score: 0 };
    })()
  `;
}
