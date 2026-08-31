# Expanded Modern Ingress Surfaces & Transport Topologies (14 Formats)

**Document Identifier:** SENTINEL-RES-SURF-EXP-04  
**Classification:** Transport Layer Protocols, API Gateways & Serialization Analysis  

---

## 1. Multi-Surface Transport Topology

Modern web applications ingest untrusted data through a wide variety of protocols, serialization formats, and asynchronous pipelines before translating them into backend SQL commands:

```
                                INGRESS TRANSPORT SURFACES
                                             │
    ┌──────────────────────┬─────────────────┼─────────────────┬──────────────────────┐
    ▼                      ▼                 ▼                 ▼                      ▼
[Standard HTTP]        [Modern API]      [Headers & Auth]   [Clean URL Paths]      [Async Pipelines]
- URL Query Params     - Flat JSON Body  - Client Cookies   - REST Path Segments   - Kafka Topics
- Form URL-Encoded     - Nested Objects  - X-Forwarded-For  - UUID / Slug Routing  - RabbitMQ Payloads
- Multipart Streams    - GraphQL Vars    - JWT Claims       - Regex Route Params   - Celery Worker Jobs
- XML / SOAP Envelopes - JSON-RPC / gRPC - Gateway Headers  - Subdomain Routes     - EventBridge Events
```

---

## 2. Comprehensive 14-Surface Inventory & Analysis

| Surface ID | Ingress Format | Serialization / Protocol | Parser & Decoder Behavior | Typical Backend Query Pattern | Common Testing Pitfalls |
|:---|:---|:---|:---|:---|:---|
| **`SURF-01`** | URL Query Parameter | `application/x-www-form-urlencoded` | URL-decoded once by web server (e.g. Nginx, Apache). | Filtering (`WHERE cat = ?`), Sorting (`ORDER BY ?`), Pagination. | WAFs heavily inspect standard query string buffers. |
| **`SURF-02`** | Form URL-Encoded Body | `application/x-www-form-urlencoded` | POST request body stream parsed into key-value pairs. | Form submissions, login POSTs, profile updates. | Content-Length header must match modified byte length. |
| **`SURF-03`** | Flat JSON Body | `application/json` | JSON unmarshaled into native primitives (string, number). | REST API CRUD endpoints (`POST /api/items`). | Unescaped quotes break JSON parser with `400 Bad Request`. |
| **`SURF-04`** | Deeply Nested JSON | `application/json` | Nested objects (`{"where": {"user": {"name": ...}}}`). | Dynamic ORM filter builders (Sequelize, Prisma, TypeORM). | Object injection (`{"$gt": ""}`) altering relational logic. |
| **`SURF-05`** | JSON Array Elements | `application/json` | Array lists (`{"ids": [1, 2, "3'--"]}`). | `IN (...)` list expressions or batch updates. | Heterogeneous type validation in strongly-typed models. |
| **`SURF-06`** | Multipart Form-Data | `multipart/form-data; boundary=--xyz` | Stream MIME parts; filename attributes and form fields. | File uploads, attachment metadata logging. | Malformed boundary framing aborts request processing. |
| **`SURF-07`** | XML / SOAP Body | `application/xml`, `text/xml` | XML DOM / SAX parser unmarshaling tags into objects. | Legacy enterprise APIs, payment gateway webhooks. | XML entity encoding (`&quot;`, `&#39;`) before SQL layer. |
| **`SURF-08`** | HTTP Cookie Header | `Cookie: key=val; Session=xyz` | Web server splits on `;` and URL-decodes values. | Session verification, tracking cookies, user preferences. | Often excluded from default WAF rule inspections. |
| **`SURF-09`** | Custom HTTP Headers | `X-Forwarded-For`, `User-Agent`, `Client-IP` | Raw header string passed into request handler. | Security audit logs, analytics, geo-IP lookup tables. | Developers falsely assume headers are trusted server data. |
| **`SURF-10`** | REST Path Parameters | `GET /api/v1/users/{id}/orders` | Router matches regex path segments into controller variables. | Entity retrieval by primary key or slug (`WHERE id = ?`). | URL path segment encoding (`/` and `%2F` routing conflicts). |
| **`SURF-11`** | GraphQL Variables | `POST /graphql {"query": "...", "variables": {...}}` | GraphQL engine parses JSON variables into resolver arguments. | Resolvers compiling dynamic SQL joins and filters. | Must maintain valid GraphQL JSON syntax and variable schema. |
| **`SURF-12`** | JSON-RPC & gRPC-Web | HTTP/2 JSON transcoding (`grpc-web-text`) | Gateway translates protobuf/JSON-RPC into internal calls. | Microservice internal database coordinators. | Gateway binary envelope encoding masking raw SQL tokens. |
| **`SURF-13`** | WebSocket Frames | WS / WSS Text & Binary frames | Persistent bidirectional message socket stream. | Live chat messaging, collaborative editing, trading platforms.| Asynchronous frame responses require correlation IDs. |
| **`SURF-14`** | Async Message Queue | RabbitMQ, Apache Kafka, Celery | Asynchronous message broker queues payload for worker. | Background report generation, bulk email dispatch, cron jobs. | Response returns `202 Accepted`; SQL executes asynchronously. |
