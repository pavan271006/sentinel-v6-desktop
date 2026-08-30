//! Command Palette & Action Dispatcher

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandItem {
    pub id: String,
    pub title: String,
    pub shortcut: Option<String>,
    pub category: String,
}

pub struct CommandPalette {
    commands: Arc<RwLock<HashMap<String, CommandItem>>>,
}

impl CommandPalette {
    pub fn new() -> Self {
        Self {
            commands: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_command(&self, item: CommandItem) {
        self.commands.write().insert(item.id.clone(), item);
    }

    pub fn search_commands(&self, query: &str) -> Vec<CommandItem> {
        let q = query.to_lowercase();
        self.commands
            .read()
            .values()
            .filter(|c| {
                c.title.to_lowercase().contains(&q) || c.category.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    }

    pub fn get_command(&self, id: &str) -> Option<CommandItem> {
        self.commands.read().get(id).cloned()
    }

    pub fn execute_command(&self, id: &str) -> Result<String, SentinelError> {
        if self.commands.read().contains_key(id) {
            Ok(format!("Executed command '{}'", id))
        } else {
            Err(SentinelError::InvariantViolation(format!(
                "Unknown command: {}",
                id
            )))
        }
    }
}

impl Default for CommandPalette {
    fn default() -> Self {
        Self::new()
    }
}
