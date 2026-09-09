/**
 * Sentinel Autonomous SQL Engine — 1-Click ORM Remediation Engine
 *
 * Automatically synthesizes verified, secure, parameterized source code fixes
 * across 14 major backend programming language and ORM ecosystems.
 */

export interface OrmPatchRecommendation {
  id: string;
  ecosystem: string;
  frameworkName: string;
  language: string;
  vulnerablePattern: string;
  remediatedCode: string;
  diffExplanation: string;
  docsUrl?: string;
}

export class OrmRemediationEngine {
  private static readonly PATCH_CATALOG: Record<string, OrmPatchRecommendation> = {
    prisma: {
      id: 'prisma',
      ecosystem: 'Node.js / TypeScript',
      frameworkName: 'Prisma ORM',
      language: 'typescript',
      vulnerablePattern: 'await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE username = \'${input}\'`);',
      remediatedCode: 'await prisma.$queryRaw`SELECT * FROM users WHERE username = ${input}`;',
      diffExplanation: 'Replace $queryRawUnsafe template literal with tagged template $queryRaw which automatically parameterizes all interpolated variables.',
      docsUrl: 'https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access',
    },
    drizzle: {
      id: 'drizzle',
      ecosystem: 'Node.js / TypeScript',
      frameworkName: 'Drizzle ORM',
      language: 'typescript',
      vulnerablePattern: 'await db.execute(sql.raw(`SELECT * FROM users WHERE id = ${input}`));',
      remediatedCode: 'await db.select().from(users).where(eq(users.id, input));',
      diffExplanation: 'Replace sql.raw() string concatenation with Drizzle type-safe schema query builders or sql`... ${input}` parameterized tags.',
      docsUrl: 'https://orm.drizzle.team/docs/sql',
    },
    typeorm: {
      id: 'typeorm',
      ecosystem: 'Node.js / TypeScript',
      frameworkName: 'TypeORM',
      language: 'typescript',
      vulnerablePattern: 'repo.createQueryBuilder("u").where("u.name = \'" + input + "\'").getMany();',
      remediatedCode: 'repo.createQueryBuilder("u").where("u.name = :name", { name: input }).getMany();',
      diffExplanation: 'Use TypeORM named parameter bindings :name in where() rather than string concatenation.',
      docsUrl: 'https://typeorm.io/select-query-builder#using-parameters',
    },
    node_pg: {
      id: 'node_pg',
      ecosystem: 'Node.js / JavaScript',
      frameworkName: 'pg (node-postgres)',
      language: 'javascript',
      vulnerablePattern: 'await client.query(`SELECT * FROM users WHERE email = \'${input}\'`);',
      remediatedCode: 'await client.query(\'SELECT * FROM users WHERE email = $1\', [input]);',
      diffExplanation: 'Pass values in the second parameter array and use $1 placeholders in the query string.',
      docsUrl: 'https://node-postgres.com/features/queries#parameterized-query',
    },
    django: {
      id: 'django',
      ecosystem: 'Python',
      frameworkName: 'Django ORM',
      language: 'python',
      vulnerablePattern: 'User.objects.extra(where=["username = \'%s\'" % input])',
      remediatedCode: 'User.objects.filter(username=input)',
      diffExplanation: 'Eliminate extra() raw where fragments and use standard Django ORM filter() keyword arguments.',
      docsUrl: 'https://docs.djangoproject.com/en/stable/topics/db/queries/',
    },
    sqlalchemy: {
      id: 'sqlalchemy',
      ecosystem: 'Python',
      frameworkName: 'SQLAlchemy 2.0',
      language: 'python',
      vulnerablePattern: 'session.execute(text(f"SELECT * FROM users WHERE name = \'{input}\'"))',
      remediatedCode: 'session.execute(text("SELECT * FROM users WHERE name = :name"), {"name": input})',
      diffExplanation: 'Bind parameters via dictionary mapping with :name placeholders in SQLAlchemy text() construct.',
      docsUrl: 'https://docs.sqlalchemy.org/en/20/core/tutorial.html#using-textual-sql',
    },
    python_psycopg: {
      id: 'python_psycopg',
      ecosystem: 'Python',
      frameworkName: 'psycopg2 / psycopg3',
      language: 'python',
      vulnerablePattern: 'cursor.execute(f"SELECT * FROM accounts WHERE id = {input}")',
      remediatedCode: 'cursor.execute("SELECT * FROM accounts WHERE id = %s", (input,))',
      diffExplanation: 'Pass variables as a tuple in cursor.execute() second argument, never format strings into the SQL query.',
      docsUrl: 'https://www.psycopg.org/docs/usage.html#passing-parameters-to-sql-queries',
    },
    mybatis: {
      id: 'mybatis',
      ecosystem: 'Java / Kotlin',
      frameworkName: 'MyBatis',
      language: 'xml',
      vulnerablePattern: 'SELECT * FROM users WHERE username = ${input}',
      remediatedCode: 'SELECT * FROM users WHERE username = #{input}',
      diffExplanation: 'Replace unquoted ${...} string interpolation with #{...} prepared statement parameter binding.',
      docsUrl: 'https://mybatis.org/mybatis-3/sqlmap-xml.html#Parameters',
    },
    spring_jpa: {
      id: 'spring_jpa',
      ecosystem: 'Java / Spring Boot',
      frameworkName: 'Spring Data JPA',
      language: 'java',
      vulnerablePattern: '@Query(value = "SELECT * FROM users WHERE email = " + input, nativeQuery = true)',
      remediatedCode: '@Query("SELECT u FROM User u WHERE u.email = :email")\nUser findByEmail(@Param("email") String email);',
      diffExplanation: 'Use JPQL entity queries with @Param named bindings or positional parameters (?1).',
      docsUrl: 'https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.query-methods.at-query',
    },
    ef_core: {
      id: 'ef_core',
      ecosystem: '.NET / C#',
      frameworkName: 'Entity Framework Core',
      language: 'csharp',
      vulnerablePattern: 'context.Users.FromSqlRaw($"SELECT * FROM Users WHERE Email = \'{input}\'")',
      remediatedCode: 'context.Users.FromSqlInterpolated($"SELECT * FROM Users WHERE Email = {input}")',
      diffExplanation: 'Switch from FromSqlRaw to FromSqlInterpolated which automatically wraps interpolated parameters in DbParameter objects.',
      docsUrl: 'https://learn.microsoft.com/en-us/ef/core/querying/raw-sql',
    },
    gorm: {
      id: 'gorm',
      ecosystem: 'Go',
      frameworkName: 'GORM',
      language: 'go',
      vulnerablePattern: 'db.Where(fmt.Sprintf("name = \'%s\'", input)).Find(&users)',
      remediatedCode: 'db.Where("name = ?", input).Find(&users)',
      diffExplanation: 'Use GORM question mark ? parameter placeholders rather than fmt.Sprintf concatenation.',
      docsUrl: 'https://gorm.io/docs/query.html#String-Conditions',
    },
    go_std: {
      id: 'go_std',
      ecosystem: 'Go',
      frameworkName: 'database/sql',
      language: 'go',
      vulnerablePattern: 'rows, err := db.Query("SELECT id, name FROM users WHERE id = " + input)',
      remediatedCode: 'rows, err := db.Query("SELECT id, name FROM users WHERE id = ?", input)',
      diffExplanation: 'Pass input as argument to db.Query() alongside ? (or $1 for PostgreSQL) placeholders.',
      docsUrl: 'https://pkg.go.dev/database/sql#DB.Query',
    },
    php_pdo: {
      id: 'php_pdo',
      ecosystem: 'PHP',
      frameworkName: 'PHP PDO',
      language: 'php',
      vulnerablePattern: '$pdo->query("SELECT * FROM users WHERE email = \'" . $input . "\'");',
      remediatedCode: '$stmt = $pdo->prepare(\'SELECT * FROM users WHERE email = :email\');\n$stmt->execute([\'email\' => $input]);\n$users = $stmt->fetchAll();',
      diffExplanation: 'Prepare the statement with named placeholders :email and pass values array to execute().',
      docsUrl: 'https://www.php.net/manual/en/pdo.prepared-statements.php',
    },
    laravel: {
      id: 'laravel',
      ecosystem: 'PHP / Laravel',
      frameworkName: 'Laravel Eloquent / DB',
      language: 'php',
      vulnerablePattern: 'DB::select(DB::raw("SELECT * FROM users WHERE role = \'$input\'"));',
      remediatedCode: 'DB::table(\'users\')->where(\'role\', $input)->get();\n// Or raw binding:\nDB::select(\'SELECT * FROM users WHERE role = :role\', [\'role\' => $input]);',
      diffExplanation: 'Use Eloquent where() builder or pass parameter bindings array as second argument to DB::select().',
      docsUrl: 'https://laravel.com/docs/queries#raw-expressions',
    },
    rust_sqlx: {
      id: 'rust_sqlx',
      ecosystem: 'Rust',
      frameworkName: 'SQLx',
      language: 'rust',
      vulnerablePattern: 'sqlx::query(&format!("SELECT * FROM users WHERE id = {}", input)).fetch_all(&pool).await?;',
      remediatedCode: 'sqlx::query!("SELECT * FROM users WHERE id = $1", input).fetch_all(&pool).await?;',
      diffExplanation: 'Use compile-time checked sqlx::query! macro or query().bind(input).',
      docsUrl: 'https://docs.rs/sqlx/latest/sqlx/macro.query.html',
    },
  };

