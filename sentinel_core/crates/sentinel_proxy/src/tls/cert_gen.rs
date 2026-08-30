//! Dynamic On-The-Fly Leaf Certificate Generation
//!
//! Generates domain-specific X.509 leaf certificates signed by the Sentinel Root CA
//! with Subject Alternative Names (SANs) for arbitrary domains and IP addresses.

use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Arc;

use rcgen::{
    CertificateParams, DistinguishedName, DnType, ExtendedKeyUsagePurpose, Ia5String, KeyPair,
    KeyUsagePurpose, SanType, PKCS_ECDSA_P256_SHA256,
};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::ServerConfig;

use crate::error::ProxyError;
use crate::tls::ca::RootCA;

pub struct CertGenerator {
    root_ca: RootCA,
}

impl CertGenerator {
    pub fn new(root_ca: RootCA) -> Self {
        Self { root_ca }
    }

    /// Generates a signed leaf certificate for `host` and builds a ready-to-use `rustls::ServerConfig`.
    pub fn generate_server_config(&self, host: &str) -> Result<Arc<ServerConfig>, ProxyError> {
        crate::tls::ensure_crypto_provider_installed();
        let clean_host = host.split(':').next().unwrap_or(host).trim();

        // 1. Generate ECDSA P-256 leaf key pair
        let leaf_key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
            .map_err(|e| ProxyError::Tls(format!("Failed to generate leaf key pair: {}", e)))?;

        // 2. Configure SANs (DNS name or IP)
        let mut san_list = Vec::new();
        if let Ok(ip) = IpAddr::from_str(clean_host) {
            san_list.push(SanType::IpAddress(ip));
        } else {
            let dns_ia5 = Ia5String::try_from(clean_host.to_string())
                .map_err(|e| ProxyError::Tls(format!("Invalid DNS name {}: {}", clean_host, e)))?;
            san_list.push(SanType::DnsName(dns_ia5));
            // Add wildcard SAN if clean_host has multiple parts (e.g. sub.example.com -> *.example.com)
            let parts: Vec<&str> = clean_host.split('.').collect();
            if parts.len() > 2 {
                let wildcard = format!("*.{}", parts[1..].join("."));
                if let Ok(wildcard_ia5) = Ia5String::try_from(wildcard) {
                    san_list.push(SanType::DnsName(wildcard_ia5));
                }
            }
        }

        let mut params = CertificateParams::default();
        params.subject_alt_names = san_list;
        params.key_usages = vec![
            KeyUsagePurpose::DigitalSignature,
            KeyUsagePurpose::KeyEncipherment,
        ];
        params.extended_key_usages = vec![
            ExtendedKeyUsagePurpose::ServerAuth,
            ExtendedKeyUsagePurpose::ClientAuth,
        ];

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, clean_host);
        dn.push(DnType::OrganizationName, "SENTINEL Dynamic Leaf");
        params.distinguished_name = dn;

        // 3. Sign leaf certificate with Root CA
        let leaf_cert = params
            .signed_by(&leaf_key, &self.root_ca.cert, &self.root_ca.key_pair)
            .map_err(|e| {
                ProxyError::Tls(format!("Failed to sign leaf cert with Root CA: {}", e))
            })?;

        // 4. Construct certificate DER chain [leaf_cert, root_ca]
        let cert_chain = vec![
            CertificateDer::from(leaf_cert.der().to_vec()),
            CertificateDer::from(self.root_ca.cert_der.clone()),
        ];

        let key_der = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(leaf_key.serialize_der()));

        // 5. Construct rustls ServerConfig
        let mut server_config = ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(cert_chain, key_der)
            .map_err(|e| ProxyError::Tls(format!("Failed to build rustls ServerConfig: {}", e)))?;

        server_config.alpn_protocols = vec![b"http/1.1".to_vec()];

        Ok(Arc::new(server_config))
    }
}
