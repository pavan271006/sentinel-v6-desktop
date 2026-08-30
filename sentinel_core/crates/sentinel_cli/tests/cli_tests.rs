use sentinel_cli::*;
use std::path::PathBuf;
use uuid::Uuid;

#[test]
fn test_cli_argument_parsing_and_subcommand_dispatch() {
    // 1. Project subcommands
    let args_proj = CliArgs::parse_from(vec!["sentinel", "project", "new", "test_engagement"]).unwrap();
    assert!(matches!(
        args_proj.command,
        Some(CliCommand::Project(ProjectCommand::New { ref name, .. })) if name == "test_engagement"
    ));
    assert_eq!(execute_cli_args(&args_proj), SecurityExitCode::Clean);

    // 2. Scope check subcommand
    let args_scope = CliArgs::parse_from(vec!["sentinel", "scope", "check", "https://api.target.corp/v1"]).unwrap();
    assert!(matches!(
        args_scope.command,
        Some(CliCommand::Scope(ScopeCommand::Check { ref uri, .. })) if uri == "https://api.target.corp/v1"
    ));
    assert_eq!(execute_cli_args(&args_scope), SecurityExitCode::Clean);

    // 3. Report subcommand with flags
    let args_rep = CliArgs::parse_from(vec![
        "sentinel", "report", "--format", "sarif", "--min-severity", "high", "--title", "Audit 2026",
    ])
    .unwrap();
    if let Some(CliCommand::Report(rep_cmd)) = args_rep.command {
        assert_eq!(rep_cmd.format, "sarif");
        assert_eq!(rep_cmd.min_severity, "high");
        assert_eq!(rep_cmd.title, "Audit 2026");
    } else {
        panic!("Expected ReportCommand");
    }

    // 4. Global flags parsing
    let args_flags = CliArgs::parse_from(vec![
        "sentinel", "-p", "custom_proj", "-v", "-v", "--json", "--fail-on", "critical", "scan", "run", "https://target.corp"
    ]).unwrap();
    assert_eq!(args_flags.project_dir, Some(PathBuf::from("custom_proj")));
    assert_eq!(args_flags.verbosity, 2);
    assert!(args_flags.json);
    assert_eq!(args_flags.fail_on_severity, SeverityThreshold::Critical);
}

#[test]
fn test_security_domain_exit_codes() {
    assert_eq!(SecurityExitCode::Clean.as_i32(), 0);
    assert_eq!(SecurityExitCode::VulnerabilitiesFound.as_i32(), 1);
    assert_eq!(SecurityExitCode::OperationalError.as_i32(), 2);

    // Operational error on invalid candidate ID
    let err_args = CliArgs {
        project_dir: None,
        config_file: None,
        verbosity: 0,
        quiet: true,
        json: false,
        no_color: false,
        fail_on_severity: SeverityThreshold::Medium,
        command: Some(CliCommand::Verify(VerifyCommand::Candidate {
            candidate_id: Uuid::nil(),
            strategy: None,
        })),
    };
    assert_eq!(execute_cli_args(&err_args), SecurityExitCode::OperationalError);
}
