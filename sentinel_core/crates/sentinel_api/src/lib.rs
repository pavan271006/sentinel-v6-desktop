//! SENTINEL V6: API Security Subsystem (WP-10.1 / Professional Tier)
//!
//! Provides OpenAPI / Swagger route ingestion & spec-driven fuzzing,
//! GraphQL depth / introspection analysis / query batching DoS probing,
//! WebSocket RFC 6455 framing & CSWSH testing, and gRPC protobuf wire protocol handling.

pub mod graphql;
pub mod grpc;
pub mod openapi;
pub mod websocket;

pub use graphql::{
    GraphQlArgument, GraphQlAstParser, GraphQlBatchProbe, GraphQlComplexityCalculator,
    GraphQlComplexityConfig, GraphQlCycleDetector, GraphQlDirective, GraphQlDocument, GraphQlEngine,
    GraphQlField, GraphQlOperation, GraphQlOperationType, GraphQlSelection,
    GraphQlVulnerabilityFinding,
};
pub use grpc::{
    decode_varint, encode_varint, DynamicMessage, GrpcEngine, GrpcMessageFrame, GrpcServiceInfo,
    ProtobufValue, ProtobufWireType,
};
pub use openapi::{
    JsonPointerResolver, OpenApiEndpointSchema, OpenApiParameter, OpenApiParser, SpecDrivenFuzzCase,
};
pub use websocket::{CswshFinding, CswshProbe, WebSocketParser, WsFrame, WsOpcode};
