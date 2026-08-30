//! GraphQL Lexer and Recursive-Descent AST Parser.

use crate::ast::{
    GraphQlArgument, GraphQlDocument, GraphQlField, GraphQlOperation, GraphQlOperationType,
    GraphQlSelection, GraphQlValue, GraphQlVariableDefinition,
};

pub struct GraphQlParser;

impl GraphQlParser {
    /// Parses a GraphQL document string into a GraphQlDocument AST.
    pub fn parse(source: &str) -> Result<GraphQlDocument, String> {
        let tokens = Self::tokenize(source);
        if tokens.is_empty() {
            return Err("Empty GraphQL document".to_string());
        }

        let mut idx = 0;
        let mut operations = Vec::new();

        while idx < tokens.len() {
            let op = Self::parse_operation(&tokens, &mut idx)?;
            operations.push(op);
        }

        Ok(GraphQlDocument { operations })
    }

    fn tokenize(source: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut chars = source.chars().peekable();

        while let Some(&c) = chars.peek() {
            if c.is_whitespace() || c == ',' {
                chars.next();
            } else if c == '#' {
                // Line comment
                while let Some(&ch) = chars.peek() {
                    chars.next();
                    if ch == '\n' {
                        break;
                    }
                }
            } else if c == '"' {
                // String literal
                chars.next();
                let mut s = String::new();
                while let Some(ch) = chars.next() {
                    if ch == '"' {
                        break;
                    }
                    if ch == '\\' {
                        if let Some(escaped) = chars.next() {
                            s.push(escaped);
                        }
                    } else {
                        s.push(ch);
                    }
                }
                tokens.push(format!("\"{}\"", s));
            } else if c == '{'
                || c == '}'
                || c == '('
                || c == ')'
                || c == '['
                || c == ']'
                || c == ':'
                || c == '$'
                || c == '!'
                || c == '@'
                || c == '='
            {
                chars.next();
                tokens.push(c.to_string());
            } else {
                let mut word = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_whitespace()
                        || ch == ','
                        || ch == '{'
                        || ch == '}'
                        || ch == '('
                        || ch == ')'
                        || ch == '['
                        || ch == ']'
                        || ch == ':'
                        || ch == '$'
                        || ch == '!'
                        || ch == '@'
                        || ch == '='
                        || ch == '#'
                        || ch == '"'
                    {
                        break;
                    }
                    word.push(ch);
                    chars.next();
                }
                tokens.push(word);
            }
        }

