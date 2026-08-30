use blake3::Hasher;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MerkleCasNode {
    pub node_id: String,
    pub hash: [u8; 32],
    pub raw_bytes: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct MerkleCasProofTree {
    pub root_hash: [u8; 32],
    pub nodes: Vec<MerkleCasNode>,
    pub timestamp_utc: u64,
}

impl MerkleCasProofTree {
    pub fn build(nodes: Vec<MerkleCasNode>, timestamp_utc: u64) -> Self {
        let mut hasher = Hasher::new();
        for node in &nodes {
            hasher.update(&node.hash);
        }
        let root_hash = *hasher.finalize().as_bytes();

        Self {
            root_hash,
            nodes,
            timestamp_utc,
        }
    }

    pub fn verify(&self) -> bool {
        let mut hasher = Hasher::new();
        for node in &self.nodes {
            let mut node_hasher = Hasher::new();
            node_hasher.update(&node.raw_bytes);
            if *node_hasher.finalize().as_bytes() != node.hash {
                return false;
            }
            hasher.update(&node.hash);
        }
        *hasher.finalize().as_bytes() == self.root_hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_valid_node(id: &str, data: &[u8]) -> MerkleCasNode {
        let mut hasher = Hasher::new();
        hasher.update(data);
        MerkleCasNode {
            node_id: id.to_string(),
            hash: *hasher.finalize().as_bytes(),
            raw_bytes: data.to_vec(),
        }
    }

    #[test]
    fn test_cas_merkle_valid() {
        let nodes = vec![
            create_valid_node("req1", b"GET / HTTP/1.1"),
            create_valid_node("resp1", b"HTTP/1.1 200 OK"),
            create_valid_node("req2", b"POST /api HTTP/1.1"),
            create_valid_node("resp2", b"HTTP/1.1 403 Forbidden"),
        ];

        let tree = MerkleCasProofTree::build(nodes, 1693425000);
        assert!(tree.verify(), "Valid proof bundle with 4 raw nodes must return true");
    }

    #[test]
    fn test_cas_merkle_tamper() {
        let mut nodes = vec![
            create_valid_node("req1", b"GET / HTTP/1.1"),
            create_valid_node("resp1", b"HTTP/1.1 200 OK"),
        ];

        let mut tree = MerkleCasProofTree::build(nodes.clone(), 1693425000);
        
        // Tamper with 1 byte of raw request in proof node bundle
        tree.nodes[0].raw_bytes[0] = b'P'; // Changed 'G' to 'P'

        assert!(!tree.verify(), "Tampered proof must fail verification");
    }
}
