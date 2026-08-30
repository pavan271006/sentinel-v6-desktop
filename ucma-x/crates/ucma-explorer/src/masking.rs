//! Synthetic data classification and sensitive field redaction.

pub struct DataMasker;

impl DataMasker {
    /// Masks sensitive values based on column name heuristics.
    pub fn mask_value(col_name: &str, raw_val: &str) -> String {
        let name_lower = col_name.to_lowercase();
        if name_lower.contains("pass")
            || name_lower.contains("secret")
            || name_lower.contains("token")
            || name_lower.contains("key")
            || name_lower.contains("hash")
        {
            "********[REDACTED]********".to_string()
        } else if name_lower.contains("email") {
            if let Some((user, domain)) = raw_val.split_once('@') {
                let first_char = user.chars().next().unwrap_or('*');
                format!("{}***@{}", first_char, domain)
            } else {
                "***@***.***".to_string()
            }
        } else {
            raw_val.to_string()
        }
    }
}
