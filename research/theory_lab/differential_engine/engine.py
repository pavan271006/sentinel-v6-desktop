"""
Differential Security Engine - Statistical & Semantic Divergence Implementation
Module: research.theory_lab.differential_engine.engine
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any, Set
import math
import re
import json

from .models import (
    DifferentialAxis,
    ResponseSnapshot,
    LatencyDistribution,
    DivergenceResult,
)


def compute_token_shannon_entropy(token: str) -> float:
    """Compute exact Shannon entropy H(token) in bits."""
    if not token:
        return 0.0
    freq: Dict[str, int] = {}
    for c in token:
        freq[c] = freq.get(c, 0) + 1
    
    n = len(token)
    entropy = 0.0
    for count in freq.values():
        p = count / n
        entropy -= p * math.log2(p)
    return entropy


# Volatile patterns
UUID_REGEX = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
TIMESTAMP_REGEX = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?")
NUMERIC_ID_REGEX = re.compile(r"\b\d{6,}\b")
HEX_TOKEN_REGEX = re.compile(r"\b[0-9a-fA-F]{16,64}\b")
JWT_REGEX = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")


def mask_volatile_tokens(text: str, entropy_threshold: float = 3.8) -> Tuple[str, int]:
    """
    Masks volatile tokens (UUIDs, timestamps, session tokens, dynamic nonces, JWTs)
    to eliminate false-positive divergence.
    """
    if not text:
        return "", 0
    masked_count = 0

    # 1. Regex masks
    text, n0 = JWT_REGEX.subn("[JWT_MASKED]", text)
    text, n1 = UUID_REGEX.subn("[UUID_MASKED]", text)
    text, n2 = TIMESTAMP_REGEX.subn("[TIMESTAMP_MASKED]", text)
    text, n3 = NUMERIC_ID_REGEX.subn("[NUMERIC_ID_MASKED]", text)
    text, n4 = HEX_TOKEN_REGEX.subn("[HEX_NONCE_MASKED]", text)
    masked_count += n0 + n1 + n2 + n3 + n4

    # 2. Entropy-based token masking for words/tokens >= 12 chars
    words = text.split()
    masked_words = []
    for word in words:
        # Strip common punctuation for entropy analysis
        clean_word = word.strip('"\'{},:[]()')
        if len(clean_word) >= 12 and compute_token_shannon_entropy(clean_word) >= entropy_threshold:
            masked_words.append("[HIGH_ENTROPY_TOKEN_MASKED]")
            masked_count += 1
        else:
            masked_words.append(word)

    return " ".join(masked_words), masked_count


def extract_structural_tokens(text: str) -> Set[str]:
    """
    Extracts structural tokens from text / JSON AST to compare layout.
    """
    if not text:
        return set()
    try:
        data = json.loads(text)
        tokens = set()
        
        def recurse_json(obj, prefix=""):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    key_path = f"{prefix}.{k}" if prefix else k
                    tokens.add(f"KEY:{key_path}")
                    recurse_json(v, key_path)
            elif isinstance(obj, list):
                tokens.add(f"ARR_LEN:{prefix}:{len(obj)}")
                if obj:
                    for i, item in enumerate(obj[:5]):  # Sample first 5 items
                        recurse_json(item, f"{prefix}[{i}]")
            else:
                tokens.add(f"TYPE:{prefix}:{type(obj).__name__}")
                # Include constant / enum values if short
                if isinstance(obj, (bool, type(None))):
                    tokens.add(f"VAL:{prefix}:{str(obj)}")
                elif isinstance(obj, str) and len(obj) <= 20 and not obj.startswith("["):
                    tokens.add(f"VAL:{prefix}:{obj}")

        recurse_json(data)
        return tokens
    except Exception:
        # Fallback: word n-grams and line structures
        words = text.split()
        return set(words)


def compute_jaccard_similarity(tokens_a: Set[str], tokens_b: Set[str]) -> float:
    """Computes Jaccard similarity coefficient J(A, B) = |A ∩ B| / |A ∪ B|."""
    if not tokens_a and not tokens_b:
        return 1.0
    union = tokens_a.union(tokens_b)
    if not union:
        return 1.0
    intersection = tokens_a.intersection(tokens_b)
    return len(intersection) / len(union)


def compute_header_divergence(headers_a: Dict[str, str], headers_b: Dict[str, str]) -> float:
    """Computes normalized distance over canonical security headers."""
    security_headers = [
        "content-type", "x-frame-options", "content-security-policy",
        "x-content-type-options", "strict-transport-security", "location",
        "www-authenticate", "access-control-allow-origin"
    ]
    diff_count = 0
    total_checked = 0
    norm_a = {k.lower(): v.strip() for k, v in headers_a.items()}
    norm_b = {k.lower(): v.strip() for k, v in headers_b.items()}

    for h in security_headers:
        val_a = norm_a.get(h)
        val_b = norm_b.get(h)
        if val_a is not None or val_b is not None:
            total_checked += 1
            if val_a != val_b:
                diff_count += 1
    if total_checked == 0:
        return 0.0
    return diff_count / total_checked


def welch_t_test(pop1: List[float], pop2: List[float]) -> Tuple[Optional[float], Optional[float], bool]:
    """
    Calculates Welch's t-test statistic and two-tailed p-value for unequal variances.
    Returns (t_stat, p_value, is_significant_at_p_001).
    """
    n1 = len(pop1)
    n2 = len(pop2)
    if n1 < 3 or n2 < 3:
        return None, None, False

    mean1 = sum(pop1) / n1
    mean2 = sum(pop2) / n2

    var1 = sum((x - mean1) ** 2 for x in pop1) / (n1 - 1)
    var2 = sum((x - mean2) ** 2 for x in pop2) / (n2 - 1)

    denom = math.sqrt((var1 / n1) + (var2 / n2))
    if denom == 0.0:
        return 0.0, 1.0, False

    t_stat = (mean1 - mean2) / denom

    # Welch-Satterthwaite degrees of freedom
    df_num = ((var1 / n1) + (var2 / n2)) ** 2
    df_den = (((var1 / n1) ** 2) / (n1 - 1)) + (((var2 / n2) ** 2) / (n2 - 1))
    df = df_num / df_den if df_den > 0 else 1.0

    # Student-t two-tailed p-value approximation via standard normal / regularized incomplete beta approximation
    z = abs(t_stat)
    p = 0.3275911
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    t_val = 1.0 / (1.0 + p * (z / math.sqrt(2.0)))
    erfc = (a1 * t_val + a2 * (t_val**2) + a3 * (t_val**3) + a4 * (t_val**4) + a5 * (t_val**5)) * math.exp(-(z**2) / 2.0)
    p_value = min(1.0, max(0.0, erfc))

    is_significant = (p_value < 0.001) or (abs(t_stat) > 4.5)
    return round(t_stat, 4), round(p_value, 6), is_significant


class DifferentialSecurityEngine:
    """
    Multi-dimensional statistical and semantic divergence analyzer.
    """

    def __init__(self, entropy_threshold: float = 3.8):
        self.entropy_threshold = entropy_threshold

    def analyze_divergence(
        self,
        baseline: ResponseSnapshot,
        candidate: ResponseSnapshot,
        axis: DifferentialAxis,
        baseline_latencies: Optional[List[float]] = None,
        candidate_latencies: Optional[List[float]] = None,
    ) -> DivergenceResult:
        """
        Analyzes the semantic and statistical divergence between baseline and candidate responses.
        """
        # 1. Status Code Divergence
        status_diverged = (baseline.status_code != candidate.status_code)

        # 2. Volatile Token Masking
        masked_base, n_base = mask_volatile_tokens(baseline.body, self.entropy_threshold)
        masked_cand, n_cand = mask_volatile_tokens(candidate.body, self.entropy_threshold)
        total_masked = n_base + n_cand

        # 3. Body Length Delta
        body_len_delta = abs(len(masked_cand.encode("utf-8")) - len(masked_base.encode("utf-8")))
        max_len = max(len(masked_base.encode("utf-8")), len(masked_cand.encode("utf-8")), 1)
        length_divergence_ratio = body_len_delta / max_len

        # 4. AST / Token Jaccard Similarity
        tokens_base = extract_structural_tokens(masked_base)
        tokens_cand = extract_structural_tokens(masked_cand)
        jaccard_sim = compute_jaccard_similarity(tokens_base, tokens_cand)
        ast_divergence = 1.0 - jaccard_sim

        # 5. Header Divergence
        header_divergence = compute_header_divergence(baseline.headers, candidate.headers)

        # 6. Statistical Latency Welch's t-test (if latency populations provided)
        t_stat, p_val, is_timing_sig = None, None, False
        if baseline_latencies and candidate_latencies:
            t_stat, p_val, is_timing_sig = welch_t_test(baseline_latencies, candidate_latencies)

        # 7. Composite Divergence Score Calculation
        # Weights: Status (0.40), AST (0.35), Length (0.15), Header (0.10)
        status_weight = 0.40 if status_diverged else 0.0
        composite_score = min(1.0, status_weight + (0.35 * ast_divergence) + (0.15 * length_divergence_ratio) + (0.10 * header_divergence))

        # 8. Finding Verdict Classification based on Differential Axis
        verdict = "BENIGN"
        details: Dict[str, Any] = {
            "baseline_status": baseline.status_code,
            "candidate_status": candidate.status_code,
            "masked_base_sample": masked_base[:120],
            "masked_cand_sample": masked_cand[:120],
            "header_divergence": round(header_divergence, 4),
        }

        if axis == DifferentialAxis.ROLE_A_VS_ROLE_B:
            # BOLA / IDOR check:
            # If User A accesses User B's resource and gets 200 OK with high structural similarity (>0.80) -> IDOR!
            if candidate.status_code == 200 and jaccard_sim >= 0.80:
                verdict = "CONFIRMED_VULNERABILITY"
                details["vuln_type"] = "IDOR_BOLA_HORIZONTAL_BYPASS"
            elif candidate.status_code in (401, 403, 404):
                verdict = "BENIGN"
            else:
                verdict = "POTENTIAL_ANOMALY"

        elif axis == DifferentialAxis.AUTHENTICATED_VS_ANONYMOUS:
            # BFLA check:
            # If anonymous user gets 200 OK to an authenticated endpoint with identical body structure -> BFLA!
            if candidate.status_code == 200 and jaccard_sim >= 0.85:
                verdict = "CONFIRMED_VULNERABILITY"
                details["vuln_type"] = "BFLA_UNAUTHENTICATED_ACCESS"
            elif candidate.status_code in (401, 403):
                verdict = "BENIGN"
            else:
                verdict = "POTENTIAL_ANOMALY"

        elif axis == DifferentialAxis.BASELINE_VS_MUTATED:
            # Injection / behavioral anomaly
            if is_timing_sig and abs(t_stat or 0) >= 4.0:
                verdict = "CONFIRMED_VULNERABILITY"
                details["vuln_type"] = "TIME_BASED_INJECTION"
            elif status_diverged and candidate.status_code == 500:
                verdict = "POTENTIAL_ANOMALY"
                details["vuln_type"] = "SERVER_ERROR_TRIGGERED"
            elif composite_score > 0.60:
                verdict = "POTENTIAL_ANOMALY"
                details["vuln_type"] = "STRUCTURAL_RESPONSE_DIVERGENCE"

        elif axis == DifferentialAxis.HTTP1_VS_HTTP2:
            # Protocol translation discrepancy
            if status_diverged or ast_divergence > 0.50:
                verdict = "CONFIRMED_VULNERABILITY"
                details["vuln_type"] = "PROTOCOL_TRANSLATION_DESYNC"

        elif axis == DifferentialAxis.ORIGIN_VS_PROXY_CACHE:
            # Cache deception or poisoning
            if status_diverged or composite_score > 0.50:
                verdict = "CONFIRMED_VULNERABILITY"
                details["vuln_type"] = "CACHE_DECEPTION_POISONING"

        return DivergenceResult(
            axis=axis,
            divergence_score=round(composite_score, 4),
            status_code_diverged=status_diverged,
            body_length_delta=body_len_delta,
            ast_jaccard_similarity=round(jaccard_sim, 4),
            token_distance=round(ast_divergence, 4),
            latency_welch_t_stat=t_stat,
            latency_welch_p_value=p_val,
            is_statistically_significant=is_timing_sig,
            masked_volatile_tokens_count=total_masked,
            finding_verdict=verdict,
            details=details,
        )
