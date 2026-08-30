#!/usr/bin/env python3
"""
Sentinel V6 - High-Performance Test Data & Synthetic Workload Generator
========================================================================
Generates high-speed SQLite databases conforming to V6_SQLITE_SCHEMA.sql
(streaming up to 1,000,000 transactions), 1MB-100MB diff body test files,
and 20,000-entry Command Palette index datasets.
"""

import argparse
import hashlib
import json
import math
import os
import random
import sqlite3
import string
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


SCHEMA_DDL = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS scopes (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    includes_json TEXT NOT NULL,
    excludes_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);

CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    graph_node_id TEXT NOT NULL,
    FOREIGN KEY (graph_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoints_unique ON endpoints(host, path, method);
CREATE INDEX IF NOT EXISTS idx_endpoints_graph_node ON endpoints(graph_node_id);

CREATE TABLE IF NOT EXISTS parameters (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    inferred_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parameters_endpoint ON parameters(endpoint_id);

CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    provenance TEXT NOT NULL,
    source TEXT NOT NULL,
    data_ref TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_observations_data_ref ON observations(data_ref);
CREATE INDEX IF NOT EXISTS idx_observations_scope ON observations(scope_id);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    protocol TEXT NOT NULL,
    stream_id INTEGER,
    req_method TEXT NOT NULL,
    req_uri TEXT NOT NULL,
    req_blob_id TEXT NOT NULL,
    req_normalized_text TEXT NOT NULL,
    res_status INTEGER,
    res_blob_id TEXT,
    res_normalized_text TEXT,
    timing_ms INTEGER NOT NULL,
    tls_cipher TEXT,
    version INTEGER NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_uri ON transactions(req_uri);
CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope_id);

CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    username TEXT NOT NULL,
    roles_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    cookies_json TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME,
    FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_identity ON sessions(identity_id);

CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    secret_reference TEXT NOT NULL,
    access_level TEXT NOT NULL,
    expires_at DATETIME,
    FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credentials_identity ON credentials(identity_id);

CREATE TABLE IF NOT EXISTS oast_tokens (
    id TEXT PRIMARY KEY,
    token_string TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL,
    context_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_oast_tokens_string ON oast_tokens(token_string);

CREATE TABLE IF NOT EXISTS oast_interactions (
    id TEXT PRIMARY KEY,
    token_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    protocol TEXT NOT NULL,
    source_ip TEXT NOT NULL,
    raw_blob_id TEXT NOT NULL,
    FOREIGN KEY (token_id) REFERENCES oast_tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oast_interactions_token ON oast_interactions(token_id);

CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    source_observation_id TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (source_observation_id) REFERENCES observations(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_source_obs ON candidates(source_observation_id);

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    strategy_type TEXT NOT NULL,
    strategy_version TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    confidence REAL NOT NULL,
    executed_at DATETIME NOT NULL,
    duration_ms INTEGER NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verifications_candidate ON verifications(candidate_id);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    verification_id TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    data_blob_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (verification_id) REFERENCES verifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_verification ON evidence(verification_id);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    verification_id TEXT NOT NULL,
    state TEXT NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (verification_id) REFERENCES verifications(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_verification ON findings(verification_id);
CREATE INDEX IF NOT EXISTS idx_findings_state_severity ON findings(state, severity);
CREATE INDEX IF NOT EXISTS idx_findings_scope ON findings(scope_id);

CREATE TABLE IF NOT EXISTS task_checkpoints (
    task_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    last_updated DATETIME NOT NULL,
    state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    config_json TEXT NOT NULL,
    generated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS regression_tests (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    seed_transaction_id TEXT NOT NULL,
    expected_status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
    FOREIGN KEY (seed_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regression_tests_finding ON regression_tests(finding_id);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_target ON notes(target_id);

CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    blob_id TEXT NOT NULL,
    full_page BOOLEAN NOT NULL,
    timestamp DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS attack_paths (
    id TEXT PRIMARY KEY,
    start_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    risk_score REAL NOT NULL,
    discovered_at DATETIME NOT NULL,
    FOREIGN KEY (start_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attack_paths_start ON attack_paths(start_node_id);
CREATE INDEX IF NOT EXISTS idx_attack_paths_target ON attack_paths(target_node_id);

CREATE TABLE IF NOT EXISTS scan_configs (
    id TEXT PRIMARY KEY,
    scope_id TEXT NOT NULL,
    concurrency_limit INTEGER NOT NULL,
    active_plugins_json TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_configs_scope ON scan_configs(scope_id);

CREATE TABLE IF NOT EXISTS proxy_intercept_rules (
    id TEXT PRIMARY KEY,
    match_condition TEXT NOT NULL,
    action TEXT NOT NULL,
    action_data_json TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1
);
"""

HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
STATUS_CODES = [200, 201, 204, 301, 302, 400, 401, 403, 404, 422, 500, 502, 503]
STATUS_WEIGHTS = [65, 10, 5, 2, 3, 4, 3, 2, 3, 1, 1, 0.5, 0.5]
URL_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/users',
    '/api/v1/users/profile',
    '/api/v1/users/settings',
    '/api/v1/orders',
    '/api/v1/orders/checkout',
    '/api/v1/products',
    '/api/v1/products/search',
    '/api/v1/inventory',
    '/api/v1/admin/dashboard',
    '/api/v1/admin/roles',
    '/api/v1/admin/audit-logs',
    '/api/v1/payments/charge',
    '/api/v1/billing/invoices',
    '/api/v2/graphql',
    '/api/v2/websocket',
    '/static/js/bundle.min.js',
    '/static/css/theme.min.css',
    '/static/images/logo.png',
]
HOSTS = [
    'target.local',
    'api.target.local',
    'auth.target.local',
    'admin.target.local',
    'cdn.target.local',
]
PROTOCOLS = ['HTTP/1.1', 'HTTP/2.0']
TLS_CIPHERS = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256', 'TLS_AES_128_GCM_SHA256']


def generate_sha256(content: str | bytes) -> str:
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha256(content).hexdigest()


def generate_sqlite_dataset(output_path: str, count: int, batch_size: int = 10000) -> float:
    """Streams count transactions into a SQLite database conforming to V6_SQLITE_SCHEMA.sql."""
    db_file = Path(output_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    if db_file.exists():
        db_file.unlink()

    print(f"[*] Initializing SQLite database at: {output_path}")
    print(f"[*] Target transaction count: {count:,} records (batch size: {batch_size:,})")

    t_start = time.perf_counter()

    conn = sqlite3.connect(output_path, isolation_level=None)
    cursor = conn.cursor()

    # Fast bulk insertion pragmas
    cursor.execute("PRAGMA journal_mode=MEMORY;")
    cursor.execute("PRAGMA synchronous=OFF;")
    cursor.execute("PRAGMA temp_store=MEMORY;")
    cursor.execute("PRAGMA cache_size=-128000;") # 128MB cache

    cursor.executescript(SCHEMA_DDL)

    # 1. Insert Base Scope
    scope_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "INSERT INTO scopes (id, version, timestamp, includes_json, excludes_json) VALUES (?, ?, ?, ?, ?)",
        (
            scope_id,
            1,
            now_iso,
            json.dumps(["target.local", "https://api.target.local/*"]),
            json.dumps(["169.254.169.254/32", "10.0.0.0/8", "127.0.0.1/32"]),
        ),
    )

    # 2. Insert Knowledge Graph & Endpoints
    graph_node_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO graph_nodes (id, version, timestamp, node_type, label, metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
        (graph_node_id, 1, now_iso, "ASSET", "target.local", json.dumps({"environment": "production"})),
    )

    for i, path in enumerate(URL_PATHS[:10]):
        ep_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT OR IGNORE INTO endpoints (id, host, path, method, timestamp, graph_node_id) VALUES (?, ?, ?, ?, ?, ?)",
            (ep_id, "api.target.local", path, "GET" if i % 2 == 0 else "POST", now_iso, graph_node_id),
        )

    # 3. Insert Identities & Sessions
    identity_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO identities (id, version, timestamp, username, roles_json) VALUES (?, ?, ?, ?, ?)",
        (identity_id, 1, now_iso, "pentester_admin", json.dumps(["ADMIN", "SECURITY_AUDITOR"])),
    )
    cursor.execute(
        "INSERT INTO sessions (id, identity_id, cookies_json, headers_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), identity_id, json.dumps({"session_id": "sess-998877"}), json.dumps({"Authorization": "Bearer tok-123"}), now_iso),
    )

    # 4. Stream Transactions & Observations in Batches
    num_batches = math.ceil(count / batch_size)
    total_inserted = 0

    for b in range(num_batches):
        cur_batch_size = min(batch_size, count - total_inserted)
        tx_rows = []
        obs_rows = []

        for i in range(cur_batch_size):
            global_idx = total_inserted + i
            tx_id = f"tx-{global_idx:08d}-{uuid.uuid4().hex[:8]}"
            obs_id = f"obs-{global_idx:08d}-{uuid.uuid4().hex[:8]}"
            
            method = random.choice(HTTP_METHODS)
            host = random.choice(HOSTS)
            path = random.choice(URL_PATHS)
            uri = f"https://{host}{path}?id={global_idx}&ref=test"
            protocol = random.choice(PROTOCOLS)
            status = random.choices(STATUS_CODES, weights=STATUS_WEIGHTS)[0]
            timing = random.randint(8, 450)
            tls = random.choice(TLS_CIPHERS)

            req_body = f'{{"action":"req_{global_idx}","timestamp":{int(time.time())},"index":{global_idx}}}'
            res_body = f'{{"status":"ok","code":{status},"response_id":"{tx_id}","data":"payload_{global_idx}"}}'

            req_blob_id = generate_sha256(req_body)
            res_blob_id = generate_sha256(res_body)

            req_text = f"{method} {path}?id={global_idx}&ref=test {protocol}\r\nHost: {host}\r\nUser-Agent: Sentinel-V6-TestRunner/6.0\r\nContent-Type: application/json\r\nContent-Length: {len(req_body)}\r\n\r\n{req_body}"
            res_text = f"{protocol} {status} OK\r\nServer: Sentinel/6.0-MockEngine\r\nContent-Type: application/json\r\nContent-Length: {len(res_body)}\r\n\r\n{res_body}"

            tx_rows.append((
                tx_id,
                now_iso,
                protocol,
                global_idx % 100,
                method,
                uri,
                req_blob_id,
                req_text,
                status,
                res_blob_id,
                res_text,
                timing,
                tls,
                1,
                "PROXY_INGEST",
                "ACTIVE",
                scope_id,
            ))

            obs_rows.append((
                obs_id,
                1,
                now_iso,
                "PROXY",
                "TRAFFIC_INTERCEPT",
                req_blob_id,
                "CAPTURED",
                scope_id,
            ))

        cursor.execute("BEGIN TRANSACTION;")
        cursor.executemany(
            """
            INSERT INTO transactions (
                id, timestamp, protocol, stream_id, req_method, req_uri,
                req_blob_id, req_normalized_text, res_status, res_blob_id,
                res_normalized_text, timing_ms, tls_cipher, version, provenance,
                lifecycle, scope_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            tx_rows,
        )
        cursor.executemany(
            """
            INSERT INTO observations (
                id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            obs_rows,
        )
        cursor.execute("COMMIT;")

        total_inserted += cur_batch_size
        if (b + 1) % 5 == 0 or total_inserted == count:
            elapsed = time.perf_counter() - t_start
            rate = total_inserted / elapsed if elapsed > 0 else 0
            print(f"  -> Inserted {total_inserted:,} / {count:,} records ({rate:,.1f} records/sec)")

    # 5. Insert Sample Findings and Verifications
    cand_id = str(uuid.uuid4())
    obs_sample = f"obs-00000000-{uuid.uuid4().hex[:8]}"
    cursor.execute(
        "INSERT OR IGNORE INTO observations (id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (obs_sample, 1, now_iso, "PROXY", "TRAFFIC", "blob-sample-01", "CAPTURED", scope_id),
    )
    cursor.execute(
        "INSERT INTO candidates (id, timestamp, source_observation_id, hypothesis, status, version, provenance, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (cand_id, now_iso, obs_sample, "IDOR Vulnerability on /api/v1/users/{id}", "VERIFIED", 1, "AUTOMATED_SCAN", "ACTIVE", scope_id),
    )
    verif_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO verifications (id, candidate_id, strategy_type, strategy_version, success, confidence, executed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (verif_id, cand_id, "CROSS_ROLE_STATE_DELTA", "1.0", 1, 0.99, now_iso, 45),
    )
    cursor.execute(
        "INSERT INTO findings (id, version, timestamp, title, severity, verification_id, state, provenance, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), 1, now_iso, "BOLA / IDOR in Profile Endpoint", "HIGH", verif_id, "CONFIRMED", "VERIFICATION_ENGINE", "ACTIVE", scope_id),
    )

    # 6. Apply Production PRAGMAs & WAL Mode
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    conn.commit()
    conn.close()

    t_end = time.perf_counter()
    total_time = t_end - t_start
    file_size_mb = db_file.stat().st_size / (1024 * 1024)

    print(f"[OK] Completed SQLite dataset generation: {count:,} records in {total_time:.2f}s ({count/total_time:,.1f} rec/s, DB size: {file_size_mb:.2f} MB)")
    return total_time


def generate_diff_payload_files(output_dir: str) -> dict:
    """Generates 1MB, 5MB, 10MB, 50MB, 100MB synthetic diff body files."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    sizes_mb = [1, 5, 10, 50, 100]
    mutation_rates = [0.05, 0.02, 0.01, 0.005, 0.001]
    results = {}

    print(f"[*] Generating synthetic diff payload pairs in: {output_dir}")

    for size_mb, mut_rate in zip(sizes_mb, mutation_rates):
        t0 = time.perf_counter()
        target_bytes = size_mb * 1024 * 1024

        line_len = 100
        line_count = target_bytes // line_len

        orig_lines = []
        mod_lines = []

        for i in range(line_count):
            base_line = f"line_{i:07d}: " + "".join(random.choices(string.ascii_letters + string.digits, k=80))
            orig_lines.append(base_line)

            if random.random() < mut_rate:
                mod_line = f"line_{i:07d}: MODIFIED_" + "".join(random.choices(string.ascii_letters + string.digits, k=71))
                mod_lines.append(mod_line)
            else:
                mod_lines.append(base_line)

        orig_text = "\n".join(orig_lines)
        mod_text = "\n".join(mod_lines)

        orig_file = out_path / f"body_{size_mb}mb_original.txt"
        mod_file = out_path / f"body_{size_mb}mb_modified.txt"

        orig_file.write_text(orig_text, encoding='utf-8')
        mod_file.write_text(mod_text, encoding='utf-8')

        elapsed = time.perf_counter() - t0
        results[f"{size_mb}MB"] = {
            "orig_size_bytes": orig_file.stat().st_size,
            "mod_size_bytes": mod_file.stat().st_size,
            "lines": line_count,
            "gen_time_sec": round(elapsed, 3),
        }
        print(f"  -> Generated {size_mb}MB diff pair ({line_count:,} lines) in {elapsed:.2f}s")

    return results


def generate_command_palette_dataset(output_path: str, count: int = 20000) -> float:
    """Generates 20,000 Command Palette index items."""
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"[*] Generating {count:,} Command Palette items at: {output_path}")
    t0 = time.perf_counter()

    categories = [
        "Workspace", "Proxy", "Scope", "Repeater", "Scanner", "Fuzzer",
        "Identity", "Authz", "API Security", "Browser", "OAST", "Findings",
        "Notebook", "Attack Graph", "Reporting", "Settings", "System"
    ]
    verbs = ["Open", "Switch to", "Toggle", "Run", "Inspect", "Export", "Clear", "Analyze", "Filter", "Configure"]

    commands = []
    for i in range(count):
        cat = categories[i % len(categories)]
        verb = verbs[i % len(verbs)]
        cmd_id = f"cmd-{i:06d}"
        title = f"{verb} {cat} Action {i}: Target Subsystem Component #{i % 250}"
        shortcut = f"Ctrl+Shift+{chr(65 + (i % 26))}" if i < 100 else None
        keywords = [
            f"tag-{i % 50}",
            f"module-{i % 100}",
            cat.lower().replace(" ", "-"),
            verb.lower(),
            f"id_{i}"
        ]

        commands.append({
            "id": cmd_id,
            "title": title,
            "category": cat,
            "shortcut": shortcut,
            "keywords": keywords,
            "action": f"action://sentinel/{cat.lower().replace(' ', '_')}/{verb.lower()}_{i}"
        })

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(commands, f, indent=2)

    elapsed = time.perf_counter() - t0
    file_size_mb = out_file.stat().st_size / (1024 * 1024)
    print(f"[OK] Completed Command Palette dataset: {count:,} commands in {elapsed:.2f}s ({file_size_mb:.2f} MB)")
    return elapsed


def main():
    parser = argparse.ArgumentParser(description="Sentinel V6 High-Speed Test Data Generator")
    parser.add_argument("--count", type=int, default=100000, help="Number of SQLite transactions to generate")
    parser.add_argument("--output-db", type=str, help="Output SQLite database path (.sentinel)")
    parser.add_argument("--output-diff-dir", type=str, help="Output directory for synthetic diff body files (1MB-100MB)")
    parser.add_argument("--output-palette", type=str, help="Output path for Command Palette JSON dataset")
    parser.add_argument("--all", action="store_true", help="Generate all datasets (100K DB, diff payloads, 20K palette)")
    parser.add_argument("--benchmark", action="store_true", help="Report throughput and resource benchmarks")

    args = parser.parse_args()

    if not any([args.output_db, args.output_diff_dir, args.output_palette, args.all]):
        # Default self-test mode: generate sample datasets in storage/
        args.all = True

    if args.all:
        storage_dir = Path("storage")
        storage_dir.mkdir(exist_ok=True)
        generate_sqlite_dataset("storage/test_100k.sentinel", args.count)
        generate_diff_payload_files("storage/diff_payloads")
        generate_command_palette_dataset("storage/palette_20k.json", 20000)
    else:
        if args.output_db:
            generate_sqlite_dataset(args.output_db, args.count)
        if args.output_diff_dir:
            generate_diff_payload_files(args.output_diff_dir)
        if args.output_palette:
            generate_command_palette_dataset(args.output_palette, 20000)


if __name__ == "__main__":
    main()
