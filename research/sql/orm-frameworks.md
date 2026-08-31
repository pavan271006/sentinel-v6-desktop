# ORM, Query-Builder & Modern Framework SQL Injection Patterns

**Document Identifier:** SENTINEL-RES-ORM-09  
**Classification:** Application Framework Security & Source-Assisted Analysis  
**Ecosystems Covered:** Node.js, Python, Java, .NET, Ruby, PHP  

---

## 1. The ORM Security Paradox

Object-Relational Mapping (ORM) frameworks automatically parameterize standard CRUD operations (e.g. `User.findById(id)`). However, developers frequently encounter complex queries requiring **raw escape hatches**, dynamic column sorting, or custom SQL fragments. In these scenarios, developers often assume the ORM provides magic protection, resulting in critical SQL injection vulnerabilities.

```
                              ORM SECURITY TOPOLOGY
                                        │
    ┌───────────────────────────────────┼───────────────────────────────────┐
    ▼                                   ▼                                   ▼
[ Safe Parameterized Path ]     [ Raw Escape Hatches ]              [ Dynamic Identifiers ]
User.find({ id: req.body.id })  User.where("id = " + req.body.id)   .orderBy(req.query.sortField)
(Lexically Safe)                (CRITICAL VULNERABILITY)            (ORDER BY INJECTION)
```

---

## 2. Framework-Specific Anti-Patterns & Vulnerabilities

| Framework | Language | Dangerous API / Anti-Pattern | Vulnerability Mechanism |
|:---|:---|:---|:---|
| **TypeORM / Knex** | TypeScript / Node.js | `createQueryBuilder().where("user.name = " + name)`<br>`orderBy(req.query.sort)` | String interpolation in raw where clause; unquoted dynamic `ORDER BY` field. |
| **Sequelize** | JavaScript / Node.js | `Sequelize.literal(req.body.field)`<br>`order: [Sequelize.fn(...)]` | `Sequelize.literal()` inserts raw SQL without escaping; bypasses parameter bindings. |
| **Prisma** | TypeScript | `prisma.$queryRawUnsafe(\`SELECT * FROM User WHERE name = '${name}'\`)` | Developer mistakenly invokes `$queryRawUnsafe` instead of tagged template `$queryRaw`. |
| **Django ORM** | Python | `User.objects.extra(where=["name = '%s'" % name])`<br>`User.objects.raw(...)` | `.extra()` and `.raw()` accept unparameterized strings if formatting is used improperly. |
| **SQLAlchemy** | Python | `session.query(User).filter(text("name = " + name))` | `text()` constructs a raw SQL construct that allows direct injection unless `.bindparams()` is used. |
| **ActiveRecord** | Ruby on Rails | `User.where("name = '#{params[:name]}'")`<br>`User.order(params[:sort])` | Ruby string interpolation `#{}` evaluates before ActiveRecord parameterization. |
| **Hibernate / JPA** | Java | `session.createQuery("FROM User WHERE name = '" + name + "'")` | HQL / JPQL injection allows executing arbitrary subqueries and database functions. |
| **Entity Framework** | C# / .NET | `context.Database.ExecuteSqlRaw("SELECT * FROM Users WHERE Name = '" + name + "'")` | `ExecuteSqlRaw` string concatenation bypasses EF Core parameterization. |

---

## 3. High-Risk ORM Attack Vectors for DAST Scanners

1. **`ORDER BY` Sort Parameter**: The single most common ORM SQL injection vulnerability in modern web apps. Developers bind the `WHERE` clause safely but interpolate `req.query.sortBy` directly into `.orderBy()`.
2. **JSON Key Path Injection**: PostgreSQL JSONB operators in TypeORM or Sequelize (`where: { metadata: { path: req.query.key } }`) interpolating JSON keys directly into `->` or `->>` operators.
3. **Array Object Injections**: In Express/Node.js, passing `{ "id": { "$ne": null } }` or `{ "id": [1, 2] }` may cause dynamic query builders to alter relational predicates unexpectedly.
