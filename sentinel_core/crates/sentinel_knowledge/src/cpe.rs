//! Common Platform Enumeration (CPE 2.3) and Semantic Version Matcher
//!
//! Implements NIST IR 7695 CPE 2.3 naming specification parsing,
//! wildcard matching, semantic version range comparison, and Linux distro
//! backport patch detection.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fmt;

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CpePart {
    Application,     // "a"
    OperatingSystem, // "o"
    Hardware,        // "h"
    Any,             // "*"
}

impl CpePart {
    pub fn as_str(&self) -> &'static str {
        match self {
            CpePart::Application => "a",
            CpePart::OperatingSystem => "o",
            CpePart::Hardware => "h",
            CpePart::Any => "*",
        }
    }
}

impl fmt::Display for CpePart {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Cpe23Uri {
    pub part: CpePart,
    pub vendor: String,
    pub product: String,
    pub version: String,
    pub update: String,
    pub edition: String,
    pub language: String,
    pub sw_edition: String,
    pub target_sw: String,
    pub target_hw: String,
    pub other: String,
}

impl Cpe23Uri {
    /// Parses a CPE 2.3 formatted string according to NIST IR 7695.
    /// Format: `cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>`
    pub fn parse(uri: &str) -> Result<Self, SentinelError> {
        let trimmed = uri.trim();
        if !trimmed.starts_with("cpe:2.3:") {
            return Err(SentinelError::parse_error(format!(
                "Invalid CPE 2.3 prefix (expected 'cpe:2.3:'): {}",
                uri
            )));
        }

        // Split while respecting escaped colons '\:'
        let mut tokens: Vec<String> = Vec::new();
        let mut current = String::new();
        let mut chars = trimmed.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '\\' {
                if let Some(&next_c) = chars.peek() {
                    current.push(next_c);
                    chars.next();
                } else {
                    current.push('\\');
                }
            } else if c == ':' {
                tokens.push(current);
                current = String::new();
            } else {
                current.push(c);
            }
        }
        tokens.push(current);

        if tokens.len() < 5 {
            return Err(SentinelError::parse_error(format!(
                "CPE 2.3 URI has insufficient fields ({}/13): {}",
                tokens.len(),
                uri
            )));
        }

        let part = match tokens.get(2).map(|s| s.as_str()).unwrap_or("*") {
            "a" => CpePart::Application,
            "o" => CpePart::OperatingSystem,
            "h" => CpePart::Hardware,
            _ => CpePart::Any,
        };

        Ok(Self {
            part,
            vendor: tokens.get(3).cloned().unwrap_or_else(|| "*".into()),
            product: tokens.get(4).cloned().unwrap_or_else(|| "*".into()),
            version: tokens.get(5).cloned().unwrap_or_else(|| "*".into()),
            update: tokens.get(6).cloned().unwrap_or_else(|| "*".into()),
            edition: tokens.get(7).cloned().unwrap_or_else(|| "*".into()),
            language: tokens.get(8).cloned().unwrap_or_else(|| "*".into()),
            sw_edition: tokens.get(9).cloned().unwrap_or_else(|| "*".into()),
            target_sw: tokens.get(10).cloned().unwrap_or_else(|| "*".into()),
            target_hw: tokens.get(11).cloned().unwrap_or_else(|| "*".into()),
            other: tokens.get(12).cloned().unwrap_or_else(|| "*".into()),
        })
    }

    /// Formats the CPE 2.3 URI back to canonical string representation.
    pub fn to_cpe23_string(&self) -> String {
        format!(
            "cpe:2.3:{}:{}:{}:{}:{}:{}:{}:{}:{}:{}:{}",
            self.part.as_str(),
            self.vendor,
            self.product,
            self.version,
            self.update,
            self.edition,
            self.language,
            self.sw_edition,
            self.target_sw,
            self.target_hw,
            self.other
        )
    }

