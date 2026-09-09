//! SENTINEL Autonomous SQL Security Engine — Request Normalizer (M04)
//!
//! RFC 9110 compliant request parser, URI canonicalizer, parameter pollution
//! handler, and deterministic request identity generator.

use std::collections::BTreeMap;
use url::Url;
use crate::sql::models::Blake3Id;

#[derive(Debug, Clone)]
pub struct NormalizedRequest {
    pub id: Blake3Id,
    pub method: String,
    pub original_uri: String,
    pub canonical_uri: String,
    pub http_version: String,
    pub headers: BTreeMap<String, String>,
    pub query_params: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub content_type: Option<String>,
}

pub struct RequestNormalizer;

impl RequestNormalizer {
    /// Parses a raw HTTP/1.1 or HTTP/2 request string into a NormalizedRequest
    pub fn parse_raw_http(raw_http: &str) -> Result<NormalizedRequest, String> {
        let mut lines = raw_http.lines();
        let request_line = lines.next().ok_or_else(|| "Empty HTTP request".to_string())?.trim();
        
        let parts: Vec<&str> = request_line.split_whitespace().collect();
        if parts.len() < 2 {
            return Err("Invalid HTTP request line".to_string());
        }
        
        let method = parts[0].to_uppercase();
        let raw_uri = parts[1].to_string();
        let http_version = if parts.len() >= 3 { parts[2].to_string() } else { "HTTP/1.1".to_string() };

        let mut headers = BTreeMap::new();
        let mut content_length: Option<usize> = None;
        let mut content_type: Option<String> = None;

        for line in lines.by_ref() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                break; // Start of body
            }
            if let Some((k, v)) = trimmed.split_once(':') {
                let header_name = k.trim().to_lowercase();
                let header_val = v.trim().to_string();
                
                if header_name == "content-length" {
                    content_length = header_val.parse::<usize>().ok();
                } else if header_name == "content-type" {
                    content_type = Some(header_val.clone());
                }
                headers.insert(header_name, header_val);
            }
        }

        // Remaining text is the body
        let body_str: String = lines.collect::<Vec<&str>>().join("\n");
        let mut body = body_str.into_bytes();
        if let Some(cl) = content_length {
            if body.len() > cl {
                body.truncate(cl);
            }
        }

        // Canonicalize URI and extract query parameters
        let (canonical_uri, query_params) = Self::canonicalize_uri(&raw_uri, headers.get("host").map(|s| s.as_str()))?;

        // Compute deterministic hash of the normalized request
        let mut hash_data = Vec::new();
        hash_data.extend_from_slice(method.as_bytes());
        hash_data.push(b' ');
        hash_data.extend_from_slice(canonical_uri.as_bytes());
        hash_data.push(b'\n');
        for (k, v) in &headers {
            hash_data.extend_from_slice(k.as_bytes());
            hash_data.push(b':');
            hash_data.extend_from_slice(v.as_bytes());
            hash_data.push(b'\n');
        }
        hash_data.extend_from_slice(&body);
        let id = Blake3Id::new(&hash_data);

        Ok(NormalizedRequest {
            id,
            method,
            original_uri: raw_uri,
            canonical_uri,
            http_version,
            headers,
            query_params,
            body,
            content_type,
        })
    }

    /// Canonicalizes the URI resolving relative paths, duplicate slashes, and deterministic query sorting
    pub fn canonicalize_uri(raw_uri: &str, host_header: Option<&str>) -> Result<(String, Vec<(String, String)>), String> {
        let full_url_str = if raw_uri.starts_with("http://") || raw_uri.starts_with("https://") {
            raw_uri.to_string()
        } else {
            let host = host_header.unwrap_or("target.local");
            format!("http://{}{}", host, if raw_uri.starts_with('/') { "" } else { "/" }) + raw_uri
        };

        let parsed_url = Url::parse(&full_url_str).map_err(|e| format!("Invalid URI {}: {}", full_url_str, e))?;

        let mut query_params = Vec::new();
        for (k, v) in parsed_url.query_pairs() {
            query_params.push((k.to_string(), v.to_string()));
        }

        // Build canonical path
        let mut path_segments: Vec<&str> = Vec::new();
        for seg in parsed_url.path().split('/') {
            if seg.is_empty() || seg == "." {
                continue;
            } else if seg == ".." {
                path_segments.pop();
            } else {
                path_segments.push(seg);
            }
        }
        let canonical_path = format!("/{}", path_segments.join("/"));

        let mut canonical_url = format!(
            "{}://{}{}",
            parsed_url.scheme(),
            parsed_url.host_str().unwrap_or("localhost"),
            canonical_path
        );

        if let Some(port) = parsed_url.port() {
            let default_port = (parsed_url.scheme() == "http" && port == 80) || (parsed_url.scheme() == "https" && port == 443);
            if !default_port {
                canonical_url = format!(
                    "{}://{}:{}{}",
                    parsed_url.scheme(),
                    parsed_url.host_str().unwrap_or("localhost"),
                    port,
                    canonical_path
                );
            }
        }

        if !query_params.is_empty() {
            let mut sorted_params = query_params.clone();
            sorted_params.sort_by(|a, b| a.0.cmp(&b.0));
            let query_str = sorted_params
                .iter()
                .map(|(k, v)| {
                    let enc_k: String = url::form_urlencoded::byte_serialize(k.as_bytes()).collect();
                    let enc_v: String = url::form_urlencoded::byte_serialize(v.as_bytes()).collect();
                    format!("{}={}", enc_k, enc_v)
                })
                .collect::<Vec<String>>()
                .join("&");
            canonical_url.push('?');
            canonical_url.push_str(&query_str);
        }

        Ok((canonical_url, query_params))
    }
}
