# Subsystem B (Protocols & APIs) Architectural Analysis & Implementation Plan

**Platform**: SENTINEL V6 Security Testing Workstation  
**Subsystem**: Subsystem B — Protocols & APIs (`sentinel_api`, `sentinel_parser`, `sentinel_proxy`)  
**Document ID**: `SENTINEL-HANDOFF-PHASE2-PROTOCOLS-APIS`  
**Author**: `explorer_phase2_protocols_apis`  
**Status**: COMPLETE / AUTHORITATIVE  

---

## 1. Observation

Direct inspection of the local codebase and architecture specifications revealed the following exact baseline implementations and architectural requirements:

### 1.1 OpenAPI 3.1 Parser & Fuzzer (`sentinel_core/crates/sentinel_api/src/openapi.rs`)
- **Current State (Lines 1–211)**:
  - `OpenApiParser::parse_spec` (Lines 48–86) parses OpenAPI JSON using `serde_json::Value` to extract basic `PRoute` definitions from the `paths` mapping. It only inspects top-level parameter `name` strings inside operation objects.
  - `OpenApiParser::parse_detailed_schemas` (Lines 89–145) parses top-level query/path parameters and extracts `schema_type`, `minimum`, `maximum`, and `enum_values`.
  - `OpenApiParser::generate_spec_fuzz_cases` (Lines 148–209) generates 4 simple fuzz cases: `OmitRequiredParam`, `TypeMismatch_StringIntoInt`, `BoundaryUnderflow`/`BoundaryOverflow`, and `EnumViolation`.
- **Gaps Observed**:
  - Zero `$ref` pointer resolution: Cannot resolve local pointers (`#/$defs/User`, `#/components/schemas/Item`), nested component references (`#/components/parameters/...`), or external/remote document paths.
  - Missing OpenAPI 3.1 JSON Schema 2020-12 dialect support: No support for polymorphic schema keywords (`oneOf`, `anyOf`, `allOf`, `not`), prefix items in arrays, `pattern` regex validation, `format` specifications (UUID, email, date-time, uri, ipv4/ipv6), or `discriminator` mappings.
  - Missing requestBody schema extraction: Only flags `request_body_required: bool` without parsing `content."application/json".schema`.
  - Missing parameter serialization styles (e.g. `matrix`, `label`, `form`, `simple`, `spaceDelimited`, `pipeDelimited`, `deepObject`).

### 1.2 gRPC Reflection v1 (`sentinel_core/crates/sentinel_api/src/grpc.rs`)
- **Current State (Lines 1–76)**:
  - `GrpcEngine::encode_frame` (Lines 28–35) and `decode_frame` (Lines 38–66) implement 5-byte length-prefixed framing (1-byte compression flag + 4-byte big-endian length).
  - `GrpcEngine::generate_reflection_request` (Lines 69–74) contains a hardcoded 2-byte Protobuf stub (`vec![0x3a, 0x00]`).
- **Gaps Observed**:
  - No dynamic Protobuf schema reflection or decoding: Lacks `prost-reflect` integration.
  - No implementation of `grpc.reflection.v1.ServerReflection` or `grpc.reflection.v1alpha.ServerReflection` streaming RPC protocol (`ServerReflectionRequest` / `ServerReflectionResponse`).
  - Cannot parse `FileDescriptorProto` byte chunks (`file_descriptor_response`), build `DescriptorPool`, or discover service methods dynamically.
  - No `DynamicMessage` builder or JSON $\leftrightarrow$ Protobuf transcoding engine for method replay and fuzzing.

### 1.3 GraphQL Complexity & Introspection (`sentinel_core/crates/sentinel_api/src/graphql.rs`)
- **Current State (Lines 1–96)**:
  - `GraphQlEngine::calculate_query_depth` (Lines 34–54) calculates depth using naive character counting of `{` and `}` curly braces.
  - `GraphQlEngine::generate_introspection_query` (Lines 29–31) returns a static introspection string.
  - `GraphQlEngine::is_introspection_enabled` (Lines 57–59) checks for raw substring matches `"__schema"` and `"queryType"`.
  - `GraphQlEngine::generate_array_batch_probe` (Lines 62–72) produces JSON array batching `[{"query": "..."}, ...]`.
  - `GraphQlEngine::generate_deep_nested_query` (Lines 75–86) generates alternating field strings.
