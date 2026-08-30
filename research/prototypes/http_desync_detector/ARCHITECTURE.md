# Architecture: HTTP Desync & Smuggling Detector

## Subsystem Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HTTP DESYNC & SMUGGLING DETECTOR                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Desync Probe Generator                                               │  │
│   │ ├─ CL.TE Non-destructive Timeout Payload                             │  │
│   │ ├─ TE.CL Non-destructive Timeout Payload                             │  │
│   │ ├─ TE.TE Obfuscated RFC 7230 Permutations (tabs, xchunked, wrap)     │  │
│   │ └─ H2.CL / H2.TE HTTP/2 Downgrade Frames                             │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Single-Packet Frame Assembler (MSS <= 1460 bytes packaging)          │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Diagnostic Response Evaluator                                        │  │
│   │ ├─ Timeout-induced backend hang evaluation                           │  │
│   │ ├─ Differential prefix leak & secondary response canary detection    │  │
│   │ └─ Clean remediation generation                                      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```
