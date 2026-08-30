//! SQLite Recursive Common Table Expression (CTE) Query Generator (Engine 1)
//!
//! Generates recursive SQL CTE queries for high-performance graph traversal in SQLite:
//! - Upstream finding lineage tracing
//! - Downstream attack impact and blast radius
//! - Transitive asset containment and choke point detection

pub struct AttackGraphCteQueries;

impl AttackGraphCteQueries {
    /// Generates recursive CTE query for upstream finding lineage tracing:
    /// Traverses backward from finding to root asset.
    pub fn query_lineage_sql(finding_id: &str, max_depth: usize) -> String {
        format!(
            r#"WITH RECURSIVE lineage(id, source_id, target_id, edge_type, depth) AS (
    SELECT id, source_id, target_id, edge_type, 0
    FROM graph_edges
    WHERE target_id = '{finding_id}'
    UNION ALL
    SELECT e.id, e.source_id, e.target_id, e.edge_type, l.depth + 1
    FROM graph_edges e
    JOIN lineage l ON e.target_id = l.source_id
    WHERE l.depth < {max_depth}
)
SELECT DISTINCT n.id, n.node_type, n.label, n.metadata_json, l.edge_type, l.depth
FROM lineage l
JOIN graph_nodes n ON l.source_id = n.id
ORDER BY l.depth ASC;"#
        )
    }

    /// Generates recursive CTE query for downstream attack path traversal:
    /// Traverses forward from entrypoint asset to all reachable sink nodes.
    pub fn query_attack_paths_sql(asset_id: &str, max_depth: usize) -> String {
        format!(
            r#"WITH RECURSIVE attack_path(id, source_id, target_id, edge_type, depth, path_str) AS (
    SELECT id, source_id, target_id, edge_type, 0, source_id || '->' || target_id
    FROM graph_edges
    WHERE source_id = '{asset_id}'
    UNION ALL
    SELECT e.id, e.source_id, e.target_id, e.edge_type, ap.depth + 1, ap.path_str || '->' || e.target_id
    FROM graph_edges e
    JOIN attack_path ap ON e.source_id = ap.target_id
    WHERE ap.depth < {max_depth} AND instr(ap.path_str, e.target_id) = 0
)
SELECT DISTINCT ap.depth, ap.path_str, n.id, n.node_type, n.label, n.metadata_json
FROM attack_path ap
JOIN graph_nodes n ON ap.target_id = n.id
ORDER BY ap.depth ASC;"#
        )
    }

    /// Generates recursive CTE query for blast radius estimation from a compromised node.
    pub fn query_blast_radius_sql(node_id: &str, max_depth: usize) -> String {
        format!(
            r#"WITH RECURSIVE blast_radius(id, source_id, target_id, edge_type, depth) AS (
    SELECT id, source_id, target_id, edge_type, 0
    FROM graph_edges
    WHERE source_id = '{node_id}'
    UNION ALL
    SELECT e.id, e.source_id, e.target_id, e.edge_type, br.depth + 1
    FROM graph_edges e
    JOIN blast_radius br ON e.source_id = br.target_id
    WHERE br.depth < {max_depth}
)
SELECT n.node_type, COUNT(DISTINCT n.id) as impacted_count
FROM blast_radius br
JOIN graph_nodes n ON br.target_id = n.id
GROUP BY n.node_type;"#
        )
    }

    /// Generates recursive CTE query for identifying topological choke points between assets and findings.
    pub fn query_choke_points_sql(max_depth: usize) -> String {
        format!(
            r#"WITH RECURSIVE paths(source_node, current_node, depth, visited_path) AS (
    SELECT n.id, e.target_id, 1, n.id || ',' || e.target_id
    FROM graph_nodes n
    JOIN graph_edges e ON n.id = e.source_id
    WHERE n.node_type = 'asset'
    UNION ALL
    SELECT p.source_node, e.target_id, p.depth + 1, p.visited_path || ',' || e.target_id
    FROM paths p
    JOIN graph_edges e ON p.current_node = e.source_id
    JOIN graph_nodes target_n ON e.target_id = target_n.id
    WHERE p.depth < {max_depth}
      AND instr(p.visited_path, e.target_id) = 0
)
SELECT gn.id, gn.node_type, gn.label, COUNT(*) as path_traversal_count
FROM paths p
JOIN graph_nodes gn ON p.current_node = gn.id
WHERE gn.node_type NOT IN ('asset', 'finding')
GROUP BY gn.id, gn.node_type, gn.label
ORDER BY path_traversal_count DESC;"#
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lineage_sql_generation() {
        let sql = AttackGraphCteQueries::query_lineage_sql("fnd-1234", 10);
        assert!(sql.contains("WITH RECURSIVE lineage"));
        assert!(sql.contains("WHERE target_id = 'fnd-1234'"));
        assert!(sql.contains("WHERE l.depth < 10"));
    }

    #[test]
    fn test_attack_paths_sql_generation() {
        let sql = AttackGraphCteQueries::query_attack_paths_sql("asset-999", 8);
        assert!(sql.contains("WITH RECURSIVE attack_path"));
        assert!(sql.contains("WHERE source_id = 'asset-999'"));
        assert!(sql.contains("WHERE ap.depth < 8"));
    }

    #[test]
    fn test_blast_radius_sql_generation() {
        let sql = AttackGraphCteQueries::query_blast_radius_sql("node-555", 5);
        assert!(sql.contains("WITH RECURSIVE blast_radius"));
        assert!(sql.contains("WHERE source_id = 'node-555'"));
    }

    #[test]
    fn test_choke_points_sql_generation() {
        let sql = AttackGraphCteQueries::query_choke_points_sql(6);
        assert!(sql.contains("WITH RECURSIVE paths"));
        assert!(sql.contains("WHERE gn.node_type NOT IN ('asset', 'finding')"));
    }
}
