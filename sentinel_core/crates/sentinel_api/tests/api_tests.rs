use sentinel_api::*;
use serde_json::json;
use std::collections::{HashMap, HashSet};

#[test]
fn test_openapi_31_ref_resolution_local_nested_and_circular() {
    let spec = json!({
        "openapi": "3.1.0",
        "info": { "title": "Sentinel Security API", "version": "1.0.0" },
        "paths": {
            "/api/v1/users/{userId}": {
                "get": {
                    "summary": "Get user details",
                    "parameters": [
                        { "$ref": "#/components/parameters/UserIdParam" }
                    ],
                    "responses": {
                        "200": {
                            "description": "User profile",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/UserProfile" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/orgs/{orgId}/recursive": {
                "post": {
                    "summary": "Recursive Node",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/TreeNode" }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "parameters": {
                "UserIdParam": {
                    "name": "userId",
                    "in": "path",
                    "required": true,
                    "schema": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 1000000
                    }
                }
            },
            "schemas": {
                "Address": {
                    "type": "object",
                    "properties": {
                        "street": { "type": "string", "minLength": 3 },
                        "city": { "type": "string" }
                    }
                },
                "UserProfile": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "integer" },
                        "name": { "type": "string" },
                        "address": { "$ref": "#/components/schemas/Address" }
                    }
                },
                "TreeNode": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string", "format": "uuid" },
                        "child": { "$ref": "#/components/schemas/TreeNode" }
                    }
                }
            }
        }
    });

    let spec_str = spec.to_string();

    // 1. JsonPointerResolver direct resolution
    let resolver = JsonPointerResolver::new(spec.clone());
    let mut visited = HashSet::new();
    let resolved_param = resolver.resolve_ref("#/components/parameters/UserIdParam", &mut visited).unwrap();
    assert_eq!(resolved_param["name"], "userId");
    assert_eq!(resolved_param["schema"]["type"], "integer");

    // 2. Circular reference cycle guard test
    let mut visited_cycle = HashSet::new();
    let expanded_tree = resolver.resolve_ref("#/components/schemas/TreeNode", &mut visited_cycle).unwrap();
    assert!(expanded_tree.get("properties").is_some());

    // 3. Full detailed schemas parse
    let endpoints = OpenApiParser::parse_detailed_schemas(&spec_str).unwrap();
    assert_eq!(endpoints.len(), 2);

    let get_user = endpoints.iter().find(|e| e.path == "/api/v1/users/{userId}").unwrap();
    assert_eq!(get_user.parameters.len(), 1);
    assert_eq!(get_user.parameters[0].name, "userId");
    assert_eq!(get_user.parameters[0].schema_type, "integer");
    assert_eq!(get_user.parameters[0].minimum, Some(1));
    assert_eq!(get_user.parameters[0].maximum, Some(1000000));

    // 4. Spec-driven fuzz cases generation
    let fuzz_cases = OpenApiParser::generate_spec_fuzz_cases(get_user);
    assert!(fuzz_cases.iter().any(|c| c.test_name.starts_with("BoundaryUnderflow")));
    assert!(fuzz_cases.iter().any(|c| c.test_name.starts_with("BoundaryOverflow")));
    assert!(fuzz_cases.iter().any(|c| c.test_name.starts_with("TypeMismatch_StringIntoInt")));

    let post_node = endpoints.iter().find(|e| e.path == "/api/v1/orgs/{orgId}/recursive").unwrap();
    let post_fuzz = OpenApiParser::generate_spec_fuzz_cases(post_node);
    assert!(post_fuzz.iter().any(|c| c.test_name == "MassAssignment_AdminPrivilege"));
    assert!(post_fuzz.iter().any(|c| c.test_name == "MassAssignment_PrototypePollution"));
}

