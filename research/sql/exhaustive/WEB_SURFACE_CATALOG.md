# Web Application Surface & Ingress Catalog (18 Formats)

**Document Identifier:** SENTINEL-EXH-SURF-08  
**Classification:** Serialization Protocols, API Transport Formats & Ingress Boundary Analysis  

---

## 1. Multi-Tier Ingress Surface Topology

```
                                  18 INGRESS SURFACES
                                           │
    ┌──────────────────────┬───────────────┼───────────────┬──────────────────────┐
    ▼                      ▼               ▼               ▼                      ▼
[Standard Web Formats] [Modern API Protocols] [Headers & Identity] [Clean URL Paths]  [Asynchronous Queues]
• SURF-01: URL Query   • SURF-05: Flat JSON   • SURF-10: Cookies   • SURF-13: REST Path• SURF-18: Kafka / Celery
• SURF-02: Form Body   • SURF-06: Nested JSON • SURF-11: Std Header• SURF-14: GraphQL   (Asynchronous worker)
• SURF-03: Multipart   • SURF-07: JSON Array  • SURF-12: Gateways  • SURF-15: GraphQL Args
• SURF-04: Filename    • SURF-08: XML / SOAP                       • SURF-16: gRPC Transcoding
                                                                   • SURF-17: WebSockets
```

---

## 2. In-Depth Surface Specifications & Injection Rules

| Surface ID | Ingress Format | Protocol / MIME Type | Decoding & Normalization Layers | Backend Query Flow Pattern | Key Security & Parsing Considerations |
|:---|:---|:---|:---|:---|:---|
| **`SURF-01`** | URL Query Parameter | `application/x-www-form-urlencoded` | URL-decoded by web server (Nginx/Apache). | Filtering (`WHERE cat = ?`), Sorting (`ORDER BY ?`), Pagination. | WAFs inspect raw query string before secondary decoding. |
| **`SURF-02`** | Form URL-Encoded Body | `application/x-www-form-urlencoded` | Body stream parsed into key-value map. | Login POSTs, profile updates, form submissions. | Content-Length must match modified payload byte length. |
| **`SURF-03`** | Multipart Form Field | `multipart/form-data; boundary=--b` | MIME multipart stream parser. | File upload metadata, multi-field forms. | Must maintain valid multipart boundary structure. |
| **`SURF-04`** | Multipart Filename | `multipart/form-data` | MIME `filename="..."` attribute extracted. | File storage audit logs, document indexing. | Filename header injection escaping quote boundaries. |
| **`SURF-05`** | Flat JSON Body | `application/json` | JSON unmarshaled into native primitives. | REST API CRUD endpoints (`POST /api/items`). | Unescaped quotes trigger JSON parser `400 Bad Request`. |
| **`SURF-06`** | Deeply Nested JSON | `application/json` | JSON recursive dictionary unmarshaling. | Dynamic ORM filter builders (Sequelize, Prisma, TypeORM). | Object parameter tampering (`{"$gt": ""}`) altering relational logic. |
| **`SURF-07`** | JSON Array Elements | `application/json` | JSON array list (`{"ids": [1, "2'--"]}`). | SQL `IN (...)` tuple lists, bulk update queries. | Heterogeneous typing in dynamic query builders. |
| **`SURF-08`** | XML / SOAP Element Body | `application/xml`, `text/xml` | XML DOM / SAX parser. | Legacy enterprise APIs, payment webhooks. | XML entity encoding (`&quot;`, `&#39;`) before SQL layer. |
| **`SURF-09`** | XML Attribute Value | `application/xml` | XML attribute string parser. | Configuration XML files, SOAP envelopes. | Attribute quote escaping requirements. |
| **`SURF-10`** | HTTP Cookie Header | `Cookie: key=val; Session=xyz` | Web server splits on `;` and URL-decodes. | Session verification, tracking cookies, user preferences. | Often excluded from default WAF rule inspections. |
| **`SURF-11`** | Standard HTTP Headers | `User-Agent`, `Referer`, `X-Forwarded-For` | Raw header string passed into request context. | Security audit logs, analytics, geo-IP lookups. | Developers falsely assume headers are trusted server data. |
| **`SURF-12`** | Custom Gateway Headers | `X-Consumer-ID`, `X-Tenant-Slug` | Injected by API gateways (Kong, Apigee, Envoy).| Multi-tenant routing, internal authorization checks. | Header injection via upstream proxy trust spoofing. |
| **`SURF-13`** | REST Clean Path Segment | `GET /api/v1/users/{id}/details` | Router matches regex path segments into variables. | Entity retrieval by primary key or slug (`WHERE id = ?`). | Path segment URL-encoding (`/` vs `%2F` router collisions). |
| **`SURF-14`** | GraphQL Variables JSON | `POST /graphql {"query": "...", "variables": {...}}` | GraphQL engine parses JSON variables into resolvers. | Resolvers compiling dynamic SQL joins and filters. | Must maintain valid GraphQL JSON syntax and variable types. |
| **`SURF-15`** | GraphQL Field Arguments | `query { user(id: "1'--") { name } }` | GraphQL lexer tokenizes inline query string. | Direct resolver field lookup queries. | Inline string literal escaping within GraphQL query document. |
| **`SURF-16`** | gRPC-Web / Transcoding | `application/grpc-web-text`, HTTP/2 JSON | Envoy / gRPC gateway transcode to Protobuf. | Internal microservice database coordinators. | Gateway binary envelope encoding masking raw SQL tokens. |
| **`SURF-17`** | WebSocket Text Frames | WS / WSS Text & Binary frames | Persistent bidirectional message socket stream. | Live chat messaging, collaborative editing, trading. | Asynchronous frame responses require correlation IDs. |
| **`SURF-18`** | Async Message Queue | RabbitMQ, Apache Kafka, Celery | Message broker queues payload for worker thread. | Background report generation, bulk email, cron jobs. | Response returns `202 Accepted`; SQL executes asynchronously. |
