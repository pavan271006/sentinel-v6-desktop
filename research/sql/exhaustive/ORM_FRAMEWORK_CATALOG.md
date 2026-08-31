# Master ORM & Framework SQL Injection Catalog (48 Patterns across 10 Ecosystems)

**Document Identifier:** SENTINEL-EXH-ORM-10  
**Classification:** Framework Abstractions, ORM Escape Hatches & Query Builder Analysis  

---

## 1. ORM Ecosystem Taxonomy

Object-Relational Mappers (ORMs) parameterize standard CRUD operations, but developers introduce critical vulnerabilities when resorting to **Raw Query Escape Hatches**, **Dynamic Identifiers**, or **Unquoted Sorting Clauses**:

```
[ Safe Parameterized Path ]           [ Raw Escape Hatch ]                [ Dynamic Identifier ]
User.findById(req.body.id)            User.where("id = " + req.body.id)   .orderBy(req.query.sort)
(100% Lexically Parameterized)        (CRITICAL RAW SQL INJECTION)        (DYNAMIC IDENTIFIER INJECTION)
```

---

## 2. Comprehensive Framework Vulnerability Index

### Ecosystem 1: TypeScript & JavaScript (Node.js)
1. **`ORM-NODE-01` (TypeORM - Dynamic `orderBy`)**: `createQueryBuilder("u").orderBy(req.query.sort)` inserts unquoted column identifiers into `ORDER BY`, allowing boolean-blind `(CASE WHEN ...)` injection.
2. **`ORM-NODE-02` (TypeORM - Raw `where`)**: `.where("u.name = " + req.body.name)` directly concatenates input into raw SQL.
3. **`ORM-NODE-03` (Sequelize - `Sequelize.literal()`)**: Passing user input into `Sequelize.literal(req.body.expr)` bypasses all parameter bindings.
4. **`ORM-NODE-04` (Sequelize - JSON Object Injection)**: In Sequelize $\le 5$, passing `{ "username": { "$ne": null } }` alters boolean logic.
5. **`ORM-NODE-05` (Prisma - `$queryRawUnsafe()`)**: `prisma.$queryRawUnsafe(\`SELECT * FROM User WHERE id = ${id}\`)` string template evaluation.
6. **`ORM-NODE-06` (Knex - `.whereRaw()`)**: `knex('users').whereRaw('id = ' + req.query.id)` interpolates raw SQL without binding parameters.
7. **`ORM-NODE-07` (MikroORM - Raw SQL Fragment)**: `em.find(User, { [raw('lower(name)')]: req.query.name })` unescaped raw expression.

### Ecosystem 2: Python
8. **`ORM-PY-01` (Django ORM - `.extra(where=[...])`)**: `User.objects.extra(where=["username = '%s'" % name])` bypasses Django parameterization.
9. **`ORM-PY-02` (Django ORM - `.raw()`)**: `User.objects.raw("SELECT * FROM auth_user WHERE username = '" + name + "'")`.
10. **`ORM-PY-03` (SQLAlchemy - `text()`)**: `session.query(User).filter(text("name = '" + name + "'"))` constructs unparameterized raw SQL clauses.
11. **`ORM-PY-04` (SQLAlchemy - Dynamic `order_by()`)**: `query.order_by(text(req.args.get('sort')))` unquoted ordering injection.
12. **`ORM-PY-05` (Peewee - `SQL()`)**: `User.select().where(SQL("username = '" + name + "'"))`.
13. **`ORM-PY-06` (Tortoise ORM - `raw()`)**: `await Tortoise.get_connection("default").execute_query("SELECT * FROM users WHERE id = " + id)`.

### Ecosystem 3: Java & Kotlin
14. **`ORM-JAVA-01` (Hibernate - HQL String Concatenation)**: `session.createQuery("FROM User WHERE name = '" + name + "'")` HQL injection.
15. **`ORM-JAVA-02` (JPA - `EntityManager.createNativeQuery()`)**: `em.createNativeQuery("SELECT * FROM users WHERE email = '" + email + "'")`.
16. **`ORM-JAVA-03` (MyBatis - Dynamic `${param}` Substitution)**: Using `${param}` performs direct string substitution instead of `#{param}` parameter binding.
17. **`ORM-JAVA-04` (Spring Data JPA - `@Query` Native Concatenation)**: `@Query(value = "SELECT * FROM users WHERE name = " + ":name", nativeQuery = true)`.
18. **`ORM-JAVA-05` (jOOQ - `DSL.field()`)**: `ctx.select().from(USERS).where(DSL.condition("name = '" + name + "'"))`.
19. **`ORM-JAVA-06` (Exposed Kotlin - `exec()`)**: `TransactionManager.current().exec("SELECT * FROM users WHERE id = " + id)`.

