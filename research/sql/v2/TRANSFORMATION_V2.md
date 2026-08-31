# Validated Input Transformation & Parser Differential Catalog V2 (12 Classes)

**Document Reference:** SENTINEL-V2-TRANS-20  
**Classification:** Parser Differentials, Normalization Pipelines & Gateway Transcoding Analysis  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Multi-Tier Normalization Pipeline

```
[ Client Request ] ──► [ CDN / WAF ] ──► [ Reverse Proxy ] ──► [ Web Server ] ──► [ Deserializer ] ──► [ DB Driver ] ──► [ DB Parser ]
  URL Encoded          Filter / Strip    Canonicalize          URL Decode        JSON / Form Cast    String Escaping    AST Tokenize
```

A **Parser Differential** arises when an intermediate gateway (WAF/Proxy) normalizes or decodes an input differently than the backend database interpreter, allowing executable SQL tokens to bypass detection filters.

---

## 2. Comprehensive 12-Class Transformation Inventory

| Class ID | Transformation Method | Serialization Example | Decoding / Parsing Mechanism | Affected Engines & Layers | Evidence |
|:---|:---|:---|:---|:---|:---|
| **`TRANS-01`** | **Standard URL Percent Encoding** | `%27%20OR%201%3D1--%20` | Decoded once by web server into raw `' OR 1=1-- `. | Standard transport for query strings and form bodies. | **`E5`** |
| **`TRANS-02`** | **Double URL Encoding** | `%2527%2520OR%25201%253D1` | Reverse proxy decodes `%25` to `%`, then application decodes `%27` to `'`. | Bypasses filters inspecting raw request buffer before secondary decoding. | **`E5`** |
| **`TRANS-03`** | **Unicode Overlong UTF-8** | `%C0%A7` or `%u0027` | Legacy UTF-8 decoders normalize overlong sequences into ASCII `'` (`0x27`). | MySQL (utf8mb3), Microsoft SQL Server, IIS. | **`E4`** |
| **`TRANS-04`** | **Multibyte Charset Mismatch (GBK)**| `%bf%27` | PHP `addslashes` converts `'` to `\'` (`0x5c27`); GBK parser consumes `%bf%5c` as single char `0xbf5c`, leaving `'` unescaped! | PHP PDO with `emulate_prepares=true` on GBK/Big5/Shift-JIS databases. | **`E5`** |
| **`TRANS-05`** | **Whitespace Control Byte Substitution**| `%09` (Tab), `%0a` (LF), `%0c` (FF), `%0d` (CR), `%a0` (NBSP) | Database lexers treat control bytes as valid SQL token separators, circumventing regexes expecting space (`%20`). | PostgreSQL, MySQL, MSSQL, Oracle, SQLite. | **`E5`** |
| **`TRANS-06`** | **Inline SQL Comment Insertion**| `UNION/**/SELECT/**/1,2` | Comments treated as valid token boundaries by database engines while breaking static WAF regex signatures. | MySQL, MSSQL, SQLite, PostgreSQL (`/* */`). | **`E5`** |
| **`TRANS-07`** | **Version-Specific MySQL Comments**| `/*!50000SELECT*/` | Executed as SQL by MySQL 5.0+, but treated as benign comments by WAFs. | MySQL & MariaDB. | **`E5`** |
| **`TRANS-08`** | **Case Sensitivity Manipulation**| `uNiOn/**/SeLeCt` | SQL keywords are case-insensitive; bypasses case-sensitive blacklist regexes. | ANSI SQL Universal. | **`E5`** |
| **`TRANS-09`** | **JSON Unicode Escape Sequences**| `\u0027 OR 1=1--` | JSON parser unmarshals `\u0027` into `'` before passing string to query builder. | Node.js, Python, Java JSON REST APIs. | **`E5`** |
| **`TRANS-10`** | **XML Entity Character References**| `&apos; OR 1=1--` / `&#39;` | XML parser resolves entity references before passing text to SQL executor. | SOAP / XML Web Services. | **`E5`** |
| **`TRANS-11`** | **Null-Byte String Truncation** | `admin%00' OR '1'='1` | C-based strings in legacy engines truncated at null byte (`0x00`). *Historical.* | Legacy PHP $\le 5.3$ / MySQL. | **`E4` (Hist)** |
| **`TRANS-12`** | **Hexadecimal & Scientific Literals**| `0x61646d696e` (`'admin'`), `1e0` (`1`)| Database lexers parse hex and exponents directly without requiring single quotes. | MySQL, PostgreSQL, SQLite. | **`E5`** |
