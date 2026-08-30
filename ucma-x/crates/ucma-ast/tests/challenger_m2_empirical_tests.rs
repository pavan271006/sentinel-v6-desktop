//! Empirical Challenger Test Suite for UCMA-X Milestone 2
//! Adversarially verifies:
//! 1. SqlAstParser -> SqlAst -> AstRenderer roundtrip & dialect fidelity across all 5 DBMS dialects (PG, MySQL, SQLite, MSSQL, Oracle).
//! 2. BoundaryInjectionMutator metamorphic probe pair generation & comment truncation across dialects.
//! 3. AstSanitizer safety invariant enforcement (blocking destructive DDL/DML/admin execution, allowing bounded safe queries).

use ucma_ast::{
    AstNode, AstRenderer, AstSanitizer, BoundaryInjectionMutator, SecurityViolation,
    SqlAstParser,
};
use ucma_dialect::{
    DbmsDialect, DbmsType, MsSqlDialect, MySqlDialect, OracleDialect, PostgreSqlDialect,
    SqliteDialect,
};
use ucma_parameter::InjectionContext;
use ucma_sql_ir::{OrderDirection, StatementIr};

// ============================================================================
// 1. DIALECT SYNTAX & FIDELITY TESTS ACROSS ALL 5 DBMS ENGINES
// ============================================================================

#[test]
fn test_all_five_dialects_metadata() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    assert_eq!(pg.name(), "PostgreSQL");
    assert_eq!(pg.dbms_type(), DbmsType::PostgreSql);

    assert_eq!(mysql.name(), "MySQL");
    assert_eq!(mysql.dbms_type(), DbmsType::MySql);

    assert_eq!(sqlite.name(), "SQLite");
    assert_eq!(sqlite.dbms_type(), DbmsType::Sqlite);

    assert_eq!(mssql.name(), "MSSQL");
    assert_eq!(mssql.dbms_type(), DbmsType::MsSql);

    assert_eq!(oracle.name(), "Oracle");
    assert_eq!(oracle.dbms_type(), DbmsType::Oracle);
}

#[test]
fn test_dialect_identifier_quoting() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    // PostgreSQL / SQLite / Oracle use double quotes with internal quote doubling
    assert_eq!(pg.quote_identifier("column_name"), "\"column_name\"");
    assert_eq!(pg.quote_identifier("col\"with\"quote"), "\"col\"\"with\"\"quote\"");

    assert_eq!(sqlite.quote_identifier("my_table"), "\"my_table\"");
    assert_eq!(sqlite.quote_identifier("tbl\"quote"), "\"tbl\"\"quote\"");

    assert_eq!(oracle.quote_identifier("EMP_ID"), "\"EMP_ID\"");

    // MySQL uses backticks with internal backtick doubling
    assert_eq!(mysql.quote_identifier("user_col"), "`user_col`");
    assert_eq!(mysql.quote_identifier("col`name"), "`col``name`");

    // MSSQL uses square brackets with internal right-bracket doubling
    assert_eq!(mssql.quote_identifier("Order Details"), "[Order Details]");
    assert_eq!(mssql.quote_identifier("col]name"), "[col]]name]");
}

#[test]
fn test_dialect_string_literal_escaping() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    let test_input = "O'Reilly's Book \\ \"Test\"";

    // Standard SQL dialects escape single quotes by doubling them ('')
    assert_eq!(pg.quote_string_literal(test_input), "'O''Reilly''s Book \\ \"Test\"'");
    assert_eq!(sqlite.quote_string_literal(test_input), "'O''Reilly''s Book \\ \"Test\"'");
    assert_eq!(mssql.quote_string_literal(test_input), "'O''Reilly''s Book \\ \"Test\"'");
    assert_eq!(oracle.quote_string_literal(test_input), "'O''Reilly''s Book \\ \"Test\"'");

    // MySQL also escapes backslashes
    assert_eq!(mysql.quote_string_literal(test_input), "'O''Reilly''s Book \\\\ \"Test\"'");
}

#[test]
fn test_dialect_concat_expression() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    let ops = vec!["'foo'".to_string(), "'bar'".to_string(), "'baz'".to_string()];

    assert_eq!(pg.concat_expression(&ops), "'foo' || 'bar' || 'baz'");
    assert_eq!(sqlite.concat_expression(&ops), "'foo' || 'bar' || 'baz'");
    assert_eq!(oracle.concat_expression(&ops), "'foo' || 'bar' || 'baz'");
    assert_eq!(mssql.concat_expression(&ops), "'foo' + 'bar' + 'baz'");
    assert_eq!(mysql.concat_expression(&ops), "CONCAT('foo', 'bar', 'baz')");
}

