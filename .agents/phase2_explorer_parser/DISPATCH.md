## 2026-08-17T08:19:41Z

You are the Parser Explorer for Phase 2: Traffic, Proxy & Protocol Engine.
Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_explorer_parser`
You must read `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md` and `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md` before starting.

YOUR TASK:
1. Investigate the design and implementation strategy for `crates/sentinel_parser`:
   - Requirements for `HttpParser` trait implementation.
   - Fault-tolerant parsing of HTTP/1.1 & HTTP/2 requests and responses.
   - Preserving malformed headers, repeated headers, raw transfer encodings, and request smuggling indicators.
   - Serialization: `serialize_request` and `serialize_response` preserving byte accuracy (`serialize(parse(raw)) == raw` roundtrip for well-formed and anomaly inputs).
   - Integration with `httparse` or custom zero-copy parsing techniques.
   - Proptest, fuzzing, and unit test strategy.
2. Recommend concrete crate layout, modules (`parser::request`, `parser::response`, `parser::smuggling`, `parser::serialize`), data structures, and dependency selections.
3. Write your complete report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_explorer_parser\handoff.md`.
4. Maintain `progress.md` with timestamps.
5. Message the orchestrator (ID: ebf19a92-a9bf-4dc2-830a-557507a9aa67) when done.
