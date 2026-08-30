//! Response Diffing Engine (LCS Line & Byte Comparison)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiffKind {
    Unchanged,
    Added,
    Removed,
    Modified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineDiff {
    pub kind: DiffKind,
    pub original_line_num: Option<usize>,
    pub new_line_num: Option<usize>,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HeaderDiffItem {
    pub name: String,
    pub kind: DiffKind,
    pub original_value: Option<String>,
    pub new_value: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseDiffResult {
    pub status_delta: Option<(u16, u16)>,
    pub duration_delta_ms: Option<(u64, u64)>,
    pub size_delta_bytes: (usize, usize),
    pub header_diffs: Vec<HeaderDiffItem>,
    pub body_line_diffs: Vec<LineDiff>,
    pub has_divergence: bool,
}

pub struct ResponseDiff;

impl ResponseDiff {
    pub fn diff_text(original: &str, modified: &str) -> Vec<LineDiff> {
        let orig_lines: Vec<&str> = original.lines().collect();
        let mod_lines: Vec<&str> = modified.lines().collect();

        Self::compute_lcs_diff(&orig_lines, &mod_lines)
    }

    pub fn diff_headers(
        original: &[(Vec<u8>, Vec<u8>)],
        modified: &[(Vec<u8>, Vec<u8>)],
    ) -> Vec<HeaderDiffItem> {
        let mut diffs = Vec::new();

        for (k, v) in original {
            let k_str = String::from_utf8_lossy(k).to_string();
            let v_str = String::from_utf8_lossy(v).to_string();

            if let Some((_, mod_v)) = modified.iter().find(|(mk, _)| mk.eq_ignore_ascii_case(k)) {
                let mod_v_str = String::from_utf8_lossy(mod_v).to_string();
                if v_str == mod_v_str {
                    diffs.push(HeaderDiffItem {
                        name: k_str,
                        kind: DiffKind::Unchanged,
                        original_value: Some(v_str),
                        new_value: Some(mod_v_str),
                    });
                } else {
                    diffs.push(HeaderDiffItem {
                        name: k_str,
                        kind: DiffKind::Modified,
                        original_value: Some(v_str),
                        new_value: Some(mod_v_str),
                    });
                }
            } else {
                diffs.push(HeaderDiffItem {
                    name: k_str,
                    kind: DiffKind::Removed,
                    original_value: Some(v_str),
                    new_value: None,
                });
            }
        }

        // Check for newly added headers
        for (mk, mv) in modified {
            let mk_str = String::from_utf8_lossy(mk).to_string();
            let mv_str = String::from_utf8_lossy(mv).to_string();

            if !original.iter().any(|(k, _)| k.eq_ignore_ascii_case(mk)) {
                diffs.push(HeaderDiffItem {
                    name: mk_str,
                    kind: DiffKind::Added,
                    original_value: None,
                    new_value: Some(mv_str),
                });
            }
        }

        diffs
    }

    /// Computes LCS (Longest Common Subsequence) diff over line slices.
    fn compute_lcs_diff(orig: &[&str], modified: &[&str]) -> Vec<LineDiff> {
        let n = orig.len();
        let m = modified.len();

        let mut dp = vec![vec![0; m + 1]; n + 1];

        for i in 0..n {
            for j in 0..m {
                if orig[i] == modified[j] {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = usize::max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        let mut i = n;
        let mut j = m;
        let mut diffs = Vec::new();

        while i > 0 || j > 0 {
            if i > 0 && j > 0 && orig[i - 1] == modified[j - 1] {
                diffs.push(LineDiff {
                    kind: DiffKind::Unchanged,
                    original_line_num: Some(i),
                    new_line_num: Some(j),
                    content: orig[i - 1].to_string(),
                });
                i -= 1;
                j -= 1;
            } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
                diffs.push(LineDiff {
                    kind: DiffKind::Added,
                    original_line_num: None,
                    new_line_num: Some(j),
                    content: modified[j - 1].to_string(),
                });
                j -= 1;
            } else if i > 0 && (j == 0 || dp[i][j - 1] < dp[i - 1][j]) {
                diffs.push(LineDiff {
                    kind: DiffKind::Removed,
                    original_line_num: Some(i),
                    new_line_num: None,
                    content: orig[i - 1].to_string(),
                });
                i -= 1;
            }
        }

        diffs.reverse();
        diffs
    }
}
