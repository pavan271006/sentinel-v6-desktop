//! Request Smuggling & Protocol Anomaly Detection Engine
//!
//! Evaluates HTTP headers, framing metadata, and byte layout against 12 canonical
//! desync indicators (CL.TE, TE.CL, duplicate headers, obfuscations, obs-fold, H2 injection).

use sentinel_common::enums::Severity;
use sentinel_common::operational::ParseWarning;

use crate::headers::find_headers;
use crate::types::RawHeader;

/// Enum of supported request smuggling anomaly indicator types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmugglingIndicator {
    DualFramingClTe,
    DualFramingTeCl,
    DuplicateContentLength,
    DuplicateTransferEncoding,
    ObfuscatedTransferEncoding,
    SpaceBeforeColon,
    ObsoleteLineFolding,
    InvalidChunkHex,
    PrematureEndOfStream,
    H2NewlineInHeader,
    H2DuplicatePseudoHeader,
    H2UppercaseHeader,
}

impl SmugglingIndicator {
    pub fn code(&self) -> &'static str {
        match self {
            Self::DualFramingClTe => "SMUG_CL_TE_DUAL_FRAMING",
            Self::DualFramingTeCl => "SMUG_TE_CL_DUAL_FRAMING",
            Self::DuplicateContentLength => "SMUG_DUPLICATE_CONTENT_LENGTH",
            Self::DuplicateTransferEncoding => "SMUG_DUPLICATE_TRANSFER_ENCODING",
            Self::ObfuscatedTransferEncoding => "SMUG_OBFUSCATED_TRANSFER_ENCODING",
            Self::SpaceBeforeColon => "SMUG_HEADER_SPACE_BEFORE_COLON",
            Self::ObsoleteLineFolding => "SMUG_OBSOLETE_LINE_FOLDING",
            Self::InvalidChunkHex => "SMUG_INVALID_CHUNK_HEX",
            Self::PrematureEndOfStream => "SMUG_PREMATURE_END_OF_STREAM",
            Self::H2NewlineInHeader => "SMUG_H2_NEWLINE_IN_HEADER",
            Self::H2DuplicatePseudoHeader => "SMUG_H2_DUPLICATE_PSEUDO_HEADER",
            Self::H2UppercaseHeader => "SMUG_H2_UPPERCASE_HEADER",
        }
    }

    pub fn default_severity(&self) -> Severity {
        match self {
            Self::DualFramingClTe => Severity::Critical,
            Self::DualFramingTeCl => Severity::Critical,
            Self::DuplicateContentLength => Severity::High,
            Self::DuplicateTransferEncoding => Severity::High,
            Self::ObfuscatedTransferEncoding => Severity::High,
            Self::SpaceBeforeColon => Severity::Medium,
            Self::ObsoleteLineFolding => Severity::Medium,
            Self::InvalidChunkHex => Severity::High,
            Self::PrematureEndOfStream => Severity::Medium,
            Self::H2NewlineInHeader => Severity::Critical,
            Self::H2DuplicatePseudoHeader => Severity::High,
            Self::H2UppercaseHeader => Severity::Low,
        }
    }

    pub fn to_warning(&self, offset: usize, message: impl Into<String>) -> ParseWarning {
        ParseWarning {
            code: self.code().to_string(),
            severity: self.default_severity(),
            offset,
            component: "HTTPParser".to_string(),
            message: message.into(),
        }
    }
}

