//! Test Suite for Findings Center, Notebook & Reporting Subsystem

use uuid::Uuid;

use sentinel_common::config::ReportConfig;
use sentinel_common::domain::{EntityMetadata, Finding};
use sentinel_common::enums::{FindingLifecycle, Provenance, ReportFormat, Severity};
use sentinel_report::{FindingsCenter, NotebookManager, ReportGenerator};

fn create_sample_finding() -> Finding {
    Finding {
        meta: EntityMetadata::new(Provenance::Manual),
        title: "SQL Injection in Login Endpoint".to_string(),
        severity: Severity::Critical,
        verification_id: Uuid::new_v4(),
        state: FindingLifecycle::Confirmed,
    }
}

#[test]
fn test_report_generation_formats() {
    let finding = create_sample_finding();
    let findings = vec![finding];

    // 1. Markdown
    let md_cfg = ReportConfig {
        format: ReportFormat::Markdown,
        finding_ids: vec![],
        include_evidence: true,
    };
    let md = ReportGenerator::generate("Pentest 2026", &findings, &md_cfg).unwrap();
    assert!(md.contains("SQL Injection in Login Endpoint"));
    assert!(md.contains("**Total Findings**: 1"));

    // 2. HTML
    let html_cfg = ReportConfig {
        format: ReportFormat::Html,
        finding_ids: vec![],
        include_evidence: true,
    };
    let html = ReportGenerator::generate("Pentest 2026", &findings, &html_cfg).unwrap();
    assert!(html.contains("<table>"));
    assert!(html.contains("SQL Injection in Login Endpoint"));

    // 3. JSON
    let json_cfg = ReportConfig {
        format: ReportFormat::Json,
        finding_ids: vec![],
        include_evidence: true,
    };
    let json_str = ReportGenerator::generate("Pentest 2026", &findings, &json_cfg).unwrap();
    assert!(json_str.contains("\"title\": \"Pentest 2026\""));

    // 4. SARIF 2.1.0
    let sarif_cfg = ReportConfig {
        format: ReportFormat::Sarif,
        finding_ids: vec![],
        include_evidence: true,
    };
    let sarif_str = ReportGenerator::generate("Pentest 2026", &findings, &sarif_cfg).unwrap();
    assert!(sarif_str.contains("\"version\": \"2.1.0\""));
    assert!(sarif_str.contains("SENTINEL-"));
    assert!(sarif_str.contains("SQL Injection in Login Endpoint"));
}

#[test]
fn test_notebook_manager_crud() {
    let nb = NotebookManager::new();
    let target = Uuid::new_v4();

    let note_id = nb.add_note(target, "tester_alice", "Investigate endpoint /api/auth");
    let note = nb.get_note(note_id).unwrap();
    assert_eq!(note.author, "tester_alice");

    let list = nb.list_notes_for_target(target);
    assert_eq!(list.len(), 1);

    assert!(nb.delete_note(note_id).is_ok());
    assert!(nb.get_note(note_id).is_none());
}

#[test]
fn test_findings_center_triage() {
    let fc = FindingsCenter::new();
    let f1 = create_sample_finding();
    let f1_id = f1.meta.id;
    fc.insert_finding(f1);

    assert_eq!(fc.all_findings().len(), 1);
    assert_eq!(fc.filter_by_severity(Severity::Critical).len(), 1);
    assert_eq!(fc.filter_by_severity(Severity::Low).len(), 0);
    assert_eq!(fc.filter_by_state(FindingLifecycle::Confirmed).len(), 1);
    assert!(fc.get_finding(f1_id).is_some());
}
