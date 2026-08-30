//! SENTINEL V6: Pentester Productivity Subsystem (WP-15.1)
//!
//! Provides command palette action dispatching, global omni-search indexing,
//! and keyboard-first hotkey navigation.

pub mod codecs;
pub mod command_palette;
pub mod hash;
pub mod hotkeys;
pub mod search;

pub use codecs::*;
pub use command_palette::{CommandItem, CommandPalette};
pub use hash::{HashAlgorithm, HashEngine, HashOutput, HmacAlgorithm};
pub use hotkeys::HotkeyManager;
pub use search::{OmniSearchEngine, SearchHit, SearchResultKind};
