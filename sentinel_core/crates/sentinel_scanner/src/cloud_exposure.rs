//! Cloud Metadata & Storage Bucket Exposure Prober
//!
//! Audits exposure of cloud provider metadata services (AWS IMDSv1/v2, GCP, Azure)
//! and public cloud storage bucket misconfigurations (S3, GCS, Azure Blob).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CloudPlatform {
    Aws,
    Gcp,
    Azure,
    DigitalOcean,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudMetadataProbe {
    pub platform: CloudPlatform,
    pub endpoint_url: String,
    pub required_headers: Vec<(String, String)>,
    pub distinguishing_signature: String,
    pub title: String,
    pub severity: String,
}

pub struct CloudExposureProber;

impl CloudExposureProber {
    /// Generates cloud metadata audit probes
    pub fn get_metadata_probes() -> Vec<CloudMetadataProbe> {
        vec![
            CloudMetadataProbe {
                platform: CloudPlatform::Aws,
                endpoint_url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/".to_string(),
                required_headers: vec![],
                distinguishing_signature: "AccessKeyId".to_string(),
                title: "AWS EC2 IMDSv1 Metadata Exposure".to_string(),
                severity: "CRITICAL".to_string(),
            },
            CloudMetadataProbe {
                platform: CloudPlatform::Gcp,
                endpoint_url: "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token".to_string(),
                required_headers: vec![("Metadata-Flavor".to_string(), "Google".to_string())],
                distinguishing_signature: "access_token".to_string(),
                title: "GCP Compute Engine Metadata Exposure".to_string(),
                severity: "CRITICAL".to_string(),
            },
            CloudMetadataProbe {
                platform: CloudPlatform::Azure,
                endpoint_url: "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/".to_string(),
                required_headers: vec![("Metadata".to_string(), "true".to_string())],
                distinguishing_signature: "access_token".to_string(),
                title: "Azure Instance Metadata Service (IMDS) Exposure".to_string(),
                severity: "CRITICAL".to_string(),
            },
        ]
    }

    /// Evaluates if response indicates open/unauthenticated S3 / GCS bucket listing
    pub fn evaluate_storage_bucket_response(body: &str) -> Option<String> {
        if body.contains("<ListBucketResult") && body.contains("<Contents>") && body.contains("<Key>") {
            Some("AWS S3 Public Bucket Listing Enabled: XML ListBucketResult accessible unauthenticated".to_string())
        } else if body.contains("\"kind\": \"storage#objects\"") && body.contains("\"items\": [") {
            Some("Google Cloud Storage (GCS) Public Object Listing Enabled".to_string())
        } else if body.contains("<EnumerationResults") && body.contains("<Blobs>") {
            Some("Azure Blob Storage Public Container Listing Enabled".to_string())
        } else {
            None
        }
    }
}
