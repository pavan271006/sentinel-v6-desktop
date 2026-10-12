# Sentinel V6 Autonomous Stealth Crawler & Deep Discovery Engine
# Comprehensive E2E Test Infrastructure Specification (`TEST_INFRA.md`)

## 1. Overview & Architecture

This document defines the test architecture, methodology, invocation protocols, and coverage thresholds for the Autonomous Stealth Web Crawler and Deep Discovery Engine in Sentinel Desktop V6 (`C:/Users/Legion 5 pro/Desktop/cyber sec`).

The testing framework employs an opaque-box, contract-driven, requirement-verified methodology derived from `ORIGINAL_REQUEST.md` and `PROJECT.md`. It guarantees that all 28 core features across Milestones M1 through M6 operate autonomously, resist edge defenses, handle complex client-side application workflows, and maintain absolute UI and store stability.

```
                              ┌───────────────────────────────────────────────┐
                              │            Vitest Test Harness (v3.2.7)       │
                              │    JSDOM + Synthetic CDP + Mock Engine Wire   │
                              └───────────────────────┬───────────────────────┘
                                                      │
         ┌───────────────────────────┬────────────────┴───────────┬───────────────────────────┐
         │                           │                            │                           │
         ▼                           ▼                            ▼                           ▼
┌──────────────────┐       ┌──────────────────┐         ┌───────────────────┐       ┌──────────────────┐
│      Tier 1      │       │      Tier 2      │         │      Tier 3       │       │      Tier 4      │
│ Feature Coverage │       │ Boundary & Corner│         │   Cross-Feature   │       │   Real-World     │
│ (28 Features)    │       │ (28 Features)    │         │   Combinations    │       │ Application Scen.│
│ >= 140 Tests     │       │ >= 140 Tests     │         │   >= 25 Tests     │       │   >= 10 Tests    │
└──────────────────┘       └──────────────────┘         └───────────────────┘       └──────────────────┘
```

---

## 2. Directory Layout & File Organization

The E2E test suites are co-located in the Content Discovery service domain and the root E2E directory:

```
C:/Users/Legion 5 pro/Desktop/cyber sec/
├── src/services/contentDiscovery/__tests__/e2e/
│   ├── tier1_crawler_features.e2e.test.ts        # Tier 1: 28 Features × >=5 tests (>=140 tests)
│   ├── tier2_crawler_boundaries.e2e.test.ts      # Tier 2: Boundary & Corner Cases (>=140 tests)
│   ├── tier3_crawler_cross_features.e2e.test.ts  # Tier 3: Pairwise Cross-Feature Interactions
│   └── tier4_crawler_realworld.e2e.test.ts       # Tier 4: Real-World E2E Scenarios (ScrapingCourse, SPAs)
├── tests/e2e/
│   ├── tier1_feature_perf.test.ts                # Base Shell/Proxy E2E Performance
│   ├── tier2_boundary_limits.test.ts             # Base Shell/Proxy Boundary Limits
│   ├── tier3_cross_feature_streams.test.ts       # Base Shell/Proxy Cross-Stream Interactions
│   └── tier4_pentester_workflows.test.ts         # Base Shell/Proxy 17-Step Pentester Workflows
├── TEST_INFRA.md                                 # This specification
└── TEST_READY.md                                 # Test readiness verification report
```

---

## 3. Four-Tier Test Coverage Framework