#[test]
fn test_dialect_limit_offset_clauses() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    // Case 1: Both limit and offset
    assert_eq!(pg.limit_offset_clause(Some(10), Some(20)), "LIMIT 10 OFFSET 20");
    assert_eq!(mysql.limit_offset_clause(Some(10), Some(20)), "LIMIT 20, 10");
    assert_eq!(sqlite.limit_offset_clause(Some(10), Some(20)), "LIMIT 10 OFFSET 20");
    assert_eq!(
        mssql.limit_offset_clause(Some(10), Some(20)),
        "OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY"
    );
    assert_eq!(
        oracle.limit_offset_clause(Some(10), Some(20)),
        "OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY"
    );

    // Case 2: Only limit
    assert_eq!(pg.limit_offset_clause(Some(5), None), "LIMIT 5");
    assert_eq!(mysql.limit_offset_clause(Some(5), None), "LIMIT 5");
    assert_eq!(sqlite.limit_offset_clause(Some(5), None), "LIMIT 5");
    assert_eq!(
        mssql.limit_offset_clause(Some(5), None),
        "OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY"
    );
    assert_eq!(
        oracle.limit_offset_clause(Some(5), None),
        "OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY"
    );

    // Case 3: Only offset
    assert_eq!(pg.limit_offset_clause(None, Some(15)), "OFFSET 15");
    assert_eq!(
        mysql.limit_offset_clause(None, Some(15)),
        "LIMIT 15, 18446744073709551615"
    );
    assert_eq!(sqlite.limit_offset_clause(None, Some(15)), "LIMIT -1 OFFSET 15");
    assert_eq!(mssql.limit_offset_clause(None, Some(15)), "OFFSET 15 ROWS");
    assert_eq!(oracle.limit_offset_clause(None, Some(15)), "OFFSET 15 ROWS");
}

#[test]
fn test_dialect_sleep_timing_payloads() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    assert_eq!(pg.sleep_payload(3.5), "pg_sleep(3.50)");
    assert_eq!(mysql.sleep_payload(3.0), "SLEEP(3)");
    assert_eq!(mssql.sleep_payload(5.0), "WAITFOR DELAY '00:00:05'");
    assert_eq!(oracle.sleep_payload(4.0), "dbms_pipe.receive_message(('p'), 4)");
    assert!(sqlite.sleep_payload(2.0).contains("RANDOMBLOB"));
}

#[test]
fn test_dialect_comment_and_fingerprint_queries() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;
    let sqlite = SqliteDialect;
    let mssql = MsSqlDialect;
    let oracle = OracleDialect;

    assert_eq!(pg.line_comment_prefix(), "-- ");
    assert_eq!(mysql.line_comment_prefix(), "# ");
    assert_eq!(sqlite.line_comment_prefix(), "-- ");
    assert_eq!(mssql.line_comment_prefix(), "-- ");
    assert_eq!(oracle.line_comment_prefix(), "-- ");

    assert_eq!(pg.version_query(), "SELECT VERSION()");
    assert_eq!(mysql.version_query(), "SELECT @@VERSION");
    assert_eq!(sqlite.version_query(), "SELECT sqlite_version()");
    assert_eq!(mssql.version_query(), "SELECT @@VERSION");
    assert_eq!(oracle.version_query(), "SELECT banner FROM v$version WHERE ROWNUM = 1");
}

// ============================================================================
// 2. AST PARSER -> AST -> RENDERER ROUNDTRIP & FUZZING TESTS
// ============================================================================

#[test]
fn test_ast_roundtrip_select_simple() {
    let dialects: Vec<Box<dyn DbmsDialect>> = vec![
        Box::new(PostgreSqlDialect),
        Box::new(MySqlDialect),
        Box::new(SqliteDialect),
        Box::new(MsSqlDialect),
        Box::new(OracleDialect),
    ];

    let sql = "SELECT id, username, email FROM users WHERE id = 42";
    let ast = SqlAstParser::parse(sql).expect("Failed to parse simple select");

    for d in &dialects {
        let rendered = AstRenderer::render(&ast.root, d.as_ref());
        assert!(!rendered.is_empty());
        assert!(rendered.starts_with("SELECT "));
        assert!(rendered.contains("FROM "));
        assert!(rendered.contains("WHERE "));

        // Re-parse rendered SQL
        let reparsed = SqlAstParser::parse(&rendered).expect("Failed to re-parse rendered SQL");
        match (&ast.root, &reparsed.root) {
            (
                AstNode::Statement(StatementIr::Select(orig_s)),
                AstNode::Statement(StatementIr::Select(rep_s)),
            ) => {
                assert_eq!(orig_s.projections.len(), rep_s.projections.len());
                assert!(rep_s.where_clause.is_some());
            }
            _ => panic!("Expected matching Select AST roots"),
        }
    }
}

