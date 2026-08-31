# Modern Web Application Ingress Surfaces & Topology Matrix

**Document Identifier:** SENTINEL-RES-SURF-04  
**Classification:** Application Protocol & Surface Engineering Knowledge Base  

---

## 1. Input Surface Classification

Modern cloud architectures introduce diverse serialization formats and transport layers that interface with backend relational databases.

```
                            MODERN INPUT SURFACES
                                      │
    ┌────────────────┬────────────────┼────────────────┬─────────────────┐
    ▼                ▼                ▼                ▼                 ▼
[HTTP Query/Form] [JSON & GraphQL] [Headers/Cookies] [REST Path Seg]   [Async Workflows]
- GET Query       - Flat JSON      - Tracking Cookies- Clean URLs      - Celery / Kafka
- Form-Urlencoded - Nested Objects - X-Forwarded-For - UUID/Slug Paths - Background Jobs
- Multipart Form  - GraphQL Vars   - Client-IP       - Regex Routes    - Microservices
```

---

## 2. Comprehensive Surface Breakdown

| Ingress Surface | Serialization Format | Typical Backend SQL Target | Detection & Injection Nuances |
|:---|:---|:---|:---|
| **URL Query Parameter** | URL-encoded key-value | Filtering, sorting, pagination | Standard encoding; WAFs inspect primary URI buffer. |
| **JSON Body (Flat)** | `{"key": "value"}` | REST API CRUD operations | Requires preserving valid JSON structure; quotes must be escaped or unescaped in payload string. |
| **Nested JSON Object** | `{"filter": {"field": {"eq": "val"}}}` | ORM dynamic criteria building | Object injection; arrays/objects may bypass strict type checking in dynamic query builders. |
| **HTTP Cookies** | `Cookie: key=value` | Session lookups, tracking, preferences | Often bypassed by standard WAF rules; frequently executed in authentication/logging SQL queries. |
| **HTTP Request Headers** | `X-Forwarded-For`, `User-Agent`, `Referer` | Audit logs, geo-IP lookup, analytics | Often unescaped because developers treat headers as trusted server-generated metadata. |
| **REST Path Parameters** | `/api/v1/users/{id}/details` | Entity retrieval by primary key | Web frameworks route path tokens to controller arguments; often numeric or UUID contexts. |
| **GraphQL Variables** | `{"query": "...", "variables": {"id": "1"}}` | GraphQL-to-SQL resolvers | Injection occurs inside the JSON variable object which gets unmarshaled into resolver dynamic SQL. |
| **Multipart Form Data** | Boundary-delimited streams | File metadata, profile updates | Injected into filename fields or form part text parameters. |
| **Asynchronous Message Bus**| RabbitMQ, Kafka, AWS SQS | Background batch processing | First-order response returns 202 Accepted; SQL evaluation happens asynchronously in background worker. |

---

## 3. Architecture-Specific Vulnerability Vectors

### 3.1 GraphQL-to-SQL Resolvers (e.g. Hasura, PostGraphile, Prisma)
- **Mechanism**: Translating nested GraphQL abstract syntax trees into dynamic SQL joins and `WHERE` filters.
- **Risk Area**: Unparameterized custom resolver logic or raw SQL fragments embedded in `@customDirective(sql: "...")`.

### 3.2 Microservice & API Gateway Serialization
- **Gateway Transformation**: An API gateway (Kong, Envoy) may sanitize or URL-decode an input, which is subsequently re-serialized as JSON and forwarded to an internal microservice where raw SQL construction takes place.
- **Header Forwarding**: Gateways injecting `X-Consumer-Custom-ID` or `X-User-ID` from JWT claims into internal HTTP headers, which the downstream service queries via raw SQL.
