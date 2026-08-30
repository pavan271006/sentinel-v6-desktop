//! Passive Technology Fingerprinting Engine

use sentinel_common::domain::core::Transaction;
use sentinel_common::operational::TechFingerprint;

pub struct TechDetector;

impl TechDetector {
    pub fn detect_from_transaction(tx: &Transaction) -> Vec<TechFingerprint> {
        let mut results = Vec::new();

        if let Some(resp) = &tx.response {
            // 1. Analyze Response Headers
            for (name, val) in &resp.parsed.headers {
                let name_str = String::from_utf8_lossy(name).to_ascii_lowercase();
                let val_str = String::from_utf8_lossy(val).to_string();

                if name_str == "server" {
                    Self::analyze_server_header(&val_str, &mut results);
                } else if name_str == "x-powered-by" {
                    Self::analyze_powered_by_header(&val_str, &mut results);
                } else if name_str == "set-cookie" {
                    Self::analyze_cookie_header(&val_str, &mut results);
                } else if name_str == "cf-ray" || name_str == "cf-cache-status" {
                    results.push(TechFingerprint {
                        tech: "Cloudflare CDN/WAF".to_string(),
                        confidence: 0.99,
                    });
                } else if name_str == "x-amz-cf-id" {
                    results.push(TechFingerprint {
                        tech: "AWS CloudFront".to_string(),
                        confidence: 0.99,
                    });
                }
            }

            // 2. Analyze Body content if available
            let body_str = &resp.normalized_text;
            Self::analyze_body_content(body_str, &mut results);
        }

        // Deduplicate results keeping highest confidence
        Self::deduplicate_fingerprints(results)
    }

    fn analyze_server_header(server: &str, results: &mut Vec<TechFingerprint>) {
        let s = server.to_ascii_lowercase();
        if s.contains("nginx") {
            results.push(TechFingerprint {
                tech: "Nginx".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("apache") {
            results.push(TechFingerprint {
                tech: "Apache HTTP Server".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("microsoft-iis") || s.contains("iis") {
            results.push(TechFingerprint {
                tech: "Microsoft IIS".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("caddy") {
            results.push(TechFingerprint {
                tech: "Caddy Server".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("cloudflare") {
            results.push(TechFingerprint {
                tech: "Cloudflare".to_string(),
                confidence: 0.98,
            });
        }
        if s.contains("envoy") {
            results.push(TechFingerprint {
                tech: "Envoy Proxy".to_string(),
                confidence: 0.95,
            });
        }
    }

    fn analyze_powered_by_header(powered_by: &str, results: &mut Vec<TechFingerprint>) {
        let s = powered_by.to_ascii_lowercase();
        if s.contains("express") {
            results.push(TechFingerprint {
                tech: "Express.js".to_string(),
                confidence: 0.95,
            });
            results.push(TechFingerprint {
                tech: "Node.js".to_string(),
                confidence: 0.90,
            });
        }
        if s.contains("php") {
            results.push(TechFingerprint {
                tech: "PHP".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("asp.net") {
            results.push(TechFingerprint {
                tech: "ASP.NET".to_string(),
                confidence: 0.95,
            });
        }
        if s.contains("next.js") {
            results.push(TechFingerprint {
                tech: "Next.js".to_string(),
                confidence: 0.98,
            });
        }
    }

    fn analyze_cookie_header(cookie: &str, results: &mut Vec<TechFingerprint>) {
        let c = cookie.to_ascii_lowercase();
        if c.contains("phpsessid") {
            results.push(TechFingerprint {
                tech: "PHP".to_string(),
                confidence: 0.90,
            });
        }
        if c.contains("jsessionid") {
            results.push(TechFingerprint {
                tech: "Java / Servlet".to_string(),
                confidence: 0.90,
            });
        }
        if c.contains("aspsessionid") || c.contains("asp.net_sessionid") {
            results.push(TechFingerprint {
                tech: "ASP.NET".to_string(),
                confidence: 0.90,
            });
        }
        if c.contains("connect.sid") {
            results.push(TechFingerprint {
                tech: "Express.js / Node.js".to_string(),
                confidence: 0.90,
            });
        }
        if c.contains("laravel_session") {
            results.push(TechFingerprint {
                tech: "Laravel".to_string(),
                confidence: 0.95,
            });
        }
        if c.contains("csrftoken") || c.contains("django") {
            results.push(TechFingerprint {
                tech: "Django".to_string(),
                confidence: 0.85,
            });
        }
    }

    fn analyze_body_content(body: &str, results: &mut Vec<TechFingerprint>) {
        if body.contains("wp-content") || body.contains("wp-includes") {
            results.push(TechFingerprint {
                tech: "WordPress".to_string(),
                confidence: 0.95,
            });
        }
        if body.contains("drupal.settings") || body.contains("Drupal") {
            results.push(TechFingerprint {
                tech: "Drupal".to_string(),
                confidence: 0.90,
            });
        }
        if body.contains("__NEXT_DATA__") {
            results.push(TechFingerprint {
                tech: "Next.js / React".to_string(),
                confidence: 0.98,
            });
        }
        if body.contains("data-reactroot") || body.contains("react-dom") {
            results.push(TechFingerprint {
                tech: "React".to_string(),
                confidence: 0.90,
            });
        }
        if body.contains("ng-version") || body.contains("ng-app") {
            results.push(TechFingerprint {
                tech: "Angular".to_string(),
                confidence: 0.90,
            });
        }
    }

    fn deduplicate_fingerprints(fingerprints: Vec<TechFingerprint>) -> Vec<TechFingerprint> {
        let mut map = std::collections::HashMap::new();
        for fp in fingerprints {
            map.entry(fp.tech)
                .and_modify(|c: &mut f32| {
                    if fp.confidence > *c {
                        *c = fp.confidence;
                    }
                })
                .or_insert(fp.confidence);
        }

        map.into_iter()
            .map(|(tech, confidence)| TechFingerprint { tech, confidence })
            .collect()
    }
}