#[test]
fn test_ast_roundtrip_select_complex() {
    let sql = "SELECT DISTINCT uid AS user_identifier, name, total FROM users AS u WHERE active = true AND age >= 18 ORDER BY id DESC LIMIT 25 OFFSET 50";
    let ast = SqlAstParser::parse(sql).expect("Failed to parse complex select");

    match &ast.root {
        AstNode::Statement(StatementIr::Select(s)) => {
            assert!(s.distinct);
            assert_eq!(s.projections.len(), 3);
            assert!(s.from.is_some());
            assert!(s.where_clause.is_some());
            assert_eq!(s.order_by.len(), 1);
            assert_eq!(s.order_by[0].direction, OrderDirection::Desc);
            assert_eq!(s.limit_offset.as_ref().unwrap().limit, Some(25));
            assert_eq!(s.limit_offset.as_ref().unwrap().offset, Some(50));
        }
        _ => panic!("Expected Select"),
    }

    let pg = PostgreSqlDialect;
    let rendered_pg = AstRenderer::render(&ast.root, &pg);
    assert_eq!(
        rendered_pg,
        "SELECT DISTINCT \"uid\" AS \"user_identifier\", \"name\", \"total\" FROM \"users\" AS \"u\" WHERE \"active\" = TRUE AND \"age\" >= 18 ORDER BY \"id\" DESC LIMIT 25 OFFSET 50"
    );
}

#[test]
fn test_ast_roundtrip_insert() {
    let sql = "INSERT INTO accounts (user_id, balance, status) VALUES (100, 2500, 'ACTIVE')";
    let ast = SqlAstParser::parse(sql).expect("Failed to parse insert");

    let pg = PostgreSqlDialect;
    let rendered = AstRenderer::render(&ast.root, &pg);
    assert_eq!(
        rendered,
        "INSERT INTO \"accounts\" (\"user_id\", \"balance\", \"status\") VALUES (100, 2500, 'ACTIVE')"
    );

    let reparsed = SqlAstParser::parse(&rendered).expect("Failed to reparse insert");
    match (&ast.root, &reparsed.root) {
        (
            AstNode::Statement(StatementIr::Insert(i1)),
            AstNode::Statement(StatementIr::Insert(i2)),
        ) => {
            assert_eq!(i1.columns, i2.columns);
            assert_eq!(i1.values.len(), i2.values.len());
        }
        _ => panic!("Expected Insert statements"),
    }
}

#[test]
fn test_ast_roundtrip_update() {
    let sql = "UPDATE products SET price = 99, in_stock = true WHERE product_id = 7";
    let ast = SqlAstParser::parse(sql).expect("Failed to parse update");

    let mssql = MsSqlDialect;
    let rendered = AstRenderer::render(&ast.root, &mssql);
    assert_eq!(
        rendered,
        "UPDATE [products] SET [price] = 99, [in_stock] = TRUE WHERE [product_id] = 7"
    );

    let reparsed = SqlAstParser::parse(&rendered).expect("Failed to reparse update");
    match (&ast.root, &reparsed.root) {
        (
            AstNode::Statement(StatementIr::Update(u1)),
            AstNode::Statement(StatementIr::Update(u2)),
        ) => {
            assert_eq!(u1.assignments.len(), u2.assignments.len());
            assert!(u2.where_clause.is_some());
        }
        _ => panic!("Expected Update statements"),
    }
}

#[test]
fn test_ast_roundtrip_delete() {
    let sql = "DELETE FROM sessions WHERE expire_time < 1700000000";
    let ast = SqlAstParser::parse(sql).expect("Failed to parse delete");

    let mysql = MySqlDialect;
    let rendered = AstRenderer::render(&ast.root, &mysql);
    assert_eq!(
        rendered,
        "DELETE FROM `sessions` WHERE `expire_time` < 1700000000"
    );

    let reparsed = SqlAstParser::parse(&rendered).expect("Failed to reparse delete");
    match (&ast.root, &reparsed.root) {
        (
            AstNode::Statement(StatementIr::Delete(d1)),
            AstNode::Statement(StatementIr::Delete(d2)),
        ) => {
            assert_eq!(d1.table, d2.table);
            assert!(d2.where_clause.is_some());
        }
        _ => panic!("Expected Delete statements"),
    }
}