/// Analyzes parsed HTTP headers and framing for request smuggling anomalies.
pub fn analyze_headers(
    headers: &[RawHeader],
    obs_fold_detected: bool,
    body_len: usize,
) -> Vec<ParseWarning> {
    let mut warnings = Vec::new();

    let cl_headers = find_headers(headers, "content-length");
    let te_headers = find_headers(headers, "transfer-encoding");

    // 1. Dual Framing (CL.TE / TE.CL)
    if !cl_headers.is_empty() && !te_headers.is_empty() {
        let cl_pos = headers
            .iter()
            .position(|h| h.name.eq_ignore_ascii_case(b"content-length"))
            .unwrap_or(0);
        let te_pos = headers
            .iter()
            .position(|h| h.name.eq_ignore_ascii_case(b"transfer-encoding"))
            .unwrap_or(0);

        if cl_pos < te_pos {
            warnings.push(SmugglingIndicator::DualFramingClTe.to_warning(
                cl_pos,
                "Request contains both Content-Length and Transfer-Encoding headers (CL.TE dual framing)",
            ));
        } else {
            warnings.push(SmugglingIndicator::DualFramingTeCl.to_warning(
                te_pos,
                "Request contains Transfer-Encoding followed by Content-Length (TE.CL dual framing)",
            ));
        }
    }

    // 2. Duplicate Content-Length
    if cl_headers.len() > 1 {
        warnings.push(SmugglingIndicator::DuplicateContentLength.to_warning(
            0,
            format!(
                "Multiple Content-Length headers detected (count: {})",
                cl_headers.len()
            ),
        ));
    } else if let Some(cl) = cl_headers.first() {
        // Check for comma-separated Content-Length: "10, 20" or "10, 10"
        if cl.value.contains(&b',') {
            warnings.push(SmugglingIndicator::DuplicateContentLength.to_warning(
                0,
                format!(
                    "Comma-separated Content-Length header value detected: '{}'",
                    cl.value_as_str()
                ),
            ));
        }
    }

    // 3. Duplicate Transfer-Encoding
    if te_headers.len() > 1 {
        warnings.push(SmugglingIndicator::DuplicateTransferEncoding.to_warning(
            0,
            format!(
                "Multiple Transfer-Encoding headers detected (count: {})",
                te_headers.len()
            ),
        ));
    }

    // 4. Obfuscated Transfer-Encoding
    for te in &te_headers {
        let val_str = te.value_as_str().trim().to_lowercase();
        if val_str != "chunked" && val_str != "identity" {
            warnings.push(SmugglingIndicator::ObfuscatedTransferEncoding.to_warning(
                0,
                format!(
                    "Potentially obfuscated Transfer-Encoding header value: '{}'",
                    te.value_as_str()
                ),
            ));
        }
    }

    // 5. Space Before Colon in Headers
    for (idx, h) in headers.iter().enumerate() {
        if h.space_before_colon {
            warnings.push(SmugglingIndicator::SpaceBeforeColon.to_warning(
                idx,
                format!(
                    "Whitespace before colon delimiter detected on header '{}'",
                    h.name_as_str()
                ),
            ));
        }
    }

    // 6. Obsolete Line Folding
    if obs_fold_detected {
        warnings.push(SmugglingIndicator::ObsoleteLineFolding.to_warning(
            0,
            "Obsolete line folding (RFC 7230 obs-fold) detected in header block",
        ));
    }

    // 7. Premature End of Stream / Content-Length mismatch
    if let Some(cl_h) = cl_headers.first() {
        if let Ok(cl_val) = cl_h.value_as_str().trim().parse::<usize>() {
            if body_len < cl_val && te_headers.is_empty() {
                warnings.push(SmugglingIndicator::PrematureEndOfStream.to_warning(
                    0,
                    format!(
                        "Body payload length ({}) is shorter than declared Content-Length ({})",
                        body_len, cl_val
                    ),
                ));
            }
        }
    }

    warnings
}

/// Analyzes HTTP/2 headers for protocol-level anomalies.
pub fn analyze_h2_headers(headers: &[(Vec<u8>, Vec<u8>)]) -> Vec<ParseWarning> {
    let mut warnings = Vec::new();
    let mut pseudo_methods = 0;
    let mut pseudo_paths = 0;
    let mut pseudo_schemes = 0;
    let mut pseudo_authorities = 0;

    for (name, val) in headers {
        let name_str = String::from_utf8_lossy(name);

        // Check for uppercase letters in H2 header names (RFC 7540 §8.1.2)
        if name.iter().any(|b| b.is_ascii_uppercase()) {
            warnings.push(SmugglingIndicator::H2UppercaseHeader.to_warning(
                0,
                format!(
                    "HTTP/2 header name contains uppercase characters: '{}'",
                    name_str
                ),
            ));
        }

        // Check for CRLF injection in header values
        if val.contains(&b'\r') || val.contains(&b'\n') {
            warnings.push(SmugglingIndicator::H2NewlineInHeader.to_warning(
                0,
                format!(
                    "HTTP/2 header '{}' value contains CRLF injection characters",
                    name_str
                ),
            ));
        }

        // Check for duplicate pseudo-headers
        match name.as_slice() {
            b":method" => {
                pseudo_methods += 1;
                if pseudo_methods > 1 {
                    warnings.push(
                        SmugglingIndicator::H2DuplicatePseudoHeader
                            .to_warning(0, "Duplicate HTTP/2 :method pseudo-header".to_string()),
                    );
                }
            }
            b":path" => {
                pseudo_paths += 1;
                if pseudo_paths > 1 {
                    warnings.push(
                        SmugglingIndicator::H2DuplicatePseudoHeader
                            .to_warning(0, "Duplicate HTTP/2 :path pseudo-header".to_string()),
                    );
                }
            }
            b":scheme" => {
                pseudo_schemes += 1;
                if pseudo_schemes > 1 {
                    warnings.push(
                        SmugglingIndicator::H2DuplicatePseudoHeader
                            .to_warning(0, "Duplicate HTTP/2 :scheme pseudo-header".to_string()),
                    );
                }
            }
            b":authority" => {
                pseudo_authorities += 1;
                if pseudo_authorities > 1 {
                    warnings.push(
                        SmugglingIndicator::H2DuplicatePseudoHeader
                            .to_warning(0, "Duplicate HTTP/2 :authority pseudo-header".to_string()),
                    );
                }
            }
            _ => {}
        }
    }

    warnings
}
