# Master Validated ORM & Framework Catalog V2 (32 Patterns)

**Document Reference:** SENTINEL-V2-ORM-14  
**Classification:** ORM Escape Hatches, Criteria Builders & Unsafe Framework Abstractions  
**Status:** Validated & Source-Verified (V2)  

---

## 1. ORM Security Principle

ORMs provide automatic parameterization for standard CRUD methods (`User.findById(id)`). Vulnerabilities occur exclusively when developers invoke **Raw Escape Hatches**, concatenate user data into **Dynamic Identifier Clauses**, or allow **Object Parameter Tampering**.

---

## 2. Comprehensive 32-Pattern Validated Inventory

### Ecosystem 1: TypeScript & Node.js
1. **`ORM-V2-01` (TypeORM - Dynamic `orderBy`)**: `createQueryBuilder().orderBy(req.query.sort)` inserts unquoted identifiers into `ORDER BY`. Evidence: `E5`.
2. **`ORM-V2-02` (TypeORM - Raw `where`)**: `.where("u.name = " + name)` concatenates raw SQL. Evidence: `E5`.
3. **`ORM-V2-03` (Sequelize - `Sequelize.literal()`)**: `Sequelize.literal(req.body.expr)` bypasses parameter binding. Evidence: `E5`.
4. **`ORM-V2-04` (Prisma - `$queryRawUnsafe()`)**: `prisma.$queryRawUnsafe(\`... ${id}\`)` evaluates raw string templates. Evidence: `E5`.
5. **`ORM-V2-05` (Knex - `.whereRaw()`)**: `knex('users').whereRaw('id = ' + id)` unparameterized raw clause. Evidence: `E5`.

### Ecosystem 2: Python
6. **`ORM-V2-06` (Django ORM - `.extra(where=[...])`)**: `User.objects.extra(where=["username = '%s'" % name])`. Evidence: `E5`.
7. **`ORM-V2-07` (Django ORM - `.raw()`)**: `User.objects.raw("SELECT * FROM auth_user WHERE username = '" + name + "'")`. Evidence: `E5`.
8. **`ORM-V2-08` (SQLAlchemy - `text()`)**: `session.query(User).filter(text("name = '" + name + "'"))`. Evidence: `E5`.
9. **`ORM-V2-09` (SQLAlchemy - Dynamic `order_by()`)**: `query.order_by(text(req.args.get('sort')))`. Evidence: `E5`.
10. **`ORM-V2-10` (Peewee - `SQL()`)**: `User.select().where(SQL("username = '" + name + "'"))`. Evidence: `E5`.

### Ecosystem 3: Java & Kotlin
11. **`ORM-V2-11` (Hibernate - HQL String Concatenation)**: `session.createQuery("FROM User WHERE name = '" + name + "'")`. Evidence: `E5`.
12. **`ORM-V2-12` (JPA - `EntityManager.createNativeQuery()`)**: `em.createNativeQuery("SELECT * FROM users WHERE email = '" + email + "'")`. Evidence: `E5`.
13. **`ORM-V2-13` (MyBatis - Dynamic `${param}` Substitution)**: `${param}` direct string substitution instead of `#{param}`. Evidence: `E5`.
14. **`ORM-V2-14` (Spring Data JPA - Native `@Query`)**: `@Query(value = "SELECT * FROM users WHERE name = " + ":name", nativeQuery = true)`. Evidence: `E5`.
15. **`ORM-V2-15` (jOOQ - `DSL.condition()`)**: `ctx.select().from(USERS).where(DSL.condition("name = '" + name + "'"))`. Evidence: `E5`.

### Ecosystem 4: C# / .NET
16. **`ORM-V2-16` (EF Core - `FromSqlRaw()`)**: `context.Users.FromSqlRaw("SELECT * FROM Users WHERE Name = '" + name + "'")`. Evidence: `E5`.
17. **`ORM-V2-17` (EF Core - `ExecuteSqlRaw()`)**: `context.Database.ExecuteSqlRaw("UPDATE Users SET Role = '" + role + "'")`. Evidence: `E5`.
18. **`ORM-V2-18` (Dapper - String Interpolation in `Query()`)**: `conn.Query<User>($"SELECT * FROM Users WHERE Id = {id}")`. Evidence: `E5`.
19. **`ORM-V2-19` (NHibernate - HQL Injection)**: `session.CreateQuery("from User where Name = '" + name + "'")`. Evidence: `E5`.

### Ecosystem 5: Ruby
20. **`ORM-V2-20` (ActiveRecord - String Interpolation in `.where()`)**: `User.where("name = '#{params[:name]}'")`. Evidence: `E5`.
21. **`ORM-V2-21` (ActiveRecord - Dynamic `.order()`)**: `User.order(params[:sort])` unquoted column identifier injection. Evidence: `E5`.
22. **`ORM-V2-22` (ActiveRecord - `find_by_sql()`)**: `User.find_by_sql("SELECT * FROM users WHERE id = " + params[:id])`. Evidence: `E5`.

### Ecosystem 6: PHP
23. **`ORM-V2-23` (Laravel Eloquent - `whereRaw()`)**: `User::whereRaw("name = '" . $request->name . "'")->get()`. Evidence: `E5`.
24. **`ORM-V2-24` (Laravel Eloquent - `orderByRaw()`)**: `User::orderByRaw($request->sort)->get()`. Evidence: `E5`.
25. **`ORM-V2-25` (Doctrine ORM - DQL Concatenation)**: `$em->createQuery("SELECT u FROM User u WHERE u.name = '" . $name . "'")`. Evidence: `E5`.

### Ecosystem 7: Go
26. **`ORM-V2-26` (GORM - Unsafe `db.Raw()`)**: `db.Raw(fmt.Sprintf("SELECT * FROM users WHERE id = %s", id))`. Evidence: `E5`.
27. **`ORM-V2-27` (GORM - Unsafe `db.Where()`)**: `db.Where(fmt.Sprintf("name = '%s'", name))`. Evidence: `E5`.
28. **`ORM-V2-28` (GORM - Dynamic `db.Order()`)**: `db.Order(r.URL.Query().Get("sort"))`. Evidence: `E5`.

### Ecosystem 8: Rust
29. **`ORM-V2-29` (Diesel - `dsl::sql()`)**: `users.filter(diesel::dsl::sql(&format!("name = '{}'", name)))`. Evidence: `E5`.
30. **`ORM-V2-30` (SQLx - `sqlx::query()` with `format!()`)**: `sqlx::query(&format!("SELECT * FROM users WHERE id = {}", id))`. Evidence: `E5`.

### Ecosystem 9 & 10: Elixir & Scala
31. **`ORM-V2-31` (Ecto - `fragment()`)**: `from(u in User, where: fragment(^"name = '#{name}'"))`. Evidence: `E5`.
32. **`ORM-V2-32` (Slick - `sql"#$...".as[...]`)**: String interpolation with `#$` performs direct string substitution. Evidence: `E5`.
