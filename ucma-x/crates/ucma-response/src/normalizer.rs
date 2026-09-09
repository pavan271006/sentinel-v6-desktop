//! Differential Invariant Normalizer (DIN)
//! Implements element-wise triple-quorum intersection across baseline requests
//! and projects responses onto stable DOM masks, neutralizing dynamic content flapping.

use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NormalizerError {
    #[error("XML/HTML parse error: {0}")]
    XmlParse(String),
    #[error("Insufficient baseline requests: expected at least 3, got {0}")]
    InsufficientBaselines(usize),
    #[error("Stable mask not computed yet")]
    MaskNotComputed,
    #[error("Node not found in stable mask: {0}")]
    NodeNotFound(String),
}

/// Unique identifier for a node within a DOM tree.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DomNodeId(pub String);

/// Representation of a DOM node with tag, path, and normalized content hash.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DomNode {
    pub id: DomNodeId,
    pub tag: String,
    pub path: String,
    pub text_content: String,
    pub is_dynamic: bool,
}

/// Simplified structural DOM representation for invariant analysis.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DomTree {
    pub nodes: HashMap<DomNodeId, DomNode>,
    pub ordered_ids: Vec<DomNodeId>,
}

impl DomTree {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_node(&mut self, node: DomNode) {
        let id = node.id.clone();
        if !self.nodes.contains_key(&id) {
            self.ordered_ids.push(id.clone());
        }
        self.nodes.insert(id, node);
    }

    pub fn contains(&self, id: &DomNodeId) -> bool {
        self.nodes.contains_key(id)
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }
}

/// Differential Invariant Normalizer for triple-quorum baseline masking.
pub struct DifferentialInvariantNormalizer {
    baseline_responses: Vec<String>,
    pub stable_dom_mask: Option<DomTree>,
    pub node_weights: HashMap<DomNodeId, f64>,
}

impl DifferentialInvariantNormalizer {
    /// Creates a new normalizer from baseline response bodies.
    pub fn new(baseline_responses: Vec<String>) -> Self {
        Self {
            baseline_responses,
            stable_dom_mask: None,
            node_weights: HashMap::new(),
        }
    }

