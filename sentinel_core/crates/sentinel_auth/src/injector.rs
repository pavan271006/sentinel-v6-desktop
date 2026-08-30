//! Header & Cookie Injection Engine

use sentinel_common::operational::ParsedRequest;

pub struct AuthInjector;

impl AuthInjector {
    pub fn inject_header(request: &mut ParsedRequest, header_name: &[u8], header_value: &[u8]) {
        request
            .headers
            .retain(|(k, _)| !k.eq_ignore_ascii_case(header_name));
        request
            .headers
            .push((header_name.to_vec(), header_value.to_vec()));
    }

    pub fn inject_bearer_token(request: &mut ParsedRequest, token: &str) {
        let auth_val = format!("Bearer {}", token);
        Self::inject_header(request, b"Authorization", auth_val.as_bytes());
    }
}
