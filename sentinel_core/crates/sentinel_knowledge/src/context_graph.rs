//! Strongly-Typed Security Context Graph (SENTINEL Proprietary Engine 1)
//!
//! Provides typed nodes, typed edges, lineage tracing, upstream risk propagation,
//! choke point identification, and cycle-bounded subgraph extraction.

use std::collections::{HashMap, HashSet, VecDeque};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::enums::Severity;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextNodeType {
    Asset,
    Endpoint,
    Parameter,
    Request,
    Response,
    Finding,
    Service,
    Identity,
}

impl std::fmt::Display for ContextNodeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContextNodeType::Asset => write!(f, "asset"),
            ContextNodeType::Endpoint => write!(f, "endpoint"),
            ContextNodeType::Parameter => write!(f, "parameter"),
            ContextNodeType::Request => write!(f, "request"),
            ContextNodeType::Response => write!(f, "response"),
            ContextNodeType::Finding => write!(f, "finding"),
            ContextNodeType::Service => write!(f, "service"),
            ContextNodeType::Identity => write!(f, "identity"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextEdgeType {
    HasEndpoint,
    AcceptsParam,
    EmitsResponse,
    ExhibitsFinding,
    TargetsEndpoint,
    ProducesEvidence,
    DerivedFrom,
    AuthenticatesAs,
}

impl std::fmt::Display for ContextEdgeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContextEdgeType::HasEndpoint => write!(f, "has_endpoint"),
            ContextEdgeType::AcceptsParam => write!(f, "accepts_param"),
            ContextEdgeType::EmitsResponse => write!(f, "emits_response"),
            ContextEdgeType::ExhibitsFinding => write!(f, "exhibits_finding"),
            ContextEdgeType::TargetsEndpoint => write!(f, "targets_endpoint"),
            ContextEdgeType::ProducesEvidence => write!(f, "produces_evidence"),
            ContextEdgeType::DerivedFrom => write!(f, "derived_from"),
            ContextEdgeType::AuthenticatesAs => write!(f, "authenticates_as"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ContextGraphNode {
    pub id: Uuid,
    pub node_type: ContextNodeType,
    pub label: String,
    pub risk_score: f64,
    pub severity: Option<Severity>,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
}

impl ContextGraphNode {
    pub fn new(id: Uuid, node_type: ContextNodeType, label: impl Into<String>) -> Self {
        Self {
            id,
            node_type,
            label: label.into(),
            risk_score: 0.0,
            severity: None,
            metadata: HashMap::new(),
            created_at: Utc::now(),
        }
    }

    pub fn with_severity(mut self, severity: Severity) -> Self {
        self.severity = Some(severity);
        self.risk_score = match severity {
            Severity::Critical => 100.0,
            Severity::High => 80.0,
            Severity::Medium => 50.0,
            Severity::Low => 25.0,
            Severity::Info => 10.0,
        };
        self
    }

    pub fn with_meta(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ContextGraphEdge {
    pub id: Uuid,
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub edge_type: ContextEdgeType,
    pub weight: f64,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
}

impl ContextGraphEdge {
    pub fn new(source_id: Uuid, target_id: Uuid, edge_type: ContextEdgeType) -> Self {
        Self {
            id: Uuid::new_v4(),
            source_id,
            target_id,
            edge_type,
            weight: 1.0,
            metadata: HashMap::new(),
            created_at: Utc::now(),
        }
    }

    pub fn with_weight(mut self, weight: f64) -> Self {
        self.weight = weight;
        self
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineagePath {
    pub finding_id: Uuid,
    pub nodes: Vec<ContextGraphNode>,
    pub edges: Vec<ContextGraphEdge>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SecurityContextGraph {
    pub nodes: HashMap<Uuid, ContextGraphNode>,
    pub outgoing: HashMap<Uuid, Vec<ContextGraphEdge>>,
    pub incoming: HashMap<Uuid, Vec<ContextGraphEdge>>,
}

impl SecurityContextGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            outgoing: HashMap::new(),
            incoming: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, node: ContextGraphNode) {
        self.nodes.insert(node.id, node);
    }

    pub fn add_edge(&mut self, edge: ContextGraphEdge) {
        self.outgoing
            .entry(edge.source_id)
            .or_default()
            .push(edge.clone());
        self.incoming
            .entry(edge.target_id)
            .or_default()
            .push(edge);
    }

    pub fn get_node(&self, id: &Uuid) -> Option<&ContextGraphNode> {
        self.nodes.get(id)
    }

    pub fn get_node_mut(&mut self, id: &Uuid) -> Option<&mut ContextGraphNode> {
        self.nodes.get_mut(id)
    }

    pub fn get_outgoing_edges(&self, id: &Uuid) -> &[ContextGraphEdge] {
        self.outgoing.get(id).map(|v| v.as_slice()).unwrap_or(&[])
    }

    pub fn get_incoming_edges(&self, id: &Uuid) -> &[ContextGraphEdge] {
        self.incoming.get(id).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Traces the upstream provenance lineage of a finding back to its root asset.
    /// Traverses backward from Finding -> Response/Request -> Parameter -> Endpoint -> Asset.
    pub fn trace_finding_lineage(&self, finding_id: Uuid) -> Option<LineagePath> {
        let finding_node = self.nodes.get(&finding_id)?;
        if finding_node.node_type != ContextNodeType::Finding {
            return None;
        }

        let mut collected_nodes = vec![finding_node.clone()];
        let mut collected_edges = Vec::new();
        let mut visited = HashSet::new();
        visited.insert(finding_id);

        let mut queue = VecDeque::new();
        queue.push_back(finding_id);

        while let Some(current_id) = queue.pop_front() {
            if let Some(incoming_edges) = self.incoming.get(&current_id) {
                for edge in incoming_edges {
                    if !visited.contains(&edge.source_id) {
                        visited.insert(edge.source_id);
                        if let Some(source_node) = self.nodes.get(&edge.source_id) {
                            collected_nodes.push(source_node.clone());
                            collected_edges.push(edge.clone());
                            queue.push_back(edge.source_id);
                        }
                    }
                }
            }
        }

        Some(LineagePath {
            finding_id,
            nodes: collected_nodes,
            edges: collected_edges,
        })
    }

    /// Propagates risk scores from confirmed findings upstream through the graph hierarchy.
    /// Attenuation formula: R_upstream = max(R_upstream, 0.85 * R_downstream).
    pub fn propagate_risk_scores(&mut self) -> HashMap<Uuid, f64> {
        let mut updated_scores: HashMap<Uuid, f64> = HashMap::new();

        // 1. Initialize finding baseline scores
        for node in self.nodes.values() {
            if node.node_type == ContextNodeType::Finding {
                let base = match node.severity {
                    Some(Severity::Critical) => 100.0,
                    Some(Severity::High) => 80.0,
                    Some(Severity::Medium) => 50.0,
                    Some(Severity::Low) => 25.0,
                    Some(Severity::Info) => 10.0,
                    None => node.risk_score.max(10.0),
                };
                updated_scores.insert(node.id, base);
            }
        }

        // 2. Multi-pass upstream relaxation (topological/BFS-level relaxation)
        let max_iterations = 16;
        for _ in 0..max_iterations {
            let mut changed = false;
            let current_scores = updated_scores.clone();

            for (target_id, downstream_score) in current_scores.iter() {
                if let Some(incoming_edges) = self.incoming.get(target_id) {
                    for edge in incoming_edges {
                        let attenuated = downstream_score * 0.85 * edge.weight;
                        let existing = updated_scores.get(&edge.source_id).copied().unwrap_or(0.0);
                        if attenuated > existing + 0.001 {
                            updated_scores.insert(edge.source_id, attenuated);
                            changed = true;
                        }
                    }
                }
            }

            if !changed {
                break;
            }
        }

        // 3. Write back scores to nodes
        for (id, score) in &updated_scores {
            if let Some(node) = self.nodes.get_mut(id) {
                node.risk_score = *score;
            }
        }

        updated_scores
    }

    /// Identifies critical choke points by counting path intersections across all paths
    /// from Asset nodes to Sink nodes (Findings/Sensitive endpoints).
    pub fn find_choke_points(&self, top_n: usize) -> Vec<(Uuid, usize)> {
        let mut asset_nodes = Vec::new();
        let mut sink_nodes = Vec::new();

        for node in self.nodes.values() {
            match node.node_type {
                ContextNodeType::Asset => asset_nodes.push(node.id),
                ContextNodeType::Finding | ContextNodeType::Response => sink_nodes.push(node.id),
                _ => {}
            }
        }

        let mut node_pass_count: HashMap<Uuid, usize> = HashMap::new();

        for asset_id in &asset_nodes {
            for sink_id in &sink_nodes {
                let paths = self.find_all_paths(*asset_id, *sink_id, 16);
                for path in paths {
                    let mut path_nodes = HashSet::new();
                    for edge in path {
                        path_nodes.insert(edge.source_id);
                        path_nodes.insert(edge.target_id);
                    }
                    for node_id in path_nodes {
                        // Don't count the root asset or sink itself as intermediary choke point
                        if node_id != *asset_id && node_id != *sink_id {
                            *node_pass_count.entry(node_id).or_default() += 1;
                        }
                    }
                }
            }
        }

        let mut ranked: Vec<(Uuid, usize)> = node_pass_count.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));
        ranked.truncate(top_n);
        ranked
    }

    /// Finds paths between source and destination with cycle detection and bounded depth.
    pub fn find_all_paths(&self, from: Uuid, to: Uuid, max_depth: usize) -> Vec<Vec<ContextGraphEdge>> {
        if from == to {
            return Vec::new();
        }

        let mut results = Vec::new();
        let mut queue: VecDeque<(Uuid, Vec<ContextGraphEdge>, HashSet<Uuid>)> = VecDeque::new();

        let mut initial_visited = HashSet::new();
        initial_visited.insert(from);
        queue.push_back((from, Vec::new(), initial_visited));

        while let Some((curr, path, visited)) = queue.pop_front() {
            if path.len() >= max_depth {
                continue;
            }

            if let Some(edges) = self.outgoing.get(&curr) {
                for edge in edges {
                    if edge.target_id == to {
                        let mut complete_path = path.clone();
                        complete_path.push(edge.clone());
                        results.push(complete_path);
                    } else if !visited.contains(&edge.target_id) {
                        let mut new_visited = visited.clone();
                        new_visited.insert(edge.target_id);
                        let mut new_path = path.clone();
                        new_path.push(edge.clone());
                        queue.push_back((edge.target_id, new_path, new_visited));
                    }
                }
            }
        }

        results
    }

    /// Extracts a cycle-bounded subgraph reachable from an asset root node up to max_depth.
    pub fn get_asset_subgraph(&self, asset_id: Uuid, max_depth: usize) -> Self {
        let mut subgraph = SecurityContextGraph::new();
        let root = match self.nodes.get(&asset_id) {
            Some(node) => node.clone(),
            None => return subgraph,
        };

        subgraph.add_node(root);
        let mut visited = HashSet::new();
        visited.insert(asset_id);

        let mut queue = VecDeque::new();
        queue.push_back((asset_id, 0usize));

        while let Some((curr_id, depth)) = queue.pop_front() {
            if depth >= max_depth {
                continue;
            }

            if let Some(edges) = self.outgoing.get(&curr_id) {
                for edge in edges {
                    if let Some(target_node) = self.nodes.get(&edge.target_id) {
                        subgraph.add_node(target_node.clone());
                        subgraph.add_edge(edge.clone());

                        if !visited.contains(&edge.target_id) {
                            visited.insert(edge.target_id);
                            queue.push_back((edge.target_id, depth + 1));
                        }
                    }
                }
            }
        }

        subgraph
    }
}