        tokens
    }

    fn parse_operation(tokens: &[String], idx: &mut usize) -> Result<GraphQlOperation, String> {
        let mut op_type = GraphQlOperationType::Query;
        let mut name = None;
        let mut variable_definitions = Vec::new();

        if *idx < tokens.len() {
            let t = &tokens[*idx];
            if t == "query" {
                op_type = GraphQlOperationType::Query;
                *idx += 1;
            } else if t == "mutation" {
                op_type = GraphQlOperationType::Mutation;
                *idx += 1;
            } else if t == "subscription" {
                op_type = GraphQlOperationType::Subscription;
                *idx += 1;
            }

            // Optional operation name
            if *idx < tokens.len() && tokens[*idx] != "{" && tokens[*idx] != "(" {
                name = Some(tokens[*idx].clone());
                *idx += 1;
            }

            // Optional variable definitions: ($id: ID!, $limit: Int = 10)
            if *idx < tokens.len() && tokens[*idx] == "(" {
                *idx += 1;
                while *idx < tokens.len() && tokens[*idx] != ")" {
                    if tokens[*idx] == "$" {
                        *idx += 1;
                        let var_name = tokens.get(*idx).cloned().unwrap_or_default();
                        *idx += 1;
                        if *idx < tokens.len() && tokens[*idx] == ":" {
                            *idx += 1;
                        }
                        let mut type_name = tokens.get(*idx).cloned().unwrap_or_default();
                        *idx += 1;
                        if *idx < tokens.len() && tokens[*idx] == "!" {
                            type_name.push('!');
                            *idx += 1;
                        }

                        variable_definitions.push(GraphQlVariableDefinition {
                            name: var_name,
                            type_name,
                            default_value: None,
                        });
                    } else {
                        *idx += 1;
                    }
                }
                if *idx < tokens.len() && tokens[*idx] == ")" {
                    *idx += 1;
                }
            }
        }

        // Selection set `{ ... }`
        let selection_set = Self::parse_selection_set(tokens, idx)?;

        Ok(GraphQlOperation {
            operation_type: op_type,
            name,
            variable_definitions,
            selection_set,
        })
    }

    fn parse_selection_set(
        tokens: &[String],
        idx: &mut usize,
    ) -> Result<Vec<GraphQlSelection>, String> {
        let mut selections = Vec::new();
        if *idx >= tokens.len() || tokens[*idx] != "{" {
            return Ok(selections);
        }
        *idx += 1; // consume '{'

        while *idx < tokens.len() && tokens[*idx] != "}" {
            let field_name = tokens[*idx].clone();
            *idx += 1;

            let mut arguments = Vec::new();
            if *idx < tokens.len() && tokens[*idx] == "(" {
                *idx += 1;
                while *idx < tokens.len() && tokens[*idx] != ")" {
                    let arg_name = tokens[*idx].clone();
                    *idx += 1;
                    if *idx < tokens.len() && tokens[*idx] == ":" {
                        *idx += 1;
                    }
                    let val = Self::parse_value(tokens, idx)?;
                    arguments.push(GraphQlArgument {
                        name: arg_name,
                        value: val,
                    });
                }
                if *idx < tokens.len() && tokens[*idx] == ")" {
                    *idx += 1;
                }
            }

            let nested_selections = if *idx < tokens.len() && tokens[*idx] == "{" {
                Self::parse_selection_set(tokens, idx)?
            } else {
                Vec::new()
            };

            selections.push(GraphQlSelection::Field(GraphQlField {
                name: field_name,
                alias: None,
                arguments,
                selection_set: nested_selections,
            }));
        }

        if *idx < tokens.len() && tokens[*idx] == "}" {
            *idx += 1;
        }

        Ok(selections)
    }

    fn parse_value(tokens: &[String], idx: &mut usize) -> Result<GraphQlValue, String> {
        if *idx >= tokens.len() {
            return Err("Unexpected end of tokens while parsing GraphQL value".to_string());
        }

        let token = &tokens[*idx];
        if token == "$" {
            *idx += 1;
            let var_name = tokens.get(*idx).cloned().unwrap_or_default();
            *idx += 1;
            Ok(GraphQlValue::Variable(var_name))
        } else if token.starts_with('"') && token.ends_with('"') {
            let val = token[1..token.len() - 1].to_string();
            *idx += 1;
            Ok(GraphQlValue::String(val))
        } else if let Ok(n) = token.parse::<i64>() {
            *idx += 1;
            Ok(GraphQlValue::Int(n))
        } else if let Ok(f) = token.parse::<f64>() {
            *idx += 1;
            Ok(GraphQlValue::Float(f))
        } else if token == "true" {
            *idx += 1;
            Ok(GraphQlValue::Boolean(true))
        } else if token == "false" {
            *idx += 1;
            Ok(GraphQlValue::Boolean(false))
        } else if token == "null" {
            *idx += 1;
            Ok(GraphQlValue::Null)
        } else if token == "{" {
            *idx += 1; // consume '{'
            let mut obj = Vec::new();
            while *idx < tokens.len() && tokens[*idx] != "}" {
                let k = tokens[*idx].clone();
                *idx += 1;
                if *idx < tokens.len() && tokens[*idx] == ":" {
                    *idx += 1;
                }
                let v = Self::parse_value(tokens, idx)?;
                obj.push((k, v));
            }
            if *idx < tokens.len() && tokens[*idx] == "}" {
                *idx += 1;
            }
            Ok(GraphQlValue::Object(obj))
        } else if token == "[" {
            *idx += 1; // consume '['
            let mut list = Vec::new();
            while *idx < tokens.len() && tokens[*idx] != "]" {
                let item = Self::parse_value(tokens, idx)?;
                list.push(item);
            }
            if *idx < tokens.len() && tokens[*idx] == "]" {
                *idx += 1;
            }
            Ok(GraphQlValue::List(list))
        } else {
            let enum_name = token.clone();
            *idx += 1;
            Ok(GraphQlValue::Enum(enum_name))
        }
    }

    /// Serializes a GraphQL Document back into formatted GraphQL query string.
    pub fn serialize(doc: &GraphQlDocument) -> String {
        let mut out = String::new();
        for op in &doc.operations {
            let op_str = match op.operation_type {
                GraphQlOperationType::Query => "query",
                GraphQlOperationType::Mutation => "mutation",
                GraphQlOperationType::Subscription => "subscription",
            };
            out.push_str(op_str);

            if let Some(ref name) = op.name {
                out.push_str(&format!(" {}", name));
            }

            if !op.variable_definitions.is_empty() {
                let vars: Vec<String> = op
                    .variable_definitions
                    .iter()
                    .map(|v| format!("${}: {}", v.name, v.type_name))
                    .collect();
                out.push_str(&format!("({})", vars.join(", ")));
            }

            out.push(' ');
            out.push_str(&Self::serialize_selections(&op.selection_set));
            out.push('\n');
        }
        out
    }

    fn serialize_selections(selections: &[GraphQlSelection]) -> String {
        let mut out = String::from("{ ");
        for sel in selections {
            match sel {
                GraphQlSelection::Field(f) => {
                    out.push_str(&f.name);
                    if !f.arguments.is_empty() {
                        let args: Vec<String> = f
                            .arguments
                            .iter()
                            .map(|a| format!("{}: {}", a.name, Self::serialize_value(&a.value)))
                            .collect();
                        out.push_str(&format!("({})", args.join(", ")));
                    }
                    if !f.selection_set.is_empty() {
                        out.push(' ');
                        out.push_str(&Self::serialize_selections(&f.selection_set));
                    }
                    out.push(' ');
                }
                GraphQlSelection::FragmentSpread(name) => {
                    out.push_str(&format!("...{} ", name));
                }
            }
        }
        out.push('}');
        out
    }

    fn serialize_value(val: &GraphQlValue) -> String {
        match val {
            GraphQlValue::Variable(v) => format!("${}", v),
            GraphQlValue::Int(i) => i.to_string(),
            GraphQlValue::Float(f) => f.to_string(),
            GraphQlValue::String(s) => format!("\"{}\"", s),
            GraphQlValue::Boolean(b) => b.to_string(),
            GraphQlValue::Null => "null".to_string(),
            GraphQlValue::Enum(e) => e.clone(),
            GraphQlValue::List(l) => {
                let items: Vec<String> = l.iter().map(Self::serialize_value).collect();
                format!("[{}]", items.join(", "))
            }
            GraphQlValue::Object(o) => {
                let fields: Vec<String> = o
                    .iter()
                    .map(|(k, v)| format!("{}: {}", k, Self::serialize_value(v)))
                    .collect();
                format!("{{ {} }}", fields.join(", "))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_graphql_query() {
        let query = r#"
            query GetUser($id: ID!) {
                user(id: $id, role: "admin", filter: { active: true }) {
                    id
                    name
                    profile {
                        bio
                    }
                }
            }
        "#;
        let doc = GraphQlParser::parse(query).unwrap();
        assert_eq!(doc.operations.len(), 1);
        let op = &doc.operations[0];
        assert_eq!(op.name.as_deref(), Some("GetUser"));
        assert_eq!(op.variable_definitions.len(), 1);
        assert_eq!(op.variable_definitions[0].name, "id");
        assert_eq!(op.selection_set.len(), 1);
    }

    #[test]
    fn test_graphql_roundtrip_serialize() {
        let query = "query { user(id: 10) { id name } }";
        let doc = GraphQlParser::parse(query).unwrap();
        let serialized = GraphQlParser::serialize(&doc);
        assert!(serialized.contains("user(id: 10)"));
        assert!(serialized.contains("{ id name }"));
    }
}
