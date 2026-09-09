# Sentinel V6 — Visual & UX Reality Matrix (Workstation Ergonomics Audit)
**Audit Date:** 2026-08-25  
**Baseline Standard:** Modern Professional Security Workstation Information Architecture  
**Objective:** Document exact visual hierarchy, typography, density, split panes, and interactive states.

---

## 1. Visual & Interaction Architecture Audit

| UI Surface / Component | Current Visual Layout | Typography & Fonts | Spacing & Density | Border & Divider Styling | Interactive States (Hover/Focus/Active) | Workstation Parity Assessment | Action / Enhancement Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Header & Menu Bar** | 28px native-style dark bar with Sentinel shield, project dropdown, connected browser trigger, scope pill, settings gear. | Inter / Roboto `11px`, bold `12px` accents. | Ultra-compact, 10px horizontal padding, 6px gaps. | `#2b2d30` bottom border, subtle divider lines. | Hover highlight on menu buttons `#2b2d30`, active tab bottom border `#f37021`. | **EXACT PARITY** | Retain header layout with quick hotkeys (`Alt+B`, `Ctrl+N`). |
| **2. Primary Workspace Tabs** | Horizontal scrollable tab strip with 25 tools: Dashboard, Target, Proxy, Intruder, Repeater, Collaborator, Sequencer, Decoder, Comparer, Logger, Organizer, etc. | Sans-serif `12px`, uppercase tool badges. | `h-8` tab height, `px-3` per tab item. | Bottom active indicator `#f37021` (2px solid border). | White text on active, `#9da5b4` muted on inactive, hover `#c4c7c5`. | **EXACT PARITY** | Badge counts for live Proxy traffic (`badgeKey: 'trafficCount'`) and Critical findings. |
| **3. Target Site Map Tree (Left)** | 280px tree pane with HTTPS lock icons (`Lock` in green `#34d399`), HTTP globe icons (`#38bdf8`), expandable folder arrows. | Monospace `11px`, monospace request count badges. | Compact list, `py-0.5`, indented sub-folders. | `#2b2d30` right divider. | Selected host node highlighted `#2b2d30` with bold white text; right-click context menu active. | **EXACT PARITY** | Supports direct right-click automated content discovery & browser launch. |
| **4. Target Endpoints Table (Top Right)** | 50% split height virtualized table: `Host`, `Method`, `URL ^`, `Params (✓)`, `Status code`, `Length`, `MIME type`, `Title`, `Notes`. | JetBrains Mono / Source Code Pro `11px`. | `h-6` row height, no wasted padding. | `#2b2d30` grid row borders. | Status codes colorized (200 green `#34d399`, 302 cyan `#38bdf8`, 404 yellow `#eab308`, 500 red `#ef4444`). | **EXACT PARITY** | Right-click context menu dispatches to Repeater, Intruder, Browser. |
| **5. Request / Response Split Pane (Bottom Right)** | 50% split height with side-by-side Request (Left 50%) and Response (Right 50%) inspectors. | JetBrains Mono `11px` with line height `1.4`. | Header bar `28px`, search footer `24px`. | Vertical divider `#2b2d30` between Request and Response. | Sub-tab buttons (`Pretty`, `Raw`, `Hex`, `Render`), search highlight indicators, live byte counts. | **EXACT PARITY** | Matches Burp Suite dual-pane inspection layout. |
| **6. Repeater Multi-Tab Workbench** | Tab bar with color-coded labels, add tab (`+`), close tab (`x`), history revision drawer (`Ctrl+H`), side-by-side diff modal (`Ctrl+D`). | Sans `12px` tab titles, mono `12px` editors. | Responsive split pane (Horizontal / Vertical toggle `Ctrl+\`). | Active tab top border / highlight, `#2b2d30` panels. | Send button with pulsing state, status badge (`200 OK`, `12ms`, `1.4 KB`). | **EXACT PARITY** | Dual-mode request/response viewing with dynamic variable extraction. |
| **7. Intruder / Fuzzer Editor & Attack Modal** | Request template textarea with `§...§` position highlight badges, payload configuration panel, detached attack window. | Monospace `12px` for request template, sans `12px` for config. | Two-column setup (Left: Template & Payload markers, Right: Attack configuration). | `#2b2d30` borders, `#f37021` highlight badges. | Minimize, maximize, close window controls; `Attack ▾` & `Save ▾` (CSV/JSON/TXT) dropdowns. | **EXACT PARITY** | Live real-request execution with grep-match and regex extractors. |
| **8. Context Menu (Universal)** | Floating dark context menu with keyboard shortcuts aligned right (`Ctrl+R`, `Ctrl+I`, `Ctrl+O`). | Sans `11px`, muted shortcut text `#8c9099`. | Compact `py-1` padding, divider lines. | Rounded `4px`, shadow-xl, border `#3e4249`. | Hover item `#282b30`, text white. | **EXACT PARITY** | Suppresses Chromium browser menu globally; dispatches real state across stores. |

---

## 2. Workstation Information Density Standards

1. **Zero Decorative Padding**: Maximum vertical space dedicated to HTTP wire data, request headers, payload parameters, and response bodies.
2. **Typography Standardization**: Monospace fonts strictly reserved for raw network payloads, hashes, status codes, and HTTPQL syntax; clean sans-serif reserved for navigation labels and metadata badges.
3. **Deterministic Micro-Interactions**: Hover, active, focus, and disabled states are tied to live store and socket states with zero fake loading indicators.
