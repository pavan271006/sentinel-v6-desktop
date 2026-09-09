import { describe, it, expect } from 'vitest';
import { OrmRemediationEngine } from './engine/OrmRemediationEngine';

describe('OrmRemediationEngine — Multi-Language 1-Click Code Patches', () => {
  it('generates 14 framework-specific parameterized query patches for target parameters', () => {
    const remediations = OrmRemediationEngine.getRemediation('search_query', 'PostgreSQL');
    expect(remediations.length).toBeGreaterThanOrEqual(14);

    const prismaPatch = remediations.find((r) => r.id === 'prisma');
    expect(prismaPatch).toBeDefined();
    expect(prismaPatch?.remediatedCode).toContain('prisma.$queryRaw`');
    expect(prismaPatch?.remediatedCode).toContain('search_query');
    expect(prismaPatch?.diffExplanation).toContain('search_query');

    const djangoPatch = remediations.find((r) => r.id === 'django');
    expect(djangoPatch).toBeDefined();
    expect(djangoPatch?.remediatedCode).toContain('User.objects.filter(username=search_query)');

    const efPatch = remediations.find((r) => r.id === 'ef_core');
    expect(efPatch).toBeDefined();
    expect(efPatch?.remediatedCode).toContain('FromSqlInterpolated');

    const gormPatch = remediations.find((r) => r.id === 'gorm');
    expect(gormPatch).toBeDefined();
    expect(gormPatch?.remediatedCode).toContain('db.Where("name = ?", search_query)');

    const pdoPatch = remediations.find((r) => r.id === 'php_pdo');
    expect(pdoPatch).toBeDefined();
    expect(pdoPatch?.remediatedCode).toContain(':email');

    const rustPatch = remediations.find((r) => r.id === 'rust_sqlx');
    expect(rustPatch).toBeDefined();
    expect(rustPatch?.remediatedCode).toContain('sqlx::query!');
  });

  it('retrieves individual patch by ID cleanly', () => {
    const patch = OrmRemediationEngine.getPatchById('sqlalchemy', 'user_id', 'MySQL');
    expect(patch).toBeDefined();
    expect(patch?.frameworkName).toBe('SQLAlchemy 2.0');
    expect(patch?.remediatedCode).toContain('{"name": user_id}');
  });
});