### Tier 1: Feature Coverage (Isolation Verification)
- **Target:** >=5 unit/e2e test cases per feature across all 28 features in `PROJECT.md` (Minimum: 140 tests).
- **Features Tested:**
  1. Multi-Source DOM Link Extraction (`<a>`, `<form>`, `<button data-url/onclick>`, `<iframe>`)
  2. Dynamic JS Bundle & Mutation Mining (Webpack/Vite chunks, script mutations, script tags)
  3. Client-Side Router Introspection (React Router v5/v6, Vue Router, Next.js manifests, Remix)
  4. Inline Script AST & Comment Parsing (Hidden API routes in comments & AST script bodies)
  5. Web Worker & Service Worker Dredging (Worker registration, CacheStorage, offline assets)
  6. Absolute Endpoint Normalization (WHATWG URL resolution, hashbang `/#/` conversion, query strip)
  7. Dynamic RESTful Parameter Clustering (Collapsing variable IDs, UUIDs, dates, hashes, slugs)
  8. Dual-Domain CDP Interception (`Fetch.requestPaused`, `Network.requestWillBeSent`)
  9. Request Payload & Header Capture (Lossless body capture: JSON, FormData, decompressed Brotli/Gzip)
  10. WebSocket & Beacon Interception (WebSocket frames, `navigator.sendBeacon`)
  11. Headless & CDP Neutralization (`navigator.webdriver`, CDC traces, prototype alignment)
  12. Hardware & API Consistency (Canvas noise, WebGL vendor, AudioContext, Client Hints)
  13. Network & TLS Coherence (JA3/JA4 TLS ClientHello alignment, HTTP/2 pseudo-header order)
  14. Active Challenge Clearance (Cloudflare Turnstile, AWS WAF, Akamai, DataDome interstitial bypass)
  15. Semantic Field Understanding (Context-aware search queries, form inputs, roll numbers, academic context)
  16. Natural Motion Dynamics (Cubic Bézier trajectories, S-curve velocity profiling, micro-jitters)
  17. Natural Keystroke & Input Dynamics (Gaussian cadence, cognitive pauses, Shift key, kinetic scroll)
  18. Comprehensive Workflow Exploration (Search forms, filter toggles, paginators, dropdown selects)
  19. Modal Dialog Workflow Exploration (Exploring modal dialog state nodes before dismissal)
  20. Dynamic SPA State Graph (Structural DOM hashing, cycle detection, visited state maps)
  21. Event-Driven Zero-Lag Pacing (Adaptive pacing, <50ms turbo mode settlement, exponential backoff)
  22. Deception & Honeypot Filtering (CSS hidden traps: `display:none`, `opacity:0`, off-screen `-9999px`)
  23. Persistent Store Lifting (Surviving workspace view unmounting, global store persistence)
  24. Real-Time Request Store Streaming (`trafficStore.addTransaction()` live ingestion)
  25. Modular Content Discovery Refactor (Modular architecture: miner, clusterer, crawler, stealth)
  26. Clean Build Verification (Zero TypeScript errors, correct exported contracts)
  27. Full E2E Test Suite (Tiers 1-4) (Multi-tier harness execution, deterministic assertions)
  28. Adversarial Coverage Hardening (Adversarial edge inputs, defensive crash recovery, safety kernel)

### Tier 2: Boundary & Corner Cases (Adversarial Stress)
- **Target:** >=5 boundary/corner test cases per feature across all 28 features (Minimum: 140 tests).
- **Edge Conditions Tested:**
  - Empty inputs (empty DOM, empty strings, 0-byte scripts, null responses)
  - Extreme sizes (10MB DOM, 50MB multipart bodies, 10,000-character strings, 8192-char URLs)
  - Malformed syntax (unclosed tags, broken JSON, invalid regex, corrupt gzip/brotli streams)
  - Malicious characters (null bytes `%00`, CRLF injection, Unicode surrogate pairs, path traversal `../../`)
  - Deception traps (8-level hidden ancestors, sub-pixel dimensions, zero-contrast fonts)
  - Infinite loops & state explosions (recursive links, ticking clocks, 1000-page pagination)
  - Rate limiting & circuit breaking (consecutive 429/503 errors, max backoff clamping)
  - Destructive action attempts (`/logout`, `/delete-account`, `javascript:wipeAll()`, payment triggers)

