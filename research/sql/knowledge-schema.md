# Machine-Readable Knowledge Graph Schema & Entity Specification

**Document Identifier:** SENTINEL-RES-SCHEMA-17  
**Classification:** Knowledge Representation, Graph Schema & Ontology Design  

---

## 1. Relational Knowledge Graph Topology

The Sentinel Knowledge Base represents SQL security concepts as a **Directed Attributed Entity-Relationship Graph**:

```
[ Technique ] ────── COMPATIBLE_WITH ──────► [ DBMS Dialect ]
     │
     ├───────────── REQUIRES_CONTEXT ─────► [ SQL Context ]
     │
     ├───────────── OBSERVED_VIA ─────────► [ Observation Oracle ]
     │
     ├───────────── EXECUTES_ON ──────────► [ Ingress Transport ]
     │
     ▼
[ Observable Signal ]
     │
     └───────────── UPDATES_BELIEF ───────► [ Bayesian Hypothesis ]
                                                    │
                                                    ▼
                                            [ Promoted Finding ]
                                                    │
                                                    └──── DEMONSTRATES ──► [ Security Impact ]
```

---

## 2. Formal JSON Schema Definitions

### 2.1 Technique Node Schema (`techniques.json`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SqlSecurityTechnique",
  "type": "object",
  "required": ["id", "name", "intent", "priority", "lifecycle", "safetyClass", "baseCost"],
  "properties": {
    "id": { "type": "string", "pattern": "^TECH-[A-Z0-9_-]+$" },
    "name": { "type": "string" },
    "intent": { "type": "string" },
    "priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
    "lifecycle": { "type": "string", "enum": ["CONFIRMED", "CANDIDATE", "RESEARCH", "DEPRECATED", "UNSUPPORTED"] },
    "safetyClass": { "type": "string", "enum": ["PARALLEL_SAFE", "TIMING_SENSITIVE", "STATE_DEPENDENT", "ORDER_DEPENDENT", "SESSION_SENSITIVE"] },
    "baseCost": { "type": "integer", "minimum": 1 },
    "expectedInfoGain": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "supportedContexts": { "type": "array", "items": { "type": "string" } },
    "supportedDbms": { "type": "array", "items": { "type": "string" } },
    "primaryOracle": { "type": "string" }
  }
}
```

### 2.2 DBMS Node Schema (`dbms.json`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DbmsDialectProfile",
  "type": "object",
  "required": ["id", "family", "concatOperator", "commentStyles", "timingFunction"],
  "properties": {
    "id": { "type": "string" },
    "family": { "type": "string" },
    "versions": { "type": "array", "items": { "type": "string" } },
    "concatOperator": { "type": "string" },
    "commentStyles": { "type": "array", "items": { "type": "string" } },
    "timingFunction": { "type": "string" },
    "castTypeSyntax": { "type": "string" },
    "systemCatalogTable": { "type": "string" },
    "stackedQuerySupport": { "type": "boolean" }
  }
}
```