- **Gaps Observed**:
  - No AST-based parser: Fragile curly-brace counting fails on string literals containing braces (e.g. `query { user(bio: "{hello}") { id } }`), comments (`# {`), and fragments.
  - No AST complexity score calculator: Lacks field cost weighting, multiplier arguments (e.g. `users(limit: 100)` $\to 100 \times \text{child\_cost}$), and directive handling (`@include`, `@skip`).
  - No schema-aware circular query generator: Cannot analyze type relationships from an introspection schema to detect recursive cycles and construct cyclic denial-of-service payloads.
  - No alias-based batching generator: Missing single-query aliased operation bundling (`query { a1: user(id: 1) { ... }, a2: user(id: 2) { ... } }`).

### 1.4 Native HTTP/3 QUIC (`sentinel_parser` and `sentinel_proxy`)
- **`sentinel_parser` State**:
  - `sentinel_parser/src/h2.rs` (Lines 1–568) implements RFC 7540 HTTP/2 framing (`H2FrameHeader`, `H2Frame`) and RFC 7541 HPACK (`HpackDecoder`, `encode_hpack_headers`).
  - No HTTP/3 frame parsing, no QUIC Varint codecs (RFC 9000 §16), and no QPACK decoder (RFC 9204).
- **`sentinel_proxy` State**:
  - `sentinel_proxy/src/server.rs` (Lines 1–85) binds only a TCP listener (`tokio::net::TcpListener`).
  - `sentinel_proxy/src/handler.rs` (Lines 1–481) handles Plain HTTP and HTTPS CONNECT TCP tunnels with `rustls` TLS 1.3 termination.
  - `sentinel_proxy/src/tls/mod.rs` (Lines 1–88) configures ALPN only for `h2` and `http/1.1`.
- **Gaps Observed**:
  - Missing UDP QUIC socket listener using `quinn` / `h3`.
  - Missing ALPN negotiation for `h3` and `h3-29`.
  - Missing QUIC TLS 1.3 forged certificate generation and upstream connection dispatcher.

---

## 2. Logic Chain

