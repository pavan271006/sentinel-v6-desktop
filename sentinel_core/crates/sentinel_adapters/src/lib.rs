//! SENTINEL V6: External Tool Adapters Subsystem (WP-17.1 / SUB-22..25)
//!
//! Provides normalized wrappers and output sanitization for external security tools:
//! Nmap (SUB-22), Nuclei (SUB-23), Sqlmap (SUB-24), Subfinder (SUB-25).

pub mod nmap;
pub mod nuclei;
pub mod sqlmap;
pub mod subfinder;

pub use nmap::NmapAdapter;
pub use nuclei::NucleiAdapter;
pub use sqlmap::SqlmapAdapter;
pub use subfinder::SubfinderAdapter;
