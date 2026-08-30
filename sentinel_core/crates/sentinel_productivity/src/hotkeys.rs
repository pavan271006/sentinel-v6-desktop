//! Keyboard-First Navigation & Hotkey Bindings

use std::collections::HashMap;

pub struct HotkeyManager {
    bindings: HashMap<String, String>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        let mut bindings = HashMap::new();
        bindings.insert("Ctrl+P".to_string(), "open_command_palette".to_string());
        bindings.insert("Ctrl+K".to_string(), "global_search".to_string());
        bindings.insert("Ctrl+R".to_string(), "send_to_repeater".to_string());
        bindings.insert("Ctrl+I".to_string(), "toggle_interceptor".to_string());
        bindings.insert("Ctrl+F".to_string(), "open_fuzzer".to_string());
        Self { bindings }
    }

    pub fn register(&mut self, key_combo: &str, action: &str) {
        self.bindings
            .insert(key_combo.to_string(), action.to_string());
    }

    pub fn lookup(&self, key_combo: &str) -> Option<&str> {
        self.bindings.get(key_combo).map(|s| s.as_str())
    }
}

impl Default for HotkeyManager {
    fn default() -> Self {
        Self::new()
    }
}
