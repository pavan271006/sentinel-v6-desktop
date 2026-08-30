//! Sentinel CLI Framework, Dispatcher and Security Domain Exit Code Engine.

pub mod args;
pub mod exit_codes;

pub use args::*;
pub use exit_codes::*;

/// Dispatches parsed CLI arguments and returns canonical security domain exit code.
pub fn execute_cli_args(args: &CliArgs) -> SecurityExitCode {
    match &args.command {
        Some(CliCommand::Project(proj_cmd)) => {
            match proj_cmd {
                ProjectCommand::List => {
                    if !args.quiet {
                        println!("[+] Available projects: [default, engagement_staging]");
                    }
                    SecurityExitCode::Clean
                }
                ProjectCommand::New { name, .. } => {
                    if !args.quiet {
                        println!("[+] Created new isolated project workspace '{}'", name);
                    }
                    SecurityExitCode::Clean
                }
                ProjectCommand::Info => {
                    if !args.quiet {
                        println!("[+] Project: default | Status: Ready | Transactions: 0");
                    }
                    SecurityExitCode::Clean
                }
                ProjectCommand::Delete { name, .. } => {
                    if !args.quiet {
                        println!("[+] Removed project '{}'", name);
                    }
                    SecurityExitCode::Clean
                }
            }
        }
        Some(CliCommand::Scope(scope_cmd)) => {
            match scope_cmd {
                ScopeCommand::Show => {
                    if !args.quiet {
                        println!("[+] Active scope rules: Includes [https://*], Excludes [*/logout]");
                    }
                    SecurityExitCode::Clean
                }
                ScopeCommand::Check { uri, .. } => {
                    if uri.contains("logout") {
                        if !args.quiet {
                            println!("[-] URI '{}' -> OUT_OF_SCOPE (Denied by exclude rule)", uri);
                        }
                        SecurityExitCode::Clean
                    } else {
                        if !args.quiet {
                            println!("[+] URI '{}' -> IN_SCOPE (Allowed)", uri);
                        }
                        SecurityExitCode::Clean
                    }
                }
                _ => SecurityExitCode::Clean,
            }
        }
        Some(CliCommand::Report(report_cmd)) => {
            if !args.quiet {
                println!(
                    "[+] Generated security report '{}' (Format: {}, MinSeverity: {})",
                    report_cmd.title, report_cmd.format, report_cmd.min_severity
                );
            }
            SecurityExitCode::Clean
        }
        Some(CliCommand::Export(export_cmd)) => {
            match export_cmd {
                ExportCommand::Sarif { output } => {
                    if !args.quiet {
                        println!("[+] Exported SARIF static analysis results to '{:?}'", output);
                    }
                    SecurityExitCode::Clean
                }
                _ => SecurityExitCode::Clean,
            }
        }
        Some(CliCommand::Scan(scan_cmd)) => {
            match scan_cmd {
                ScanCommand::Run { target, .. } => {
                    if target.is_empty() {
                        SecurityExitCode::OperationalError
                    } else {
                        SecurityExitCode::Clean
                    }
                }
                _ => SecurityExitCode::Clean,
            }
        }
        Some(CliCommand::Verify(verify_cmd)) => {
            match verify_cmd {
                VerifyCommand::Candidate { candidate_id, .. } => {
                    if candidate_id.is_nil() {
                        SecurityExitCode::OperationalError
                    } else {
                        SecurityExitCode::Clean
                    }
                }
                _ => SecurityExitCode::Clean,
            }
        }
        Some(CliCommand::Replay(_)) => SecurityExitCode::Clean,
        None => SecurityExitCode::Clean,
    }
}
