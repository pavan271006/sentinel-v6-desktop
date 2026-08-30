//! Semantic Parameter Classification Engine

use regex::Regex;
use sentinel_common::enums::ParameterClass;

pub struct ParameterClassifier;

impl ParameterClassifier {
    pub fn classify(name: &str, value: &str) -> ParameterClass {
        let name_lower = name.to_ascii_lowercase();
        let val_trimmed = value.trim();

        // 1. Boolean check
        if val_trimmed.eq_ignore_ascii_case("true")
            || val_trimmed.eq_ignore_ascii_case("false")
            || val_trimmed.eq_ignore_ascii_case("yes")
            || val_trimmed.eq_ignore_ascii_case("no")
            || (val_trimmed == "1" || val_trimmed == "0")
                && (name_lower.contains("is_")
                    || name_lower.contains("has_")
                    || name_lower.contains("enable")
                    || name_lower.contains("active"))
        {
            return ParameterClass::Boolean;
        }

        // 2. Search / Query intent check
        if name_lower == "q"
            || name_lower == "query"
            || name_lower == "search"
            || name_lower == "keyword"
            || name_lower == "term"
        {
            return ParameterClass::Search;
        }

        // 3. ObjectId check (24-hex MongoDB / ObjectId)
        if val_trimmed.len() == 24 && val_trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
            return ParameterClass::ObjectId;
        }

        // 4. Token check (JWT, UUID, Bearer, API Token)
        if Self::is_token(&name_lower, val_trimmed) {
            return ParameterClass::Token;
        }

        // 5. Email check
        if val_trimmed.contains('@') && val_trimmed.contains('.') {
            let email_re = Regex::new(r"^[\w\.\+-]+@[\w\.-]+\.\w+$").unwrap();
            if email_re.is_match(val_trimmed) {
                return ParameterClass::Email;
            }
        }

        // 6. URL check
        if val_trimmed.starts_with("http://")
            || val_trimmed.starts_with("https://")
            || val_trimmed.starts_with("//")
            || name_lower.contains("url")
            || name_lower.contains("redirect")
            || name_lower.contains("callback")
            || name_lower.contains("next")
            || name_lower.contains("dest")
        {
            return ParameterClass::Url;
        }

        // 7. File Path check
        if val_trimmed.contains('/')
            || val_trimmed.contains('\\')
            || Self::has_file_extension(val_trimmed)
        {
            return ParameterClass::FilePath;
        }

        // 8. JSON check
        if ((val_trimmed.starts_with('{') && val_trimmed.ends_with('}'))
            || (val_trimmed.starts_with('[') && val_trimmed.ends_with(']')))
            && serde_json::from_str::<serde_json::Value>(val_trimmed).is_ok()
        {
            return ParameterClass::Json;
        }

        // 9. XML / HTML check
        if val_trimmed.starts_with('<') && val_trimmed.ends_with('>') {
            let lower_val = val_trimmed.to_ascii_lowercase();
            if lower_val.contains("<html")
                || lower_val.contains("<div")
                || lower_val.contains("<script")
            {
                return ParameterClass::Html;
            }
            return ParameterClass::Xml;
        }

        // 10. Numeric check
        if !val_trimmed.is_empty()
            && val_trimmed
                .chars()
                .all(|c| c.is_ascii_digit() || c == '.' || c == '-')
        {
            return ParameterClass::Numeric;
        }

        // 11. Enumeration vs FreeText
        if val_trimmed.len() < 24
            && !val_trimmed.contains(' ')
            && val_trimmed
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return ParameterClass::Enumeration;
        }

        if val_trimmed.len() > 30 || val_trimmed.contains(' ') {
            return ParameterClass::FreeText;
        }

        ParameterClass::Unknown
    }

    fn is_token(name: &str, val: &str) -> bool {
        // UUID check
        if val.len() == 36 && val.chars().filter(|&c| c == '-').count() == 4 {
            return true;
        }

        // JWT check (3 base64url segments separated by dots)
        if val.chars().filter(|&c| c == '.').count() == 2 && val.len() > 40 {
            return true;
        }

        if name.contains("token")
            || name.contains("auth")
            || name.contains("key")
            || name.contains("secret")
            || name.contains("jwt")
            || name.contains("session")
            || name.contains("signature")
        {
            return true;
        }

        false
    }

    fn has_file_extension(val: &str) -> bool {
        let extensions = [
            ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".txt", ".csv", ".json", ".xml",
            ".html", ".doc", ".docx", ".zip", ".tar", ".gz", ".log",
        ];
        extensions.iter().any(|ext| val.ends_with(ext))
    }
}