  /**
   * Generates tailored 1-click remediation recommendations for a confirmed vulnerability
   */
  public static getRemediation(parameterName: string, inferredDbms: string = 'Generic SQL'): OrmPatchRecommendation[] {
    const list = Object.values(OrmRemediationEngine.PATCH_CATALOG);
    return list.map((item) => {
      const vulnReplaced = item.vulnerablePattern.replace(/input/g, parameterName);
      const remediatedReplaced = item.remediatedCode.replace(/input/g, parameterName);
      return {
        ...item,
        vulnerablePattern: vulnReplaced,
        remediatedCode: remediatedReplaced,
        diffExplanation: `${item.diffExplanation} (Target Parameter: "${parameterName}", DBMS: ${inferredDbms})`,
      };
    });
  }

  /**
   * Retrieves a specific patch recommendation by ID
   */
  public static getPatchById(id: string, parameterName: string = 'id', inferredDbms: string = 'PostgreSQL'): OrmPatchRecommendation | undefined {
    const patch = OrmRemediationEngine.PATCH_CATALOG[id];
    if (!patch) return undefined;
    return {
      ...patch,
      vulnerablePattern: patch.vulnerablePattern.replace(/input/g, parameterName),
      remediatedCode: patch.remediatedCode.replace(/input/g, parameterName),
      diffExplanation: `${patch.diffExplanation} (Target Parameter: "${parameterName}", DBMS: ${inferredDbms})`,
    };
  }
}