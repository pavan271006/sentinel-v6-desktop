//! SENTINEL V6: Out-of-Band OAST Subsystem (WP-12.1 / SUB-16)
//!
//! Provides cryptographic stateless AES-256 token synthesis, multi-protocol
//! callback correlation (DNS, HTTP/HTTPS, SMTP), interaction polling, and CAS raw payload recording.

pub mod protocol;
pub mod server;
pub mod token;

pub use protocol::{
    DecodedDnsInteraction, DecodedHttpInteraction, DecodedSmtpInteraction, OastProtocol,
    OastProtocolDecoder,
};
pub use server::DefaultOastServer;
pub use token::{OastTokenGenerator, OastTokenManager, OastTokenPayload};