### Ecosystem 4: C# / .NET
20. **`ORM-DOTNET-01` (EF Core - `FromSqlRaw()`)**: `context.Users.FromSqlRaw("SELECT * FROM Users WHERE Name = '" + name + "'")`.
21. **`ORM-DOTNET-02` (EF Core - `ExecuteSqlRaw()`)**: `context.Database.ExecuteSqlRaw("UPDATE Users SET Role = '" + role + "'")`.
22. **`ORM-DOTNET-03` (Dapper - String Interpolation in `Query()`)**: `conn.Query<User>($"SELECT * FROM Users WHERE Id = {id}")`.
23. **`ORM-DOTNET-04` (NHibernate - HQL Injection)**: `session.CreateQuery("from User where Name = '" + name + "'")`.

### Ecosystem 5: Ruby
24. **`ORM-RUBY-01` (ActiveRecord - String Interpolation in `.where()`)**: `User.where("name = '#{params[:name]}'")`.
25. **`ORM-RUBY-02` (ActiveRecord - Dynamic `.order()`)**: `User.order(params[:sort])` unquoted column identifier injection.
26. **`ORM-RUBY-03` (ActiveRecord - `find_by_sql()`)**: `User.find_by_sql("SELECT * FROM users WHERE id = " + params[:id])`.
27. **`ORM-RUBY-04` (Sequel - String Dataset Filter)**: `DB[:users].where("name = '#{params[:name]}'")`.

### Ecosystem 6: PHP
28. **`ORM-PHP-01` (Laravel Eloquent - `whereRaw()`)**: `User::whereRaw("name = '" . $request->name . "'")->get()`.
29. **`ORM-PHP-02` (Laravel Eloquent - `orderByRaw()`)**: `User::orderByRaw($request->sort)->get()`.
30. **`ORM-PHP-03` (Laravel Eloquent - `DB::statement()`)**: `DB::statement("UPDATE users SET email = '" . $email . "'")`.
31. **`ORM-PHP-04` (Doctrine ORM - DQL Concatenation)**: `$em->createQuery("SELECT u FROM User u WHERE u.name = '" . $name . "'")`.

### Ecosystem 7: Go
32. **`ORM-GO-01` (GORM - Unsafe `db.Raw()`)**: `db.Raw(fmt.Sprintf("SELECT * FROM users WHERE id = %s", id)).Scan(&users)`.
33. **`ORM-GO-02` (GORM - Unsafe `db.Where()`)**: `db.Where(fmt.Sprintf("name = '%s'", name)).Find(&users)`.
34. **`ORM-GO-03` (GORM - Dynamic `db.Order()`)**: `db.Order(r.URL.Query().Get("sort")).Find(&users)`.
35. **`ORM-GO-04` (sqlx - `sqlx.NamedQuery` string formatting)**: `db.Queryx(fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name))`.

### Ecosystem 8: Rust
36. **`ORM-RUST-01` (Diesel - `dsl::sql()`)**: `users.filter(diesel::dsl::sql(&format!("name = '{}'", name))).load(&conn)`.
37. **`ORM-RUST-02` (SQLx - `sqlx::query()` with `format!()`)**: `sqlx::query(&format!("SELECT * FROM users WHERE id = {}", id))`.
38. **`ORM-RUST-03` (SeaORM - `DbBackend::execute()`)**: `db.execute(Statement::from_string(DbBackend::Postgres, format!("...")))`.

### Ecosystem 9 & 10: Elixir & Scala
39. **`ORM-ELIXIR-01` (Ecto - `fragment()`)**: `from(u in User, where: fragment(^"name = '#{name}'"))`.
40. **`ORM-SCALA-01` (Slick - `sql"#$...".as[...]`)**: String interpolation with `#$` performs direct text replacement instead of `$`.
