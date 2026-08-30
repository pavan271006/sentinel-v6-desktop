//! In-Memory Graph Topology Engine & Pathfinding

use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;

use sentinel_common::operational::{GraphEdge, GraphNode};

const MAX_PATH_DEPTH: usize = 32;

#[derive(Debug, Default, Clone)]
pub struct GraphIndex {
    nodes: HashMap<Uuid, GraphNode>,
    outgoing: HashMap<Uuid, Vec<GraphEdge>>,
    incoming: HashMap<Uuid, Vec<GraphEdge>>,
    label_index: HashMap<String, Uuid>,
}

impl GraphIndex {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            outgoing: HashMap::new(),
            incoming: HashMap::new(),
            label_index: HashMap::new(),
        }
    }

    pub fn insert_node(&mut self, node: GraphNode) {
        let label_key = node.label.to_ascii_lowercase();
        self.label_index.insert(label_key, node.id);
        self.nodes.insert(node.id, node);
    }

    pub fn get_node(&self, id: Uuid) -> Option<&GraphNode> {
        self.nodes.get(&id)
    }

    pub fn resolve_label(&self, label: &str) -> Option<&GraphNode> {
        let label_key = label.to_ascii_lowercase();
        self.label_index
            .get(&label_key)
            .and_then(|id| self.nodes.get(id))
    }

    pub fn insert_edge(&mut self, edge: GraphEdge) {
        self.outgoing
            .entry(edge.source_id)
            .or_default()
            .push(edge.clone());
        self.incoming.entry(edge.target_id).or_default().push(edge);
    }

    pub fn get_neighbors(&self, node_id: Uuid) -> Vec<GraphNode> {
        let mut neighbors = Vec::new();
        if let Some(edges) = self.outgoing.get(&node_id) {
            for edge in edges {
                if let Some(node) = self.nodes.get(&edge.target_id) {
                    neighbors.push(node.clone());
                }
            }
        }
        neighbors
    }

    /// BFS pathfinding from source node to target node with cycle protection.
    pub fn find_paths(&self, from: Uuid, to: Uuid) -> Vec<Vec<GraphEdge>> {
        if from == to {
            return Vec::new();
        }

        let mut results = Vec::new();
        let mut queue: VecDeque<(Uuid, Vec<GraphEdge>, HashSet<Uuid>)> = VecDeque::new();

        let mut initial_visited = HashSet::new();
        initial_visited.insert(from);
        queue.push_back((from, Vec::new(), initial_visited));

        while let Some((curr, path, visited)) = queue.pop_front() {
            if path.len() >= MAX_PATH_DEPTH {
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
}
