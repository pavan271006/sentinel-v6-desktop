//! UCMA-X: Unified Causal-Metamorphic SQL Security Validation Engine CLI.

use std::env;
use ucma_core::ids::{EndpointId, ParameterId, TargetId};
use ucma_detection::DetectionOrchestrator;
use ucma_explorer::{ExplorationPolicy, TableSampler};
use ucma_parameter::extractor::ParameterExtractor;
use ucma_planner::{AdaptivePlanner, ExperimentStrategy};
use url::Url;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args: Vec<String> = env::args().collect();
    let mode = args.get(1).map(|s| s.as_str()).unwrap_or("help");

    println!("====================================================================");
    println!("UCMA-X: UNIFIED CAUSAL-METAMORPHIC SQL SECURITY VALIDATION ENGINE");
    println!("====================================================================");

    match mode {
        "discovery" => {
            let target_url = args.get(2).map(|s| s.as_str()).unwrap_or("https://lab.internal.local/api/search?id=10&sort=asc&filter=active");
            println!("[*] Executing Parameter Discovery against: {}", target_url);

            let parsed_url = Url::parse(target_url)?;
            let tid = TargetId::derive(target_url);
            let eid = EndpointId::derive(&tid, "GET", parsed_url.path());

            if let Some(query) = parsed_url.query() {
                let params = ParameterExtractor::extract_from_query(&eid, query);
                println!("[+] Discovered {} SQL-relevant parameters:", params.len());
                for p in params {
                    println!("    - Parameter: {} | Inferred Type: {:?} | Inferred Context: {:?}", p.name, p.inferred_type, p.inferred_context);
                }
            }
        }
        "validate" => {
            println!("[*] Running Multi-Oracle Causal-Metamorphic Validation Simulation...");

            let tid = TargetId::derive("https://lab.auth.test");
            let eid = EndpointId::derive(&tid, "GET", "/products");
            let pid = ParameterId::derive(&eid, "query", "id");

            let baseline = "<html><body>Found 10 items</body></html>";
            let true_body = "<html><body>Found 10 items</body></html>";
            let false_body = "<html><body>Found 0 items</body></html>";

            if let Some(finding) = DetectionOrchestrator::analyze_boolean_differential(
                tid,
                eid,
                pid,
                "id",
                baseline,
                "1 AND 1=1",
                true_body,
                "1 AND 1=2",
                false_body,
            ) {
                println!("[!] Confirmed Vulnerability: {}", finding.title);
                println!("    Lifecycle State: {:?}", finding.state);
                println!("    Technique: {}", finding.primary_technique);
                println!("    Confidence Score: {:.2}%", finding.confidence * 100.0);
                println!("    Reproduction Payloads: {:?}", finding.reproduction_payloads);
            }
        }
        "plan" => {
            println!("[*] Running Adaptive Bayesian Experiment Planner Simulation...");
            let planner = AdaptivePlanner::default();
            let mut executed = Vec::new();

            for step_num in 1..=4 {
                let plan = planner.select_next_step(0.0, &executed);
                println!("    Step {}: Strategy: {:?} | Expected Info Gain: {:.2} | Reason: {}", step_num, plan.strategy, plan.expected_info_gain, plan.reason);
                if plan.strategy == ExperimentStrategy::TerminalComplete {
                    break;
                }
                executed.push(plan.strategy);
            }
        }
        "explorer" => {
            println!("[*] Running Controlled Data Explorer (Policy Gated)...");
            let policy = ExplorationPolicy::SchemaPlusSample { max_rows: 3 };
            let cols = vec!["id".to_string(), "username".to_string(), "password_hash".to_string(), "email".to_string()];
            
            let mut row1 = std::collections::HashMap::new();
            row1.insert("id".to_string(), "1".to_string());
            row1.insert("username".to_string(), "admin".to_string());
            row1.insert("password_hash".to_string(), "$2y$12$securehash...".to_string());
            row1.insert("email".to_string(), "admin@lab.test".to_string());

            let result = TableSampler::process_sample(policy, "app_users", &cols, vec![row1], Some(1));
            println!("[+] Table: {} (Complete: {})", result.table_name, result.is_complete);
            for row in result.rows {
                println!("    Row: {:?}", row);
            }
        }
        _ => {
            println!("Usage: ucma-cli <COMMAND> [OPTIONS]");
            println!();
            println!("Commands:");
            println!("  discovery <URL>    Extract & infer context of input parameters");
            println!("  validate           Execute multi-oracle causal validation");
            println!("  plan               Simulate adaptive experiment selection");
            println!("  explorer           Demonstrate policy-gated data sampling & masking");
        }
    }

    Ok(())
}
