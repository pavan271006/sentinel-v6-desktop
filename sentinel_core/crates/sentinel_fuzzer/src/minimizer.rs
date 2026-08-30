//! Automated Payload Minimization (Delta Debugging)

pub struct PayloadMinimizer;

impl PayloadMinimizer {
    /// Reduces a triggering payload to its minimal reproducing representation
    /// using a binary delta-debugging partitioning predicate.
    pub fn minimize<F>(payload: &[u8], mut test_fn: F) -> Vec<u8>
    where
        F: FnMut(&[u8]) -> bool,
    {
        if !test_fn(payload) {
            return payload.to_vec();
        }

        let mut current = payload.to_vec();
        let mut n = 2;

        while current.len() >= 2 {
            let mut reduced = false;
            let chunk_size = current.len().div_ceil(n);
            let mut next_n = n;

            // 1. Try removing each chunk
            for i in 0..n {
                let start = i * chunk_size;
                let end = (start + chunk_size).min(current.len());
                if start >= current.len() {
                    break;
                }

                let mut candidate = Vec::with_capacity(current.len() - (end - start));
                candidate.extend_from_slice(&current[..start]);
                candidate.extend_from_slice(&current[end..]);

                if !candidate.is_empty() && test_fn(&candidate) {
                    current = candidate;
                    next_n = (n - 1).max(2);
                    reduced = true;
                    break;
                }
            }

            if reduced {
                n = next_n;
            } else {
                if n >= current.len() {
                    break;
                }
                n = (n * 2).min(current.len());
            }
        }

        current
    }
}
