# SENTINEL — SQL INJECTION MASTER CATALOG (RESEARCHED 2026)

## Scope

This is an evidence-backed taxonomy for SQL injection and closely related SQL/query-manipulation security issues in web applications.

Important: there is **no finite authoritative list of every SQLi payload or every string ever published**. Payload permutations are effectively unbounded. This catalog therefore enumerates distinct attack families, subtechniques, execution contexts, observation methods, lifecycle patterns, and implementation variants that can be meaningfully represented and tested.

It is designed as a **knowledge base for Sentinel**, not as a payload dump.

---

# 1. Core SQL Injection Families

### A. Predicate / expression injection
1. String-literal delimiter breakout
2. Numeric-expression injection
3. Boolean tautology injection
4. Boolean contradiction injection
5. AND/OR predicate manipulation
6. NOT predicate manipulation
7. Conditional expression injection
8. CASE-based conditional injection
9. NULL-semantics manipulation
10. Three-valued-logic manipulation
11. Arithmetic-expression injection
12. Bitwise-expression injection
13. Range/comparison manipulation
14. EXISTS/NOT EXISTS predicate manipulation
15. IN-list predicate manipulation
16. Scalar-subquery predicate injection
17. Correlated-subquery manipulation
18. Function-expression injection
19. Operator injection
20. Wildcard/pattern predicate manipulation

### B. In-band projection / set manipulation
21. UNION projection injection
22. UNION ALL projection injection
23. EXCEPT/INTERSECT/MINUS set manipulation
24. Column-count discovery
25. Projection datatype alignment
26. Reflected canary projection
27. Multi-column projection extraction
28. Scalar-subquery projection
29. Nested projection manipulation
30. Hidden/nested UNION scenarios
31. Set-operation differential testing

### C. Error-based SQL injection
32. Syntax-error injection
33. Type-conversion error injection
34. CAST/CONVERT error disclosure
35. Arithmetic exception induction
36. Division-by-zero based observation
37. Numeric overflow/underflow error behavior
38. XML/XPath error-based techniques
39. Regex/parser error behavior
40. Function-induced exceptions
41. Conditional error techniques
42. DBMS-specific verbose-error extraction

### D. Blind / inferential SQL injection
43. Boolean-content differential
44. Boolean-status differential
45. Redirect differential
46. Header differential
47. Structural/DOM differential
48. Application-state differential
49. Row-count differential
50. Conditional-result inference
51. Existence inference
52. Length inference
53. Character inference
54. Range inference
55. Binary-search inference
56. Bitwise inference
57. Membership inference
58. Adaptive inference
59. Statistical inference
60. Sequential hypothesis testing
61. Noisy-channel inference
62. Repetition/majority voting
63. Backtracking inference
64. Entropy-weighted search
65. Information-gain-driven search

### E. Time / side-channel SQL injection
66. Conditional timing
67. Fixed-delay timing
68. Statistical timing
69. Resource-contention timing
70. Computational-delay timing
71. Lock/contention timing
72. Cache-related timing
73. Query-planner/optimizer timing
74. Distributed-database timing effects
75. Asynchronous/delayed timing observation

### F. Stacked / batched / procedural execution
76. Multi-statement chaining
77. Statement batching
78. Procedural block injection
79. Stored-procedure invocation
80. Dynamic SQL execution
81. Procedure-parameter SQL injection
82. Batch-control manipulation
83. Transaction-control injection
84. Savepoint manipulation
85. Session/control-statement injection

### G. Out-of-band SQL injection
86. DNS-based OOB
87. HTTP-based OOB
88. HTTPS-based OOB
89. SMB-based OOB
90. LDAP/network callback variants
91. DBMS extension network callbacks
92. Delayed OOB correlation
93. Asynchronous OOB correlation

### H. Second-order / stored SQL injection
94. Stored user-input SQLi
95. Stored profile-field SQLi
96. Stored comment/ticket SQLi
97. Stored metadata SQLi
98. Stored configuration SQLi
99. Stored filename SQLi
100. Stored import-data SQLi
101. Admin-triggered second-order SQLi
102. Report-triggered second-order SQLi
103. Scheduled-job second-order SQLi
104. Background-worker SQLi
105. Queue-triggered SQLi
106. Cross-endpoint second-order SQLi
107. Cross-service second-order SQLi
108. Multi-stage workflow SQLi

---

# 2. SQL Grammar / AST Contexts

