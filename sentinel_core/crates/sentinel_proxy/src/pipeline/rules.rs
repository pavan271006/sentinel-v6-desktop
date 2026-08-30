//! InterceptRule Evaluation & High-Performance Condition Matching

use crate::pipeline::interceptor::InterceptAction;
use regex::Regex;
use sentinel_common::enums::HttpMethod;
use sentinel_common::operational::{InterceptRule, ParsedRequest, ParsedResponse};

/// Parsed and compiled condition matcher.
#[derive(Debug, Clone)]
pub enum ConditionMatcher {
    Any,
    UrlContains(String),
    UrlStartsWith(String),
    UrlRegex(Regex),
    MethodEquals(HttpMethod),
    HeaderContains { name: Vec<u8>, substring: String },
    HeaderEquals { name: Vec<u8>, value: Vec<u8> },
    BodyContains(Vec<u8>),
    BodyRegex(Regex),
    ResponseStatus(u16),
    ResponseHeaderContains { name: Vec<u8>, substring: String },
    ResponseHeaderEquals { name: Vec<u8>, value: Vec<u8> },
    ResponseBodyContains(Vec<u8>),
    ResponseBodyRegex(Regex),
}

impl ConditionMatcher {
    pub fn parse(cond: &str) -> Self {
        let trimmed = cond.trim();
        if trimmed.is_empty() || trimmed == "*" || trimmed.eq_ignore_ascii_case("all") {
            return Self::Any;
        }

        if let Some(rest) = trimmed.strip_prefix("url contains ") {
            return Self::UrlContains(rest.trim_matches('"').trim().to_string());
        }

        if let Some(rest) = trimmed.strip_prefix("url starts_with ") {
            return Self::UrlStartsWith(rest.trim_matches('"').trim().to_string());
        }

        if let Some(rest) = trimmed.strip_prefix("url regex ") {
            if let Ok(re) = Regex::new(rest.trim_matches('"').trim()) {
                return Self::UrlRegex(re);
            }
        }

        if let Some(rest) = trimmed.strip_prefix("method == ") {
            let m_str = rest.trim_matches('"').trim();
            if let Ok(method) = m_str.parse::<HttpMethod>() {
                return Self::MethodEquals(method);
            }
        }

        if trimmed.starts_with("response.header[") {
            if let Some(close_bracket) = trimmed.find(']') {
                let header_name = trimmed[16..close_bracket].trim().as_bytes().to_vec();
                let after_bracket = trimmed[close_bracket + 1..].trim();

                if let Some(val) = after_bracket.strip_prefix("contains ") {
                    return Self::ResponseHeaderContains {
                        name: header_name,
                        substring: val.trim_matches('"').trim().to_string(),
                    };
                } else if let Some(val) = after_bracket.strip_prefix("== ") {
                    return Self::ResponseHeaderEquals {
                        name: header_name,
                        value: val.trim_matches('"').trim().as_bytes().to_vec(),
                    };
                }
            }
        }

        if let Some(rest) = trimmed.strip_prefix("response.status == ") {
            if let Ok(code) = rest.trim().parse::<u16>() {
                return Self::ResponseStatus(code);
            }
        }

        if let Some(rest) = trimmed.strip_prefix("response.body contains ") {
            return Self::ResponseBodyContains(rest.trim_matches('"').trim().as_bytes().to_vec());
        }

        if let Some(rest) = trimmed.strip_prefix("response.body regex ") {
            if let Ok(re) = Regex::new(rest.trim_matches('"').trim()) {
                return Self::ResponseBodyRegex(re);
            }
        }

        if trimmed.starts_with("header[") {
            if let Some(close_bracket) = trimmed.find(']') {
                let header_name = trimmed[7..close_bracket].trim().as_bytes().to_vec();
                let after_bracket = trimmed[close_bracket + 1..].trim();

                if let Some(val) = after_bracket.strip_prefix("contains ") {
                    return Self::HeaderContains {
                        name: header_name,
                        substring: val.trim_matches('"').trim().to_string(),
                    };
                } else if let Some(val) = after_bracket.strip_prefix("== ") {
                    return Self::HeaderEquals {
                        name: header_name,
                        value: val.trim_matches('"').trim().as_bytes().to_vec(),
                    };
                }
            }
        }

        if let Some(rest) = trimmed.strip_prefix("body contains ") {
            return Self::BodyContains(rest.trim_matches('"').trim().as_bytes().to_vec());
        }

        if let Some(rest) = trimmed.strip_prefix("body regex ") {
            if let Ok(re) = Regex::new(rest.trim_matches('"').trim()) {
                return Self::BodyRegex(re);
            }
        }

        // Fallback: substring match on URL
        Self::UrlContains(trimmed.to_string())
    }