To satisfy the authoritative requirements from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `V6_FINAL_EVOLUTION_PLAN.md`, the Subsystem B architecture must be structured into four fully-specified modules:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           SUBSYSTEM B: PROTOCOLS & APIS ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  1. OPENAPI 3.1 & JSON SCHEMA 2020-12 ENGINE (`sentinel_api::openapi`)                          │
│     ├── JsonPointerResolver: Local (#/$defs/...), Remote/URI, Circular Cycle Detection          │
│     ├── OpenApiRouteExtractor: Path templates, Query/Header/Cookie/Body Parameter Extraction    │
│     ├── SchemaTypeSynthesizer: Type constraint validation, polymorphism (oneOf/anyOf/allOf)     │
│     └── SpecDrivenFuzzer: Type confusion, Boundary overflows, Mass assignment, Enum corruption │
│                                                                                                 │
│  2. gRPC REFLECTION V1 & DYNAMIC MESSAGE ENGINE (`sentinel_api::grpc`)                          │
│     ├── GrpcReflectionClient: ServerReflection v1 / v1alpha stream handler                     │
│     ├── DescriptorPoolManager: Transitive FileDescriptorProto resolution and service discovery │
│     ├── DynamicMessageCodec: JSON <-> Protobuf transcoding via prost-reflect                    │
│     └── GrpcSecurityFuzzer: Varint 64-bit overflow, Unknown tag injection, Depth exhaustion    │
│                                                                                                 │
│  3. GRAPHQL AST COMPLEXITY & INTROSPECTION ENGINE (`sentinel_api::graphql`)                     │
│     ├── GraphQlAstParser: Lexer & Document AST (Operations, Selections, Fragments, Arguments)   │
│     ├── ComplexityCalculator: Base field weights + multiplier scaling (e.g. limit: 100)        │
│     ├── CycleDetector: Schema type graph recursion & deep circular payload generator            │
│     └── BatchingEngine: Array-based ([{q1}, {q2}]) & Alias-based (a1: q1, a2: q2) DoS probes    │
│                                                                                                 │
│  4. NATIVE HTTP/3 QUIC ENGINE (`sentinel_parser::h3` & `sentinel_proxy::quic`)                 │
│     ├── H3FrameCodec: RFC 9114 Frame types (DATA, HEADERS, SETTINGS, GOAWAY) + RFC 9000 Varints │
│     ├── QpackCodec: RFC 9204 Static Table (99 entries) & dynamic table literal decoder          │
│     ├── QuicProxyServer: UDP socket listener + ALPN "h3" + Quinn Endpoint                       │
│     └── ScopeEnforcedQuicHandler: SEC-01 Pre-socket check -> Dynamic TLS -> Upstream QUIC Client│
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 OpenAPI 3.1 Parser & Fuzzer Specification (`sentinel_api::openapi`)

#### A. JSON Schema & `$ref` Pointer Resolution Architecture
OpenAPI 3.1 adopts full JSON Schema 2020-12 compatibility. The pointer resolver must support:
1. **URI / Fragment Normalization**: Parse RFC 6901 JSON Pointers (`#/components/schemas/Pet`, `#/$defs/User/properties/address`).
2. **Cycle & Recursion Guard**: Track visited pointer paths in a resolution stack (`HashSet<String>`) to detect circular definitions (e.g. `Node -> children -> Node`) and prevent stack overflow.
3. **Local and External Pointer Resolvers**:
   - `resolve_local(&self, root: &Value, pointer: &str) -> Result<Value, OpenApiError>`
   - `resolve_external(&self, base_uri: &str, ref_path: &str) -> Result<Value, OpenApiError>`
4. **Keyword Expansion**: Merge `$ref` target with in-place sibling keywords per JSON Schema 2020-12 (e.g., `$ref` with local `description` or `title` overrides).

```rust
pub struct JsonPointerResolver {
    root_doc: serde_json::Value,
    external_docs: HashMap<String, serde_json::Value>,
    max_depth: usize,
}

impl JsonPointerResolver {
    pub fn new(root_doc: serde_json::Value) -> Self {
        Self {
            root_doc,
            external_docs: HashMap::new(),
            max_depth: 64,
        }
    }

    pub fn resolve_ref(&self, ref_str: &str, visited: &mut HashSet<String>) -> Result<serde_json::Value, SentinelError> {
        if visited.contains(ref_str) {
            return Ok(serde_json::json!({ "type": "circular_ref_stub", "$ref": ref_str }));
        }
        visited.insert(ref_str.to_string());

        if let Some(fragment) = ref_str.strip_prefix('#') {
            self.resolve_fragment(&self.root_doc, fragment)
        } else if ref_str.contains('#') {
            let parts: Vec<&str> = ref_str.split('#').collect();
            let doc = self.external_docs.get(parts[0])
                .ok_or_else(|| SentinelError::parse_error(format!("External ref doc not loaded: {}", parts[0])))?;
            self.resolve_fragment(doc, parts[1])
        } else {
            self.external_docs.get(ref_str).cloned()
                .ok_or_else(|| SentinelError::parse_error(format!("External ref not found: {}", ref_str)))
        }
    }

    fn resolve_fragment(&self, doc: &serde_json::Value, fragment: &str) -> Result<serde_json::Value, SentinelError> {
        let tokens: Vec<String> = fragment
            .split('/')
            .filter(|s| !s.is_empty())
            .map(|s| s.replace("~1", "/").replace("~0", "~"))
            .collect();

        let mut curr = doc;
        for token in tokens {
            if let Some(obj) = curr.as_object() {
                curr = obj.get(&token).ok_or_else(|| {
                    SentinelError::parse_error(format!("Pointer token '{}' not found in document", token))
                })?;
            } else if let Some(arr) = curr.as_array() {
                let idx: usize = token.parse().map_err(|_| {
                    SentinelError::parse_error(format!("Invalid array index '{}' in pointer", token))
                })?;
                curr = arr.get(idx).ok_or_else(|| {
                    SentinelError::parse_error(format!("Array index {} out of bounds", idx))
                })?;
            } else {
                return Err(SentinelError::parse_error(format!("Cannot traverse primitive with token '{}'", token)));
            }
        }
        Ok(curr.clone())
    }
}
```

#### B. Route and Parameter Template Extraction
The parser must extract:
- **Path Templates**: e.g., `/api/v1/organizations/{org_id}/users/{user_id}`.
- **Parameters**: `in: "path"`, `in: "query"`, `in: "header"`, `in: "cookie"`.
- **Request Body Schemas**: `requestBody.content."application/json".schema` with full resolution of nested object properties, arrays, and primitive formats.
- **Security Schemes**: Extract required `apiKey`, `http` (Bearer/Basic), `oauth2`, or `openIdConnect`.

#### C. Spec-Driven Fuzzing Engine Matrix
Generate comprehensive security fuzz suites based on extracted schema metadata:

| Attack Vector | Fuzz Payload Strategy | Target Schema Keyword | Expected Boundary |
|---|---|---|---|
| **Required Parameter Omission** | Drop mandatory query, path, or body parameters | `required: true` | `400 Bad Request` |
| **Type Confusion Injection** | Inject string `["abc"]` into integer; inject nested object `{}` into string; inject boolean `true` into array | `type: "integer" \| "string" \| "array"` | `400 / 422 Unprocessable` |
| **Numeric Boundary Overflow** | Pass `i64::MAX + 1`, `i64::MIN - 1`, `maximum + 1`, `minimum - 1`, `-0`, `NaN`, `Infinity` | `minimum`, `maximum`, `format: int32/int64` | `400 Bad Request` |
| **String Constraints & Regex Bypass** | `""` (empty string for `minLength > 0`), strings exceeding `maxLength` ($10^5$ bytes), regex inversion payloads | `minLength`, `maxLength`, `pattern` | `400 Bad Request` |
| **Enum Violation & Case Sensitivity** | Generate invalid enum strings, lowercase/uppercase mutation, Unicode lookalikes | `enum: [...]` | `400 Bad Request` |
| **Mass Assignment & Prototype Pollution** | Inject `{"__proto__": {"admin": true}}`, `{"constructor": {"prototype": {"role": "admin"}}}`, `{"role": "admin"}` | Request body object schemas | `400 / Ignored` |
| **Format Violation** | Malformed UUIDs, non-RFC5322 emails, non-ISO8601 dates, path traversal strings in URI formats | `format: "uuid" \| "email" \| "uri"` | `400 Bad Request` |

---

### 2.2 gRPC Reflection v1 Engine Specification (`sentinel_api::grpc`)

#### A. Protocol Mechanics & Reflection v1 Handshake
gRPC Server Reflection allows clients to discover services without pre-compiled `.proto` files:
1. Client establishes an HTTP/2 gRPC bidirectional streaming connection to `/grpc.reflection.v1.ServerReflection/ServerReflectionInfo` (with fallback to `/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo`).
2. Client sends a `ServerReflectionRequest`:
   - `list_services: ""` (request list of all registered services).
3. Server responds with `ServerReflectionResponse`:
   - `list_services_response`: list of service names (e.g., `pkg.UserService`, `pkg.PaymentService`).
4. For each discovered service, client requests full file descriptor descriptors:
   - `file_containing_symbol: "pkg.UserService"`.
5. Server responds with raw `FileDescriptorProto` serialized byte chunks (`file_descriptor_response.file_descriptor_proto`).

#### B. Dynamic Schema Reconstruction via `prost-reflect`
1. Collect all `FileDescriptorProto` byte slices from responses.
2. Build a dynamic `prost_reflect::DescriptorPool`:
   ```rust
   use prost_reflect::{DescriptorPool, DynamicMessage, MessageDescriptor, ServiceDescriptor};
   use prost_types::FileDescriptorSet;

   pub struct GrpcReflectionClient {
       descriptor_pool: DescriptorPool,
   }

   impl GrpcReflectionClient {
       pub fn new() -> Self {
           Self {
               descriptor_pool: DescriptorPool::new(),
           }
       }

       pub fn load_file_descriptor_protos(&mut self, protos: &[Vec<u8>]) -> Result<(), SentinelError> {
           let mut file_set = FileDescriptorSet::default();
           for p in protos {
               let file_desc = prost_types::FileDescriptorProto::decode(p.as_slice())
                   .map_err(|e| SentinelError::parse_error(format!("Failed to decode FileDescriptorProto: {}", e)))?;
               file_set.file.push(file_desc);
           }
           self.descriptor_pool.add_file_descriptor_set(file_set)
               .map_err(|e| SentinelError::parse_error(format!("Failed to build DescriptorPool: {}", e)))?;
           Ok(())
       }

       pub fn get_service(&self, service_name: &str) -> Option<ServiceDescriptor> {
           self.descriptor_pool.get_service_by_name(service_name)
       }

       pub fn create_dynamic_message(&self, message_type_name: &str, json_data: &serde_json::Value) -> Result<DynamicMessage, SentinelError> {
           let message_desc = self.descriptor_pool.get_message_by_name(message_type_name)
               .ok_or_else(|| SentinelError::parse_error(format!("Message type '{}' not found in pool", message_type_name)))?;
           
           let mut dyn_msg = DynamicMessage::new(message_desc);
           dyn_msg.transcode_from_json(json_data)
               .map_err(|e| SentinelError::parse_error(format!("JSON to Protobuf transcoding failed: {}", e)))?;
           Ok(dyn_msg)
       }
   }
   ```

#### C. gRPC Method Replay, Wire Framing & Security Fuzzing
- **Frame Assembly**: Encode `DynamicMessage::encode_to_vec()` into standard 5-byte length-prefixed frame:
  `[0x00 (Compression Flag)] + [4-byte Big-Endian Length] + [Protobuf binary payload]`.
- **Wire Protocol Fuzzing Vectors**:
  1. **Varint Overflows**: 64-bit integer values with MSB continuation bits (`0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F`) testing Protobuf varint decoder limits.
  2. **Unknown Tag Injection**: Injecting wire types `0` (varint), `1` (64-bit), `2` (length-delimited), and `5` (32-bit) with high tag numbers ($> 2^{19}$) to test unhandled field memory growth.
  3. **Recursion Depth Exhaustion**: Deeply nested length-delimited sub-messages (depth $> 100$) to trigger stack overflow in native C++/Go/Rust gRPC runtimes.
  4. **String & Bytes Memory Bombs**: Length-delimited string fields with declared length $2^{31}-1$ bytes to trigger heap allocation panics.

---

### 2.3 GraphQL AST Complexity & Introspection Engine Specification (`sentinel_api::graphql`)

#### A. GraphQL AST Parser & Lexer
Replace brittle curly-brace regexes with full AST parsing:
- Represent GraphQL documents as AST Nodes: `Document`, `OperationDefinition` (Query, Mutation, Subscription), `SelectionSet`, `Field`, `InlineFragment`, `FragmentSpread`, `Argument`, `Directive`, `Variable`.
- Parse variables and directives (`@skip(if: ...)`, `@include(if: ...)`).

#### B. AST Complexity Score Calculation Formula
The complexity of a GraphQL query is computed recursively over the AST using configurable weights:

$$\text{Complexity}(N) = \text{FieldWeight}(N) + \text{Multiplier}(N) \times \sum_{C \in \text{Children}(N)} \text{Complexity}(C)$$

Where:
- $\text{FieldWeight}(N) = 1.0$ (Scalar field default)
- Object fields default to $2.0$.
- Multiplier $\text{Multiplier}(N)$ is extracted from arguments:
  - `limit: N`, `first: N`, `count: N`, `pageSize: N` $\implies \text{Multiplier} = N$.
  - If argument is missing, defaults to default list multiplier (e.g., $10.0$).
- Directives: `@include(if: false)` or `@skip(if: true)` evaluate to $0.0$ if static constant.

```rust
pub struct GraphQlComplexityCalculator {
    pub scalar_cost: u32,
    pub object_cost: u32,
    pub default_list_multiplier: u32,
}

impl Default for GraphQlComplexityCalculator {
    fn default() -> Self {
        Self {
            scalar_cost: 1,
            object_cost: 2,
            default_list_multiplier: 10,
        }
    }
}

impl GraphQlComplexityCalculator {
    pub fn calculate_query_complexity(&self, query_ast: &GraphQlAstNode) -> u64 {
        self.compute_node_cost(query_ast)
    }

    fn compute_node_cost(&self, node: &GraphQlAstNode) -> u64 {
        match node {
            GraphQlAstNode::ScalarField { .. } => self.scalar_cost as u64,
            GraphQlAstNode::ObjectField { children, multiplier, .. } => {
                let mult = multiplier.unwrap_or(1) as u64;
                let child_sum: u64 = children.iter().map(|c| self.compute_node_cost(c)).sum();
                (self.object_cost as u64) + (mult * child_sum)
            }
            GraphQlAstNode::ListField { children, multiplier, .. } => {
                let mult = multiplier.unwrap_or(self.default_list_multiplier) as u64;
                let child_sum: u64 = children.iter().map(|c| self.compute_node_cost(c)).sum();
                (self.object_cost as u64) + (mult * child_sum)
            }
            GraphQlAstNode::Operation { selection_set, .. } => {
                selection_set.iter().map(|s| self.compute_node_cost(s)).sum()
            }
        }
    }
}
```

#### C. Schema-Aware Circular Query & Recursion Generator
1. **Type Dependency Graph**: Construct a directed graph $G = (V, E)$ from the introspection schema where vertices $V$ are object types and directed edges $(T_1, T_2) \in E$ represent fields on type $T_1$ that return type $T_2$.
2. **Cycle Finding**: Find elementary cycles using Tarjan's strongly connected components or DFS (e.g. `User.posts -> Post.author -> User`).
3. **Payload Synthesizer**: Given a cycle $T_1 \to T_2 \to \dots \to T_1$ and desired depth $D$, synthesize the nested recursive GraphQL document:
   ```graphql
   query DeepCircularExhaustion {
     user(id: "1") {
       posts {
         author {
           posts {
             author {
               posts {
                 author {
                   id
                 }
               }
             }
           }
         }
       }
     }
   }
   ```

#### D. Batching & DoS Probing Suite
1. **JSON Array Batching**: Send array of $N$ operations (`[{"query": "query A {...}"}, {"query": "query B {...}"}]`). Tests if backend executes queries in parallel without global rate limiting.
2. **Aliased Query Batching**: Pack $N$ distinct queries into a single query body:
   ```graphql
   query AliasedBatch {
     a1: user(id: "1") { id email }
     a2: user(id: "2") { id email }
     a3: user(id: "3") { id email }
     ...
     a100: user(id: "100") { id email }
   }
   ```
3. **Field Suggestion Harvester**: Automatically parse error responses containing `Did you mean "..."?` suggestions to brute-force and map hidden admin fields and private schemas when full introspection is disabled.

---

### 2.4 Native HTTP/3 QUIC Specification (`sentinel_parser` & `sentinel_proxy`)

#### A. HTTP/3 Binary Frame & QUIC Varint Codec (`sentinel_parser::h3`)
Per RFC 9114 and RFC 9000:
1. **QUIC Variable-Length Integer Encoding (RFC 9000 §16)**:
   - 2-bit prefix:
     - `00`: 1 byte (0 to 63 / $2^6 - 1$)
     - `01`: 2 bytes (0 to 16,383 / $2^{14} - 1$)
     - `10`: 4 bytes (0 to 1,073,741,823 / $2^{30} - 1$)
     - `11`: 8 bytes (0 to 4,611,686,018,427,387,903 / $2^{62} - 1$)

```rust
pub struct QuicVarint;

impl QuicVarint {
    pub fn decode(bytes: &[u8]) -> Result<(u64, usize), ParserError> {
        if bytes.is_empty() {
            return Err(ParserError::UnexpectedEof);
        }
        let first = bytes[0];
        let prefix = first >> 6;
        let len = 1 << prefix; // 1, 2, 4, 8 bytes

        if bytes.len() < len {
            return Err(ParserError::IncompletePayload);
        }

        let mut val = (first & 0x3F) as u64;
        for i in 1..len {
            val = (val << 8) | (bytes[i] as u64);
        }
        Ok((val, len))
    }

    pub fn encode(mut val: u64, buf: &mut Vec<u8>) -> Result<usize, ParserError> {
        if val < 64 {
            buf.push(val as u8);
            Ok(1)
        } else if val < 16384 {
            buf.push(0x40 | ((val >> 8) as u8));
            buf.push((val & 0xFF) as u8);
            Ok(2)
        } else if val < 1073741824 {
            buf.push(0x80 | ((val >> 24) as u8));
            buf.push(((val >> 16) & 0xFF) as u8);
            buf.push(((val >> 8) & 0xFF) as u8);
            buf.push((val & 0xFF) as u8);
            Ok(4)
        } else if val < 4611686018427387904 {
            buf.push(0xC0 | ((val >> 56) as u8));
            for shift in (0..7).rev() {
                buf.push(((val >> (shift * 8)) & 0xFF) as u8);
            }
            Ok(8)
        } else {
            Err(ParserError::InvalidInteger("QUIC Varint exceeds 62 bits".to_string()))
        }
    }
}
```

2. **HTTP/3 Frame Framing (RFC 9114 §7.2)**:
   - Frame Header: `Frame Type (QUIC Varint)` + `Length (QUIC Varint)` + `Payload (bytes)`.
   - Frame Types:
     - `0x00`: `DATA`
     - `0x01`: `HEADERS`
     - `0x03`: `CANCEL_PUSH`
     - `0x04`: `SETTINGS`
     - `0x05`: `PUSH_PROMISE`
     - `0x07`: `GOAWAY`
     - `0x0D`: `MAX_PUSH_ID`

3. **QPACK Header Decompression (RFC 9204)**:
   - Static table containing 99 standard header field entries.
   - Literal header fields with static name reference or literal strings (Huffman encoded or raw bytes).
   - Bidirectional conversion between `ParsedRequest` / `ParsedResponse` $\longleftrightarrow$ `H3Frame` stream.

#### B. QUIC Proxy Server & ALPN `h3` MITM Engine (`sentinel_proxy::quic`)
1. **UDP Socket Listener**: Initialize `quinn::Endpoint` bound to configured UDP address/port.
2. **ALPN Negotiation**: Negotiate `alpn_protocols = vec![b"h3".to_vec(), b"h3-29".to_vec()]`.
3. **Dynamic TLS 1.3 Certificate Generation**: Intercept incoming client QUIC handshake, extract SNI, query `TlsServerConfigCache` for certificate generated by `RootCA`, and complete QUIC handshake.
4. **SEC-01 Scope Enforcement Gate**:
   - Before initializing upstream QUIC connection to target UDP socket, evaluate `ScopeEngine::is_in_scope(&target_uri)`.
   - If denied: immediately terminate connection with `H3_REQUEST_REJECTED` / `403 Forbidden` and emit `CriticalEvent::ScopeViolationAttempt` to `sentinel_bus` (SEC-12).
5. **Bidirectional Stream Processing**:
   - Client sends bidirectional QUIC stream.
   - Proxy decodes QPACK headers and data frames into `ParsedRequest`.
   - Passes through `InterceptorPipeline` (request interception, modification, drop, or synthetic response).
   - Establishes upstream QUIC connection via `quinn::Endpoint` client with SEC-01 scope checks.
   - Reads upstream HTTP/3 response, passes through response interceptor pipeline, and streams back to client.
   - Dual-writes transaction to SQLite WAL and CAS blob store (SEC-07/SEC-08).

---

## 3. Caveats

1. **QUIC UDP Network Topologies**: In certain testbed or containerized environments, UDP packets or QUIC traffic may be blocked by corporate firewalls or VPNs. The proxy must provide automatic fallback to HTTP/2 and HTTP/1.1 over TCP when UDP ports are unreachable.
2. **gRPC Reflection Disablement**: Target production servers may have gRPC Server Reflection disabled. In this case, the gRPC engine must support fallback to manual `.proto` file import while retaining dynamic message encoding and wire framing capabilities.
3. **External `$ref` Remote Fetching**: In offline, air-gapped, or strictly scope-isolated pentesting environments, external `$ref` pointers with remote HTTP/HTTPS URIs should not make un-gated network requests. All external schema fetching must pass through `ScopeEngine` (SEC-01) or be pre-loaded from local files.

---

## 4. Conclusion

Subsystem B provides the complete modern Protocol & API security engine for SENTINEL V6:
1. **OpenAPI 3.1 & JSON Schema**: Full `$ref` pointer resolution (local, remote, cycle-guarded), detailed route/parameter extraction, and spec-driven vulnerability fuzz suites.
2. **gRPC Reflection v1**: `prost-reflect` dynamic message builder, `ServerReflection` v1/v1alpha stream decoder, JSON $\leftrightarrow$ Protobuf transcoding, and wire-level varint fuzzing.
3. **GraphQL AST Analysis**: AST complexity calculation with list multipliers, recursion cycle detection, circular DoS generators, array/alias batching, and field suggestion harvesting.
4. **Native HTTP/3 QUIC**: RFC 9114 binary framing, RFC 9000 QUIC varints, RFC 9204 QPACK decompression, Quinn UDP server/client, ALPN `h3`, and SEC-01 fail-closed scope enforcement.

### Updated Module Structure
```
sentinel_core/crates/sentinel_api/
├── Cargo.toml (dependencies: prost-reflect, openapiv3/serde_json, graphql-parser)
├── src/
│   ├── lib.rs
│   ├── openapi.rs (OpenAPI 3.1 & JSON Schema 2020-12 resolver, route extractor, fuzz suite generator)
│   ├── grpc.rs (gRPC Reflection v1, prost-reflect DynamicMessage builder, varint fuzzer)
│   ├── graphql.rs (GraphQL AST complexity, depth bounding, cycle detection, batching probes)
│   └── websocket.rs (RFC 6455 frame parser, encoder, CSWSH evaluation)
└── tests/
    └── api_tests.rs (Exhaustive unit & integration test suites for all 4 subsystems)

sentinel_core/crates/sentinel_parser/
├── src/
│   ├── lib.rs
│   ├── h2.rs
│   ├── h3.rs (HTTP/3 frames, QUIC Varints, QPACK decoder)
│   └── types.rs

sentinel_core/crates/sentinel_proxy/
├── Cargo.toml (dependencies: quinn, h3, h3-quinn)
├── src/
│   ├── lib.rs
│   ├── server.rs
│   ├── handler.rs
│   ├── quic.rs (Quinn UDP endpoint, ALPN h3 negotiation, QUIC MITM stream handler)
│   └── tls/
```

---

## 5. Verification Method

To independently verify the Subsystem B architecture, specifications, and implementations:

### 5.1 Verification Commands
1. **Workspace Compilation**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo check --workspace --locked
   ```
2. **Crate-Specific Unit & Integration Tests**:
   ```bash
   cargo test -p sentinel_api --lib --tests
   cargo test -p sentinel_parser --lib --tests
   cargo test -p sentinel_proxy --lib --tests
   ```
3. **Full Workspace Regression & Linter**:
   ```bash
   cargo clippy --workspace --all-targets -- -D warnings
   cargo test --workspace --locked
   ```
4. **Canonical Specification Validator**:
   ```bash
   python architecture/v6/validate_v6_spec.py
   ```

### 5.2 Specific Test Cases to Inspect
- `sentinel_api/tests/api_tests.rs`:
  - `test_openapi_31_ref_resolution_local_and_nested`: Verifies `#/$defs/User` and `#/components/schemas/...` pointer resolution with cycle detection.
  - `test_openapi_spec_driven_fuzz_generation`: Verifies required omission, type mismatch, boundary underflow/overflow, and enum violation generation.
  - `test_grpc_dynamic_message_and_reflection_decoding`: Verifies `prost-reflect` `DescriptorPool` assembly and JSON $\leftrightarrow$ Protobuf serialization.
  - `test_graphql_ast_complexity_and_circular_cycles`: Verifies AST complexity scoring with list multipliers (`first: 50`) and circular type cycle generation (`User -> Post -> User`).
  - `test_http3_quic_varint_and_frame_codec`: Verifies QUIC Varint encoding/decoding (1, 2, 4, 8 bytes) and HTTP/3 DATA/HEADERS framing.

### 5.3 Invalidation Conditions
- Any occurrence of stack overflow on circular `$ref` schemas or recursive GraphQL types.
- Any bypass of SEC-01 scope gate on UDP QUIC socket initialization.
- Any reliance on brittle string/regex heuristics for GraphQL depth calculation instead of structured AST parsing.
