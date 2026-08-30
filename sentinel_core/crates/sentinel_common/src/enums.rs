// SENTINEL V6: Canonical Platform Enums
// crates/sentinel_common/src/enums.rs

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    TRACE,
    CONNECT,
    GRAPHQL,
}

impl HttpMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::GET => "GET",
            Self::POST => "POST",
            Self::PUT => "PUT",
            Self::DELETE => "DELETE",
            Self::PATCH => "PATCH",
            Self::HEAD => "HEAD",
            Self::OPTIONS => "OPTIONS",
            Self::TRACE => "TRACE",
            Self::CONNECT => "CONNECT",
            Self::GRAPHQL => "GRAPHQL",
        }
    }

    pub fn is_safe(&self) -> bool {
        matches!(self, Self::GET | Self::HEAD | Self::OPTIONS | Self::TRACE)
    }

    pub fn is_idempotent(&self) -> bool {
        matches!(
            self,
            Self::GET | Self::HEAD | Self::OPTIONS | Self::TRACE | Self::PUT | Self::DELETE
        )
    }
}

impl fmt::Display for HttpMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for HttpMethod {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "GET" => Ok(Self::GET),
            "POST" => Ok(Self::POST),
            "PUT" => Ok(Self::PUT),
            "DELETE" => Ok(Self::DELETE),
            "PATCH" => Ok(Self::PATCH),
            "HEAD" => Ok(Self::HEAD),
            "OPTIONS" => Ok(Self::OPTIONS),
            "TRACE" => Ok(Self::TRACE),
            "CONNECT" => Ok(Self::CONNECT),
            "GRAPHQL" => Ok(Self::GRAPHQL),
            _ => Err(format!("Unknown HTTP method: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParamLocation {
    Query,
    Body,
    Header,
    Path,
    Cookie,
    JsonPath,
    XPath,
    MultipartField,
    GraphQLVariable,
    WebSocketFrame,
}

impl ParamLocation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Query => "Query",
            Self::Body => "Body",
            Self::Header => "Header",
            Self::Path => "Path",
            Self::Cookie => "Cookie",
            Self::JsonPath => "JsonPath",
            Self::XPath => "XPath",
            Self::MultipartField => "MultipartField",
            Self::GraphQLVariable => "GraphQLVariable",
            Self::WebSocketFrame => "WebSocketFrame",
        }
    }
}

impl fmt::Display for ParamLocation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DataType {
    String,
    Integer,
    Boolean,
    Float,
    Uuid,
    Json,
    Xml,
    Base64,
    Unknown,
}

impl DataType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::String => "String",
            Self::Integer => "Integer",
            Self::Boolean => "Boolean",
            Self::Float => "Float",
            Self::Uuid => "Uuid",
            Self::Json => "Json",
            Self::Xml => "Xml",
            Self::Base64 => "Base64",
            Self::Unknown => "Unknown",
        }
    }
}

impl fmt::Display for DataType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Provenance {
    Manual,
    Scanner,
    Fuzzer,
    Proxy,
    AI,
    Tool,
}

impl Provenance {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Manual => "Manual",
            Self::Scanner => "Scanner",
            Self::Fuzzer => "Fuzzer",
            Self::Proxy => "Proxy",
            Self::AI => "AI",
            Self::Tool => "Tool",
        }
    }
}

impl fmt::Display for Provenance {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LifecycleState {
    Active,
    Archived,
    Deleted,
}

impl LifecycleState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::Archived => "Archived",
            Self::Deleted => "Deleted",
        }
    }
}

impl fmt::Display for LifecycleState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaskLifecycle {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl TaskLifecycle {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "Pending",
            Self::Running => "Running",
            Self::Paused => "Paused",
            Self::Completed => "Completed",
            Self::Failed => "Failed",
            Self::Cancelled => "Cancelled",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled)
    }
}

impl fmt::Display for TaskLifecycle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ScanLifecycle {
    Initializing,
    Running,
    Pausing,
    Paused,
    Finished,
    Error,
}

