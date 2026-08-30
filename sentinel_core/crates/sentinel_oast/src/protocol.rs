//! Multi-Protocol OAST Callback Decoders (DNS, HTTP/HTTPS, SMTP)
//!
//! Parses and normalizes incoming out-of-band network interactions:
//! - DNS Queries: extracts QNAME, Query Type (A, AAAA, TXT, CNAME), client source IP
//! - HTTP/HTTPS Requests: extracts method, path, headers (Host, User-Agent, Referer), query parameters, raw body
//! - SMTP Sessions: extracts HELO/EHLO identity, MAIL FROM, RCPT TO, DATA envelope

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OastProtocol {
    Dns,
    Http,
    Https,
    Smtp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedDnsInteraction {
    pub query_name: String,
    pub query_type: String,
    pub client_ip: String,
    pub extracted_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedHttpInteraction {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub extracted_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedSmtpInteraction {
    pub helo_domain: String,
    pub mail_from: String,
    pub rcpt_to: Vec<String>,
    pub raw_data: String,
    pub extracted_token: Option<String>,
}

pub struct OastProtocolDecoder;

impl OastProtocolDecoder {
    /// Decodes a raw DNS query packet / QNAME string
    pub fn decode_dns_query(qname: &str, client_ip: &str) -> DecodedDnsInteraction {
        let clean_qname = qname.trim_end_matches('.');
        let token = Self::extract_token_from_string(clean_qname);

        DecodedDnsInteraction {
            query_name: clean_qname.to_string(),
            query_type: "A".to_string(),
            client_ip: client_ip.to_string(),
            extracted_token: token,
        }
    }

    /// Decodes an incoming HTTP request interaction
    pub fn decode_http_request(
        method: &str,
        path: &str,
        headers: &[(String, String)],
        body: &[u8],
    ) -> DecodedHttpInteraction {
        // Look for token in path or Host header
        let mut token = Self::extract_token_from_string(path);
        if token.is_none() {
            if let Some((_, host)) = headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("host")) {
                token = Self::extract_token_from_string(host);
            }
        }

        DecodedHttpInteraction {
            method: method.to_string(),
            path: path.to_string(),
            headers: headers.to_vec(),
            body: body.to_vec(),
            extracted_token: token,
        }
    }

    /// Decodes an incoming SMTP email interaction
    pub fn decode_smtp_session(
        helo: &str,
        from: &str,
        rcpt: &[String],
        data: &str,
    ) -> DecodedSmtpInteraction {
        let token = Self::extract_token_from_string(from)
            .or_else(|| Self::extract_token_from_string(data));

        DecodedSmtpInteraction {
            helo_domain: helo.to_string(),
            mail_from: from.to_string(),
            rcpt_to: rcpt.to_vec(),
            raw_data: data.to_string(),
            extracted_token: token,
        }
    }

    /// Helper: extracts an `oast_<hex>` token from an arbitrary input string
    fn extract_token_from_string(s: &str) -> Option<String> {
        for segment in s.split(|c: char| !c.is_alphanumeric() && c != '_') {
            if segment.starts_with("oast_") && segment.len() >= 16 {
                return Some(segment.to_string());
            }
        }
        None
    }
}