109. Single-quoted string literal
110. Double-quoted string/identifier
111. Alternative quoted literal
112. Dollar-quoted literal
113. Q-quoted literal
114. Backtick identifier
115. Bracketed identifier
116. Numeric literal
117. Parenthesized numeric/expression
118. Bitwise expression
119. Hexadecimal literal
120. Scientific-notation literal
121. LIKE pattern
122. Regular-expression pattern
123. WHERE predicate
124. JOIN condition
125. ON condition
126. GROUP BY expression
127. HAVING predicate
128. ORDER BY expression
129. ORDER BY identifier
130. ORDER direction
131. LIMIT expression
132. OFFSET expression
133. FETCH row count
134. Window partition expression
135. Window ordering expression
136. Table identifier
137. Schema identifier
138. Column identifier
139. Projection expression
140. Function argument
141. EXISTS expression
142. IN-list element
143. Scalar subquery
144. Correlated subquery
145. CTE expression
146. INSERT VALUES expression
147. INSERT SELECT projection
148. UPDATE assignment
149. DELETE predicate
150. MERGE predicate
151. UPSERT assignment
152. Dynamic EXEC/EXECUTE string
153. Stored-procedure parameter
154. JSON operator/path expression
155. Array index
156. Array slice
157. Full-text search expression
158. Search/query-pattern expression
159. Extension-specific expression
160. DDL expression
161. DCL expression
162. Session/control expression

---

# 3. Web / Application Ingress Surfaces

163. URL query parameter
164. Form-urlencoded body
165. Multipart form field
166. Multipart filename/metadata
167. Cookie value
168. Standard HTTP header
169. Custom HTTP header
170. REST path segment
171. JSON scalar field
172. Nested JSON object
173. JSON array element
174. XML element
175. XML attribute
176. SOAP parameter
177. GraphQL variable
178. GraphQL field argument
179. GraphQL query document input
180. WebSocket message
181. gRPC-transcoded field
182. API gateway transformed parameter
183. Service-to-service propagated parameter
184. Message queue payload
185. Background-job payload
186. Scheduled-job input
187. Import pipeline
188. Export/report parameter
189. Search/filter interface
190. Administrative interface
191. Batch-processing interface

---

# 4. ORM / Query-Builder / Query-Language Classes

192. Raw SQL concatenation
193. Unsafe string interpolation
194. Raw-query escape-hatch misuse
195. Dynamic identifier injection
196. Dynamic ORDER BY injection
197. Dynamic filter injection
198. Dynamic expression injection
199. Raw SQL fragment injection
200. Unsafe JSON query construction
201. Unsafe array query construction
202. Query-builder operator injection
203. ORM scope/filter injection
204. HQL injection
205. JPQL injection
206. DQL injection
207. Framework-specific query-language injection
208. Template-generated SQL injection
209. Generated-query injection
210. Stored-query fragment injection

---

# 5. Driver / Protocol / Execution-Layer Variants

211. Client-side parameter interpolation
212. Server-side prepared-statement differences
213. Emulated prepared statements
214. Multi-statement configuration differences
215. Batch API behavior
216. Raw-query API behavior
217. Parameter typing differences
218. Driver-specific parser behavior
219. Connection-pool behavior
220. Protocol framing differences
221. Query/batch API distinction
222. Session-state differences
223. Character-set handling in the driver
224. Application-side escaping vs server parameterization

---

# 6. Transformation / Parser-Differential Classes

225. URL percent encoding
226. Repeated/double decoding
227. JSON escape decoding
228. XML entity decoding
229. Unicode normalization differences
230. Character-set conversion differences
231. Multibyte character-set mismatch
232. Whitespace normalization differences
233. Comment handling differences
234. Case normalization differences
235. Canonicalization differences
236. Proxy rewriting
237. WAF/backend parser differential
238. Framework normalization
239. Serialization/deserialization differential
240. Gateway transcoding differential
241. Request normalization mismatch

---

# 7. Database / Dialect Dimensions

242. PostgreSQL-specific SQLi
243. MySQL-specific SQLi
244. MariaDB-specific SQLi
245. Microsoft SQL Server-specific SQLi
246. Oracle-specific SQLi
247. SQLite-specific SQLi
248. Microsoft Access-specific SQLi
249. IBM Db2-specific SQLi
250. SAP HANA-specific SQLi
251. Firebird-specific SQLi
252. H2-specific SQLi
253. HSQLDB-specific SQLi
254. Apache Derby-specific SQLi
255. Informix-specific SQLi
256. CockroachDB-specific SQLi
257. TiDB-specific SQLi
258. YugabyteDB-specific SQLi
259. DuckDB-specific query injection
260. ClickHouse-specific query injection
261. Snowflake-specific SQL injection
262. Amazon Redshift-specific SQL injection
263. Google BigQuery-specific query injection
264. Databricks SQL-specific query injection
265. Trino/Presto query injection
266. Vertica-specific SQL injection
267. Sybase-family SQL injection
268. Other SQL-compatible-engine variants

---

# 8. Observation / Oracle Classes

269. Direct body reflection
270. Direct JSON projection
271. Direct XML projection
272. Unique canary reflection
273. Syntax error
274. Type-conversion error
275. Conditional error
276. XML/XPath error
277. Arithmetic exception
278. Overflow exception
279. Boolean content differential
280. Boolean status differential
281. Header differential
282. Redirect differential
283. DOM/structural differential
284. AST/semantic response differential
285. Timing differential
286. Statistical timing
287. Resource-contention timing
288. Application-state change
289. Row-count differential
290. Pagination-total differential
291. Delayed application effect
292. Workflow effect
293. OOB DNS
294. OOB HTTP
295. OOB SMB
296. Other documented network callback
297. Multi-oracle evidence fusion

