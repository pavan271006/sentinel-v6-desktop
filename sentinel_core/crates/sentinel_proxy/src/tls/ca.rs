//! Sentinel Dynamic TLS Root CA Management
//!
//! Generates, stores, loads, and exports the self-signed X.509 Root CA
//! certificate used for MITM SSL/TLS interception.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DistinguishedName, DnType, IsCa, KeyPair,
    KeyUsagePurpose, PKCS_ECDSA_P256_SHA256,
};
use tracing::{info, warn};

use crate::error::ProxyError;

/// Managed Root CA container containing private key and certificate.
#[derive(Clone)]
pub struct RootCA {
    pub cert_pem: String,
    pub key_pem: String,
    pub cert_der: Vec<u8>,
    pub key_der: Vec<u8>,
    pub cert: Arc<Certificate>,
    pub key_pair: Arc<KeyPair>,
}

impl RootCA {
    /// Generates a new self-signed Root CA or loads from existing PEM files on disk.
    pub fn load_or_generate(cert_path: &Path, key_path: &Path) -> Result<Self, ProxyError> {
        if cert_path.exists() && key_path.exists() {
            match Self::load_from_files(cert_path, key_path) {
                Ok(ca) => {
                    info!("Loaded existing Sentinel Root CA from {:?}", cert_path);
                    return Ok(ca);
                }
                Err(e) => {
                    warn!(
                        "Failed to load existing CA files ({:?}), regenerating new Root CA: {}",
                        cert_path, e
                    );
                }
            }
        }

        let ca = Self::generate()?;
        if let Some(parent) = cert_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(e) = fs::write(cert_path, &ca.cert_pem) {
            warn!("Could not persist Root CA cert to {:?}: {}", cert_path, e);
        }
        if let Err(e) = fs::write(key_path, &ca.key_pem) {
            warn!("Could not persist Root CA key to {:?}: {}", key_path, e);
        }

        info!(
            "Generated new Sentinel Root CA and saved to {:?}",
            cert_path
        );
        Ok(ca)
    }

    /// Generates a brand new in-memory ECDSA P-256 Root CA.
    pub fn generate() -> Result<Self, ProxyError> {
        let key_pair = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
            .map_err(|e| ProxyError::Tls(format!("Failed to generate ECDSA key pair: {}", e)))?;

        let mut params = CertificateParams::default();
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "SENTINEL Dynamic Proxy Root CA");
        dn.push(DnType::OrganizationName, "SENTINEL Security Framework");
        dn.push(DnType::CountryName, "US");
        params.distinguished_name = dn;

        let cert = params
            .self_signed(&key_pair)
            .map_err(|e| ProxyError::Tls(format!("Failed to self-sign Root CA: {}", e)))?;

        let cert_pem = cert.pem();
        let key_pem = key_pair.serialize_pem();
        let cert_der = cert.der().to_vec();
        let key_der = key_pair.serialize_der();

        Ok(Self {
            cert_pem,
            key_pem,
            cert_der,
            key_der,
            cert: Arc::new(cert),
            key_pair: Arc::new(key_pair),
        })
    }

    /// Loads Root CA from PEM files.
    pub fn load_from_files(cert_path: &Path, key_path: &Path) -> Result<Self, ProxyError> {
        let cert_pem = fs::read_to_string(cert_path)
            .map_err(|e| ProxyError::Tls(format!("Failed to read CA cert file: {}", e)))?;
        let key_pem = fs::read_to_string(key_path)
            .map_err(|e| ProxyError::Tls(format!("Failed to read CA key file: {}", e)))?;

        let key_pair = KeyPair::from_pem(&key_pem)
            .map_err(|e| ProxyError::Tls(format!("Invalid CA private key PEM: {}", e)))?;

        let mut params = CertificateParams::default();
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "SENTINEL Dynamic Proxy Root CA");
        dn.push(DnType::OrganizationName, "SENTINEL Security Framework");
        params.distinguished_name = dn;

        let cert = params
            .self_signed(&key_pair)
            .map_err(|e| ProxyError::Tls(format!("Failed to reconstruct CA cert: {}", e)))?;

        let cert_der = cert.der().to_vec();
        let key_der = key_pair.serialize_der();

        Ok(Self {
            cert_pem,
            key_pem,
            cert_der,
            key_der,
            cert: Arc::new(cert),
            key_pair: Arc::new(key_pair),
        })
    }

    /// Exports the Root CA certificate PEM string.
    pub fn export_cert_pem(&self) -> &str {
        &self.cert_pem
    }
}