    /// Checks whether this CPE rule matches detected vendor and product names.
    pub fn matches_target(&self, detected_vendor: &str, detected_product: &str) -> bool {
        let v_match = self.vendor == "*"
            || self.vendor == "-"
            || self.vendor.eq_ignore_ascii_case(detected_vendor)
            || detected_vendor.eq_ignore_ascii_case(&self.vendor);
        let p_match = self.product == "*"
            || self.product == "-"
            || self.product.eq_ignore_ascii_case(detected_product)
            || detected_product.eq_ignore_ascii_case(&self.product);
        v_match && p_match
    }

    /// Compares against another CPE 2.3 instance using wildcard resolution.
    pub fn matches_cpe(&self, target: &Cpe23Uri) -> bool {
        let part_match = self.part == CpePart::Any
            || target.part == CpePart::Any
            || self.part == target.part;
        let vendor_match = self.vendor == "*"
            || target.vendor == "*"
            || self.vendor.eq_ignore_ascii_case(&target.vendor);
        let product_match = self.product == "*"
            || target.product == "*"
            || self.product.eq_ignore_ascii_case(&target.product);
        let version_match = self.version == "*"
            || target.version == "*"
            || self.version.eq_ignore_ascii_case(&target.version);

        part_match && vendor_match && product_match && version_match
    }
}

/// Semantic Version representation with Linux distro backport support.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemVersion {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    pub distro_build: Option<String>,
}

impl SemVersion {
    /// Parses standard SemVer or Linux distribution version strings (e.g. "2.4.49", "v1.2.3", "2.4.41-4ubuntu3.14").
    pub fn parse(v: &str) -> Option<Self> {
        let clean = v.trim().trim_start_matches(|c: char| c == 'v' || c == 'V' || c == '=');
        if clean.is_empty() {
            return None;
        }

        // Split by dash to separate base version from distro/pre-release build
        let mut dash_parts = clean.splitn(2, '-');
        let base = dash_parts.next()?;
        let distro_build = dash_parts.next().map(|s| s.to_string());

        let dot_parts: Vec<&str> = base.split('.').collect();
        let major = dot_parts.get(0).and_then(|p| p.parse().ok())?;
        let minor = dot_parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
        let patch = dot_parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);

        Some(Self {
            major,
            minor,
            patch,
            distro_build,
        })
    }

    /// Evaluates whether this version satisfies the specified advisory ranges.
    pub fn satisfies_range(
        &self,
        start_inc: Option<&str>,
        end_inc: Option<&str>,
        end_exc: Option<&str>,
    ) -> bool {
        if let Some(start) = start_inc.and_then(SemVersion::parse) {
            if self < &start {
                return false;
            }
        }
        if let Some(end) = end_inc.and_then(SemVersion::parse) {
            if self > &end {
                return false;
            }
        }
        if let Some(end) = end_exc.and_then(SemVersion::parse) {
            if self >= &end {
                return false;
            }
        }
        true
    }

    /// Determines if a distro backport build satisfies a patched backport requirement.
    /// E.g. "4ubuntu3.14" is >= "4ubuntu3.12" (meaning patched).
    pub fn is_distro_backport_patched(&self, fixed_distro_build: &str) -> bool {
        match (&self.distro_build, fixed_distro_build) {
            (Some(current), target) => {
                // Extract trailing numeric components if available
                let current_nums: Vec<u64> = current
                    .split(|c: char| !c.is_ascii_digit())
                    .filter_map(|s| s.parse().ok())
                    .collect();
                let target_nums: Vec<u64> = target
                    .split(|c: char| !c.is_ascii_digit())
                    .filter_map(|s| s.parse().ok())
                    .collect();

                if !current_nums.is_empty() && !target_nums.is_empty() {
                    current_nums >= target_nums
                } else {
                    current.as_str() >= target
                }
            }
            (None, _) => false,
        }
    }
}

impl Ord for SemVersion {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
    }
}

impl PartialOrd for SemVersion {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Display for SemVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(build) = &self.distro_build {
            write!(f, "{}.{}.{}-{}", self.major, self.minor, self.patch, build)
        } else {
            write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
        }
    }
}