#[test]
fn test_grpc_dynamic_message_and_reflection_fuzzing() {
    // 1. Dynamic Protobuf Message assembly
    let mut msg = DynamicMessage::new();
    msg.insert(1, ProtobufValue::Varint(42));
    msg.insert(2, ProtobufValue::LengthDelimited(b"Sentinel Auditor".to_vec()));

    let mut sub_msg = HashMap::new();
    sub_msg.insert(1, vec![ProtobufValue::Varint(999)]);
    msg.insert(3, ProtobufValue::Message(sub_msg));

    let encoded_bytes = msg.encode_to_vec();
    assert!(!encoded_bytes.is_empty());

    // 2. Decode back from wire bytes
    let decoded_msg = DynamicMessage::decode_from_slice(&encoded_bytes).unwrap();
    assert_eq!(decoded_msg.fields.get(&1).unwrap()[0], ProtobufValue::Varint(42));
    assert_eq!(
        decoded_msg.fields.get(&2).unwrap()[0],
        ProtobufValue::LengthDelimited(b"Sentinel Auditor".to_vec())
    );

    // 3. JSON transcoding
    let json_val = json!({
        "1": 10928,
        "2": "Alice Pentester",
        "3": {
            "1": 555
        }
    });
    let mut transcoded_msg = DynamicMessage::new();
    transcoded_msg.transcode_from_json(&json_val).unwrap();
    let back_to_json = transcoded_msg.transcode_to_json();
    assert_eq!(back_to_json["1"], 10928);
    assert_eq!(back_to_json["2"], "Alice Pentester");

    // 4. 5-byte Length-prefixed wire framing
    let wire_frame = GrpcEngine::encode_frame(&encoded_bytes, false);
    assert_eq!(wire_frame.len(), 5 + encoded_bytes.len());
    let parsed_frame = GrpcEngine::decode_frame(&wire_frame).unwrap();
    assert_eq!(parsed_frame.data, encoded_bytes);
    assert!(!parsed_frame.is_compressed);

    // 5. Server Reflection v1 request generation
    let reflection_req = GrpcEngine::generate_reflection_request();
    assert!(reflection_req.len() >= 5);

    // 6. Security Fuzzing Payloads
    let varint_overflow_frame = GrpcEngine::generate_varint_overflow_fuzz_frame();
    assert!(varint_overflow_frame.len() >= 15);

    let high_tag_frame = GrpcEngine::generate_high_tag_injection_frame(1_000_000);
    assert!(high_tag_frame.len() > 10);

    let depth_frame = GrpcEngine::generate_recursion_depth_fuzz_frame(50);
    assert!(depth_frame.len() > 100);
}

#[test]
fn test_graphql_ast_parser_complexity_and_batching() {
    let query_str = r#"
        # Sentinel GraphQL Security Test Query
        query GetUserProfile($limit: Int) {
            user(id: "usr_100", bio: "Bio with {brackets} and \"escaped\" quotes") {
                id
                email
                profile @include(if: true) {
                    avatarUrl
                }
                posts(first: 50) {
                    id
                    title
                    comments(limit: 10) {
                        id
                        content
                    }
                }
            }
        }
    "#;

    // 1. AST Parser test
    let doc = GraphQlAstParser::parse(query_str).unwrap();
    assert_eq!(doc.operations.len(), 1);
    let op = &doc.operations[0];
    assert_eq!(op.name.as_deref(), Some("GetUserProfile"));
    assert_eq!(op.selection_set.len(), 1);

    // 2. Measure depth without regex breakdown
    let depth = GraphQlEngine::calculate_query_depth(query_str);
    assert!(depth >= 4);

    // 3. Complexity calculation with list multipliers
    let calc = GraphQlComplexityCalculator::new(GraphQlComplexityConfig {
        scalar_cost: 1,
        object_cost: 2,
        default_list_multiplier: 10,
    });
    let complexity = calc.calculate_document_complexity(&doc);
    // Root user object (2) + scalar id (1) + email (1) + profile (2 + 1) + posts (2 + 50 * (id: 1 + title: 1 + comments: (2 + 10 * (id: 1 + content: 1))))
    assert!(complexity > 500);

    // 4. Batching Probing Generators
    let array_batch = GraphQlEngine::generate_array_batch_probe("query { me { id } }", 5);
    assert_eq!(array_batch.batch_size, 5);
    assert!(array_batch.payload_json.starts_with('['));
    assert!(array_batch.payload_json.ends_with(']'));

    let alias_batch = GraphQlEngine::generate_alias_batch_probe("user", "id email", 3);
    assert!(alias_batch.contains("a1: user(id: \"1\") { id email }"));
    assert!(alias_batch.contains("a2: user(id: \"2\") { id email }"));
    assert!(alias_batch.contains("a3: user(id: \"3\") { id email }"));

    // 5. Field suggestions detector
    let leak_resp = r#"{"errors":[{"message":"Cannot query field 'passwrd' on type 'User'. Did you mean 'password'?"}]}"#;
    let detected = GraphQlEngine::detect_field_suggestions(leak_resp);
    assert!(detected.is_some());
}
