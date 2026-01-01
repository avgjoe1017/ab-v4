# Data Strategy Migration Guide

**Date**: 2025-01-30  
**Purpose**: Add data strategy models to Prisma schema

## Migration Steps

### 1. Generate Prisma Migration

```bash
cd apps/api
pnpm prisma migrate dev --name add_data_strategy_models
```

This will:
- Create a new migration file in `prisma/migrations/`
- Apply the migration to your database
- Regenerate the Prisma client

### 2. Verify Migration

After migration, verify the new tables exist:

```bash
pnpm prisma studio
```

Or check via SQL:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Consent%' OR name LIKE '%Memory%' OR name LIKE '%Intent%' OR name LIKE '%Efficacy%';
```

### 3. Seed Initial Data (Optional)

If you want to seed initial intent taxonomy nodes:

```typescript
// Create a seed script or run via Prisma Studio
// Example intent taxonomy nodes:
- confidence.work (parent: null, sensitivity: low)
- anxiety.calm (parent: null, sensitivity: medium)
- sleep.rest (parent: null, sensitivity: low)
- focus.concentration (parent: null, sensitivity: low)
- self_love.acceptance (parent: null, sensitivity: medium)
```

### 4. Environment Variables

Add to `.env`:

```bash
# Debug cache encryption key (change in production!)
DEBUG_CACHE_ENCRYPTION_KEY=your-secret-key-here-change-in-production
```

### 5. Test Endpoints

Test the new endpoints:

```bash
# Get event catalog
curl http://localhost:8787/admin/data-strategy/event-catalog

# Get cold start rules
curl http://localhost:8787/admin/data-strategy/cold-start-rules

# Get reason codes
curl http://localhost:8787/admin/data-strategy/reason-codes
```

## Rollback

If you need to rollback:

```bash
cd apps/api
pnpm prisma migrate reset
```

**Warning**: This will delete all data. Use `migrate down` if you need to preserve data.

## Notes

- All new models are optional (nullable foreign keys where appropriate)
- Existing functionality is not affected
- Data strategy services fail gracefully if database models don't exist yet
- Integration points in `v4-chat.ts` and `index.ts` are wrapped in try-catch to prevent failures