### Tier 3: Cross-Feature Combinations (Pairwise Interaction)
- **Target:** >=25 pairwise interaction tests validating multi-subsystem behavior.
- **Key Pairwise Matrices:**
  1. DOM Extraction + Endpoint Normalizer (canonical resolution of extracted links & forms)
  2. Form Interaction + Honeypot Filtering (filling semantic forms while pruning hidden trap fields)
  3. CDP Interception + Zero-Lag Quiescence (CDP network stream settlement gating crawler state transitions)
  4. Router Introspection + State Graph (harvested Next.js/React Router routes populating SFG state nodes)
  5. Parameter Clustering + State Governor (preventing state explosion on dynamic REST endpoints)
  6. Anti-Bot Neutralization + Biometric Kinematics (executing Bézier trajectories in stealth context)
  7. Active Challenge Clearance + Cookie Preservation + Interception Stream (preserving clearance tokens)
  8. Modal Dialog Exploration + Destructive Action Kernel (protecting against destructive modal actions)
  9. Script AST Mining + Source Map Miner (combining bundle AST routes with unpacked source maps)
  10. Real-Time Store Streaming + Recon Store Ingestion (updating global recon store & trafficStore)
  11. Adaptive Pacing + Crawl Pattern Randomization (combining backoff pacing with priority tiers)
  12. Cognitive Flow Agent + Cascading Dropdown Resolution (solving dependent AJAX select elements)
  13. Web Worker Dredging + CacheStorage Mining (intercepting offline worker cache endpoints)
  14. WebSocket Interception + Traffic Store Streaming (capturing live frames into transaction store)
  15. Deception Pruning + Structural DOM Hashing (ensuring hidden traps do not mutate structural hash)

### Tier 4: Real-World Application Scenarios (End-to-End Simulation)
- **Target:** >=10 comprehensive real-world scenarios.
- **Scenarios:**
  1. Modern Next.js E-Commerce Catalog Crawl (Search -> Product cards -> Pagination -> Modal quick-view)
  2. ScrapingCourse Challenge: Cloudflare Turnstile Obstacle (Detection -> PoW -> Kinematic click -> Bypass)
  3. ScrapingCourse Challenge: Infinite Scroll & Virtual DOM (Scroll -> Mutation settlement -> Deduplication)
  4. ScrapingCourse Challenge: Honeypot & Anti-Bot Deception Traps (Filtering 5 types of traps)
  5. Multi-Step Dashboard Workflow with Modal Dialogs (Table view -> Modal details -> Inner tabs)
  6. Academic / Enterprise Portal with Dependent Dropdowns (Regulation -> Branch -> Semester -> Roll No)
  7. Full Attack-Surface Pipeline (UnifiedReconOrchestrator coordinating all discovery engines)
  8. Destructive Action Safety Gate under Adversarial Navigation (Rejecting logout/delete links)
  9. Rate-Limited Host with Dynamic Pacing Adaptation (429 handling -> slow retry -> clearance)
  10. Single-Page Application with Hashbang and Virtual Routes (`/#/dashboard`, `/#/users` state traversal)

---

## 4. Test Execution & Automation Protocols

### Runner Commands
```bash
# Execute Content Discovery E2E Suites (Tiers 1-4)
npx vitest run src/services/contentDiscovery/__tests__/e2e

# Execute All E2E Suites (Content Discovery + Shell/Proxy)
npx vitest run src/services/contentDiscovery/__tests__/e2e tests/e2e

# Execute Specific Tier
npx vitest run src/services/contentDiscovery/__tests__/e2e/tier1_crawler_features.e2e.test.ts
npx vitest run src/services/contentDiscovery/__tests__/e2e/tier2_crawler_boundaries.e2e.test.ts
npx vitest run src/services/contentDiscovery/__tests__/e2e/tier3_crawler_cross_features.e2e.test.ts
npx vitest run src/services/contentDiscovery/__tests__/e2e/tier4_crawler_realworld.e2e.test.ts
```

### Environment & Timeout Constraints
- **Environment:** `jsdom` (configured in `vite.config.ts`)
- **Isolation:** `poolOptions.threads.isolate = true`
- **Default Test Timeout:** 20,000ms
- **Memory Ceiling:** Bounded heap growth with strict garbage collection between test suites
- **Flakiness Protection:** Zero arbitrary `sleep()` loops; all asynchronous settlement relies on event settlement, Promise resolution, or simulated deterministic timers.

---

## 5. Pass/Fail Criteria & Quality Gates

| Metric | Threshold | Verification Method |
|---|---|---|
| Tier 1 Feature Coverage | 100% (>=140/140 passing) | `npx vitest run` |
| Tier 2 Boundary Stress | 100% (>=140/140 passing) | `npx vitest run` |
| Tier 3 Cross-Feature | 100% (>=25/25 passing) | `npx vitest run` |
| Tier 4 Real-World Workflows | 100% (>=10/10 passing) | `npx vitest run` |
| Compilation / Types | 0 TypeScript errors | `npm run quick:build` |
| Total Tests Passing | >= 315 tests green | Aggregated Vitest summary |
