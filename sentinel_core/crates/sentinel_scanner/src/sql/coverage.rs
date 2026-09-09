//! SENTINEL Autonomous SQL Security Engine — Coverage Engine (M26)
//!
//! Multi-dimensional coordinate accounting matrix tracking tested vs confirmed vs
//! rejected vs coverage debt across the 1.2M+ theoretical coordinate space.

use std::collections::HashSet;
use crate::sql::models::Blake3Id;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct InvestigationCoordinate {
    pub target_id: Blake3Id,
    pub context_id: String,
    pub dbms_id: String,
    pub technique_id: String,
    pub oracle_id: String,
}

pub struct CoverageEngine {
    pub tested_coordinates: HashSet<InvestigationCoordinate>,
    pub confirmed_coordinates: HashSet<InvestigationCoordinate>,
    pub rejected_coordinates: HashSet<InvestigationCoordinate>,
    pub coverage_debt: HashSet<InvestigationCoordinate>,
}

impl CoverageEngine {
    pub fn new() -> Self {
        Self {
            tested_coordinates: HashSet::new(),
            confirmed_coordinates: HashSet::new(),
            rejected_coordinates: HashSet::new(),
            coverage_debt: HashSet::new(),
        }
    }

    pub fn record_test(&mut self, coord: InvestigationCoordinate) {
        self.coverage_debt.remove(&coord);
        self.tested_coordinates.insert(coord);
    }

    pub fn record_confirmation(&mut self, coord: InvestigationCoordinate) {
        self.confirmed_coordinates.insert(coord);
    }

    pub fn record_rejection(&mut self, coord: InvestigationCoordinate) {
        self.rejected_coordinates.insert(coord);
    }

    pub fn add_coverage_debt(&mut self, coord: InvestigationCoordinate) {
        if !self.tested_coordinates.contains(&coord) {
            self.coverage_debt.insert(coord);
        }
    }

    pub fn total_tested(&self) -> usize {
        self.tested_coordinates.len()
    }

    pub fn total_debt(&self) -> usize {
        self.coverage_debt.len()
    }
}