impl ScanLifecycle {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Initializing => "Initializing",
            Self::Running => "Running",
            Self::Pausing => "Pausing",
            Self::Paused => "Paused",
            Self::Finished => "Finished",
            Self::Error => "Error",
        }
    }

    pub fn is_active(&self) -> bool {
        matches!(self, Self::Initializing | Self::Running | Self::Pausing)
    }
}

impl fmt::Display for ScanLifecycle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Critical => "Critical",
            Self::High => "High",
            Self::Medium => "Medium",
            Self::Low => "Low",
            Self::Info => "Info",
        }
    }

    pub fn score(&self) -> f32 {
        match self {
            Self::Critical => 10.0,
            Self::High => 8.0,
            Self::Medium => 5.0,
            Self::Low => 2.5,
            Self::Info => 0.0,
        }
    }

    pub fn rank(&self) -> u8 {
        match self {
            Self::Info => 0,
            Self::Low => 1,
            Self::Medium => 2,
            Self::High => 3,
            Self::Critical => 4,
        }
    }
}

impl PartialOrd for Severity {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Severity {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.rank().cmp(&other.rank())
    }
}

impl fmt::Display for Severity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FindingLifecycle {
    Candidate,
    Verified,
    Confirmed,
    Reported,
    Remediated,
    FalsePositive,
    AcceptedRisk,
    Regression,
}

impl FindingLifecycle {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Candidate => "Candidate",
            Self::Verified => "Verified",
            Self::Confirmed => "Confirmed",
            Self::Reported => "Reported",
            Self::Remediated => "Remediated",
            Self::FalsePositive => "FalsePositive",
            Self::AcceptedRisk => "AcceptedRisk",
            Self::Regression => "Regression",
        }
    }

    pub fn is_actionable(&self) -> bool {
        matches!(
            self,
            Self::Verified | Self::Confirmed | Self::Reported | Self::Regression
        )
    }
}

impl fmt::Display for FindingLifecycle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Formal 10-State Linear Finding Lifecycle (Phase 3 Requirement)
/// OBSERVED -> CANDIDATE -> REPRODUCIBLE -> VERIFIED -> INDEPENDENTLY_VERIFIED -> PROMOTED -> DEDUPLICATED -> REPORTED -> RETESTED -> FIXED | STILL_PRESENT
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FormalFindingState {
    Observed,
    Candidate,
    Reproducible,
    Verified,
    IndependentlyVerified,
    Promoted,
    Deduplicated,
    Reported,
    Retested,
    Fixed,
    StillPresent,
    Closed,
}

impl FormalFindingState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Observed => "OBSERVED",
            Self::Candidate => "CANDIDATE",
            Self::Reproducible => "REPRODUCIBLE",
            Self::Verified => "VERIFIED",
            Self::IndependentlyVerified => "INDEPENDENTLY_VERIFIED",
            Self::Promoted => "PROMOTED",
            Self::Deduplicated => "DEDUPLICATED",
            Self::Reported => "REPORTED",
            Self::Retested => "RETESTED",
            Self::Fixed => "FIXED",
            Self::StillPresent => "STILL_PRESENT",
            Self::Closed => "CLOSED",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Closed)
    }
}

impl fmt::Display for FormalFindingState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ObservationSource {
    Proxy,
    OAST,
    Browser,
    Manual,
    Tool,
}

impl ObservationSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Proxy => "Proxy",
            Self::OAST => "OAST",
            Self::Browser => "Browser",
            Self::Manual => "Manual",
            Self::Tool => "Tool",
        }
    }
}

impl fmt::Display for ObservationSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AccessLevel {
    Admin,
    User,
    Anonymous,
    TenantA,
    TenantB,
}

impl AccessLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Admin => "Admin",
            Self::User => "User",
            Self::Anonymous => "Anonymous",
            Self::TenantA => "TenantA",
            Self::TenantB => "TenantB",
        }
    }
}

impl fmt::Display for AccessLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ReportFormat {
    Pdf,
    Markdown,
    Json,
    Html,
    Sarif,
}

impl ReportFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pdf => "Pdf",
            Self::Markdown => "Markdown",
            Self::Json => "Json",
            Self::Html => "Html",
            Self::Sarif => "Sarif",
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Markdown => "md",
            Self::Json => "json",
            Self::Html => "html",
            Self::Sarif => "sarif",
        }
    }
}

