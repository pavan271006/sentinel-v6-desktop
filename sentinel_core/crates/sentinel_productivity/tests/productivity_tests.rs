//! Test Suite for Pentester Productivity Subsystem

use uuid::Uuid;

use sentinel_productivity::{
    CommandItem, CommandPalette, HotkeyManager, OmniSearchEngine, SearchHit, SearchResultKind,
};

#[test]
fn test_command_palette_operations() {
    let palette = CommandPalette::new();
    palette.register_command(CommandItem {
        id: "nav_repeater".to_string(),
        title: "Go to Repeater Tab".to_string(),
        shortcut: Some("Ctrl+R".to_string()),
        category: "Navigation".to_string(),
    });

    let results = palette.search_commands("repeater");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, "nav_repeater");

    let exec_res = palette.execute_command("nav_repeater").unwrap();
    assert!(exec_res.contains("Executed command 'nav_repeater'"));

    assert!(palette.execute_command("nonexistent").is_err());
}

#[test]
fn test_omni_search_ranking() {
    let search = OmniSearchEngine::new();

    search.index_item(SearchHit {
        id: Uuid::new_v4(),
        kind: SearchResultKind::Endpoint,
        title: "GET /api/v1/users".to_string(),
        snippet: "Retrieve user list".to_string(),
        score: 10,
    });

    search.index_item(SearchHit {
        id: Uuid::new_v4(),
        kind: SearchResultKind::Finding,
        title: "SQLi in /api/v1/users endpoint".to_string(),
        snippet: "Critical vulnerability found".to_string(),
        score: 100,
    });

    let hits = search.search("users");
    assert_eq!(hits.len(), 2);
    // Highest score first
    assert_eq!(hits[0].score, 100);
    assert_eq!(hits[0].kind, SearchResultKind::Finding);
}

#[test]
fn test_hotkey_manager() {
    let mut hm = HotkeyManager::new();
    assert_eq!(hm.lookup("Ctrl+P"), Some("open_command_palette"));
    assert_eq!(hm.lookup("Ctrl+K"), Some("global_search"));

    hm.register("Ctrl+Shift+X", "export_sarif");
    assert_eq!(hm.lookup("Ctrl+Shift+X"), Some("export_sarif"));
}