    pub fn matches_request(&self, req: &ParsedRequest) -> bool {
        match self {
            Self::Any => true,
            Self::UrlContains(sub) => req.uri.contains(sub),
            Self::UrlStartsWith(prefix) => req.uri.starts_with(prefix),
            Self::UrlRegex(re) => re.is_match(&req.uri),
            Self::MethodEquals(method) => req.method == *method,
            Self::HeaderContains { name, substring } => {
                req.headers.iter().any(|(h_name, h_val)| {
                    h_name.eq_ignore_ascii_case(name)
                        && String::from_utf8_lossy(h_val).contains(substring)
                })
            }
            Self::HeaderEquals { name, value } => req
                .headers
                .iter()
                .any(|(h_name, h_val)| h_name.eq_ignore_ascii_case(name) && h_val == value),
            Self::BodyContains(sub) => req.body.windows(sub.len()).any(|w| w == sub.as_slice()),
            Self::BodyRegex(re) => {
                let body_str = String::from_utf8_lossy(&req.body);
                re.is_match(&body_str)
            }
            Self::ResponseStatus(_)
            | Self::ResponseHeaderContains { .. }
            | Self::ResponseHeaderEquals { .. }
            | Self::ResponseBodyContains(_)
            | Self::ResponseBodyRegex(_) => false,
        }
    }

    pub fn matches_response(&self, res: &ParsedResponse) -> bool {
        match self {
            Self::Any => true,
            Self::ResponseStatus(code) => res.status_code == *code,
            Self::ResponseHeaderContains { name, substring } => {
                res.headers.iter().any(|(h_name, h_val)| {
                    h_name.eq_ignore_ascii_case(name)
                        && String::from_utf8_lossy(h_val).contains(substring)
                })
            }
            Self::ResponseHeaderEquals { name, value } => res
                .headers
                .iter()
                .any(|(h_name, h_val)| h_name.eq_ignore_ascii_case(name) && h_val == value),
            Self::ResponseBodyContains(sub) => {
                res.body.windows(sub.len()).any(|w| w == sub.as_slice())
            }
            Self::ResponseBodyRegex(re) => {
                let body_str = String::from_utf8_lossy(&res.body);
                re.is_match(&body_str)
            }
            _ => false,
        }
    }
}

/// Parsed and compiled intercept action.
#[derive(Debug, Clone)]
pub enum CompiledAction {
    Forward,
    Drop { reason: String },
    ReplaceHeader { name: Vec<u8>, value: Vec<u8> },
    RemoveHeader { name: Vec<u8> },
    ReplaceBody { find: Vec<u8>, replace: Vec<u8> },
    RegexReplaceBody { pattern: Regex, replacement: String },
    RegexReplaceHeader { name: Vec<u8>, pattern: Regex, replacement: String },
    RespondWith { status: u16, body: Vec<u8> },
}