impl fmt::Display for ReportFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MutatorType {
    BitFlip,
    ByteReplace,
    Grammar,
    Wordlist,
    Radamsa,
    Boundary,
    UnicodeNormalization,
    Truncation,
    FormatString,
    AiAssisted,
}

impl MutatorType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BitFlip => "BitFlip",
            Self::ByteReplace => "ByteReplace",
            Self::Grammar => "Grammar",
            Self::Wordlist => "Wordlist",
            Self::Radamsa => "Radamsa",
            Self::Boundary => "Boundary",
            Self::UnicodeNormalization => "UnicodeNormalization",
            Self::Truncation => "Truncation",
            Self::FormatString => "FormatString",
            Self::AiAssisted => "AiAssisted",
        }
    }
}

impl fmt::Display for MutatorType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VerificationStrategy {
    BrowserExecution,
    OASTCorrelation,
    TimingStatistical,
    ResponseDifferential,
    StateVerification,
    AuthorizationReplay,
    ContentVerification,
    MathematicalVerification,
    ErrorClassification,
    CausalMinimization,
}

impl VerificationStrategy {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BrowserExecution => "BrowserExecution",
            Self::OASTCorrelation => "OASTCorrelation",
            Self::TimingStatistical => "TimingStatistical",
            Self::ResponseDifferential => "ResponseDifferential",
            Self::StateVerification => "StateVerification",
            Self::AuthorizationReplay => "AuthorizationReplay",
            Self::ContentVerification => "ContentVerification",
            Self::MathematicalVerification => "MathematicalVerification",
            Self::ErrorClassification => "ErrorClassification",
            Self::CausalMinimization => "CausalMinimization",
        }
    }
}

impl fmt::Display for VerificationStrategy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParameterClass {
    ObjectId,
    Url,
    FilePath,
    Email,
    Token,
    Search,
    Numeric,
    Boolean,
    Json,
    Xml,
    Html,
    Enumeration,
    FreeText,
    Unknown,
}

impl ParameterClass {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ObjectId => "ObjectId",
            Self::Url => "Url",
            Self::FilePath => "FilePath",
            Self::Email => "Email",
            Self::Token => "Token",
            Self::Search => "Search",
            Self::Numeric => "Numeric",
            Self::Boolean => "Boolean",
            Self::Json => "Json",
            Self::Xml => "Xml",
            Self::Html => "Html",
            Self::Enumeration => "Enumeration",
            Self::FreeText => "FreeText",
            Self::Unknown => "Unknown",
        }
    }
}

impl fmt::Display for ParameterClass {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PolicyResultType {
    Approved,
    Blocked,
    Filtered,
    RequiresHumanApproval,
}

impl PolicyResultType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Approved => "Approved",
            Self::Blocked => "Blocked",
            Self::Filtered => "Filtered",
            Self::RequiresHumanApproval => "RequiresHumanApproval",
        }
    }
}

impl fmt::Display for PolicyResultType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyResult {
    Approved,
    Blocked,
    Filtered(String),
    RequiresHumanApproval,
}

impl PolicyResult {
    pub fn is_approved(&self) -> bool {
        matches!(self, Self::Approved)
    }

    pub fn is_blocked(&self) -> bool {
        matches!(self, Self::Blocked)
    }

    pub fn result_type(&self) -> PolicyResultType {
        match self {
            Self::Approved => PolicyResultType::Approved,
            Self::Blocked => PolicyResultType::Blocked,
            Self::Filtered(_) => PolicyResultType::Filtered,
            Self::RequiresHumanApproval => PolicyResultType::RequiresHumanApproval,
        }
    }
}

impl fmt::Display for PolicyResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Approved => write!(f, "PolicyResult::Approved"),
            Self::Blocked => write!(f, "PolicyResult::Blocked"),
            Self::Filtered(pattern) => write!(f, "PolicyResult::Filtered({})", pattern),
            Self::RequiresHumanApproval => write!(f, "PolicyResult::RequiresHumanApproval"),
        }
    }
}