#[test]
fn test_fuzz_ast_expressions() {
    let expressions = [
        "id = 1",
        "id <> 2",
        "id != 3",
        "price < 100",
        "price <= 50",
        "score > 90",
        "score >= 80",
        "name LIKE 'admin%'",
        "a = 1 AND b = 2",
        "a = 1 OR b = 2",
        "(x = 1 AND y = 2) OR z = 3",
    ];

    for expr_str in &expressions {
        let sql = format!("SELECT * FROM t WHERE {}", expr_str);
        let ast = SqlAstParser::parse(&sql).unwrap_or_else(|e| panic!("Failed parsing '{}': {}", sql, e));
        let pg = PostgreSqlDialect;
        let rendered = AstRenderer::render(&ast.root, &pg);
        assert!(rendered.contains("WHERE "), "Rendered SQL missing WHERE for: {}", expr_str);
    }
}

// ============================================================================
// 3. BOUNDARY INJECTION MUTATOR STRESS-TESTS
// ============================================================================

#[test]
fn test_boundary_injection_mutator_numeric_points() {
    let pg = PostgreSqlDialect;
    let sql = "SELECT * FROM orders WHERE order_id = 9999";
    let probes = BoundaryInjectionMutator::generate_boundary_probes(sql, &pg);

    // MutationScanner identifies both identifier `order_id` (point 1) and numeric literal `9999` (point 2)
    assert_eq!(probes.len(), 2, "Expected 2 mutation points (identifier and numeric literal)");

    let numeric_probe = probes
        .iter()
        .find(|p| p.context == InjectionContext::Numeric)
        .expect("Numeric mutation point must be identified");

    assert_eq!(numeric_probe.original_sql, sql);
    assert!(
        numeric_probe.tautology_sql.contains("9999 OR 1 = 1"),
        "Tautology must contain '9999 OR 1 = 1', got: {}",
        numeric_probe.tautology_sql
    );
    assert!(
        numeric_probe.contradiction_sql.contains("9999 AND 1 = 2"),
        "Contradiction must contain '9999 AND 1 = 2', got: {}",
        numeric_probe.contradiction_sql
    );
}

#[test]
fn test_boundary_injection_mutator_string_points() {
    let mysql = MySqlDialect;
    let sql = "SELECT username, role FROM users WHERE username = 'administrator'";
    let probes = BoundaryInjectionMutator::generate_boundary_probes(sql, &mysql);

    // MutationScanner scans projections (username, role) + WHERE (username, 'administrator') -> 4 points
    assert_eq!(probes.len(), 4, "Expected 4 mutation points across projections and WHERE");

    let string_probe = probes
        .iter()
        .find(|p| p.context == InjectionContext::SingleQuoteString)
        .expect("String literal mutation point must be identified");

    assert!(
        string_probe.tautology_sql.contains("'administrator' OR '1' = '1'"),
        "Tautology string probe missing, got: {}",
        string_probe.tautology_sql
    );
    assert!(
        string_probe.contradiction_sql.contains("'administrator' AND '1' = '2'"),
        "Contradiction string probe missing, got: {}",
        string_probe.contradiction_sql
    );
}

#[test]
fn test_boundary_injection_mutator_multiple_points() {
    let oracle = OracleDialect;
    let sql = "SELECT id FROM items WHERE category = 'electronics' AND price = 500";
    let probes = BoundaryInjectionMutator::generate_boundary_probes(sql, &oracle);

    // id (proj), category (ident), 'electronics' (str), price (ident), 500 (num) -> 5 points
    assert_eq!(probes.len(), 5, "Expected 5 distinct mutation points");

    let string_probe = probes
        .iter()
        .find(|p| p.context == InjectionContext::SingleQuoteString)
        .expect("Should find string probe");
    assert!(string_probe.tautology_sql.contains("'electronics' OR '1' = '1'"));

    let numeric_probe = probes
        .iter()
        .find(|p| p.context == InjectionContext::Numeric)
        .expect("Should find numeric probe");
    assert!(numeric_probe.tautology_sql.contains("500 OR 1 = 1"));
}