---

# 9. Blind / Search Algorithms

298. Linear search
299. Binary search
300. Bitwise search
301. Length binary search
302. Range splitting
303. Membership queries
304. Character-by-character recovery
305. Adaptive search
306. Bayesian belief updating
307. Expected information gain
308. Sequential probability ratio testing
309. Non-parametric latency comparison
310. Majority-vote repetition
311. Backtracking
312. Noisy-channel estimation
313. Frequency-weighted search
314. Dictionary-prior search
315. Multi-hypothesis search
316. Early stopping
317. Confidence-bound stopping

---

# 10. Stateful / Workflow Patterns

318. Synchronous first-order
319. Stored second-order
320. Deferred execution
321. Asynchronous worker
322. Scheduled execution
323. Cross-endpoint execution
324. Cross-service execution
325. Administrative-review execution
326. Queue-triggered execution
327. Event-driven execution
328. Multi-step N>=3 workflow
329. Persistent-state propagation

---

# 11. Impact / Capability Classes

These are **not separate SQLi mechanisms**, but Sentinel should distinguish them:

330. Authentication impact
331. Authorization impact
332. Tenant-isolation impact
333. Schema disclosure
334. Metadata disclosure
335. Data disclosure
336. Credential disclosure
337. Data modification
338. Data deletion
339. Transaction manipulation
340. Privilege escalation
341. File interaction
342. Network interaction
343. Operating-system consequence
344. Persistence consequence

---

# 12. Related But Distinct Security Areas

These should remain separate from core SQL injection unless the actual SQL boundary is demonstrated.

345. NoSQL injection
346. LDAP injection
347. XPath/XQuery injection
348. HQL/JPQL injection
349. ORM object/operator manipulation
350. Template injection
351. Command injection
352. AI prompt injection
353. AI-generated-SQL manipulation
354. Vector query manipulation
355. Protocol smuggling
356. Database-engine implementation bugs
357. Database authorization flaws

---

# 13. Sentinel Classification Rules

Every discovered item should be classified as:

- TRUE_SQLI
- SQLI_SUBTECHNIQUE
- SQLI_VARIANT
- DBMS_VARIANT
- CONTEXT_VARIANT
- ORACLE
- INFERENCE_METHOD
- TRANSFORMATION
- DRIVER_BEHAVIOR
- FRAMEWORK_PATTERN
- LIFECYCLE
- IMPACT
- RELATED_SECURITY
- THEORETICAL
- HISTORICAL
- OBSOLETE
- UNSUPPORTED

Never inflate the SQLi count by counting every payload mutation as a separate attack.

---

# 14. What This Means for Sentinel

The scanner should not execute entries in numerical order.

Instead:

1. Discover all candidate inputs.
2. Infer plausible SQL contexts.
3. Infer plausible DBMS families.
4. Map the input to applicable knowledge-graph nodes.
5. Eliminate only branches that are demonstrably incompatible.
6. Schedule applicable low-risk tests concurrently.
7. Keep timing-sensitive tests isolated.
8. Analyze evidence.
9. Update hypotheses.
10. Re-plan.
11. Follow reachable workflows where authorized.
12. Continue until applicable branches are confirmed, rejected, inconclusive, unsupported, or unreachable.

The number of **derived test combinations** can become vastly larger than the number of named techniques.

---

# 15. Important Research Corrections

This catalog deliberately does NOT claim that every historical CVE involving a database is SQLi.

It also does NOT treat:
- OGNL injection as SQL injection
- command injection as SQL injection
- NoSQL injection as SQL injection
- generic ORM misuse as automatically SQL injection
- AI prompt injection as automatically SQL injection
- vector-query manipulation as automatically SQL injection

Those are separate categories unless the SQL execution boundary is established.

---

# 16. Source Basis

This research structure was cross-checked against:

- OWASP Web Security Testing Guide (latest)
- OWASP SQL Injection Prevention guidance
- MITRE CAPEC / CWE SQL injection classifications
- PortSwigger Web Security Academy SQL injection material
- sqlmap current documentation/wiki
- SQL injection and database-testing research literature
- vendor/database documentation where relevant

Current public guidance confirms that SQLi includes multiple detection/exploitation styles and that ORM injection and client-side SQL database injection are relevant but distinct testing areas.

---

# 17. Reality Check

There is no scientifically defensible fixed number that equals:

> “all SQL injection attacks on the Internet.”

The defensible unit is a **knowledge graph** with:

- distinct mechanisms
- techniques
- subtechniques
- contexts
- DBMS/version variants
- drivers
- frameworks
- surfaces
- workflows
- oracles
- inference methods
- transformations

That graph is what Sentinel should use to construct its applicable investigation space.

Research date: 2026-08-31
