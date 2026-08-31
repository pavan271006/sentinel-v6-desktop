# Validated Web Application Surface Catalog V2 (14 Formats)

**Document Reference:** SENTINEL-V2-SURF-12  
**Classification:** Serialization Protocols, API Transport Envelopes & Ingress Layer Analysis  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Multi-Surface Ingress Topology

Transport surfaces define the **network serialization format** where untrusted input enters the application before unmarshaling into SQL query builders:

```
                              14 INGRESS TRANSPORT SURFACES
                                            │
    ┌──────────────────────┬────────────────┼────────────────┬──────────────────────┐
    ▼                      ▼                ▼                ▼                      ▼
[Standard Web Formats] [Modern API Protocols] [Headers & Identity] [Clean URL Paths]  [Asynchronous Queues]
• SURF-01: URL Query   • SURF-05: Flat JSON   • SURF-09: Cookies   • SURF-11: REST Path• SURF-14: Kafka / Celery
• SURF-02: Form Body   • SURF-06: Nested JSON • SURF-10: Gateways  • SURF-12: GraphQL
• SURF-03: Multipart   • SURF-07: JSON Array                       • SURF-13: WebSockets
• SURF-04: Filename    • SURF-08: XML / SOAP
```

---

## 2. Comprehensive 14-Surface Inventory & Analysis

| Surface ID | Ingress Format | Serialization / MIME Type | Parsing & Normalization Layer | Backend Query Flow Pattern | Key Security & Detection Invariants | Evidence |
|:---|:---|:---|:---|:---|:---|:---|
| **`SURF-01`** | URL Query Parameter | `application/x-www-form-urlencoded` | URL-decoded once by web server (Nginx/Apache). | Filtering (`WHERE cat = ?`), Sorting (`ORDER BY ?`). | WAFs inspect raw query string before secondary decoding. | **`E5`** |
| **`SURF-02`** | Form URL-Encoded Body | `application/x-www-form-urlencoded` | POST request body stream parsed into key-value map. | Login POSTs, profile updates, form submissions. | Content-Length header must match modified byte length. | **`E5`** |
| **`SURF-03`** | Multipart Form Field | `multipart/form-data; boundary=--b` | Stream MIME parts parser. | File upload metadata, multi-field forms. | Must maintain valid multipart boundary framing. | **`E5`** |
| **`SURF-04`** | Multipart Filename | `multipart/form-data` | MIME `filename="..."` attribute extracted. | File storage audit logs, document indexing. | Filename header quote breakout. | **`E5`** |
| **`SURF-05`** | Flat JSON Body | `application/json` | JSON unmarshaled into native primitives. | REST API CRUD endpoints (`POST /api/items`). | Unescaped quotes break JSON parser with `400 Bad Request`. | **`E5`** |
| **`SURF-06`** | Deeply Nested JSON | `application/json` | JSON recursive dictionary unmarshaling. | Dynamic ORM filter builders (Sequelize, Prisma, TypeORM). | Object parameter tampering (`{"$gt": ""}`) altering relational logic. | **`E5`** |
| **`SURF-07`** | JSON Array Elements | `application/json` | JSON array list (`{"ids": [1, "2'--"]}`). | SQL `IN (...)` tuple lists, bulk update queries. | Heterogeneous typing in dynamic query builders. | **`E5`** |
| **`SURF-08`** | XML / SOAP Body | `application/xml`, `text/xml` | XML DOM / SAX parser unmarshaling tags. | Legacy enterprise APIs, payment webhooks. | XML entity encoding (`&quot;`, `&#39;`) before SQL layer. | **`E5`** |
| **`SURF-09`** | HTTP Cookie Header | `Cookie: key=val; Session=xyz` | Web server splits on `;` and URL-decodes. | Session verification, tracking cookies, user preferences. | Often excluded from default WAF rule inspections. | **`E5`** |
| **`SURF-10`** | Custom Gateway Headers | `X-Consumer-ID`, `X-Tenant-Slug` | Injected by API gateways (Kong, Apigee, Envoy).| Multi-tenant routing, internal authorization checks. | Header injection via upstream proxy trust spoofing. | **`E5`** |
| **`SURF-11`** | REST Clean Path Segment | `GET /api/v1/users/{id}/details` | Router matches regex path segments into variables. | Entity retrieval by primary key or slug (`WHERE id = ?`). | URL path segment encoding (`/` and `%2F` routing conflicts). | **`E5`** |
| **`SURF-12`** | GraphQL Variables JSON | `POST /graphql {"query": "...", "variables": {...}}` | GraphQL engine parses JSON variables into resolvers. | Resolvers compiling dynamic SQL joins and filters. | Must maintain valid GraphQL JSON syntax and variable schema. | **`E5`** |
| **`SURF-13`** | WebSocket Text Frames | WS / WSS Text & Binary frames | Persistent bidirectional message socket stream. | Live chat messaging, collaborative editing, trading platforms.| Asynchronous frame responses require correlation IDs. | **`E4`** |
| **`SURF-14`** | Async Message Queue | RabbitMQ, Apache Kafka, Celery | Asynchronous message broker queues payload for worker. | Background report generation, bulk email, cron jobs. | Response returns `202 Accepted`; SQL executes asynchronously. | **`E5`** |
