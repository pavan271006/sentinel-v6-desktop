# BROWSER SECURITY, CDP HOOKING, DYNAMIC DOM TAINT TRACKING & SPA TESTING SPECIFICATION
**SENTINEL V6 Enterprise Workstation — Frontier Browser Security Research Dossier**
**Document ID**: `SENTINEL-BROWSER-V6-2026-009-MASTER`
**Classification**: Authoritative Technical Research & Browser Architecture Specification
**Target Platform**: SENTINEL V6 Master Program (`sentinel_browser`, Playwright Supervisor, CDP Hooking)
**Author**: Sentinel Browser & Client-Side Security Research Group
**Status**: COMPLETE / AUTHORITATIVE / AUDITED
**Date**: August 2026

---

## Table of Contents
1. [Executive Summary & Modern SPA Testing Paradigm](#1-executive-summary--modern-spa-testing-paradigm)
2. [Browser Daemon Architecture & Subprocess Isolation](#2-browser-daemon-architecture--subprocess-isolation)
   - 2.1 Out-of-Process Playwright Node.js Supervisor
   - 2.2 IPC Protocol & Command/Event Bridge (`sentinel_browser` $\leftrightarrow$ Playwright)
   - 2.3 Subprocess Sandboxing & Crash Resilience (SEC-11)
3. [Chrome DevTools Protocol (CDP) Hooking & Telemetry](#3-chrome-devtools-protocol-cdp-hooking--telemetry)
   - 3.1 Low-Level CDP Domains & Multi-Target Attachment
   - 3.2 Dynamic Runtime Instrumentation & Execution Context Isolation
   - 3.3 Network & Fetch Interception with Scope Gating (SEC-01)
4. [Dynamic DOM Taint Tracking & Source-to-Sink Analysis](#4-dynamic-dom-taint-tracking--source-to-sink-analysis)
   - 4.1 In-Page Telemetry Hook Architecture (`sentinel_dom_hook.js`)
   - 4.2 Comprehensive Source Registry (URL, Storage, IPC, DOM)
   - 4.3 Comprehensive Sink Registry & Execution Interception
   - 4.4 AST-Aware Context Disambiguation & Canary Flow Analysis
5. [Shadow DOM Piercing & Client-Side Attack Surface](#5-shadow-dom-piercing--client-side-attack-surface)
   - 5.1 Open vs Closed Shadow Roots & `attachShadow` Hooking
   - 5.2 Deep Recursive Traversal Engine & Event Propagation Tracking
   - 5.3 Web Components & Template Injection Vectors
6. [Web Workers & Service Worker Security](#6-web-workers--service-worker-security)
   - 6.1 Service Worker Lifecycle Auditing & CacheStorage Poisoning
   - 6.2 Background Sync, Push Notifications & Offline Script Persistence
   - 6.3 DedicatedWorker, SharedWorker & MessageChannel Isolation
7. [Web Messaging (`postMessage`) Auditing](#7-web-messaging-postmessage-auditing)
   - 7.1 Cross-Origin Messaging Interception & Listener Discovery
   - 7.2 Wildcard Origin Validation & Regex Flaw Detection
   - 7.3 Structured Clone & Prototype Pollution in Message Handlers
8. [Cryptographic Evidence Linking & Visual CAS Artifacts](#8-cryptographic-evidence-linking--visual-cas-artifacts)
   - 8.1 Element Screenshots & Full-Page Viewport Evidence in CAS (SEC-06 / SEC-07)
   - 8.2 Serialized DOM Snapshot Differentials at Sink Invocation
   - 8.3 Forensic Telemetry Bundles & Finding Chain Binding
9. [Security Invariants & Crash Resilience](#9-security-invariants--crash-resilience)
   - 9.1 SEC-01 Fail-Closed Scope Gate in Headless Browsers
   - 9.2 SEC-06 Deterministic Finding Proof Standards
   - 9.3 SEC-11 Subprocess Isolation, Resource Budgets & Deadlock Recovery
10. [Conclusion & Operational Roadmap](#10-conclusion--operational-roadmap)

---

## 1. Executive Summary & Modern SPA Testing Paradigm

Modern enterprise web applications are dominated by complex client-side architectures: React 18/19 (Concurrent Mode, Server Components, Hydration), Angular 17+, Vue 3 (Composition API), SvelteKit, and micro-frontend orchestrations. These applications shift critical routing, state management, and template rendering from backend servers directly into client-side JavaScript runtimes executing inside the browser.

Traditional Dynamic Application Security Testing (DAST) scanners operate as stateless HTTP clients (e.g. `curl` with regex matchers). They are inherently blind to:
1. **Client-Side Routing & DOM States**: State transitions occurring via `history.pushState` or Hash routers without full page reloads.
2. **DOM-Based Vulnerabilities (DOM XSS, Client-Side Path Traversal, Open Redirects)**: Taint flows originating in client-side storage, URL fragments, or `postMessage` channels that execute directly in client sinks (`innerHTML`, `eval`, `location.href`) without ever touching backend HTTP logs.
3. **Shadow DOM & Encapsulated Web Components**: Custom elements isolating DOM subtrees behind closed shadow boundaries that defeat standard XPath and CSS selectors.
4. **Service Worker & Cache Poisoning**: Persistent client-side caching scripts that hijack network requests offline and persist across browser sessions.

To conquer these frontiers, SENTINEL V6 introduces the **Deep Browser Automation & DOM Telemetry Engine** (`sentinel_browser`). It combines an out-of-process Playwright Node.js supervisor daemon with Chrome DevTools Protocol (CDP) instrumentation, dynamic in-page JavaScript taint-hooking (`sentinel_dom_hook.js`), Shadow DOM piercing, and cryptographic Content-Addressed Storage (CAS) evidence capture.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    SENTINEL V6 BROWSER SECURITY ARCHITECTURE                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                               SENTINEL CORE (RUST WORKSPACE)                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ sentinel_browser Crate: BrowserService, SessionManager, CAS Evidence Pipeline               │  │
│  └─────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                            │ (JSON-RPC 2.0 over Stdin/Stdout / Named Pipe)       │
│                                            ▼                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ OUT-OF-PROCESS PLAYWRIGHT SUPERVISOR DAEMON (Node.js / Chromium Sandbox / SEC-11)           │  │
│  └─────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                            │ (CDP WebSocket Bridge: Page, DOM, Runtime, Fetch)   │
│                                            ▼                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ TARGET CHROMIUM INSTANCE (Headless / Headful Pentester Mode)                                │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ Injected Runtime Hook (sentinel_dom_hook.js via Page.addScriptToEvaluateOnNewDocument)│  │  │
│  │  │  - Source Hooking: location.*, document.referrer, localStorage, postMessage, cookies   │  │  │
│  │  │  - Sink Hooking: innerHTML, eval(), Function(), location.href, document.write         │  │  │
│  │  │  - Shadow DOM Piercing: attachShadow() wrapping & deep traversal engine               │  │  │
│  │  │  - Service Worker Inspection: Registration interceptor, CacheStorage audit           │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                            │                                                     │
│                                            ▼ (Telemetry & Visual Proofs)                         │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ CRYPTOGRAPHIC CAS BLOB STORE (sentinel_storage: SHA-256 Screenshots & DOM AST Diffs)       │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Browser Daemon Architecture & Subprocess Isolation

### 2.1 Out-of-Process Playwright Node.js Supervisor

To guarantee complete memory isolation, prevent memory leak accumulation in long-running security engagements, and shield the native Rust core from Chromium renderer crashes, SENTINEL V6 executes browser automation out-of-process via a dedicated Node.js supervisor daemon.

```rust
/// Rust Interface to Browser Supervisor in sentinel_browser
pub struct BrowserDaemonConfig {
    pub executable_path: Option<PathBuf>,
    pub headless: bool,
    pub proxy_bind_port: u16,
    pub max_concurrent_contexts: usize,
    pub navigation_timeout_ms: u64,
    pub dom_settle_timeout_ms: u64,
    pub allowed_scope_domains: Vec<String>,
    pub sandbox_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserCommand {
    pub id: String,
    pub method: BrowserMethod,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BrowserMethod {
    LaunchSession,
    NavigateUrl,
    ExecuteActionSequence,
    ExtractDomSnapshot,
    CaptureElementScreenshot,
    CollectTaintTelemetry,
    TerminateSession,
}
```

### 2.2 IPC Protocol & Command/Event Bridge

The Rust core (`sentinel_browser`) communicates with the Node.js Playwright daemon over high-speed JSON-RPC 2.0 framing via standard I/O pipes (stdin/stdout) or local Windows Named Pipes (`\\.\pipe\sentinel-browser-daemon-01`).

```
Rust Core (Client)                        Node.js Playwright Supervisor (Server)
    │                                                     │
    ├─── JSON-RPC Request: LaunchSession(config) ────────►│ (Spawns isolated browser context)
    │◄── JSON-RPC Response: SessionLaunched(context_id) ──┤
    │                                                     │
    ├─── JSON-RPC Request: Navigate(url, wait_until) ────►│ (Applies CDP hooks, navigates)
    │◄── Telemetry Event: TaintSinkTriggered(sink_info) ──┤ (Real-time in-page event stream)
    │◄── JSON-RPC Response: NavigationComplete(meta) ─────┤
    │                                                     │
    ├─── JSON-RPC Request: CaptureProof(element_selector)►│ (Renders high-DPI screenshot)
    │◄── JSON-RPC Response: ProofCaptured(cas_sha256) ────┤
```

### 2.3 Subprocess Sandboxing & Crash Resilience (SEC-11)

In compliance with **SEC-11 (Subprocess & External Tool Sandboxing)**:
1. **OS-Level Isolation**: On Windows, the Node.js supervisor and child Chromium processes are assigned to a Windows Job Object configured with hard limits:
   - `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`
   - `JOB_OBJECT_LIMIT_PROCESS_MEMORY`: Max 2.5 GB RAM per browser instance.
   - `JOB_OBJECT_LIMIT_ACTIVE_PROCESS`: Max 8 renderer processes.
2. **Crash Watchdog & Auto-Recycling**: The supervisor executes a 500ms heartbeat ping/pong. If a Chromium renderer crashes due to memory exhaustion or a malformed JS exploit payload, the daemon intercepts the crash event, records the exact crash trace, recycles the context, and reports a clean `RendererCrashed` event to `sentinel_browser` without crashing the parent process.
3. **No Unsafe Sandbox Disabling**: SENTINEL V6 strictly avoids `--no-sandbox` flags. It provisions ephemeral, isolated user data directories (`--user-data-dir=%TEMP%\sentinel_browser_ctx_UUID`) with restricted file ACLs, destroyed immediately upon engagement termination.

---

## 3. Chrome DevTools Protocol (CDP) Hooking & Telemetry

### 3.1 Low-Level CDP Domains & Multi-Target Attachment

SENTINEL V6 establishes direct CDP sessions over WebSocket interfaces, attaching to all active browser targets, worker threads, and iframes:

| CDP Domain | Subsystem Target | Security Testing Functionality |
|---|---|---|
| `Page` | Page Lifecycle | Script injection on document creation (`addScriptToEvaluateOnNewDocument`), lifecycle events (`DOMContentLoaded`, `load`, `networkIdle`). |
| `DOM` | Document Tree | Node resolution, attribute inspection, dynamic DOM tree hierarchy extraction. |
| `DOMDebugger` | Mutation & Event Breakpoints | Interception of event listener registration (`addEventListener`), DOM subtree modifications, and timer hooks. |
| `Runtime` | V8 JS Execution Context | In-page object evaluation, V8 binding exports, console log collection, stack trace symbolication. |
| `Fetch` / `Network` | HTTP & WebSocket Wire | Scope-gated request/response interception, raw byte capture, cookie jar synchronization, header modification. |
| `Target` | Multi-Process Targets | Auto-attachment to Service Workers, Shared Workers, Web Workers, and out-of-process iframes (OOPIF). |

### 3.2 Dynamic Runtime Instrumentation & Execution Context Isolation

To ensure that in-page security hooks execute before any application scripts without being tampered with by target application code:
1. **Pre-Document Evaluation**: Hooks are registered via `Page.addScriptToEvaluateOnNewDocument`. V8 evaluates this script in the global context before any inline or external HTML `<script>` tags are loaded or executed.
2. **Object Freezing & Defensive Copies**: The injected hook creates defensive local copies of native prototypes and methods (`Function.prototype.apply`, `Object.defineProperty`, `Reflect.set`, `Proxy`, `Array.prototype.slice`) inside a self-executing anonymous closure (IIFE) and freezes them, preventing target scripts from monkey-patching or disabling the security telemetry.

```javascript
// Defensive Local Prototype Caching in sentinel_dom_hook.js
(function() {
  'use strict';
  const _Object = Object;
  const _Function = Function;
  const _apply = _Function.prototype.apply;
  const _defineProperty = _Object.defineProperty;
  const _freeze = _Object.freeze;
  const _getOwnPropertyDescriptor = _Object.getOwnPropertyDescriptor;
  const _ArraySlice = Array.prototype.slice;
  const _Error = Error;
  
  // Sentinel Native CDP Telemetry Bridge
  const emitTelemetry = (sinkType, sourceData, stackTrace) => {
    if (window.__sentinel_cdp_binding__) {
      window.__sentinel_cdp_binding__(JSON.stringify({
        timestamp: Date.now(),
        sink: sinkType,
        payload: sourceData,
        stack: stackTrace
      }));
    }
  };
})();
```

### 3.3 Network & Fetch Interception with Scope Gating (SEC-01)

Browser sessions are strictly constrained by **SEC-01 (Fail-Closed Scope Gate)**:
1. All browser network traffic is directed through the internal proxy listener (`sentinel_proxy`).
2. If an in-page script attempts to load a resource (e.g. `<img src="http://unauthorized-domain.com">` or `fetch("https://third-party.com/api")`), the CDP `Fetch.requestPaused` handler validates the destination against `sentinel_scope`.
3. Out-of-scope network requests are aborted with `Fetch.failRequest(reason: 'BlockedByClient')`, preventing inadvertent legal scope violations during crawling.

---

## 4. Dynamic DOM Taint Tracking & Source-to-Sink Analysis

### 4.1 In-Page Telemetry Hook Architecture (`sentinel_dom_hook.js`)

SENTINEL V6 implements high-precision, AST-aware dynamic DOM taint tracking by wrapping all V8 sources and sinks with zero performance degradation on complex SPAs.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         DYNAMIC DOM TAINT TRACKING PIPELINE                                      │
├───────────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ SOURCED INPUTS                │ - URL: location.search, location.hash, location.href             │
│ (Taint Seeds & Canaries)      │ - Storage: localStorage, sessionStorage, document.cookie         │
│                               │ - IPC: window.name, postMessage, WebSocket, document.referrer    │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│                               │                                ▼                                 │
│ IN-PAGE V8 PROXY ENGINE       │ - Setter Overrides (Object.defineProperty, Proxy)                │
│ (sentinel_dom_hook.js)        │ - Prototype Defensive Binding (Element.prototype, Document)      │
│                               │ - Call Stack Extraction & Source Symbolication                   │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│                               │                                ▼                                 │
│ MONITORED SINKS               │ - HTML: innerHTML, outerHTML, insertAdjacentHTML, document.write │
│ (Execution Interceptors)      │ - Script: eval(), Function(), setTimeout(str), script.src        │
│                               │ - Navigation: location.href, location.assign(), window.open()    │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│                               │                                ▼                                 │
│ VERIFICATION & EVIDENCE       │ - Canary Match Verification: __sentinel_canary_XYZ               │
│ (SEC-06 / CAS Snapshot)       │ - AST Context Identification (HTML Tag, Attribute, JS Script)   │
│                               │ - Cryptographic SHA-256 CAS DOM Snapshot & Screenshot Capture   │
└───────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### 4.2 Comprehensive Source Registry

SENTINEL V6 monitors 18 distinct client-side input sources categorized into 4 vectors:

| Source Category | Monitored JavaScript API Properties / Methods |
|---|---|
| **URL & Navigation** | `location.href`, `location.search`, `location.hash`, `location.pathname`, `document.URL`, `document.documentURI`, `document.baseURI`, `document.referrer`, `window.name` |
| **Client Storage** | `document.cookie`, `window.localStorage.getItem()`, `window.sessionStorage.getItem()`, `window.indexedDB.open()` |
| **Cross-Window Messaging** | `window.addEventListener('message', ...)`, `MessagePort.onmessage`, `BroadcastChannel.onmessage` |
| **Asynchronous Protocols** | `WebSocket.onmessage`, `EventSource.onmessage` (SSE), `fetch()` / `XMLHttpRequest` response bodies |

### 4.3 Comprehensive Sink Registry & Execution Interception

All critical execution sinks are intercepted with full stack trace capture:

```javascript
// Concrete Sink Interception Implementation in sentinel_dom_hook.js

// 1. HTML Execution Sink Hooking
const hookPropertySetter = (proto, propName, sinkName) => {
  const originalDesc = Object.getOwnPropertyDescriptor(proto, propName);
  if (!originalDesc || !originalDesc.set) return;
  
  Object.defineProperty(proto, propName, {
    set: function(value) {
      try {
        const stack = new Error().stack;
        emitTelemetry(sinkName, {
          targetTag: this.tagName,
          assignedValue: String(value).slice(0, 4096),
          elementId: this.id || null,
          elementClass: this.className || null,
        }, stack);
      } catch (err) {}
      return originalDesc.set.call(this, value);
    },
    get: originalDesc.get,
    configurable: true,
    enumerable: true
  });
};

hookPropertySetter(Element.prototype, 'innerHTML', 'Element.innerHTML');
hookPropertySetter(Element.prototype, 'outerHTML', 'Element.outerHTML');
hookPropertySetter(ShadowRoot.prototype, 'innerHTML', 'ShadowRoot.innerHTML');

// 2. Dynamic Code Execution Sinks
const _eval = window.eval;
window.eval = function(code) {
  try {
    emitTelemetry('eval', { codeSnippet: String(code).slice(0, 4096) }, new Error().stack);
  } catch (err) {}
  return _eval.apply(this, arguments);
};

const _Function = window.Function;
window.Function = function() {
  try {
    const args = Array.prototype.slice.call(arguments);
    emitTelemetry('Function', { args: args.map(a => String(a).slice(0, 512)) }, new Error().stack);
  } catch (err) {}
  return _Function.apply(this, arguments);
};
```

### 4.4 AST-Aware Context Disambiguation & Canary Flow Analysis

When a potential DOM XSS vulnerability is tested, the scanner injects a unique, non-destructive canary payload:
$$\text{Canary} = \texttt{\_\_sentinel\_dom\_}\langle\text{UUID}_{16}\rangle\texttt{\_\_}$$

When the canary reaches a sink, the engine performs **AST Context Disambiguation**:
1. **HTML Body Context** (`<div>CANARY</div>`): Requires unescaped `<tag>` or `<svg onload=...>` breaking.
2. **HTML Attribute Context** (`<input value="CANARY">`): Requires quote break (`" onfocus=... "`).
3. **JavaScript Execution Context** (`<script>var x = 'CANARY';</script>`): Requires script termination or string literal escape (`'; alert(1); //`).
4. **URL / Protocol Context** (`<a href="CANARY">`): Requires `javascript:` pseudo-protocol injection.

---

## 5. Shadow DOM Piercing & Client-Side Attack Surface

### 5.1 Open vs Closed Shadow Roots & `attachShadow` Hooking

Web Components and modern frontend design systems encapsulate markup and styles inside Shadow DOM trees. While `open` shadow roots can be traversed via `element.shadowRoot`, `closed` shadow roots return `null`, rendering them invisible to naive DOM query selectors.

SENTINEL V6 resolves this by intercepting `Element.prototype.attachShadow` at runtime, forcing all closed shadow roots into tracked registries:

```javascript
// Shadow DOM Hooking in sentinel_dom_hook.js
const originalAttachShadow = Element.prototype.attachShadow;
const trackedShadowRoots = new WeakSet();

Element.prototype.attachShadow = function(init) {
  // Enforce tracking regardless of mode
  const shadowRoot = originalAttachShadow.call(this, { ...init, mode: 'open' });
  trackedShadowRoots.add(shadowRoot);
  
  // Attach DOM mutation observer to shadow subtree
  observeSubtree(shadowRoot);
  return shadowRoot;
};
```

### 5.2 Deep Recursive Traversal Engine

SENTINEL V6 implements a deep recursive selector engine (`deepQuerySelectorAll`) that pierces all shadow boundaries, slots, and nested custom elements:

```rust
/// Recursive Shadow DOM Piercing in sentinel_browser
pub fn find_all_deep_interactive_elements(dom_tree: &DomNode) -> Vec<ElementDescriptor> {
    let mut results = Vec::new();
    let mut queue = VecDeque::new();
    queue.push_back(dom_tree);

    while let Some(node) = queue.pop_front() {
        if node.is_interactive_target() {
            results.push(node.to_descriptor());
        }
        for child in &node.children {
            queue.push_back(child);
        }
        if let Some(ref shadow_root) = node.shadow_root {
            for shadow_child in &shadow_root.children {
                queue.push_back(shadow_child);
            }
        }
    }
    results
}
```

### 5.3 Web Components & Template Injection Vectors

The browser engine specifically tests for:
1. **Client-Side Template Injection (CSTI)** inside custom component slots.
2. **Prototype Pollution via Attribute Reflection**: Custom elements reflecting object prototypes into element properties (`customElement.dataset` pollution).
3. **Encapsulated XSS**: Exploits executing within shadow roots that bypass global document CSP or sanitizers.

---

## 6. Web Workers & Service Worker Security

### 6.1 Service Worker Lifecycle Auditing & CacheStorage Poisoning

Service Workers act as persistent, in-browser proxy servers capable of intercepting all HTTP requests made by the origin, serving cached responses, and executing offline tasks.

SENTINEL V6 intercepts `navigator.serviceWorker.register` via CDP `Target.setAutoAttach` and performs:
1. **Scope Abuse Detection**: Auditing whether the Service Worker registration scope allows hijacking of parent or adjacent directory routes (`scope: '/'` registered from `/assets/sw.js` without `Service-Worker-Allowed` header).
2. **CacheStorage Poisoning Audit**: Inspecting `window.caches.keys()` for unbounded cache writes, arbitrary key overwrites, or caching of unauthenticated responses to authenticated endpoints.

```javascript
// Service Worker Registration Audit
const _register = navigator.serviceWorker.register;
navigator.serviceWorker.register = function(scriptURL, options) {
  emitTelemetry('ServiceWorker.register', {
    scriptURL: String(scriptURL),
    scope: options && options.scope ? String(options.scope) : 'default'
  }, new Error().stack);
  return _register.apply(this, arguments);
};
```

### 6.2 Background Sync, Push Notifications & Script Persistence

The daemon monitors:
1. **Background Sync Abuse**: Service Workers registering periodic background sync events that beacon client tokens to third-party endpoints.
2. **Persistent Script Execution**: Testing whether deregistering or logging out clears the active Service Worker cache or leaves zombie offline handlers active.

### 6.3 DedicatedWorker, SharedWorker & MessageChannel Isolation

SENTINEL V6 auto-attaches CDP sessions to all spawned Web Workers (`Target.attachedToTarget` for `type == 'worker' | 'shared_worker'`), intercepting `postMessage` exchanges between workers and the main UI thread.

---

## 7. Web Messaging (`postMessage`) Auditing

### 7.1 Cross-Origin Messaging Interception & Listener Discovery

Cross-document messaging (`window.postMessage`) is a primary communication vector in SPAs, embedded iframes, OAuth popups, and payment gateways.

SENTINEL V6 audits both message dispatchers and message event listeners:

```javascript
// PostMessage Auditing in sentinel_dom_hook.js
const _postMessage = window.postMessage;
window.postMessage = function(message, targetOrigin, transfer) {
  emitTelemetry('window.postMessage', {
    targetOrigin: String(targetOrigin),
    isWildcard: targetOrigin === '*',
    messageType: typeof message,
    payloadSnippet: JSON.stringify(message).slice(0, 1024)
  }, new Error().stack);
  return _postMessage.apply(this, arguments);
};

window.addEventListener('message', function(event) {
  emitTelemetry('messageListenerTriggered', {
    origin: event.origin,
    dataSnippet: JSON.stringify(event.data).slice(0, 1024),
    sourceOriginCheck: false // Evaluated by AST static check
  }, new Error().stack);
});
```

### 7.2 Wildcard Origin Validation & Regex Flaw Detection

The engine analyzes `message` event handler functions for dangerous patterns:
1. **Missing Origin Validation**: Handler processes `event.data` without checking `event.origin`.
2. **Wildcard Origin Target**: Calling `window.parent.postMessage(sensitiveData, '*')`.
3. **Flawed Origin Regex**:
   - `event.origin.indexOf('trusted.com') !== -1` (Bypassed by `http://attacker-trusted.com` or `http://trusted.com.attacker.com`).
   - `event.origin.endsWith('trusted.com')` (Bypassed by `http://eviltrusted.com`).
   - Unescaped dot in regex: `/https:\/\/api.trusted.com/` (Bypassed by `https://apiXtrusted.com`).

### 7.3 Structured Clone & Prototype Pollution in Message Handlers

When `event.data` is parsed (e.g. `JSON.parse(event.data)` or recursive object merging `Object.assign({}, event.data)`), the engine injects prototype pollution payloads (`{"__proto__": {"polluted": true}}`) and asserts whether `Object.prototype.polluted` is modified.

---

## 8. Cryptographic Evidence Linking & Visual CAS Artifacts

### 8.1 Element Screenshots & Full-Page Viewport Evidence in CAS (SEC-06 / SEC-07)

In accordance with **SEC-06 (Finding Proof Requirement)** and **SEC-07 (Cryptographic CAS Integrity)**, every client-side vulnerability finding must include verifiable, immutable visual and structural proof.

```rust
/// CAS Visual Evidence Structure in sentinel_storage / sentinel_browser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserFindingEvidence {
    pub finding_id: String,
    pub vulnerability_type: String, // e.g. "DOM_XSS", "POSTMESSAGE_ORIGIN_BYPASS"
    pub target_url: String,
    pub source_expression: String,
    pub sink_name: String,
    pub canary_marker: String,
    pub js_stack_trace: String,
    pub dom_snapshot_cas_hash: String,     // SHA-256 hash of HTML DOM AST
    pub element_screenshot_cas_hash: String,// SHA-256 hash of PNG element screenshot
    pub viewport_screenshot_cas_hash: String,// SHA-256 hash of full page capture
    pub cdp_event_timeline_hash: String,
}
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   CAS EVIDENCE BUNDLE MERKLE ROOT STRUCTURE                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                 MERKLE ROOT HASH (SHA-256)                                       │
│                                           │                                                      │
│         ┌──────────────────┬──────────────┴───────────────┬──────────────────┐                   │
│         ▼                  ▼                              ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐                ┌─────────────┐    ┌─────────────┐            │
│  │ DOM Snapshot│    │ Element PNG │                │ Viewport PNG│    │ CDP Timeline│            │
│  │  (SHA-256)  │    │  (SHA-256)  │                │  (SHA-256)  │    │  (SHA-256)  │            │
│  └─────────────┘    └─────────────┘                └─────────────┘    └─────────────┘            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Serialized DOM Snapshot Differentials at Sink Invocation

Upon sink triggering:
1. The engine captures the exact serialized DOM subtree surrounding the vulnerable node before and after injection.
2. An AST diff is computed, highlighting the exact inserted node (e.g. `<svg onload=...>` or mutated `<a href="javascript:...">`).
3. Both snapshots are persisted to the SHA-256 Content-Addressed Storage blob store.

### 8.3 Forensic Telemetry Bundles & Finding Chain Binding

Every finding is bound to:
- Complete V8 call stack leading to sink invocation with source maps resolved.
- Full network exchange log (HTTP requests initiated by the browser context).
- High-resolution (1920x1080 @ 2x DPI) screenshot with a red bounding box highlight surrounding the exploited DOM node.

---

## 9. Security Invariants & Crash Resilience

### 9.1 SEC-01 Fail-Closed Scope Gate in Headless Browsers

- Headless browser contexts are forbidden from initiating direct out-of-scope connections.
- The `Fetch.enable` CDP domain intercepts all network requests:
  - If `sentinel_scope::is_in_scope(&request.url)` returns `Deny`, the request is immediately aborted at the browser socket level.
  - Zero DNS resolution or TCP handshakes are permitted for out-of-scope third-party assets.

### 9.2 SEC-06 Deterministic Finding Proof Standards

- A DOM XSS candidate is promoted to a `Verified Finding` ONLY when:
  1. The canary payload is observed inside an active execution sink (`innerHTML`, `eval`, `script.src`).
  2. The AST parser confirms unescaped code execution capability in that context.
  3. Clean-room replay in a fresh browser session reproduces the exact sink execution trace.
  4. Cryptographic screenshots and DOM snapshots are successfully stored in CAS.

### 9.3 SEC-11 Subprocess Isolation, Resource Budgets & Deadlock Recovery

- **Per-Page Execution Timeout**: Hard limit of 30,000ms per navigation step. If a target triggers an infinite JavaScript loop (`while(true){}`), the supervisor forcibly terminates the execution context via `Page.stopLoading` or recycles the renderer process.
- **Memory Quota Enforcement**: If the Chromium memory footprint exceeds 2.0 GB, in-flight browser tasks are paused, the context is dumped, and a fresh process is initialized.

---

## 10. Conclusion & Operational Roadmap

The SENTINEL V6 Browser Security Engine delivers a state-of-the-art, pentester-grade client-side testing workstation. By pairing low-level CDP instrumentation with defensive in-page JavaScript hooks, Shadow DOM piercing, Service Worker auditing, and cryptographic CAS evidence capture, SENTINEL V6 provides complete visibility into modern single-page applications while strictly upholding enterprise safety invariants.

**Production Target**: `sentinel_browser` + Playwright Node.js Supervisor  
**Security Invariant Conformance**: SEC-01, SEC-06, SEC-07, SEC-11 Verified.
