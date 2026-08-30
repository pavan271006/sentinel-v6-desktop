//! Pentester Notebook & Note Manager

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use sentinel_common::domain::Note;
use sentinel_common::errors::SentinelError;

pub struct NotebookManager {
    notes: Arc<RwLock<HashMap<Uuid, Note>>>,
}

impl NotebookManager {
    pub fn new() -> Self {
        Self {
            notes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_note(&self, target_id: Uuid, author: &str, content: &str) -> Uuid {
        let note = Note {
            id: Uuid::new_v4(),
            target_id,
            author: author.to_string(),
            content: content.to_string(),
            timestamp: chrono::Utc::now(),
        };
        let note_id = note.id;
        self.notes.write().insert(note_id, note);
        note_id
    }

    pub fn get_note(&self, id: Uuid) -> Option<Note> {
        self.notes.read().get(&id).cloned()
    }

    pub fn list_notes_for_target(&self, target_id: Uuid) -> Vec<Note> {
        self.notes
            .read()
            .values()
            .filter(|n| n.target_id == target_id)
            .cloned()
            .collect()
    }

    pub fn delete_note(&self, id: Uuid) -> Result<(), SentinelError> {
        self.notes
            .write()
            .remove(&id)
            .map(|_| ())
            .ok_or_else(|| SentinelError::InvariantViolation(format!("Note {} not found", id)))
    }
}

impl Default for NotebookManager {
    fn default() -> Self {
        Self::new()
    }
}
