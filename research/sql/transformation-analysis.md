# Input Transformation, Encoding & Normalization Analysis

**Document Identifier:** SENTINEL-RES-TRANS-11  
**Classification:** Protocol Encoding, Gateway Normalization & WAF Filter Research  

---

## 1. Multi-Layer Transformation Pipeline

Between the client HTTP request and the backend database parser, an input string passes through multiple parsing, decoding, and normalization stages:

```
[ Client Request ] ──► [ WAF / Proxy ] ──► [ Web Server ] ──► [ Framework ] ──► [ DB Driver ] ──► [ DB Parser ]
  URL Encoded          Filter/Normalize     URL Decode        Type Casting       Escape Checks      AST Tokenize
```

If these intermediate layers decode or normalize strings inconsistently (**Parser Differential**), an input that appears benign to a WAF may be decoded into executable SQL syntax by the backend database.

---

## 2. Comprehensive Transformation Phenomena

| Transformation | Where It Occurs | Mechanism / Description | Relevant DBMSs | Detection & Testing Implication |
|:---|:---|:---|:---|:---|
| **Standard URL Encoding** | Web Server / Gateway | Converting characters to `%HEX` (e.g. `'` $\to$ `%27`, space $\to$ `%20` or `+`). | All | Baseline transport format for query strings and form-urlencoded bodies. |
| **Double URL Encoding** | Reverse Proxy + App | Proxy decodes `%2527` to `%27`, and backend application decodes `%27` to `'`. | All | Bypasses filters inspecting raw request text before secondary decoding. |
| **Inline Comment Insertion**| Framework / DB Parser | Replacing whitespace with SQL comments (`/**/` or `/*!--+*/`). | MySQL, MSSQL, SQLite, PostgreSQL | Allows query construction when WAFs block space characters (`%20`). |
| **Whitespace Replacements**| Database Parser | Using alternative whitespace control characters: `%09` (Tab), `%0A` (LF), `%0C` (FF), `%0D` (CR). | All major DBMSs | Circumvents regexes checking for literal spaces `\s+` between SQL keywords. |
| **Unicode / UTF-8 Overlong**| Reverse Proxy / JSON | Multi-byte UTF-8 representations of ASCII characters (e.g. `%u0027` or `%C0%A7`). | MySQL (utf8mb3/latin1), MSSQL | Exploits character set mismatches between UTF-8 web frontends and latin1 databases. |
| **JSON Escape Sequence** | JSON Parser / Framework | Unmarshaling `\u0027` or `\"` within JSON strings. | Node.js, Python, Java | Ensures JSON payload remains well-formed while delivering unescaped quotes to SQL builder. |
| **Case Manipulation** | Application / WAF | Altering letter casing (e.g. `uNiOn sElEcT` or `SeLeCt`). | ANSI SQL (Case-insensitive) | Bypasses simple case-sensitive string matching signatures in legacy WAFs. |
| **Scientific / Hex Literals** | Database Engine | Expressing integers as hex (`0x1`) or scientific notation (`1e0`). | MySQL, SQLite, PostgreSQL | Bypasses numeric validation checks looking for strict integer digits `^\d+$`. |
