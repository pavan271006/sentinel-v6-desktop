//! CLI argument parsing model and command taxonomy.

use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SeverityThreshold {
    Low,
    Medium,
    High,
    Critical,
}

impl SeverityThreshold {
    pub fn from_str_lenient(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "low" => SeverityThreshold::Low,
            "high" => SeverityThreshold::High,
            "critical" => SeverityThreshold::Critical,
            _ => SeverityThreshold::Medium,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CliArgs {
    pub project_dir: Option<PathBuf>,
    pub config_file: Option<PathBuf>,
    pub verbosity: u8,
    pub quiet: bool,
    pub json: bool,
    pub no_color: bool,
    pub fail_on_severity: SeverityThreshold,
    pub command: Option<CliCommand>,
}

#[derive(Debug, Clone)]
pub enum CliCommand {
    Project(ProjectCommand),
    Scan(ScanCommand),
    Replay(ReplayCommand),
    Scope(ScopeCommand),
    Report(ReportCommand),
    Verify(VerifyCommand),
    Export(ExportCommand),
}

#[derive(Debug, Clone)]
pub enum ProjectCommand {
    New { name: String, dir: Option<PathBuf> },
    List,
    Info,
    Delete { name: String, force: bool },
}

#[derive(Debug, Clone)]
pub enum ScanCommand {
    Run {
        target: String,
        profile: String,
        concurrency: usize,
        rate_limit_rps: u32,
        timeout_secs: u64,
        passive_only: bool,
        active_only: bool,
    },
    Pause { scan_id: Uuid },
    Resume { scan_id: Uuid },
    Cancel { scan_id: Uuid },
    Status { scan_id: Option<Uuid> },
}

#[derive(Debug, Clone)]
pub enum ReplayCommand {
    Send {
        tx_id: Uuid,
        override_headers: Vec<String>,
        override_body: Option<String>,
        count: usize,
    },
    Diff {
        tx_a: Uuid,
        tx_b: Uuid,
        format: String,
    },
}

#[derive(Debug, Clone)]
pub enum ScopeCommand {
    Show,
    Check { uri: String, method: String },
    AddInclude { pattern: String },
    AddExclude { pattern: String },
    Remove { rule_id: Uuid },
    Import { file: PathBuf },
}

#[derive(Debug, Clone)]
pub struct ReportCommand {
    pub format: String, // markdown, pdf, html, json, sarif
    pub output: Option<PathBuf>,
    pub title: String,
    pub min_severity: String,
    pub include_evidence: bool,
}

#[derive(Debug, Clone)]
pub enum VerifyCommand {
    Candidate { candidate_id: Uuid, strategy: Option<String> },
    Retest { finding_id: Uuid },
    AuthzMatrix { identity_a: Uuid, identity_b: Uuid },
}

#[derive(Debug, Clone)]
pub enum ExportCommand {
    Pcap { output: PathBuf, filter: Option<String> },
    Har { output: PathBuf, filter: Option<String> },
    CasBundle { output: PathBuf },
    Sarif { output: PathBuf },
}

impl CliArgs {
    /// Parses CLI arguments from command-line iterator.
    pub fn parse_from<I, T>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = T>,
        T: Into<String>,
    {
        let raw_args: Vec<String> = args.into_iter().map(|a| a.into()).collect();
        let mut project_dir = None;
        let mut config_file = None;
        let mut verbosity = 0u8;
        let mut quiet = false;
        let mut json = false;
        let mut no_color = false;
        let mut fail_on_severity = SeverityThreshold::Medium;

        let mut idx = 1; // skip program name
        while idx < raw_args.len() {
            let arg = &raw_args[idx];
            if arg == "-p" || arg == "--project" {
                if idx + 1 < raw_args.len() {
                    project_dir = Some(PathBuf::from(&raw_args[idx + 1]));
                    idx += 2;
                    continue;
                }
            } else if arg == "-c" || arg == "--config" {
                if idx + 1 < raw_args.len() {
                    config_file = Some(PathBuf::from(&raw_args[idx + 1]));
                    idx += 2;
                    continue;
                }
            } else if arg == "-v" || arg == "--verbose" {
                verbosity = verbosity.saturating_add(1);
                idx += 1;
                continue;
            } else if arg == "-q" || arg == "--quiet" {
                quiet = true;
                idx += 1;
                continue;
            } else if arg == "--json" {
                json = true;
                idx += 1;
                continue;
            } else if arg == "--no-color" {
                no_color = true;
                idx += 1;
                continue;
            } else if arg == "--fail-on" {
                if idx + 1 < raw_args.len() {
                    fail_on_severity = SeverityThreshold::from_str_lenient(&raw_args[idx + 1]);
                    idx += 2;
                    continue;
                }
            } else if !arg.starts_with('-') {
                // Subcommand found
                break;
            }
            idx += 1;
        }

        if idx >= raw_args.len() {
            return Ok(Self {
                project_dir,
                config_file,
                verbosity,
                quiet,
                json,
                no_color,
                fail_on_severity,
                command: None,
            });
        }

        let subcmd_str = &raw_args[idx];
        let sub_args = &raw_args[idx + 1..];

        let command = match subcmd_str.to_lowercase().as_str() {
            "project" => Some(CliCommand::Project(parse_project_subcommand(sub_args)?)),
            "scan" => Some(CliCommand::Scan(parse_scan_subcommand(sub_args)?)),
            "replay" => Some(CliCommand::Replay(parse_replay_subcommand(sub_args)?)),
            "scope" => Some(CliCommand::Scope(parse_scope_subcommand(sub_args)?)),
            "report" => Some(CliCommand::Report(parse_report_subcommand(sub_args)?)),
            "verify" => Some(CliCommand::Verify(parse_verify_subcommand(sub_args)?)),
            "export" => Some(CliCommand::Export(parse_export_subcommand(sub_args)?)),
            other => return Err(format!("Unknown subcommand '{}'", other)),
        };

        Ok(Self {
            project_dir,
            config_file,
            verbosity,
            quiet,
            json,
            no_color,
            fail_on_severity,
            command,
        })
    }
}

fn parse_project_subcommand(args: &[String]) -> Result<ProjectCommand, String> {
    if args.is_empty() {
        return Ok(ProjectCommand::List);
    }
    match args[0].to_lowercase().as_str() {
        "new" => {
            let name = if args.len() > 1 { args[1].clone() } else { "default".to_string() };
            Ok(ProjectCommand::New { name, dir: None })
        }
        "list" => Ok(ProjectCommand::List),
        "info" => Ok(ProjectCommand::Info),
        "delete" => {
            let name = if args.len() > 1 { args[1].clone() } else { "default".to_string() };
            Ok(ProjectCommand::Delete { name, force: false })
        }
        other => Err(format!("Unknown project action '{}'", other)),
    }
}

fn parse_scan_subcommand(args: &[String]) -> Result<ScanCommand, String> {
    if args.is_empty() {
        return Ok(ScanCommand::Status { scan_id: None });
    }
    match args[0].to_lowercase().as_str() {
        "run" => {
            let target = if args.len() > 1 { args[1].clone() } else { "https://localhost".to_string() };
            Ok(ScanCommand::Run {
                target,
                profile: "standard".to_string(),
                concurrency: 10,
                rate_limit_rps: 50,
                timeout_secs: 300,
                passive_only: false,
                active_only: false,
            })
        }
        "status" => {
            let id = if args.len() > 1 { Uuid::parse_str(&args[1]).ok() } else { None };
            Ok(ScanCommand::Status { scan_id: id })
        }
        "cancel" => {
            let id = if args.len() > 1 {
                Uuid::parse_str(&args[1]).map_err(|e| e.to_string())?
            } else {
                Uuid::nil()
            };
            Ok(ScanCommand::Cancel { scan_id: id })
        }
        other => Err(format!("Unknown scan action '{}'", other)),
    }
}

fn parse_replay_subcommand(args: &[String]) -> Result<ReplayCommand, String> {
    if args.is_empty() {
        return Err("Replay subcommand requires action: send or diff".to_string());
    }
    match args[0].to_lowercase().as_str() {
        "send" => {
            let id = if args.len() > 1 {
                Uuid::parse_str(&args[1]).map_err(|e| e.to_string())?
            } else {
                Uuid::nil()
            };
            Ok(ReplayCommand::Send {
                tx_id: id,
                override_headers: vec![],
                override_body: None,
                count: 1,
            })
        }
        "diff" => {
            let id_a = if args.len() > 1 { Uuid::parse_str(&args[1]).map_err(|e| e.to_string())? } else { Uuid::nil() };
            let id_b = if args.len() > 2 { Uuid::parse_str(&args[2]).map_err(|e| e.to_string())? } else { Uuid::nil() };
            Ok(ReplayCommand::Diff {
                tx_a: id_a,
                tx_b: id_b,
                format: "side-by-side".to_string(),
            })
        }
        other => Err(format!("Unknown replay action '{}'", other)),
    }
}

fn parse_scope_subcommand(args: &[String]) -> Result<ScopeCommand, String> {
    if args.is_empty() {
        return Ok(ScopeCommand::Show);
    }
    match args[0].to_lowercase().as_str() {
        "show" => Ok(ScopeCommand::Show),
        "check" => {
            let uri = if args.len() > 1 { args[1].clone() } else { "".to_string() };
            Ok(ScopeCommand::Check { uri, method: "GET".to_string() })
        }
        "add-include" => {
            let pattern = if args.len() > 1 { args[1].clone() } else { "*".to_string() };
            Ok(ScopeCommand::AddInclude { pattern })
        }
        "add-exclude" => {
            let pattern = if args.len() > 1 { args[1].clone() } else { "".to_string() };
            Ok(ScopeCommand::AddExclude { pattern })
        }
        other => Err(format!("Unknown scope action '{}'", other)),
    }
}

fn parse_report_subcommand(args: &[String]) -> Result<ReportCommand, String> {
    let mut format = "markdown".to_string();
    let mut title = "SENTINEL Engagement Security Report".to_string();
    let mut min_severity = "medium".to_string();

    let mut i = 0;
    while i < args.len() {
        if args[i] == "--format" && i + 1 < args.len() {
            format = args[i + 1].clone();
            i += 2;
        } else if args[i] == "--title" && i + 1 < args.len() {
            title = args[i + 1].clone();
            i += 2;
        } else if args[i] == "--min-severity" && i + 1 < args.len() {
            min_severity = args[i + 1].clone();
            i += 2;
        } else {
            i += 1;
        }
    }

    Ok(ReportCommand {
        format,
        output: None,
        title,
        min_severity,
        include_evidence: true,
    })
}

fn parse_verify_subcommand(args: &[String]) -> Result<VerifyCommand, String> {
    if args.is_empty() {
        return Err("Verify subcommand requires action: candidate or retest".to_string());
    }
    match args[0].to_lowercase().as_str() {
        "candidate" => {
            let id = if args.len() > 1 { Uuid::parse_str(&args[1]).map_err(|e| e.to_string())? } else { Uuid::nil() };
            Ok(VerifyCommand::Candidate { candidate_id: id, strategy: None })
        }
        "retest" => {
            let id = if args.len() > 1 { Uuid::parse_str(&args[1]).map_err(|e| e.to_string())? } else { Uuid::nil() };
            Ok(VerifyCommand::Retest { finding_id: id })
        }
        other => Err(format!("Unknown verify action '{}'", other)),
    }
}

fn parse_export_subcommand(args: &[String]) -> Result<ExportCommand, String> {
    if args.is_empty() {
        return Ok(ExportCommand::Sarif { output: PathBuf::from("report.sarif") });
    }
    match args[0].to_lowercase().as_str() {
        "pcap" => {
            let out = if args.len() > 1 { PathBuf::from(&args[1]) } else { PathBuf::from("traffic.pcap") };
            Ok(ExportCommand::Pcap { output: out, filter: None })
        }
        "har" => {
            let out = if args.len() > 1 { PathBuf::from(&args[1]) } else { PathBuf::from("traffic.har") };
            Ok(ExportCommand::Har { output: out, filter: None })
        }
        "cas-bundle" => {
            let out = if args.len() > 1 { PathBuf::from(&args[1]) } else { PathBuf::from("cas_bundle.tar") };
            Ok(ExportCommand::CasBundle { output: out })
        }
        "sarif" => {
            let out = if args.len() > 1 { PathBuf::from(&args[1]) } else { PathBuf::from("report.sarif") };
            Ok(ExportCommand::Sarif { output: out })
        }
        other => Err(format!("Unknown export action '{}'", other)),
    }
}
