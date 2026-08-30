// crates/sentinel_scope/src/matchers/mod.rs
//
// Target Matchers Module (Hostname, URL, IP/CIDR, SSRF Validation).

pub mod hostname;
pub mod ip;
pub mod ssrf;
pub mod url;

pub use hostname::HostnameMatcher;
pub use ip::IpCidrMatcher;
pub use ssrf::SsrfValidator;
pub use url::{UrlMatchResult, UrlMatcher, MAX_REGEX_PATTERN_LENGTH, MAX_REGEX_TIMEOUT};
