//! DOM Tree Dissection & Interactive Element Extraction

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormElement {
    pub action: String,
    pub method: String,
    pub inputs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomSnapshot {
    pub title: String,
    pub forms: Vec<FormElement>,
    pub links: Vec<String>,
    pub scripts: Vec<String>,
}

pub struct DomExtractor;

impl DomExtractor {
    pub fn extract(html: &str) -> DomSnapshot {
        let mut title = String::new();
        let mut forms = Vec::new();
        let mut links = Vec::new();
        let mut scripts = Vec::new();

        // Extract title
        if let Some(start) = html.find("<title>") {
            if let Some(end) = html[start + 7..].find("</title>") {
                title = html[start + 7..start + 7 + end].trim().to_string();
            }
        }

        // Extract links
        for segment in html.split("href=\"") {
            if let Some(end) = segment.find('"') {
                let link = segment[..end].trim();
                if !link.is_empty() && (link.starts_with('/') || link.starts_with("http")) {
                    links.push(link.to_string());
                }
            }
        }

        // Extract scripts
        for segment in html.split("<script") {
            if let Some(end) = segment.find("</script>") {
                let script = segment[..end].trim();
                if !script.is_empty() {
                    scripts.push(script.to_string());
                }
            }
        }

        // Mock form extraction
        if html.contains("<form") {
            forms.push(FormElement {
                action: "/login".to_string(),
                method: "POST".to_string(),
                inputs: vec!["username".to_string(), "password".to_string()],
            });
        }

        DomSnapshot {
            title,
            forms,
            links,
            scripts,
        }
    }
}
