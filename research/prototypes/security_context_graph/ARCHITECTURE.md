# Architecture: Security Context Graph

## System Design & Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY CONTEXT GRAPH                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐   Adjacency List   ┌───────────────────────────┐  │
│   │ Node Storage & Map  │ ─────────────────> │ Forward / Reverse Indices │  │
│   │ (UUID -> GraphNode) │                    │ (Out-Edges / In-Edges)    │  │
│   └──────────┬──────────┘                    └─────────────┬─────────────┘  │
│              │                                             │                │
│              ▼                                             ▼                │
│   ┌─────────────────────┐                    ┌───────────────────────────┐  │
│   │ Typed Index Cache   │                    │ Graph Query Engine        │  │
│   │ (NodeType / Edge)   │                    │ - Reachability (BFS)      │  │
│   └─────────────────────┘                    │ - Dijkstra Shortest Path  │  │
│                                              │ - Tarjan SCC & 3-Color    │  │
│                                              │ - Bottleneck Analysis     │  │
│                                              └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Ingestion & Query Pipelines
1. **Incremental Ingestion**: Nodes and edges are ingested in $O(1)$ amortized time.
2. **Bi-directional Indexing**: Forward and reverse incident edge lookups execute without full graph scans.
3. **Query Engine**: Independent traversals with depth bounding and cycle suppression.
