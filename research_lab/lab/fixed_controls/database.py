"""
Database layer for Fixed Negative Controls Laboratory.
Implements SQLite connection management with strict constraints and baseline data seeding.
"""

import sqlite3
import threading
from contextlib import contextmanager
from typing import Optional, List, Dict, Any


FIXED_CONTROLS_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'standard',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    secret_notes TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0.0 CHECK(balance >= 0.0),
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    initiator TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'INITIATED',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    payload TEXT NOT NULL,
    tenant_context_lock TEXT NOT NULL,
    version_id INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
"""


class FixedControlsDatabase:
    """Thread-safe SQLite database manager for Fixed Controls Lab."""

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

    @contextmanager
    def get_cursor(self):
        with self._lock:
            cursor = self._conn.cursor()
            try:
                yield cursor
                self._conn.commit()
            except Exception:
                self._conn.rollback()
                raise
            finally:
                cursor.close()

    def _init_schema(self):
        with self.get_cursor() as cursor:
            cursor.executescript(FIXED_CONTROLS_SCHEMA)
            self._seed_default_data(cursor)

    def _seed_default_data(self, cursor: sqlite3.Cursor):
        cursor.execute("SELECT COUNT(*) FROM tenants")
        if cursor.fetchone()[0] > 0:
            return

        # 1. Tenants
        tenants = [
            ("org_alpha", "Alpha Corporation", "enterprise", 1),
            ("org_beta", "Beta Innovations", "standard", 1)
        ]
        cursor.executemany(
            "INSERT INTO tenants (id, name, tier, is_active) VALUES (?, ?, ?, ?)",
            tenants
        )

        # 2. Users
        from .auth import hash_password
        pwd_hash = hash_password("password123")

        users = [
            ("u_alpha_admin", "org_alpha", "alice", pwd_hash, "admin", "Alice Admin", "alice@alpha.test", 1),
            ("u_alpha_member", "org_alpha", "bob", pwd_hash, "member", "Bob Member", "bob@alpha.test", 1),
            ("u_beta_member", "org_beta", "charlie", pwd_hash, "member", "Charlie Member", "charlie@beta.test", 1),
            ("u_beta_admin", "org_beta", "dave", pwd_hash, "admin", "Dave Admin", "dave@beta.test", 1),
            ("u_recipient", "org_alpha", "recipient_user", pwd_hash, "member", "Recipient User", "recipient@alpha.test", 1)
        ]
        cursor.executemany(
            "INSERT INTO users (id, tenant_id, username, password_hash, role, full_name, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            users
        )

        # 3. Invoices
        invoices = [
            (1, "org_alpha", "alice", "Alpha Secret Q1 Budget", 50000.0, "Alpha confidential financial plan and tax records", "APPROVED"),
            (2, "org_alpha", "bob", "Alpha Office Supplies", 1200.0, "Routine supplies purchase", "PAID"),
            (3, "org_beta", "charlie", "Beta Marketing Campaign", 15000.0, "Beta secret acquisition strategy and PR roadmap", "DRAFT"),
            (4, "org_beta", "dave", "Beta Infrastructure Bill", 8500.0, "AWS cloud server hosting fees", "PENDING")
        ]
        cursor.executemany(
            "INSERT INTO invoices (id, tenant_id, created_by, title, amount, secret_notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            invoices
        )

        # 4. Accounts
        accounts = [
            (1, "org_alpha", "alice", 5000.0, "USD"),
            (2, "org_alpha", "bob", 100.0, "USD"),  # Seeded with $100 for concurrency safety verification
            (3, "org_beta", "charlie", 100.0, "USD"),
            (4, "org_beta", "dave", 2500.0, "USD"),
            (5, "org_alpha", "recipient_user", 0.0, "USD")
        ]
        cursor.executemany(
            "INSERT INTO accounts (id, tenant_id, username, balance, currency) VALUES (?, ?, ?, ?, ?)",
            accounts
        )

        # 5. Workflows (wf_alpha_101 initialized with immutable tenant lock pinned to org_alpha)
        workflows = [
            (
                "wf_alpha_101",
                "org_alpha",
                "bob",
                "STAGED_AWAITING_RETRY",
                "STAGED",
                '{"payment": 100000, "recipient": "Alpha Vendor"}',
                "org_alpha",  # Strict immutable lock pinned to org_alpha
                1
            )
        ]
        cursor.executemany(
            "INSERT INTO workflows (id, tenant_id, initiator, current_stage, status, payload, tenant_context_lock, version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            workflows
        )

    def close(self):
        if self._conn is not None:
            self._conn.close()
            self._conn = None
