//! GraphQL AST Analysis, Schema Cycle Detection, Complexity Scoring & Vulnerability Probing Engine.
//!
//! Provides:
//! - AST-based Lexer & Parser supporting operations, selections, aliases, directives, arguments & fragments
//! - Recursive complexity scoring with list multipliers (first, limit, pageSize) and directive filtering
//! - Schema cycle detection and recursive cyclic DoS query synthesis
//! - Array-based ([{q1}, {q2}]) and Alias-based (a1: q1, a2: q2) query batching DoS generators
//! - Field suggestion information leak detector ("Did you mean ...?")

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GraphQlOperationType {
    Query,
    Mutation,
    Subscription,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphQlArgument {
    pub name: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphQlDirective {
    pub name: String,
    pub arguments: Vec<GraphQlArgument>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GraphQlSelection {
    Field(GraphQlField),
    InlineFragment {
        type_condition: Option<String>,
        directives: Vec<GraphQlDirective>,
        selection_set: Vec<GraphQlSelection>,
    },
    FragmentSpread {
        name: String,
        directives: Vec<GraphQlDirective>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphQlField {
    pub alias: Option<String>,
    pub name: String,
    pub arguments: Vec<GraphQlArgument>,
    pub directives: Vec<GraphQlDirective>,
    pub selection_set: Vec<GraphQlSelection>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphQlOperation {
    pub operation_type: GraphQlOperationType,
    pub name: Option<String>,
    pub directives: Vec<GraphQlDirective>,
    pub selection_set: Vec<GraphQlSelection>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphQlDocument {
    pub operations: Vec<GraphQlOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQlBatchProbe {
    pub batch_size: usize,
    pub payload_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQlVulnerabilityFinding {
    pub vulnerability_type: String,
    pub severity: String,
    pub confidence: f32,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct GraphQlComplexityConfig {
    pub scalar_cost: u32,
    pub object_cost: u32,
    pub default_list_multiplier: u32,
}

impl Default for GraphQlComplexityConfig {
    fn default() -> Self {
        Self {
            scalar_cost: 1,
            object_cost: 2,
            default_list_multiplier: 10,
        }
    }
}

pub struct GraphQlAstParser<'a> {
    chars: Vec<char>,
    pos: usize,
    _marker: std::marker::PhantomData<&'a ()>,
}

impl<'a> GraphQlAstParser<'a> {
    pub fn parse(query: &'a str) -> Result<GraphQlDocument, String> {
        let mut parser = Self {
            chars: query.chars().collect(),
            pos: 0,
            _marker: std::marker::PhantomData,
        };
        parser.parse_document()
    }

    fn skip_whitespace_and_comments(&mut self) {
        while self.pos < self.chars.len() {
            let c = self.chars[self.pos];
            if c.is_whitespace() || c == ',' {
                self.pos += 1;
            } else if c == '#' {
                // Comment until end of line
                while self.pos < self.chars.len() && self.chars[self.pos] != '\n' && self.chars[self.pos] != '\r' {
                    self.pos += 1;
                }
            } else {
                break;
            }
        }
    }

    fn peek(&mut self) -> Option<char> {
        self.skip_whitespace_and_comments();
        if self.pos < self.chars.len() {
            Some(self.chars[self.pos])
        } else {
            None
        }
    }

    fn consume_char(&mut self, expected: char) -> Result<(), String> {
        self.skip_whitespace_and_comments();
        if self.pos < self.chars.len() && self.chars[self.pos] == expected {
            self.pos += 1;
            Ok(())
        } else {
            Err(format!("Expected '{}' at position {}", expected, self.pos))
        }
    }

    fn parse_ident(&mut self) -> Result<String, String> {
        self.skip_whitespace_and_comments();
        let start = self.pos;
        while self.pos < self.chars.len() {
            let c = self.chars[self.pos];
            if c.is_alphanumeric() || c == '_' {
                self.pos += 1;
            } else {
                break;
            }
        }
        if self.pos > start {
            Ok(self.chars[start..self.pos].iter().collect())
        } else {
            Err(format!("Expected identifier at position {}", self.pos))
        }
    }

    fn parse_string_literal(&mut self) -> Result<String, String> {
        self.consume_char('"')?;
        let mut out = String::new();
        while self.pos < self.chars.len() {
            let c = self.chars[self.pos];
            self.pos += 1;
            if c == '"' {
                return Ok(out);
            } else if c == '\\' {
                if self.pos < self.chars.len() {
                    let esc = self.chars[self.pos];
                    self.pos += 1;
                    out.push(esc);
                }
            } else {
                out.push(c);
            }
        }
        Err("Unterminated string literal in GraphQL document".to_string())
    }

    fn parse_value(&mut self) -> Result<serde_json::Value, String> {
        self.skip_whitespace_and_comments();
        match self.peek() {
            Some('"') => {
                let s = self.parse_string_literal()?;
                Ok(serde_json::Value::String(s))
            }
            Some('$') => {
                self.pos += 1;
                let var_name = self.parse_ident()?;
                Ok(serde_json::Value::String(format!("${}", var_name)))
            }
            Some('[') => {
                self.pos += 1;
                let mut arr = Vec::new();
                while self.peek() != Some(']') {
                    arr.push(self.parse_value()?);
                }
                self.consume_char(']')?;
                Ok(serde_json::Value::Array(arr))
            }
            Some('{') => {
                self.pos += 1;
                let mut map = serde_json::Map::new();
                while self.peek() != Some('}') {
                    let key = self.parse_ident()?;
                    self.consume_char(':')?;
                    let val = self.parse_value()?;
                    map.insert(key, val);
                }
                self.consume_char('}')?;
                Ok(serde_json::Value::Object(map))
            }
            Some(c) if c.is_digit(10) || c == '-' => {
                let start = self.pos;
                while self.pos < self.chars.len() {
                    let ch = self.chars[self.pos];
                    if ch.is_digit(10) || ch == '.' || ch == '-' || ch == 'e' || ch == 'E' {
                        self.pos += 1;
                    } else {
                        break;
                    }
                }
                let num_str: String = self.chars[start..self.pos].iter().collect();
                if let Ok(i) = num_str.parse::<i64>() {
                    Ok(serde_json::json!(i))
                } else if let Ok(f) = num_str.parse::<f64>() {
                    Ok(serde_json::json!(f))
                } else {
                    Ok(serde_json::Value::String(num_str))
                }
            }
            _ => {
                let ident = self.parse_ident()?;
                match ident.as_str() {
                    "true" => Ok(serde_json::Value::Bool(true)),
                    "false" => Ok(serde_json::Value::Bool(false)),
                    "null" => Ok(serde_json::Value::Null),
                    _ => Ok(serde_json::Value::String(ident)),
                }
            }
        }
    }

    fn parse_arguments(&mut self) -> Result<Vec<GraphQlArgument>, String> {
        let mut args = Vec::new();
        if self.peek() == Some('(') {
            self.consume_char('(')?;
            while self.peek() != Some(')') {
                let name = self.parse_ident()?;
                self.consume_char(':')?;
                let value = self.parse_value()?;
                args.push(GraphQlArgument { name, value });
            }
            self.consume_char(')')?;
        }
        Ok(args)
    }

    fn parse_directives(&mut self) -> Result<Vec<GraphQlDirective>, String> {
        let mut directives = Vec::new();
        while self.peek() == Some('@') {
            self.consume_char('@')?;
            let name = self.parse_ident()?;
            let arguments = self.parse_arguments()?;
            directives.push(GraphQlDirective { name, arguments });
        }
        Ok(directives)
    }

    fn parse_selection_set(&mut self) -> Result<Vec<GraphQlSelection>, String> {
        self.consume_char('{')?;
        let mut selections = Vec::new();
        while self.peek() != Some('}') {
            if self.peek() == Some('.') {
                // Fragment spread or inline fragment
                self.consume_char('.')?;
                self.consume_char('.')?;
                self.consume_char('.')?;
                if self.peek() == Some('{') || (self.pos + 2 < self.chars.len() && self.chars[self.pos..self.pos + 2].iter().collect::<String>() == "on") {
                    let type_condition = if self.peek() != Some('{') {
                        let _on = self.parse_ident()?;
                        Some(self.parse_ident()?)
                    } else {
                        None
                    };
                    let directives = self.parse_directives()?;
                    let sub_set = self.parse_selection_set()?;
                    selections.push(GraphQlSelection::InlineFragment {
                        type_condition,
                        directives,
                        selection_set: sub_set,
                    });
                } else {
                    let name = self.parse_ident()?;
                    let directives = self.parse_directives()?;
                    selections.push(GraphQlSelection::FragmentSpread { name, directives });
                }
            } else {
                let first_ident = self.parse_ident()?;
                let (alias, name) = if self.peek() == Some(':') {
                    self.consume_char(':')?;
                    let second_ident = self.parse_ident()?;
                    (Some(first_ident), second_ident)
                } else {
                    (None, first_ident)
                };

                let arguments = self.parse_arguments()?;
                let directives = self.parse_directives()?;
                let sub_set = if self.peek() == Some('{') {
                    self.parse_selection_set()?
                } else {
                    Vec::new()
                };

                selections.push(GraphQlSelection::Field(GraphQlField {
                    alias,
                    name,
                    arguments,
                    directives,
                    selection_set: sub_set,
                }));
            }
        }
        self.consume_char('}')?;
        Ok(selections)
    }

    fn parse_document(&mut self) -> Result<GraphQlDocument, String> {
        let mut operations = Vec::new();

        while self.peek().is_some() {
            if self.peek() == Some('{') {
                // Anonymous query
                let selection_set = self.parse_selection_set()?;
                operations.push(GraphQlOperation {
                    operation_type: GraphQlOperationType::Query,
                    name: None,
                    directives: Vec::new(),
                    selection_set,
                });
            } else {
                let op_type_str = self.parse_ident()?;
                let operation_type = match op_type_str.as_str() {
                    "query" => GraphQlOperationType::Query,
                    "mutation" => GraphQlOperationType::Mutation,
                    "subscription" => GraphQlOperationType::Subscription,
                    "fragment" => {
                        // Skip fragment definition
                        let _frag_name = self.parse_ident()?;
                        let _on = self.parse_ident()?;
                        let _type = self.parse_ident()?;
                        let _ = self.parse_directives()?;
                        let _ = self.parse_selection_set()?;
                        continue;
                    }
                    _ => GraphQlOperationType::Query,
                };

                let name = if self.peek() != Some('{') && self.peek() != Some('(') && self.peek() != Some('@') {
                    Some(self.parse_ident()?)
                } else {
                    None
                };

                // Skip variable definitions if present
                if self.peek() == Some('(') {
                    self.consume_char('(')?;
                    while self.peek() != Some(')') {
                        self.pos += 1;
                    }
                    self.consume_char(')')?;
                }

                let directives = self.parse_directives()?;
                let selection_set = self.parse_selection_set()?;

                operations.push(GraphQlOperation {
                    operation_type,
                    name,
                    directives,
                    selection_set,
                });
            }
        }

        Ok(GraphQlDocument { operations })
    }
}

pub struct GraphQlComplexityCalculator {
    pub config: GraphQlComplexityConfig,
}

impl GraphQlComplexityCalculator {
    pub fn new(config: GraphQlComplexityConfig) -> Self {
        Self { config }
    }

    /// Calculates total AST complexity score for a parsed GraphQL query document.
    pub fn calculate_document_complexity(&self, doc: &GraphQlDocument) -> u64 {
        let mut total = 0u64;
        for op in &doc.operations {
            total += self.calculate_selection_set_cost(&op.selection_set, 1);
        }
        total
    }

    fn calculate_selection_set_cost(&self, selections: &[GraphQlSelection], parent_multiplier: u64) -> u64 {
        let mut sum = 0u64;
        for sel in selections {
            match sel {
                GraphQlSelection::Field(field) => {
                    // Check if skipped via directives
                    if self.is_field_skipped(&field.directives) {
                        continue;
                    }

                    if field.selection_set.is_empty() {
                        // Scalar field
                        sum += (self.config.scalar_cost as u64) * parent_multiplier;
                    } else {
                        // Object / List field
                        let multiplier = self.extract_multiplier(field);
                        let node_cost = (self.config.object_cost as u64) * parent_multiplier;
                        let children_cost = self.calculate_selection_set_cost(
                            &field.selection_set,
                            parent_multiplier * multiplier,
                        );
                        sum += node_cost + children_cost;
                    }
                }
                GraphQlSelection::InlineFragment { selection_set, directives, .. } => {
                    if !self.is_field_skipped(directives) {
                        sum += self.calculate_selection_set_cost(selection_set, parent_multiplier);
                    }
                }
                GraphQlSelection::FragmentSpread { directives, .. } => {
                    if !self.is_field_skipped(directives) {
                        sum += (self.config.scalar_cost as u64) * parent_multiplier;
                    }
                }
            }
        }
        sum
    }

    fn extract_multiplier(&self, field: &GraphQlField) -> u64 {
        for arg in &field.arguments {
            let lower = arg.name.to_lowercase();
            if lower == "first" || lower == "limit" || lower == "count" || lower == "pagesize" || lower == "last" {
                if let Some(i) = arg.value.as_i64() {
                    if i > 0 {
                        return i as u64;
                    }
                } else if let Some(u) = arg.value.as_u64() {
                    if u > 0 {
                        return u;
                    }
                }
            }
        }
        self.config.default_list_multiplier as u64
    }

    fn is_field_skipped(&self, directives: &[GraphQlDirective]) -> bool {
        for dir in directives {
            if dir.name == "skip" {
                for arg in &dir.arguments {
                    if arg.name == "if" && arg.value == serde_json::Value::Bool(true) {
                        return true;
                    }
                }
            } else if dir.name == "include" {
                for arg in &dir.arguments {
                    if arg.name == "if" && arg.value == serde_json::Value::Bool(false) {
                        return true;
                    }
                }
            }
        }
        false
    }
}

pub struct GraphQlCycleDetector;

impl GraphQlCycleDetector {
    /// Detects cycles in type relations: e.g. User.posts -> Post.author -> User
    pub fn find_type_cycles(type_graph: &HashMap<String, Vec<String>>) -> Vec<Vec<String>> {
        let mut cycles = Vec::new();
        let mut visited = HashSet::new();
        let mut rec_stack = Vec::new();

        for node in type_graph.keys() {
            if !visited.contains(node) {
                Self::dfs_cycles(node, type_graph, &mut visited, &mut rec_stack, &mut cycles);
            }
        }

        cycles
    }

    fn dfs_cycles(
        current: &str,
        graph: &HashMap<String, Vec<String>>,
        visited: &mut HashSet<String>,
        rec_stack: &mut Vec<String>,
        cycles: &mut Vec<Vec<String>>,
    ) {
        visited.insert(current.to_string());
        rec_stack.push(current.to_string());

        if let Some(neighbors) = graph.get(current) {
            for neighbor in neighbors {
                if let Some(pos) = rec_stack.iter().position(|x| x == neighbor) {
                    let mut cycle: Vec<String> = rec_stack[pos..].to_vec();
                    cycle.push(neighbor.clone());
                    cycles.push(cycle);
                } else if !visited.contains(neighbor) {
                    Self::dfs_cycles(neighbor, graph, visited, rec_stack, cycles);
                }
            }
        }

        rec_stack.pop();
    }

    /// Synthesizes deep recursive cyclic query to test execution limits
    pub fn generate_circular_cycle_query(cycle_fields: &[(String, String)], depth: usize) -> String {
        let mut q = String::new();
        for i in 0..depth {
            let (field, _) = &cycle_fields[i % cycle_fields.len()];
            q.push_str(&format!("{} {{ ", field));
        }
        q.push_str("id ");
        for _ in 0..depth {
            q.push_str("} ");
        }
        format!("query DeepCircularExploit {{ {} }}", q.trim())
    }
}

pub struct GraphQlEngine;

impl GraphQlEngine {
    /// Generates standard GraphQL schema introspection query
    pub fn generate_introspection_query() -> &'static str {
        r#"{"query": "query IntrospectionQuery { __schema { queryType { name } mutationType { name } types { ...FullType } } } fragment FullType on __Type { kind name fields(includeDeprecated: true) { name args { name type { name kind } } } } "}"#
    }

    /// Calculates query nesting depth via robust AST parsing
    pub fn calculate_query_depth(query: &str) -> usize {
        if let Ok(doc) = GraphQlAstParser::parse(query) {
            let mut max_depth = 0;
            for op in &doc.operations {
                let d = Self::measure_selection_depth(&op.selection_set);
                if d > max_depth {
                    max_depth = d;
                }
            }
            max_depth
        } else {
            // Fallback to bracket matching
            let mut depth: usize = 0;
            let mut max: usize = 0;
            for c in query.chars() {
                if c == '{' {
                    depth += 1;
                    if depth > max {
                        max = depth;
                    }
                } else if c == '}' {
                    depth = depth.saturating_sub(1);
                }
            }
            max
        }
    }

    fn measure_selection_depth(selections: &[GraphQlSelection]) -> usize {
        let mut max = 0;
        for sel in selections {
            match sel {
                GraphQlSelection::Field(field) => {
                    let d = 1 + Self::measure_selection_depth(&field.selection_set);
                    if d > max {
                        max = d;
                    }
                }
                GraphQlSelection::InlineFragment { selection_set, .. } => {
                    let d = Self::measure_selection_depth(selection_set);
                    if d > max {
                        max = d;
                    }
                }
                _ => {}
            }
        }
        max
    }

    /// Evaluates if response body confirms enabled introspection
    pub fn is_introspection_enabled(response_body: &str) -> bool {
        response_body.contains("__schema") && response_body.contains("queryType")
    }

    /// Generates an array-based query batching payload with `batch_count` queries
    pub fn generate_array_batch_probe(single_query: &str, batch_count: usize) -> GraphQlBatchProbe {
        let mut queries = Vec::with_capacity(batch_count);
        for _ in 0..batch_count {
            queries.push(format!("{{\"query\": \"{}\"}}", single_query.replace('"', "\\\"")));
        }
        let payload = format!("[{}]", queries.join(","));
        GraphQlBatchProbe {
            batch_size: batch_count,
            payload_json: payload,
        }
    }

    /// Generates an alias-based single query batching probe (e.g. a1: user(id: 1), a2: user(id: 2))
    pub fn generate_alias_batch_probe(field_name: &str, sub_fields: &str, count: usize) -> String {
        let mut body = String::new();
        for i in 1..=count {
            body.push_str(&format!("  a{}: {}(id: \"{}\") {{ {} }}\n", i, field_name, i, sub_fields));
        }
        format!("query AliasBatchDos {{\n{}}}", body)
    }

    /// Generates a deeply nested circular query to test query depth limits
    pub fn generate_deep_nested_query(field_a: &str, field_b: &str, depth: usize) -> String {
        let mut q = String::new();
        for i in 0..depth {
            let field = if i % 2 == 0 { field_a } else { field_b };
            q.push_str(&format!("{} {{ ", field));
        }
        q.push_str("id ");
        for _ in 0..depth {
            q.push_str("} ");
        }
        format!("query DeepNesting {{ {} }}", q.trim())
    }

    /// Checks if response body contains field suggestions ("Did you mean ...")
    pub fn detect_field_suggestions(response_body: &str) -> Option<String> {
        if response_body.contains("Did you mean") || response_body.contains("did you mean") {
            Some("GraphQL Field Suggestion Information Leak (helps attackers map hidden schema fields)".to_string())
        } else {
            None
        }
    }
}
