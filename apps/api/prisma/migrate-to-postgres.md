# Database Migration: SQLite → Postgres

**Phase 6.2**: Migrate from SQLite to Postgres (Supabase/Neon)

---

## Prerequisites

1. Supabase account and project created
2. Postgres database URL available
3. Local SQLite database backed up

---

## Migration Steps

### 1. Update Environment Variables

Add to `.env`:
```bash
# Old (SQLite)
# DATABASE_URL="file:./dev.db"

# New (Postgres)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

### 2. Update Prisma Schema (if needed)

Most SQLite schemas are compatible with Postgres, but check for:
- `@db.Text` vs `String` - Postgres handles both
- `@default(uuid())` - Works in Postgres
- Indexes - Should work as-is

### 3. Create Migration Script

Run the migration script:
```bash
bun apps/api/prisma/migrate-to-postgres.ts
```

This will:
1. Connect to both SQLite and Postgres
2. Read all data from SQLite
3. Write data to Postgres
4. Verify data integrity

### 4. Run Prisma Migrations

```bash
cd apps/api
pnpm prisma migrate deploy
```

### 5. Verify Migration

- Check row counts match
- Test a few queries
- Verify foreign key relationships

---

## Data Migration Script

See `apps/api/prisma/migrate-to-postgres.ts` (to be created)

---

## Rollback Plan

If migration fails:
1. Keep SQLite database as backup
2. Revert `DATABASE_URL` environment variable
3. Restart API server

---

## Post-Migration

- Update connection pooling settings
- Set up database backups
- Monitor performance
- Update documentation

