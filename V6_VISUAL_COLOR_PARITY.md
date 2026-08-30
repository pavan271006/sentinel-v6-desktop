# Sentinel V6 — Visual Color & Theme Parity Specification
**Audit Date:** 2026-08-25  
**Design System Standard:** Sentinel Dark Workstation Theme (Burp Suite Ergonomics)

---

## 1. Color Token Architecture

```css
:root {
  /* 1. Base Surfaces & Panels */
  --bg-app-shell:       #1e1f22;  /* Native menu & outer window background */
  --bg-canvas-main:     #141517;  /* High-contrast editor & data table canvas */
  --bg-panel-header:    #2b2d30;  /* Sub-tab bars, table headers, toolbar strips */
  --bg-sub-panel:       #232529;  /* Split-pane inspector sub-headers */
  --bg-item-hover:      #282b30;  /* List item and table row hover state */
  --bg-item-selected:   #2b2d30;  /* Active table row and selected tree node */

  /* 2. Brand & Primary Workstation Accent */
  --accent-primary:     #f37021;  /* Burp Suite signature active orange */
  --accent-primary-hvr: #e05d06;  /* Deep orange hover state */
  --accent-primary-sub: rgba(243, 112, 33, 0.15); /* Orange translucent pill/badge */

  /* 3. Status & Protocol Semantic Colors */
  --status-2xx-success: #34d399;  /* 200 OK, in-scope, verified vulnerability, HTTPS lock */
  --status-3xx-redirect:#38bdf8;  /* 301/302 Redirect, HTTP URL, protocol tag */
  --status-4xx-client:  #eab308;  /* 400/401/403/404 Warning client error */
  --status-5xx-server:  #ef4444;  /* 500/502/503 Server error, out-of-scope drop, Critical */

  /* 4. Text & Foreground Hierarchy */
  --text-primary:       #ffffff;  /* High-visibility active headings, URLs, methods */
  --text-body:          #dfdfdf;  /* Standard table text, raw editor payloads */
  --text-secondary:     #c4c7c5;  /* Header bar, button labels */
  --text-muted:         #9da5b4;  /* Inactive tabs, column headers, byte lengths */
  --text-subtle:        #6f737a;  /* Tree fold indicators, empty state descriptions */

  /* 5. Borders & Structural Dividers */
  --border-subtle:      #1e1f22;  /* Internal tab divider */
  --border-default:     #2b2d30;  /* Split pane borders, grid lines */
  --border-strong:      #3e4249;  /* Input borders, modal containers, cards */
}
```

---

## 2. Component Semantic Palette Mapping

| Workstation Element | Background Token | Border Token | Text Token | Highlight / State Token |
| :--- | :--- | :--- | :--- | :--- |
| **Top Menu Bar** | `--bg-app-shell` | `--border-default` | `--text-secondary` | Logo `--accent-primary` |
| **Primary Tool Tabs** | `--bg-app-shell` | `--border-subtle` | `--text-muted` | Active tab border `--accent-primary` (2px) |
| **Site Map Tree** | `--bg-canvas-main` | `--border-default` | `--text-body` | Selected node `--bg-item-selected`, HTTPS `--status-2xx-success` |
| **HTTP History Table** | `--bg-canvas-main` | `--border-default` | `--text-body` | Selected row `--bg-item-selected`, Method GET `--status-2xx-success` |
| **Request Raw Editor** | `--bg-canvas-main` | `--border-default` | `--status-2xx-success` | Selection highlight `--accent-primary` |
| **Response Raw Editor**| `--bg-canvas-main` | `--border-default` | `--text-body` | Selection highlight `--accent-primary` |
| **Context Menu** | `--bg-app-shell` | `--border-strong` | `--text-body` | Hover `--bg-item-hover`, Shortcut text `--text-subtle` |
| **Attack Modal** | `--bg-app-shell` | `--border-strong` | `--text-body` | Action buttons `--accent-primary` |