#[test]
fn test_comment_truncation_generation() {
    let pg = PostgreSqlDialect;
    let mysql = MySqlDialect;

    let pg_trunc = BoundaryInjectionMutator::create_comment_truncation("admin'", " OR 1=1", &pg);
    assert_eq!(pg_trunc, "admin' OR 1=1-- ");

    let mysql_trunc = BoundaryInjectionMutator::create_comment_truncation("admin'", " OR 1=1", &mysql);
    assert_eq!(mysql_trunc, "admin' OR 1=1# ");
}

// ============================================================================
// 4. AST SANITIZER SAFETY INVARIANTS & DESTRUCTIVE DDL/DML REJECTION
// ============================================================================

#[test]
fn test_sanitizer_blocks_destructive_ddl() {
    let destructive_queries = [
        "DROP TABLE users",
        "DROP DATABASE production",
        "DROP SCHEMA public",
        "DROP VIEW user_emails",
        "DROP INDEX idx_user_id",
        "DROP PROCEDURE cleanup_old_data",
        "DROP FUNCTION get_secret",
        "TRUNCATE TABLE audit_log",
        "TRUNCATE logs",
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN",
        "ALTER DATABASE test_db SET READ_WRITE",
        "ALTER SCHEMA sales RENAME TO sales_backup",
        "ALTER USER postgres WITH PASSWORD 'pwned'",
    ];

    for q in &destructive_queries {
        let res = AstSanitizer::validate_read_only(q);
        assert!(
            res.is_err(),
            "Expected destructive DDL to be blocked: {}",
            q
        );
        match res.unwrap_err() {
            SecurityViolation::DestructiveStatement(_) => {}
            other => panic!("Expected DestructiveStatement error for '{}', got: {:?}", q, other),
        }
    }
}

#[test]
fn test_sanitizer_blocks_admin_and_execution_vectors() {
    let dangerous_vectors = [
        "SHUTDOWN",
        "EXEC xp_cmdshell 'dir'",
        "EXECUTE xp_cmdshell('whoami')",
        "EXEC master..xp_cmdshell 'powershell'",
        "EXECUTE MASTER..some_proc",
        "SELECT * FROM users INTO OUTFILE '/var/www/html/shell.php'",
        "SELECT * FROM secrets INTO DUMPFILE '/tmp/dump'",
        "SELECT LOAD_FILE('/etc/passwd')",
        "ATTACH DATABASE '/etc/shadow' AS shadow_db",
        "GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%'",
        "REVOKE SELECT ON sensitive_data FROM public",
    ];

    for v in &dangerous_vectors {
        let res = AstSanitizer::validate_read_only(v);
        assert!(
            res.is_err(),
            "Expected dangerous vector to be blocked: {}",
            v
        );
        match res.unwrap_err() {
            SecurityViolation::DestructiveStatement(_) => {}
            other => panic!("Expected DestructiveStatement error for '{}', got: {:?}", v, other),
        }
    }
}

#[test]
fn test_sanitizer_blocks_unbounded_writes() {
    // Unbounded DELETE without WHERE
    let unb_delete = "DELETE FROM users";
    let res_del = AstSanitizer::validate_read_only(unb_delete);
    assert!(res_del.is_err());
    assert!(matches!(res_del.unwrap_err(), SecurityViolation::UnboundedWrite(_)));

    // Unbounded UPDATE without WHERE
    let unb_update = "UPDATE users SET role = 'admin', active = true";
    let res_upd = AstSanitizer::validate_read_only(unb_update);
    assert!(res_upd.is_err());
    assert!(matches!(res_upd.unwrap_err(), SecurityViolation::UnboundedWrite(_)));
}

#[test]
fn test_sanitizer_permits_safe_queries() {
    let safe_queries = [
        "SELECT * FROM users WHERE id = 10",
        "SELECT u.name, o.id FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100",
        "SELECT count(*) FROM audit WHERE timestamp >= '2026-01-01' GROUP BY user_id",
        "DELETE FROM temporary_tokens WHERE expiration < 1700000000",
        "UPDATE users SET last_login = 1700000000 WHERE user_id = 42",
        "SELECT banner FROM v$version WHERE ROWNUM = 1",
        "SELECT VERSION()",
    ];

    for q in &safe_queries {
        let res = AstSanitizer::validate_read_only(q);
        assert!(
            res.is_ok(),
            "Expected safe query to be permitted: {} (err: {:?})",
            q,
            res.err()
        );
    }
}