impl CompiledAction {
    pub fn parse(action_str: &str, action_data_json: Option<&str>) -> Self {
        let action_clean = action_str.trim().to_lowercase();

        if action_clean == "drop" {
            let reason = action_data_json
                .unwrap_or("Dropped by InterceptRule")
                .to_string();
            return Self::Drop { reason };
        }

        if let Some(json_str) = action_data_json {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                if action_clean == "replace_header" || action_clean == "set_header" {
                    if let (Some(name), Some(value)) = (val.get("name"), val.get("value")) {
                        return Self::ReplaceHeader {
                            name: name.as_str().unwrap_or("").as_bytes().to_vec(),
                            value: value.as_str().unwrap_or("").as_bytes().to_vec(),
                        };
                    }
                } else if action_clean == "remove_header" {
                    if let Some(name) = val.get("name") {
                        return Self::RemoveHeader {
                            name: name.as_str().unwrap_or("").as_bytes().to_vec(),
                        };
                    }
                } else if action_clean == "replace_body" {
                    if let (Some(find), Some(replace)) = (val.get("find"), val.get("replace")) {
                        return Self::ReplaceBody {
                            find: find.as_str().unwrap_or("").as_bytes().to_vec(),
                            replace: replace.as_str().unwrap_or("").as_bytes().to_vec(),
                        };
                    }
                } else if action_clean == "regex_replace_body" {
                    if let (Some(pattern_str), Some(replacement)) =
                        (val.get("pattern").and_then(|p| p.as_str()), val.get("replacement").and_then(|r| r.as_str()))
                    {
                        if let Ok(re) = Regex::new(pattern_str) {
                            return Self::RegexReplaceBody {
                                pattern: re,
                                replacement: replacement.to_string(),
                            };
                        }
                    }
                } else if action_clean == "regex_replace_header" {
                    if let (Some(name), Some(pattern_str), Some(replacement)) = (
                        val.get("name").and_then(|n| n.as_str()),
                        val.get("pattern").and_then(|p| p.as_str()),
                        val.get("replacement").and_then(|r| r.as_str()),
                    ) {
                        if let Ok(re) = Regex::new(pattern_str) {
                            return Self::RegexReplaceHeader {
                                name: name.as_bytes().to_vec(),
                                pattern: re,
                                replacement: replacement.to_string(),
                            };
                        }
                    }
                } else if action_clean == "respond_with" {
                    let status = val.get("status").and_then(|s| s.as_u64()).unwrap_or(200) as u16;
                    let body = val
                        .get("body")
                        .and_then(|b| b.as_str())
                        .unwrap_or("")
                        .as_bytes()
                        .to_vec();
                    return Self::RespondWith { status, body };
                }
            }
        }