    /// Parses an HTML/XML string into a structural DomTree.
    pub fn parse_dom(&self, html: &str) -> Result<DomTree, NormalizerError> {
        let mut reader = Reader::from_str(html);
        reader.config_mut().trim_text(true);

        let mut dom = DomTree::new();
        let mut path_stack: Vec<String> = Vec::new();
        let mut tag_index_stack: Vec<usize> = Vec::new();
        let mut buf = Vec::new();
        let mut current_text = String::new();

        while let Ok(event) = reader.read_event_into(&mut buf) {
            match event {
                Event::Start(e) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    path_stack.push(tag.clone());
                    tag_index_stack.push(path_stack.len());

                    let path = path_stack.join("/");
                    let node_id = DomNodeId(format!("{}:{}", path, dom.node_count()));

                    dom.add_node(DomNode {
                        id: node_id,
                        tag,
                        path,
                        text_content: String::new(),
                        is_dynamic: false,
                    });
                }
                Event::Text(e) => {
                    let text = e.unescape().unwrap_or_default().trim().to_string();
                    if !text.is_empty() {
                        current_text.push_str(&text);
                        if let Some(last_id) = dom.ordered_ids.last() {
                            if let Some(node) = dom.nodes.get_mut(last_id) {
                                node.text_content = text;
                            }
                        }
                    }
                }
                Event::Empty(e) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    let path = format!("{}/{}", path_stack.join("/"), tag);
                    let node_id = DomNodeId(format!("{}:{}", path, dom.node_count()));

                    dom.add_node(DomNode {
                        id: node_id,
                        tag,
                        path,
                        text_content: String::new(),
                        is_dynamic: false,
                    });
                }
                Event::End(_) => {
                    path_stack.pop();
                    tag_index_stack.pop();
                }
                Event::Eof => break,
                _ => {}
            }
            buf.clear();
        }

        // Fallback for plaintext or unclosed documents
        if dom.node_count() == 0 && !html.trim().is_empty() {
            dom.add_node(DomNode {
                id: DomNodeId("text:root".to_string()),
                tag: "text".to_string(),
                path: "root".to_string(),
                text_content: html.trim().to_string(),
                is_dynamic: false,
            });
        }

        Ok(dom)
    }

    /// Computes the element-wise intersection across 3 baseline requests:
    /// M_stable = DOM(B1) ∩ DOM(B2) ∩ DOM(B3)
    pub fn compute_stable_mask(&mut self) -> Result<(), NormalizerError> {
        if self.baseline_responses.len() < 3 {
            return Err(NormalizerError::InsufficientBaselines(
                self.baseline_responses.len(),
            ));
        }

        let dom_b1 = self.parse_dom(&self.baseline_responses[0])?;
        let dom_b2 = self.parse_dom(&self.baseline_responses[1])?;
        let dom_b3 = self.parse_dom(&self.baseline_responses[2])?;

        let mut stable_mask = DomTree::new();
        let mut weights = HashMap::new();

        // Check common nodes present across B1, B2, and B3
        let b2_map: HashMap<String, &DomNode> =
            dom_b2.nodes.values().map(|n| (n.path.clone(), n)).collect();
        let b3_map: HashMap<String, &DomNode> =
            dom_b3.nodes.values().map(|n| (n.path.clone(), n)).collect();

        for node_b1 in dom_b1.nodes.values() {
            if let (Some(node_b2), Some(node_b3)) = (b2_map.get(&node_b1.path), b3_map.get(&node_b1.path))
            {
                // Invariant check: is text content identical across B1, B2, B3?
                let is_stable_text = (node_b1.text_content == node_b2.text_content)
                    && (node_b2.text_content == node_b3.text_content);

                let mut stable_node = node_b1.clone();
                if is_stable_text {
                    // Invariant node: weight = 1.0
                    weights.insert(node_b1.id.clone(), 1.0);
                    stable_node.is_dynamic = false;
                } else {
                    // Fluctuating node (e.g. timestamp, CSRF token): weight = 0.0
                    weights.insert(node_b1.id.clone(), 0.0);
                    stable_node.is_dynamic = true;
                }

                stable_mask.add_node(stable_node);
            }
        }

        self.node_weights = weights;
        self.stable_dom_mask = Some(stable_mask);

        Ok(())
    }

    /// Projects a candidate response onto the stable DOM mask:
    /// Returns Π_M(Response) with volatile nodes zero-weighted.
    pub fn project_response(&self, response_body: &str) -> Result<DomTree, NormalizerError> {
        let mask = self
            .stable_dom_mask
            .as_ref()
            .ok_or(NormalizerError::MaskNotComputed)?;

        let candidate_dom = self.parse_dom(response_body)?;
        let mut projected = DomTree::new();

        let candidate_map: HashMap<String, &DomNode> = candidate_dom
            .nodes
            .values()
            .map(|n| (n.path.clone(), n))
            .collect();

        for mask_node in mask.nodes.values() {
            let weight = self.node_weights.get(&mask_node.id).copied().unwrap_or(0.0);

            if let Some(cand_node) = candidate_map.get(&mask_node.path) {
                if weight > 0.0 {
                    // Keep invariant node
                    projected.add_node((*cand_node).clone());
                } else {
                    // Volatile node: blank out text content to zero its differential impact
                    let mut masked_node = (*cand_node).clone();
                    masked_node.text_content = String::new();
                    masked_node.is_dynamic = true;
                    projected.add_node(masked_node);
                }
            }
        }

        Ok(projected)
    }

    /// Computes the weighted differential distance between a baseline and probe projection.
    pub fn calculate_weighted_distance(&self, probe_projection: &DomTree) -> f64 {
        let mask = match &self.stable_dom_mask {
            Some(m) => m,
            None => return 0.0,
        };

        let mut diff_sum = 0.0;
        let mut total_weight = 0.0;

        for mask_node in mask.nodes.values() {
            let weight = self.node_weights.get(&mask_node.id).copied().unwrap_or(0.0);
            if weight <= 0.0 {
                continue;
            }

            total_weight += weight;

            if let Some(probe_node) = probe_projection.nodes.get(&mask_node.id) {
                if probe_node.text_content != mask_node.text_content {
                    diff_sum += weight;
                }
            } else {
                // Node missing in probe
                diff_sum += weight;
            }
        }

        if total_weight == 0.0 {
            0.0
        } else {
            diff_sum / total_weight
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_triple_quorum_mask_fluctuating_timestamp() {
        let b1 = "<html><body><div>Welcome</div><span>1725450000</span><p>Catalog</p></body></html>";
        let b2 = "<html><body><div>Welcome</div><span>1725450001</span><p>Catalog</p></body></html>";
        let b3 = "<html><body><div>Welcome</div><span>1725450002</span><p>Catalog</p></body></html>";

        let mut normalizer =
            DifferentialInvariantNormalizer::new(vec![b1.to_string(), b2.to_string(), b3.to_string()]);

        normalizer.compute_stable_mask().expect("Failed to compute stable mask");

        let mask = normalizer.stable_dom_mask.as_ref().unwrap();
        assert!(mask.node_count() >= 3);

        // Verify span (timestamp) has weight 0.0, and div/p have weight 1.0
        let mut zero_weight_count = 0;
        let mut one_weight_count = 0;

        for (_id, weight) in &normalizer.node_weights {
            if *weight == 0.0 {
                zero_weight_count += 1;
            } else if *weight == 1.0 {
                one_weight_count += 1;
            }
        }

        assert!(zero_weight_count >= 1, "Fluctuating timestamp should receive zero weight");
        assert!(one_weight_count >= 2, "Stable elements should receive 1.0 weight");

        // Probe with timestamp change only -> distance should be 0.0
        let probe_noise = "<html><body><div>Welcome</div><span>1725459999</span><p>Catalog</p></body></html>";
        let proj_noise = normalizer.project_response(probe_noise).unwrap();
        let dist_noise = normalizer.calculate_weighted_distance(&proj_noise);
        assert_eq!(dist_noise, 0.0, "Pure noise must yield zero differential distance");

        // Probe with real structural mutation (e.g. Welcome Back) -> distance > 0.0
        let probe_signal = "<html><body><div>Welcome Back Administrator</div><span>1725459999</span><p>Catalog</p></body></html>";
        let proj_signal = normalizer.project_response(probe_signal).unwrap();
        let dist_signal = normalizer.calculate_weighted_distance(&proj_signal);
        assert!(dist_signal > 0.0, "Signal mutation must be detected across stable mask");
    }
}