        Self::Forward
    }

    pub fn apply_to_request(&self, req: &mut ParsedRequest) -> InterceptAction {
        match self {
            Self::Forward => InterceptAction::Continue,
            Self::Drop { reason } => InterceptAction::Drop {
                reason: reason.clone(),
            },
            Self::ReplaceHeader { name, value } => {
                if let Some(pos) = req
                    .headers
                    .iter()
                    .position(|(n, _)| n.eq_ignore_ascii_case(name))
                {
                    req.headers[pos] = (name.clone(), value.clone());
                } else {
                    req.headers.push((name.clone(), value.clone()));
                }
                InterceptAction::Modified
            }
            Self::RemoveHeader { name } => {
                req.headers.retain(|(n, _)| !n.eq_ignore_ascii_case(name));
                InterceptAction::Modified
            }
            Self::ReplaceBody { find, replace } => {
                if let Some(pos) = req
                    .body
                    .windows(find.len())
                    .position(|w| w == find.as_slice())
                {
                    let mut new_body = req.body[..pos].to_vec();
                    new_body.extend_from_slice(replace);
                    new_body.extend_from_slice(&req.body[pos + find.len()..]);
                    req.body = new_body;
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RegexReplaceBody {
                pattern,
                replacement,
            } => {
                let body_str = String::from_utf8_lossy(&req.body);
                if pattern.is_match(&body_str) {
                    let replaced = pattern.replace_all(&body_str, replacement.as_str());
                    req.body = replaced.as_bytes().to_vec();
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RegexReplaceHeader {
                name,
                pattern,
                replacement,
            } => {
                let mut modified = false;
                for (h_name, h_val) in &mut req.headers {
                    if h_name.eq_ignore_ascii_case(name) {
                        let val_str = String::from_utf8_lossy(h_val);
                        if pattern.is_match(&val_str) {
                            let replaced = pattern.replace_all(&val_str, replacement.as_str());
                            *h_val = replaced.as_bytes().to_vec();
                            modified = true;
                        }
                    }
                }
                if modified {
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RespondWith { status, body } => {
                let res = ParsedResponse {
                    version: "HTTP/1.1".to_string(),
                    status_code: *status,
                    reason: if *status == 200 {
                        "OK".to_string()
                    } else {
                        "".to_string()
                    },
                    headers: vec![
                        (
                            b"Content-Length".to_vec(),
                            body.len().to_string().as_bytes().to_vec(),
                        ),
                        (b"Content-Type".to_vec(), b"text/plain".to_vec()),
                    ],
                    body: body.clone(),
                };
                InterceptAction::RespondWith(res)
            }
        }
    }

    pub fn apply_to_response(&self, res: &mut ParsedResponse) -> InterceptAction {
        match self {
            Self::Forward => InterceptAction::Continue,
            Self::Drop { reason } => InterceptAction::Drop {
                reason: reason.clone(),
            },
            Self::ReplaceHeader { name, value } => {
                if let Some(pos) = res
                    .headers
                    .iter()
                    .position(|(n, _)| n.eq_ignore_ascii_case(name))
                {
                    res.headers[pos] = (name.clone(), value.clone());
                } else {
                    res.headers.push((name.clone(), value.clone()));
                }
                InterceptAction::Modified
            }
            Self::RemoveHeader { name } => {
                res.headers.retain(|(n, _)| !n.eq_ignore_ascii_case(name));
                InterceptAction::Modified
            }
            Self::ReplaceBody { find, replace } => {
                if let Some(pos) = res
                    .body
                    .windows(find.len())
                    .position(|w| w == find.as_slice())
                {
                    let mut new_body = res.body[..pos].to_vec();
                    new_body.extend_from_slice(replace);
                    new_body.extend_from_slice(&res.body[pos + find.len()..]);
                    res.body = new_body;
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RegexReplaceBody {
                pattern,
                replacement,
            } => {
                let body_str = String::from_utf8_lossy(&res.body);
                if pattern.is_match(&body_str) {
                    let replaced = pattern.replace_all(&body_str, replacement.as_str());
                    res.body = replaced.as_bytes().to_vec();
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RegexReplaceHeader {
                name,
                pattern,
                replacement,
            } => {
                let mut modified = false;
                for (h_name, h_val) in &mut res.headers {
                    if h_name.eq_ignore_ascii_case(name) {
                        let val_str = String::from_utf8_lossy(h_val);
                        if pattern.is_match(&val_str) {
                            let replaced = pattern.replace_all(&val_str, replacement.as_str());
                            *h_val = replaced.as_bytes().to_vec();
                            modified = true;
                        }
                    }
                }
                if modified {
                    InterceptAction::Modified
                } else {
                    InterceptAction::Continue
                }
            }
            Self::RespondWith { status, body } => {
                res.status_code = *status;
                res.body = body.clone();
                InterceptAction::Modified
            }
        }
    }
}

/// Compiled executable Intercept Rule.
#[derive(Debug, Clone)]
pub struct CompiledInterceptRule {
    pub id: uuid::Uuid,
    pub is_active: bool,
    pub matcher: ConditionMatcher,
    pub action: CompiledAction,
}

impl CompiledInterceptRule {
    pub fn compile(rule: &InterceptRule) -> Self {
        Self {
            id: rule.id,
            is_active: rule.is_active,
            matcher: ConditionMatcher::parse(&rule.match_condition),
            action: CompiledAction::parse(&rule.action, rule.action_data_json.as_deref()),
        }
    }
}
